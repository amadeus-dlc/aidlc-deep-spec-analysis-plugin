// Report finalization（Workflow 1）の永続化契約。
//
// ここで固定するのは 5 点：schema は合成ルートで一度だけ読まれ同じ値が候補と
// cross-check の両方を適合させること、処理失敗が `verified` に化けないこと、
// 同一ディレクトリの writer が待機なしで直列化されること、各 JSON が temp +
// rename でしか公開されないこと、そして load 後に兄弟が変わっていたら公開を
// 中止して stale な cross-check を残さないこと。functional-spec の Failure
// Matrix 9 行は fault injection で再現し、Public backend / Public cross-check /
// Outcome の 3 列を実測する。
//
// 時計と PID liveness probe は注入する（実時間を待たない）。並行 writer は
// 同一プロセス内で interleave させる（実プロセスは起動しない）——注入した時計
// の読み出し点が、stale rename と canonical 再取得のあいだの割り込み点になる。

import { describe, expect, test } from "bun:test";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProcessLiveness } from "@deep-spec/kernel-adapter";
import { DirectoryFinalizationLock, readContractSchema } from "@deep-spec/kernel-adapter";
import { ArtifactPath, FindingsSchema } from "@deep-spec/kernel-domain";
import type { Clock, RepositoryError } from "@deep-spec/kernel-usecase";
import type { Result } from "@deep-spec/kernel-infrastructure";
import {
  DesignFindings,
  DesignModelIdentifier,
  DesignReport,
  DesignReportIdentifier,
  DesignSkips,
  DesignVerifyDirectory,
  type DesignModel,
} from "@deep-spec/design-domain";
import {
  DesignModelRepositoryImplementation,
  DesignVerifyDirectoryRepositoryImplementation,
  renderDesignReportBytes,
} from "@deep-spec/design-adapter";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(pluginRoot, "src", "entries", "data");
const schemaPath = join(dataDir, "deep-spec-findings-schema.json");
const fixtures = join(pluginRoot, "tests", "fixtures", "design");
const LOCK_BASENAME = ".deep-spec-design-finalization.lock";
const STALE_CROSS_CHECK = ".cross-check.stale";

// テスト用: 検証済みパス VO の短縮構築（fixture パスは常に非空）。
function ap(raw: string): ArtifactPath {
  const parsed = ArtifactPath.parse(raw);
  if (!parsed.ok) throw new Error(`test fixture path is empty: ${raw}`);
  return parsed.value;
}

// 注入する時計。read 回数で hook を撃てる——これが同一プロセス内で並行 writer
// を割り込ませる唯一の seam（実時間は 1 ミリ秒も待たない）。
class StubClock implements Clock {
  #nowMs: number;
  #reads = 0;
  readonly #hooks: Map<number, () => void> = new Map();

  constructor(nowMs: number) {
    this.#nowMs = nowMs;
  }

  now(): number {
    this.#reads += 1;
    const hook = this.#hooks.get(this.#reads);
    if (hook !== undefined) {
      this.#hooks.delete(this.#reads);
      hook();
    }
    return this.#nowMs;
  }

  advance(ms: number): void {
    this.#nowMs += ms;
  }

  onRead(nth: number, hook: () => void): void {
    this.#hooks.set(nth, hook);
  }

  reads(): number {
    return this.#reads;
  }
}

// 注入する PID liveness probe。probe 回数も数える（待機・再試行の不在の証拠）。
class StubLiveness implements ProcessLiveness {
  readonly #self: number;
  #status: "alive" | "absent" | "unknown";
  #probes = 0;

  constructor(self: number, status: "alive" | "absent" | "unknown" = "alive") {
    this.#self = self;
    this.#status = status;
  }

  self(): number {
    return this.#self;
  }

  statusOf(_pid: number): "alive" | "absent" | "unknown" {
    this.#probes += 1;
    return this.#status;
  }

  reports(status: "alive" | "absent" | "unknown"): void {
    this.#status = status;
  }

  probes(): number {
    return this.#probes;
  }
}

// 公開直前の fencing を落とす lock（allowed 回だけ所有を認める）。
class FencedLock extends DirectoryFinalizationLock {
  #allowed: number;
  #afterLast: (() => void) | null;

  constructor(clock: Clock, liveness: ProcessLiveness, allowed: number, afterLast: (() => void) | null = null) {
    super(clock, liveness);
    this.#allowed = allowed;
    this.#afterLast = afterLast;
  }

  override holdsOwnership(directory: ArtifactPath): boolean {
    if (this.#allowed <= 0) return false;
    this.#allowed -= 1;
    const held = super.holdsOwnership(directory);
    const after = this.#afterLast;
    if (this.#allowed === 0 && after !== null) {
      this.#afterLast = null;
      after();
    }
    return held;
  }
}

// 契約2 のスキーマを合成ルート相当で 1 度だけ読む（entry と同じ形）。
function schemaOf(path: string): FindingsSchema {
  const file = readContractSchema(path);
  return file.ok ? FindingsSchema.of(file.value) : FindingsSchema.unreadable(file.error.cause);
}

interface Workspace {
  readonly record: string;
  readonly verifyDir: string;
  readonly model: DesignModel;
}

function makeWorkspace(): Workspace {
  const record = mkdtempSync(join(tmpdir(), "design-finalization-"));
  cpSync(join(fixtures, "record"), record, { recursive: true });
  const stageDir = join(record, "construction", "deep-spec-analysis-functional-verify");
  const verifyDir = join(stageDir, "deep-spec-design-verify");
  mkdirSync(verifyDir, { recursive: true });
  const acquired = new DesignModelRepositoryImplementation().findById(
    DesignModelIdentifier.of(ap(join(stageDir, "deep-spec-analysis-functional-formal-model.md"))),
  );
  if (!acquired.ok) throw new Error("design fixture model is unreadable");
  return { record, verifyDir, model: acquired.value };
}

function candidate(verifyDir: string, backend: string, model: DesignModel, method = "exhaustive"): DesignReport {
  return DesignReport.compose({
    id: DesignReportIdentifier.of(ap(verifyDir), backend),
    irVersion: model.irVersion(),
    irHash: model.irHash(),
    method,
    findings: DesignFindings.of([]),
    skipped: DesignSkips.of([]),
  });
}

function lockOf(clock: Clock, liveness: ProcessLiveness): DirectoryFinalizationLock {
  return new DirectoryFinalizationLock(clock, liveness);
}

function tempEntries(verifyDir: string): string[] {
  return readdirSync(verifyDir).filter((f) => f.includes(".tmp-"));
}

// 集約を「候補を置き、適合させ、クロスチェックを導き、もう一度適合させる」まで
// 組む（Finalizer と同じ順序——公開経路はこの形しか通らない）。model が無い
// ときは導けない cross-check を不在にする（IR unreadable 経路）。
function finalizing(
  repository: DesignVerifyDirectoryRepositoryImplementation,
  verifyDir: string,
  report: DesignReport,
  schema: FindingsSchema,
  model: DesignModel | null,
): DesignVerifyDirectory {
  const loaded = repository.findByDirectory(ap(verifyDir));
  if (!loaded.ok) throw new Error(`test setup: the verify directory is unreadable (${loaded.error.kind})`);
  return loaded.value.finalizedWith(report, model, schema);
}

// 兄弟文書の作り置き（fixture seed）。公開経路は store だけなので、seed も
// 集約ひとつぶんとして通す——クロスチェックは導かない。
function seed(
  repository: DesignVerifyDirectoryRepositoryImplementation,
  verifyDir: string,
  report: DesignReport,
  schema: FindingsSchema,
): Result<void, RepositoryError> {
  return repository.store(finalizing(repository, verifyDir, report, schema, null));
}

function publishedOf(aggregate: DesignVerifyDirectory): DesignReport {
  const published = aggregate.candidate();
  if (published === null) throw new Error("test setup: the aggregate carries no candidate");
  return published;
}

function crossCheckOf(aggregate: DesignVerifyDirectory): DesignReport {
  const cross = aggregate.crossCheck();
  if (cross === null) throw new Error("test setup: the aggregate carries no cross-check");
  return cross;
}

// --- #6 schema は合成ルートで一度だけ読まれる（FR1.2、BR1.1）----------------

describe("schema conformance is carried by one value per finalization", () => {
  test("the same FindingsSchema conforms both the candidate and the cross-check", () => {
    const ws = makeWorkspace();
    const schemaCopy = join(ws.record, "findings-schema.json");
    cpSync(schemaPath, schemaCopy);
    try {
      const repository = new DesignVerifyDirectoryRepositoryImplementation();
      // 合成ルートの読込はここ 1 回だけ（Repository はスキーマパスを持たない）。
      const schema = schemaOf(schemaCopy);
      const report = candidate(ws.verifyDir, "smt", ws.model);

      // 値を作ったあとに schema が消えても、保存文書はその値から導かれる。
      rmSync(schemaCopy);
      const aggregate = finalizing(repository, ws.verifyDir, report, schema, ws.model);
      expect(repository.store(aggregate).ok).toBe(true);
      expect(publishedOf(aggregate).isUnavailable()).toBe(false);
      expect(crossCheckOf(aggregate).isUnavailable()).toBe(false);
      expect(readFileSync(join(ws.verifyDir, "smt.json"), "utf-8")).toBe(renderDesignReportBytes(publishedOf(aggregate)));
      expect(readFileSync(join(ws.verifyDir, "cross-check.json"), "utf-8")).toBe(renderDesignReportBytes(crossCheckOf(aggregate)));

      // 対照：同じ path をいま読む値は「読めない」変種になり、両文書を降格させる。
      const unreadable = finalizing(repository, ws.verifyDir, report, schemaOf(schemaCopy), ws.model);
      expect(publishedOf(unreadable).unavailableReason()).toStartWith("findings schema unreadable: ");
      expect(crossCheckOf(unreadable).unavailableReason()).toStartWith("findings schema unreadable: ");
    } finally {
      rmSync(ws.record, { recursive: true, force: true });
    }
  });
});

// --- #7/#8 失敗は verified にならない（FR1.3、BR1.2）------------------------

describe("finalization failures never become a success", () => {
  test("an unreadable sibling stops the finalization before any public file changes", () => {
    const ws = makeWorkspace();
    const quintPath = join(ws.verifyDir, "quint.json");
    const crossPath = join(ws.verifyDir, "cross-check.json");
    try {
      const repository = new DesignVerifyDirectoryRepositoryImplementation();
      const schema = schemaOf(schemaPath);
      expect(seed(repository, ws.verifyDir, candidate(ws.verifyDir, "quint", ws.model), schema).ok).toBe(true);
      writeFileSync(join(ws.verifyDir, "smt.json"), "{ \"backend\": \"smt\" }\n", "utf-8");
      writeFileSync(crossPath, "{ \"backend\": \"cross-check\", \"irHash\": \"stale\" }\n", "utf-8");
      const backendBefore = readFileSync(join(ws.verifyDir, "smt.json"), "utf-8");
      const crossBefore = readFileSync(crossPath, "utf-8");

      chmodSync(quintPath, 0o000);
      // 読めない兄弟を黙って除かない：集約の解決そのものが型のある失敗になる。
      const loaded = repository.findByDirectory(ap(ws.verifyDir));
      chmodSync(quintPath, 0o644);

      expect(loaded.ok).toBe(false);
      if (!loaded.ok) expect(loaded.error.kind).toBe("corrupt");
      // Failure Matrix 行 4: old / old / save-failed。
      expect(readFileSync(join(ws.verifyDir, "smt.json"), "utf-8")).toBe(backendBefore);
      expect(readFileSync(crossPath, "utf-8")).toBe(crossBefore);
      expect(existsSync(join(ws.verifyDir, LOCK_BASENAME))).toBe(false);
    } finally {
      if (existsSync(quintPath)) chmodSync(quintPath, 0o644);
      rmSync(ws.record, { recursive: true, force: true });
    }
  });

  test("a sibling that becomes unreadable after the load stops the store", () => {
    const ws = makeWorkspace();
    const quintPath = join(ws.verifyDir, "quint.json");
    try {
      const repository = new DesignVerifyDirectoryRepositoryImplementation();
      const schema = schemaOf(schemaPath);
      expect(seed(repository, ws.verifyDir, candidate(ws.verifyDir, "quint", ws.model), schema).ok).toBe(true);
      const aggregate = finalizing(repository, ws.verifyDir, candidate(ws.verifyDir, "smt", ws.model), schema, ws.model);

      chmodSync(quintPath, 0o000);
      const stored = repository.store(aggregate);
      chmodSync(quintPath, 0o644);

      expect(stored.ok).toBe(false);
      if (!stored.ok) expect(stored.error.kind).toBe("corrupt");
      expect(existsSync(join(ws.verifyDir, "smt.json"))).toBe(false);
      expect(existsSync(join(ws.verifyDir, "cross-check.json"))).toBe(false);
      expect(existsSync(join(ws.verifyDir, LOCK_BASENAME))).toBe(false);
    } finally {
      if (existsSync(quintPath)) chmodSync(quintPath, 0o644);
      rmSync(ws.record, { recursive: true, force: true });
    }
  });

  test("a backend write failure leaves the previous backend intact and no cross-check", () => {
    const ws = makeWorkspace();
    try {
      const repository = new DesignVerifyDirectoryRepositoryImplementation();
      const schema = schemaOf(schemaPath);
      expect(seed(repository, ws.verifyDir, candidate(ws.verifyDir, "smt", ws.model), schema).ok).toBe(true);
      const crossPath = join(ws.verifyDir, "cross-check.json");
      writeFileSync(crossPath, "{ \"backend\": \"cross-check\", \"irHash\": \"stale\" }\n", "utf-8");
      const backendBefore = readFileSync(join(ws.verifyDir, "smt.json"), "utf-8");

      // stale 退避のあと、backend 公開の直前でディレクトリを書込不可にする。
      const lock = new FencedLock(new StubClock(1_000), new StubLiveness(4242), 2, () => {
        chmodSync(ws.verifyDir, 0o500);
      });
      const fenced = new DesignVerifyDirectoryRepositoryImplementation(lock);
      const stored = fenced.store(finalizing(repository, ws.verifyDir, candidate(ws.verifyDir, "smt", ws.model), schema, ws.model));
      chmodSync(ws.verifyDir, 0o755);

      expect(stored.ok).toBe(false);
      // Failure Matrix 行 6: old backend / absent cross-check / save-failed。
      expect(readFileSync(join(ws.verifyDir, "smt.json"), "utf-8")).toBe(backendBefore);
      expect(existsSync(crossPath)).toBe(false);
      expect(tempEntries(ws.verifyDir)).toEqual([]);
    } finally {
      chmodSync(ws.verifyDir, 0o755);
      rmSync(ws.record, { recursive: true, force: true });
    }
  });

  test("a failed stale rename publishes nothing", () => {
    const ws = makeWorkspace();
    try {
      const repository = new DesignVerifyDirectoryRepositoryImplementation();
      const schema = schemaOf(schemaPath);
      expect(seed(repository, ws.verifyDir, candidate(ws.verifyDir, "smt", ws.model), schema).ok).toBe(true);
      const crossPath = join(ws.verifyDir, "cross-check.json");
      writeFileSync(crossPath, "{ \"backend\": \"cross-check\", \"irHash\": \"stale\" }\n", "utf-8");
      const backendBefore = readFileSync(join(ws.verifyDir, "smt.json"), "utf-8");
      const crossBefore = readFileSync(crossPath, "utf-8");
      const aggregate = finalizing(repository, ws.verifyDir, candidate(ws.verifyDir, "smt", ws.model), schema, ws.model);
      // stale 名をディレクトリで塞ぐ——rename は必ず失敗する。
      mkdirSync(join(ws.verifyDir, STALE_CROSS_CHECK));

      const stored = repository.store(aggregate);

      expect(stored.ok).toBe(false);
      // Failure Matrix 行 5: old / old / save-failed。
      expect(readFileSync(join(ws.verifyDir, "smt.json"), "utf-8")).toBe(backendBefore);
      expect(readFileSync(crossPath, "utf-8")).toBe(crossBefore);
    } finally {
      rmSync(ws.record, { recursive: true, force: true });
    }
  });
});

// --- #9/#10 非待機取得と lease 回復（FR2.5、BR2.1／BR2.6）-------------------

describe("directory lock serialises writers without waiting", () => {
  test("a live lock is contended immediately and an independent directory is unaffected", () => {
    const ws = makeWorkspace();
    const other = join(ws.record, "construction", "other-verify");
    mkdirSync(other, { recursive: true });
    try {
      const holderLiveness = new StubLiveness(4242);
      const holder = lockOf(new StubClock(1_000), holderLiveness);
      expect(holder.acquire(ap(ws.verifyDir)).kind).toBe("acquired");

      const contenderLiveness = new StubLiveness(4243);
      const contenderClock = new StubClock(1_000);
      const contender = lockOf(contenderClock, contenderLiveness);
      const blocked = contender.acquire(ap(ws.verifyDir));
      expect(blocked.kind).toBe("lock-contended");
      // 待機も再試行もしない：lease 内なので probe すら引かず、時計は
      // 「create 直前の 1 回」と「lease 比較の 1 回」だけ読む。
      expect(contenderLiveness.probes()).toBe(0);
      expect(contenderClock.reads()).toBe(2);
      // 独立ディレクトリの writer は影響を受けない。
      expect(contender.acquire(ap(other)).kind).toBe("acquired");
      expect(holder.holdsOwnership(ap(ws.verifyDir))).toBe(true);
    } finally {
      rmSync(ws.record, { recursive: true, force: true });
    }
  });

  test("a live owner is never displaced, even paused well past the lease", () => {
    const ws = makeWorkspace();
    try {
      const holder = lockOf(new StubClock(1_000), new StubLiveness(4242));
      expect(holder.acquire(ap(ws.verifyDir)).kind).toBe("acquired");

      const clock = new StubClock(1_000);
      const liveness = new StubLiveness(4243, "alive");
      const contender = lockOf(clock, liveness);
      clock.advance(120_000); // lease（30 秒）を大きく超えて停止している。
      const alive = contender.acquire(ap(ws.verifyDir));
      expect(alive.kind).toBe("lock-contended");
      expect(liveness.probes()).toBe(1);

      // 権限などで判定できない場合も奪わない（不明を不在へ丸めない）。
      liveness.reports("unknown");
      expect(contender.acquire(ap(ws.verifyDir)).kind).toBe("lock-contended");
      expect(holder.holdsOwnership(ap(ws.verifyDir))).toBe(true);
    } finally {
      rmSync(ws.record, { recursive: true, force: true });
    }
  });

  test("an expired lease with a definitely absent owner is recovered", () => {
    const ws = makeWorkspace();
    try {
      const holder = lockOf(new StubClock(1_000), new StubLiveness(4242));
      expect(holder.acquire(ap(ws.verifyDir)).kind).toBe("acquired");
      const displaced = holder.ownerTokenOf(ap(ws.verifyDir));

      const clock = new StubClock(1_000);
      const contender = lockOf(clock, new StubLiveness(4243, "absent"));
      clock.advance(30_001);
      const recovered = contender.acquire(ap(ws.verifyDir));

      expect(recovered.kind).toBe("recovered");
      if (recovered.kind === "recovered") expect(recovered.displacedToken).toBe(displaced ?? "");
      expect(contender.holdsOwnership(ap(ws.verifyDir))).toBe(true);
      expect(holder.holdsOwnership(ap(ws.verifyDir))).toBe(false);
      // 自分が作った stale path だけを掃除して残さない。
      expect(readdirSync(ws.verifyDir).filter((f) => f.includes(".stale."))).toEqual([]);
    } finally {
      rmSync(ws.record, { recursive: true, force: true });
    }
  });
});

// --- #11 回復競合と publish 直前の fencing（FR2.5、BR2.6）-------------------

describe("at most one canonical owner survives a recovery race", () => {
  test("the writer that loses the exclusive create after its stale rename stands down", () => {
    const ws = makeWorkspace();
    try {
      const holder = lockOf(new StubClock(1_000), new StubLiveness(4242));
      expect(holder.acquire(ap(ws.verifyDir)).kind).toBe("acquired");

      const winner = lockOf(new StubClock(60_000), new StubLiveness(4244, "absent"));
      const loserClock = new StubClock(1_000);
      const loser = lockOf(loserClock, new StubLiveness(4243, "absent"));
      loserClock.advance(30_001);
      // 3 回目の時計読み出し = stale rename の直後・canonical 再取得の直前。
      // そこで別 writer に canonical を取らせる（同一プロセス内の interleave）。
      let winnerOutcome = "not-run";
      loserClock.onRead(3, () => {
        winnerOutcome = winner.acquire(ap(ws.verifyDir)).kind;
      });
      const lost = loser.acquire(ap(ws.verifyDir));

      expect(winnerOutcome).toBe("acquired");
      expect(lost.kind).toBe("lock-recovery-failed");
      expect(winner.holdsOwnership(ap(ws.verifyDir))).toBe(true);
      expect(loser.holdsOwnership(ap(ws.verifyDir))).toBe(false);
      expect(existsSync(join(ws.verifyDir, LOCK_BASENAME))).toBe(true);
      // 負けた writer は自分の stale path だけを掃除し、canonical へは触れない。
      expect(readdirSync(ws.verifyDir).filter((f) => f.includes(".stale."))).toEqual([]);
    } finally {
      rmSync(ws.record, { recursive: true, force: true });
    }
  });

  test("each publication is fenced by the current owner token", () => {
    for (const allowed of [0, 1, 2]) {
      const ws = makeWorkspace();
      try {
        const seeding = new DesignVerifyDirectoryRepositoryImplementation();
        const schema = schemaOf(schemaPath);
        // 旧 backend は method が違う——公開が起きたかを bytes で判定するため。
        expect(seed(seeding, ws.verifyDir, candidate(ws.verifyDir, "smt", ws.model, "simulation"), schema).ok).toBe(true);
        const crossPath = join(ws.verifyDir, "cross-check.json");
        writeFileSync(crossPath, "{ \"backend\": \"cross-check\", \"irHash\": \"stale\" }\n", "utf-8");
        const backendBefore = readFileSync(join(ws.verifyDir, "smt.json"), "utf-8");
        const crossBefore = readFileSync(crossPath, "utf-8");

        const aggregate = finalizing(seeding, ws.verifyDir, candidate(ws.verifyDir, "smt", ws.model), schema, ws.model);
        const lock = new FencedLock(new StubClock(1_000), new StubLiveness(4242), allowed);
        const stored = new DesignVerifyDirectoryRepositoryImplementation(lock).store(aggregate);

        expect(stored.ok).toBe(false);
        if (allowed === 0) {
          // Failure Matrix 行 4: 無効化にも入らない——old / old。
          expect(readFileSync(crossPath, "utf-8")).toBe(crossBefore);
          expect(readFileSync(join(ws.verifyDir, "smt.json"), "utf-8")).toBe(backendBefore);
        }
        if (allowed === 1) {
          // Failure Matrix 行 6: old backend / absent cross-check。
          expect(readFileSync(join(ws.verifyDir, "smt.json"), "utf-8")).toBe(backendBefore);
          expect(existsSync(crossPath)).toBe(false);
        }
        if (allowed === 2) {
          // Failure Matrix 行 7: new backend / absent cross-check。
          expect(readFileSync(join(ws.verifyDir, "smt.json"), "utf-8")).not.toBe(backendBefore);
          expect(existsSync(crossPath)).toBe(false);
        }
        expect(tempEntries(ws.verifyDir)).toEqual([]);
      } finally {
        rmSync(ws.record, { recursive: true, force: true });
      }
    }
  });
});

// --- Failure Matrix の取得系 2 行を Repository 水準でも実測する ------------

describe("a finalization that cannot take the lock changes nothing", () => {
  test("a live lock and a lost recovery race both leave both documents untouched", () => {
    for (const scenario of ["live", "recovery-race"] as const) {
      const ws = makeWorkspace();
      try {
        const seeding = new DesignVerifyDirectoryRepositoryImplementation();
        const schema = schemaOf(schemaPath);
        expect(seed(seeding, ws.verifyDir, candidate(ws.verifyDir, "smt", ws.model, "simulation"), schema).ok).toBe(true);
        const crossPath = join(ws.verifyDir, "cross-check.json");
        writeFileSync(crossPath, "{ \"backend\": \"cross-check\", \"irHash\": \"stale\" }\n", "utf-8");
        const backendBefore = readFileSync(join(ws.verifyDir, "smt.json"), "utf-8");
        const crossBefore = readFileSync(crossPath, "utf-8");
        const aggregate = finalizing(seeding, ws.verifyDir, candidate(ws.verifyDir, "smt", ws.model), schema, ws.model);

        const holder = lockOf(new StubClock(1_000), new StubLiveness(4242));
        expect(holder.acquire(ap(ws.verifyDir)).kind).toBe("acquired");

        const clock = new StubClock(1_000);
        const liveness = new StubLiveness(4243, scenario === "live" ? "alive" : "absent");
        if (scenario === "recovery-race") {
          clock.advance(30_001);
          const winner = lockOf(new StubClock(60_000), new StubLiveness(4244, "absent"));
          clock.onRead(3, () => {
            expect(winner.acquire(ap(ws.verifyDir)).kind).toBe("acquired");
          });
        }
        const stored = new DesignVerifyDirectoryRepositoryImplementation(lockOf(clock, liveness)).store(aggregate);

        // Failure Matrix 行 1・2: old / old / save-failed。
        expect(stored.ok).toBe(false);
        if (!stored.ok) {
          expect(stored.error.kind).toBe("io-failed");
          const cause = "cause" in stored.error ? stored.error.cause : "";
          expect(cause.startsWith(scenario === "live" ? "lock-contended" : "lock-recovery-failed")).toBe(true);
        }
        expect(readFileSync(join(ws.verifyDir, "smt.json"), "utf-8")).toBe(backendBefore);
        expect(readFileSync(crossPath, "utf-8")).toBe(crossBefore);
        expect(existsSync(join(ws.verifyDir, STALE_CROSS_CHECK))).toBe(false);
      } finally {
        rmSync(ws.record, { recursive: true, force: true });
      }
    }
  });
});

// --- #12 temp + rename の公開（FR2.1、BR2.3）--------------------------------

describe("every JSON document is published by rename, never in place", () => {
  test("both documents are replaced atomically and leave no temporary bytes", () => {
    const ws = makeWorkspace();
    try {
      const repository = new DesignVerifyDirectoryRepositoryImplementation();
      const schema = schemaOf(schemaPath);
      expect(seed(repository, ws.verifyDir, candidate(ws.verifyDir, "quint", ws.model), schema).ok).toBe(true);
      expect(seed(repository, ws.verifyDir, candidate(ws.verifyDir, "smt", ws.model), schema).ok).toBe(true);
      const backendPath = join(ws.verifyDir, "smt.json");
      const crossPath = join(ws.verifyDir, "cross-check.json");
      writeFileSync(crossPath, "{ \"backend\": \"cross-check\", \"irHash\": \"stale\" }\n", "utf-8");
      const backendInode = statSync(backendPath).ino;
      const crossInode = statSync(crossPath).ino;

      const aggregate = finalizing(repository, ws.verifyDir, candidate(ws.verifyDir, "smt", ws.model), schema, ws.model);
      expect(repository.store(aggregate).ok).toBe(true);

      // 置換であって上書きではない（同一 inode への書込みは truncate を伴う）。
      expect(statSync(backendPath).ino).not.toBe(backendInode);
      expect(statSync(crossPath).ino).not.toBe(crossInode);
      expect(readFileSync(backendPath, "utf-8")).toBe(renderDesignReportBytes(publishedOf(aggregate)));
      expect(tempEntries(ws.verifyDir)).toEqual([]);
      expect(existsSync(join(ws.verifyDir, STALE_CROSS_CHECK))).toBe(false);
      expect(existsSync(join(ws.verifyDir, LOCK_BASENAME))).toBe(false);
      expect(readdirSync(ws.verifyDir).filter((f) => f.includes(".cleanup."))).toEqual([]);
    } finally {
      rmSync(ws.record, { recursive: true, force: true });
    }
  });
});

// --- #13 古い cross-check は採用も復元もされない（FR2.3、BR2.2／BR2.5）------

describe("a stale cross-check is never taken for the latest result", () => {
  test("the published cross-check is rebuilt from the sibling set observed under the lock", () => {
    const ws = makeWorkspace();
    try {
      const repository = new DesignVerifyDirectoryRepositoryImplementation();
      const schema = schemaOf(schemaPath);
      expect(seed(repository, ws.verifyDir, candidate(ws.verifyDir, "quint", ws.model), schema).ok).toBe(true);
      const crossPath = join(ws.verifyDir, "cross-check.json");
      writeFileSync(crossPath, "{ \"backend\": \"cross-check\", \"irHash\": \"stale-and-wrong\" }\n", "utf-8");

      expect(repository.store(finalizing(repository, ws.verifyDir, candidate(ws.verifyDir, "smt", ws.model), schema, ws.model)).ok).toBe(true);

      const published = JSON.parse(readFileSync(crossPath, "utf-8")) as { [k: string]: unknown };
      expect(published.backend).toBe("cross-check");
      expect(published.irHash).toBe(ws.model.irHash().asString());
      // 兄弟集合は lock の中で観測した quint + candidate smt の 2 件。
      expect(Array.isArray(published.crossChecked)).toBe(true);
      const compared = (published.crossChecked as { backend: string }[]).map((e) => e.backend).sort();
      expect(compared).toEqual(["quint", "smt"]);
    } finally {
      rmSync(ws.record, { recursive: true, force: true });
    }
  });

  test("the old cross-check is not restored once the new backend is public", () => {
    const ws = makeWorkspace();
    try {
      const seeding = new DesignVerifyDirectoryRepositoryImplementation();
      const schema = schemaOf(schemaPath);
      expect(seed(seeding, ws.verifyDir, candidate(ws.verifyDir, "smt", ws.model), schema).ok).toBe(true);
      const crossPath = join(ws.verifyDir, "cross-check.json");
      const stale = "{ \"backend\": \"cross-check\", \"irHash\": \"stale-and-wrong\" }\n";
      writeFileSync(crossPath, stale, "utf-8");

      // 3 回目の fencing まで通し、cross-check 公開の直前で所有を失わせる。
      const aggregate = finalizing(seeding, ws.verifyDir, candidate(ws.verifyDir, "smt", ws.model), schema, ws.model);
      const lock = new FencedLock(new StubClock(1_000), new StubLiveness(4242), 2);
      expect(new DesignVerifyDirectoryRepositoryImplementation(lock).store(aggregate).ok).toBe(false);

      // 欠落を許容する——古い cross-check を最新として戻さない（BR2.5）。
      expect(existsSync(crossPath)).toBe(false);
      // 退避先は `*.json` ではないので兄弟列挙にもクロスチェックにも現れない。
      expect(readFileSync(join(ws.verifyDir, STALE_CROSS_CHECK), "utf-8")).toBe(stale);
      const reloaded = seeding.findByDirectory(ap(ws.verifyDir));
      expect(reloaded.ok).toBe(true);
      if (reloaded.ok) {
        expect(reloaded.value.reports().toArray().map((r) => r.id().fileName())).toEqual(["smt.json"]);
        expect(reloaded.value.crossCheck()).toBe(null);
      }
    } finally {
      rmSync(ws.record, { recursive: true, force: true });
    }
  });

  test("a sibling set that changed after the load stops the store and keeps the stale cross-check unpublished", () => {
    for (const scenario of ["changed", "added"] as const) {
      const ws = makeWorkspace();
      try {
        const repository = new DesignVerifyDirectoryRepositoryImplementation();
        const schema = schemaOf(schemaPath);
        expect(seed(repository, ws.verifyDir, candidate(ws.verifyDir, "quint", ws.model), schema).ok).toBe(true);
        const crossPath = join(ws.verifyDir, "cross-check.json");
        const stale = "{ \"backend\": \"cross-check\", \"irHash\": \"stale-and-wrong\" }\n";
        writeFileSync(crossPath, stale, "utf-8");

        // load の時点の兄弟集合でクロスチェックを導く。
        const aggregate = finalizing(repository, ws.verifyDir, candidate(ws.verifyDir, "smt", ws.model), schema, ws.model);
        // その後で別 writer が兄弟を差し替える／増やす。
        if (scenario === "changed") {
          writeFileSync(join(ws.verifyDir, "quint.json"), renderDesignReportBytes(candidate(ws.verifyDir, "quint", ws.model, "simulation")), "utf-8");
        } else {
          writeFileSync(join(ws.verifyDir, "alt.json"), renderDesignReportBytes(candidate(ws.verifyDir, "alt", ws.model)), "utf-8");
        }
        const stored = repository.store(aggregate);

        // 古い兄弟集合から導いたクロスチェックを最新として公開しない。
        expect(stored.ok).toBe(false);
        if (!stored.ok) {
          expect(stored.error.kind).toBe("io-failed");
          expect("cause" in stored.error ? stored.error.cause : "").toBe("conflict: sibling set changed since load");
        }
        expect(readFileSync(crossPath, "utf-8")).toBe(stale);
        expect(existsSync(join(ws.verifyDir, "smt.json"))).toBe(false);
        expect(existsSync(join(ws.verifyDir, STALE_CROSS_CHECK))).toBe(false);
        expect(existsSync(join(ws.verifyDir, LOCK_BASENAME))).toBe(false);
      } finally {
        rmSync(ws.record, { recursive: true, force: true });
      }
    }
  });
});

// --- Failure Matrix の解放系 2 行（Workflow 1 の 14）-------------------------

describe("release failures are reported without touching a successor's lock", () => {
  test("losing ownership before the cleanup rename leaves the canonical lock in place", () => {
    const ws = makeWorkspace();
    try {
      const stolen = new StubClock(1_000);
      const lock = new FencedLock(stolen, new StubLiveness(4242), 3, () => {
        // cross-check 公開の直前に canonical metadata を別 owner のものにする。
        writeFileSync(
          join(ws.verifyDir, LOCK_BASENAME, "owner.lockmeta"),
          `${JSON.stringify({ state: "held", token: "0".repeat(32), pid: 9999, acquiredAtMs: 1000, leaseExpiresAtMs: 31000 })}\n`,
          "utf-8",
        );
      });
      const schema = schemaOf(schemaPath);
      const aggregate = finalizing(new DesignVerifyDirectoryRepositoryImplementation(), ws.verifyDir, candidate(ws.verifyDir, "smt", ws.model), schema, ws.model);
      const stored = new DesignVerifyDirectoryRepositoryImplementation(lock).store(aggregate);

      // Failure Matrix 行 8: new / new / cleanup 失敗。canonical lock は残る。
      expect(stored.ok).toBe(false);
      if (!stored.ok) expect(stored.error.kind).toBe("io-failed");
      expect(readFileSync(join(ws.verifyDir, "smt.json"), "utf-8")).toBe(renderDesignReportBytes(publishedOf(aggregate)));
      expect(existsSync(join(ws.verifyDir, "cross-check.json"))).toBe(true);
      expect(existsSync(join(ws.verifyDir, LOCK_BASENAME))).toBe(true);
    } finally {
      rmSync(ws.record, { recursive: true, force: true });
    }
  });

  test("a cleanup path that cannot be removed still frees the canonical lock", () => {
    const ws = makeWorkspace();
    const canonical = join(ws.verifyDir, LOCK_BASENAME);
    try {
      const lock = new FencedLock(new StubClock(1_000), new StubLiveness(4242), 3, () => {
        // owner 固有 cleanup path の削除だけを塞ぐ（rename は成功する）。
        chmodSync(canonical, 0o500);
      });
      const schema = schemaOf(schemaPath);
      const aggregate = finalizing(new DesignVerifyDirectoryRepositoryImplementation(), ws.verifyDir, candidate(ws.verifyDir, "smt", ws.model), schema, ws.model);
      const stored = new DesignVerifyDirectoryRepositoryImplementation(lock).store(aggregate);

      // Failure Matrix 行 9: new / new / cleanup 失敗。canonical は空いている。
      expect(stored.ok).toBe(false);
      expect(readFileSync(join(ws.verifyDir, "smt.json"), "utf-8")).toBe(renderDesignReportBytes(publishedOf(aggregate)));
      expect(existsSync(join(ws.verifyDir, "cross-check.json"))).toBe(true);
      expect(existsSync(canonical)).toBe(false);
      const leftovers = readdirSync(ws.verifyDir).filter((f) => f.includes(".cleanup."));
      expect(leftovers.length).toBe(1);
      // 後続 writer は canonical を取得できる。
      const successor = lockOf(new StubClock(2_000), new StubLiveness(4243));
      expect(successor.acquire(ap(ws.verifyDir)).kind).toBe("acquired");
    } finally {
      for (const entry of readdirSync(ws.verifyDir)) {
        if (entry.includes(".cleanup.") || entry === LOCK_BASENAME) chmodSync(join(ws.verifyDir, entry), 0o755);
      }
      rmSync(ws.record, { recursive: true, force: true });
    }
  });
});
