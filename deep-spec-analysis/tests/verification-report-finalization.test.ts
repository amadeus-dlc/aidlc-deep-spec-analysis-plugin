// 要件検証の Report finalization の永続化契約（設計側 design-report-finalization
// と同型の契約を requirements の語彙で固定する）。
//
// ここで固定するのは 6 点：schema は合成ルートで一度だけ読まれ同じ値が候補と
// cross-check の両方を適合させること、兄弟が読めないときに verified へ抜けない
// こと、保存そのものが失敗したら verified へ抜けないこと、同一ディレクトリの
// writer が待機なしで直列化されること、load 後に兄弟が変わっていたら公開を
// 中止すること、そして古い cross-check を最新として公開・復元しないこと。
//
// 時計と PID liveness probe は注入する（実時間を待たない）。並行 writer は
// 同一プロセス内で interleave させる（実プロセスは起動しない）。

import { describe, expect, test } from "bun:test";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProcessLiveness } from "@deep-spec/kernel-adapter";
import { DirectoryFinalizationLock, readContractSchema } from "@deep-spec/kernel-adapter";
import { ArtifactPath, FindingsSchema } from "@deep-spec/kernel-domain";
import type { Clock, RepositoryError } from "@deep-spec/kernel-usecase";
import type { Result } from "@deep-spec/kernel-infrastructure";
import {
  FormalModelIdentifier,
  type RequirementsModel,
  VerificationDirectory,
  VerificationFindings,
  VerificationReport,
  VerificationReportIdentifier,
  VerificationSkips,
} from "@deep-spec/requirements-domain";
import {
  FormalModelRepositoryImplementation,
  VERIFICATION_LOCK_BASENAME,
  VerificationDirectoryRepositoryImplementation,
  renderVerificationReportBytes,
} from "@deep-spec/requirements-adapter";
import { VerificationReportFinalizer } from "@deep-spec/requirements-usecase";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = join(pluginRoot, "src", "entries", "data", "deep-spec-findings-schema.json");
const fixtures = join(pluginRoot, "tests", "fixtures", "conformance");
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

  reads(): number {
    return this.#reads;
  }
}

// 注入する PID liveness probe。probe 回数も数える（待機・再試行の不在の証拠）。
class StubLiveness implements ProcessLiveness {
  readonly #self: number;
  readonly #status: "alive" | "absent" | "unknown";
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

  probes(): number {
    return this.#probes;
  }
}

// 保存だけを失敗させる Repository。取得は本物に委ねる——「保存に失敗したら
// verified へ抜けない」を Finalizer の水準で撃つための継ぎ目。
class FailingStore extends VerificationDirectoryRepositoryImplementation {
  readonly #failure: RepositoryError;

  constructor(failure: RepositoryError) {
    super();
    this.#failure = failure;
  }

  override store(_aggregate: VerificationDirectory): Result<void, RepositoryError> {
    return { ok: false, error: this.#failure };
  }
}

function lockOf(clock: Clock, liveness: ProcessLiveness): DirectoryFinalizationLock {
  return new DirectoryFinalizationLock(clock, liveness, VERIFICATION_LOCK_BASENAME);
}

// 契約2 のスキーマを合成ルート相当で 1 度だけ読む（entry と同じ形）。
function schemaOf(path: string): FindingsSchema {
  const file = readContractSchema(path);
  return file.ok ? FindingsSchema.of(file.value) : FindingsSchema.unreadable(file.error.cause);
}

interface Workspace {
  readonly record: string;
  readonly verifyDir: string;
  readonly model: RequirementsModel;
}

function makeWorkspace(): Workspace {
  const record = mkdtempSync(join(tmpdir(), "verification-finalization-"));
  const modelPath = join(record, "deep-spec-analysis-formal-model.md");
  cpSync(join(fixtures, "deep-spec-analysis-formal-model.md"), modelPath);
  const verifyDir = join(record, "deep-spec-verify");
  mkdirSync(verifyDir, { recursive: true });
  const acquired = new FormalModelRepositoryImplementation().findById(FormalModelIdentifier.of(ap(modelPath)));
  if (!acquired.ok) throw new Error("the requirements fixture model is unreadable");
  return { record, verifyDir, model: acquired.value };
}

function candidate(verifyDir: string, backend: string, model: RequirementsModel, method = "exhaustive"): VerificationReport {
  return VerificationReport.compose({
    id: VerificationReportIdentifier.of(ap(verifyDir), backend),
    irVersion: model.irVersion(),
    irHash: model.irHash(),
    method,
    findings: VerificationFindings.of([]),
    skipped: VerificationSkips.of([]),
  });
}

function tempEntries(verifyDir: string): string[] {
  return readdirSync(verifyDir).filter((f) => f.includes(".tmp-"));
}

// 兄弟文書の作り置き（fixture seed）。公開経路は Finalizer だけなので、seed も
// 同じ経路を通す——クロスチェックは導かない（IR unreadable 経路と同じ形）。
function seed(
  repository: VerificationDirectoryRepositoryImplementation,
  report: VerificationReport,
  schema: FindingsSchema,
): Result<void, RepositoryError> {
  return new VerificationReportFinalizer(repository, schema).finalizeIrUnreadable(report);
}

// --- #1 schema は合成ルートで一度だけ読まれる ------------------------------

describe("契約2 の適合は finalization ごとに 1 つの値が運ぶ", () => {
  test("同じ FindingsSchema が候補と cross-check の両方を適合させる", () => {
    const ws = makeWorkspace();
    const schemaCopy = join(ws.record, "findings-schema.json");
    cpSync(schemaPath, schemaCopy);
    try {
      const repository = new VerificationDirectoryRepositoryImplementation();
      // 合成ルートの読込はここ 1 回だけ（Repository はスキーマパスを持たない）。
      const schema = schemaOf(schemaCopy);
      const report = candidate(ws.verifyDir, "smt", ws.model);

      // 値を作ったあとに schema が消えても、保存文書はその値から導かれる。
      rmSync(schemaCopy);
      const finalized = new VerificationReportFinalizer(repository, schema).finalize(report, ws.model);
      expect(finalized.ok).toBe(true);
      if (!finalized.ok) throw new Error("the finalization must succeed");
      expect(finalized.value.isUnavailable()).toBe(false);
      expect(readFileSync(join(ws.verifyDir, "smt.json"), "utf-8")).toBe(renderVerificationReportBytes(finalized.value));

      const published = repository.findByDirectory(ap(ws.verifyDir));
      expect(published.ok).toBe(true);
      if (published.ok) expect(published.value.crossCheck()?.isUnavailable()).toBe(false);

      // 対照：同じ path をいま読む値は「読めない」変種になり、両文書を降格させる。
      const degraded = new VerificationReportFinalizer(repository, schemaOf(schemaCopy)).finalize(report, ws.model);
      expect(degraded.ok && degraded.value.unavailableReason()).toStartWith("findings schema unreadable: ");
      const reloaded = repository.findByDirectory(ap(ws.verifyDir));
      expect(reloaded.ok && reloaded.value.crossCheck()?.unavailableReason()).toStartWith("findings schema unreadable: ");
    } finally {
      rmSync(ws.record, { recursive: true, force: true });
    }
  });
});

// --- #2/#3 失敗は verified にならない --------------------------------------

describe("finalization の失敗は成功に化けない", () => {
  test("読めない兄弟は集約の解決そのものを型のある失敗にし、公開ファイルを変えない", () => {
    const ws = makeWorkspace();
    const quintPath = join(ws.verifyDir, "quint.json");
    const crossPath = join(ws.verifyDir, "cross-check.json");
    try {
      const repository = new VerificationDirectoryRepositoryImplementation();
      const schema = schemaOf(schemaPath);
      expect(seed(repository, candidate(ws.verifyDir, "quint", ws.model), schema).ok).toBe(true);
      writeFileSync(crossPath, '{ "backend": "cross-check", "irHash": "stale" }\n', "utf-8");
      const quintBefore = readFileSync(quintPath, "utf-8");
      const crossBefore = readFileSync(crossPath, "utf-8");

      chmodSync(quintPath, 0o000);
      // 読めない兄弟を黙って除かない：finalization は型のある失敗として終わる。
      const finalized = new VerificationReportFinalizer(repository, schema)
        .finalize(candidate(ws.verifyDir, "smt", ws.model), ws.model);
      chmodSync(quintPath, 0o644);

      expect(finalized.ok).toBe(false);
      if (!finalized.ok) expect(finalized.error.kind).toBe("corrupt");
      expect(existsSync(join(ws.verifyDir, "smt.json"))).toBe(false);
      expect(readFileSync(quintPath, "utf-8")).toBe(quintBefore);
      expect(readFileSync(crossPath, "utf-8")).toBe(crossBefore);
      expect(existsSync(join(ws.verifyDir, VERIFICATION_LOCK_BASENAME))).toBe(false);
    } finally {
      if (existsSync(quintPath)) chmodSync(quintPath, 0o644);
      rmSync(ws.record, { recursive: true, force: true });
    }
  });

  test("保存に失敗した finalization は verdict を返さない", () => {
    const ws = makeWorkspace();
    try {
      const failure: RepositoryError = {
        kind: "io-failed",
        operation: "write",
        path: join(ws.verifyDir, "cross-check.json"),
        cause: "the finalization seam failed",
      };
      const finalizer = new VerificationReportFinalizer(new FailingStore(failure), schemaOf(schemaPath));
      const report = candidate(ws.verifyDir, "smt", ws.model);

      expect(finalizer.finalize(report, ws.model)).toEqual({ ok: false, error: failure });
      // IR 不成立の経路（cross-check を導けない側）も同じ継ぎ目で失敗する。
      expect(finalizer.finalizeIrUnreadable(VerificationReport.irUnreadable(report.id(), "exhaustive", "IR is not a JSON object")))
        .toEqual({ ok: false, error: failure });
      expect(readdirSync(ws.verifyDir)).toEqual([]);
    } finally {
      rmSync(ws.record, { recursive: true, force: true });
    }
  });
});

// --- #4 非待機の直列化 ------------------------------------------------------

describe("ディレクトリ lock は writer を待機なしで直列化する", () => {
  test("生存中の lock は即座に競合になり、独立ディレクトリは影響を受けない", () => {
    const ws = makeWorkspace();
    const other = join(ws.record, "other-verify");
    mkdirSync(other, { recursive: true });
    try {
      const holder = lockOf(new StubClock(1_000), new StubLiveness(4242));
      expect(holder.acquire(ap(ws.verifyDir)).kind).toBe("acquired");
      // lock の名前は要件コンテキストのもの（設計とは取り違えない）。
      expect(existsSync(join(ws.verifyDir, VERIFICATION_LOCK_BASENAME))).toBe(true);

      const contenderLiveness = new StubLiveness(4243);
      const contenderClock = new StubClock(1_000);
      const contender = lockOf(contenderClock, contenderLiveness);
      expect(contender.acquire(ap(ws.verifyDir)).kind).toBe("lock-contended");
      // 待機も再試行もしない：lease 内なので probe すら引かない。
      expect(contenderLiveness.probes()).toBe(0);
      expect(contenderClock.reads()).toBe(2);
      expect(contender.acquire(ap(other)).kind).toBe("acquired");

      // その lock を握ったまま store すれば、公開は 1 バイトも起きない。
      const repository = new VerificationDirectoryRepositoryImplementation();
      const schema = schemaOf(schemaPath);
      const loaded = repository.findByDirectory(ap(ws.verifyDir));
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) throw new Error("the verify directory must resolve");
      const aggregate = loaded.value
        .finalizing(candidate(ws.verifyDir, "smt", ws.model))
        .conformedTo(schema)
        .crossChecked(ws.model, ws.model.irHash())
        .conformedTo(schema);
      const blocked = new VerificationDirectoryRepositoryImplementation(lockOf(new StubClock(1_000), new StubLiveness(4243))).store(aggregate);
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) {
        expect(blocked.error.kind).toBe("io-failed");
        expect("cause" in blocked.error ? blocked.error.cause : "").toStartWith("lock-contended");
      }
      expect(existsSync(join(ws.verifyDir, "smt.json"))).toBe(false);
      expect(existsSync(join(ws.verifyDir, "cross-check.json"))).toBe(false);
    } finally {
      rmSync(ws.record, { recursive: true, force: true });
    }
  });
});

// --- #5 load 後の兄弟変更 ---------------------------------------------------

describe("load 後に兄弟が変わったら公開しない", () => {
  test("兄弟の差し替え・追加はどちらも store を止め、古い cross-check を残す", () => {
    for (const scenario of ["changed", "added"] as const) {
      const ws = makeWorkspace();
      try {
        const repository = new VerificationDirectoryRepositoryImplementation();
        const schema = schemaOf(schemaPath);
        expect(seed(repository, candidate(ws.verifyDir, "quint", ws.model), schema).ok).toBe(true);
        const crossPath = join(ws.verifyDir, "cross-check.json");
        const stale = '{ "backend": "cross-check", "irHash": "stale-and-wrong" }\n';
        writeFileSync(crossPath, stale, "utf-8");

        // load の時点の兄弟集合でクロスチェックを導く。
        const loaded = repository.findByDirectory(ap(ws.verifyDir));
        expect(loaded.ok).toBe(true);
        if (!loaded.ok) throw new Error("the verify directory must resolve");
        const aggregate = loaded.value
          .finalizing(candidate(ws.verifyDir, "smt", ws.model))
          .conformedTo(schema)
          .crossChecked(ws.model, ws.model.irHash())
          .conformedTo(schema);
        // その後で別 writer が兄弟を差し替える／増やす。
        if (scenario === "changed") {
          writeFileSync(join(ws.verifyDir, "quint.json"), renderVerificationReportBytes(candidate(ws.verifyDir, "quint", ws.model, "simulation")), "utf-8");
        } else {
          writeFileSync(join(ws.verifyDir, "alt.json"), renderVerificationReportBytes(candidate(ws.verifyDir, "alt", ws.model)), "utf-8");
        }
        const stored = repository.store(aggregate);

        expect(stored.ok).toBe(false);
        if (!stored.ok) {
          expect(stored.error.kind).toBe("io-failed");
          expect("cause" in stored.error ? stored.error.cause : "").toBe("conflict: sibling set changed since load");
        }
        expect(readFileSync(crossPath, "utf-8")).toBe(stale);
        expect(existsSync(join(ws.verifyDir, "smt.json"))).toBe(false);
        expect(existsSync(join(ws.verifyDir, STALE_CROSS_CHECK))).toBe(false);
        expect(existsSync(join(ws.verifyDir, VERIFICATION_LOCK_BASENAME))).toBe(false);
      } finally {
        rmSync(ws.record, { recursive: true, force: true });
      }
    }
  });
});

// --- #6 古い cross-check は採用も復元もされない -----------------------------

describe("古い cross-check を最新として扱わない", () => {
  test("公開される cross-check は lock の中で観測した兄弟集合から組み直される", () => {
    const ws = makeWorkspace();
    try {
      const repository = new VerificationDirectoryRepositoryImplementation();
      const schema = schemaOf(schemaPath);
      expect(seed(repository, candidate(ws.verifyDir, "quint", ws.model), schema).ok).toBe(true);
      const crossPath = join(ws.verifyDir, "cross-check.json");
      writeFileSync(crossPath, '{ "backend": "cross-check", "irHash": "stale-and-wrong" }\n', "utf-8");

      const finalized = new VerificationReportFinalizer(repository, schema)
        .finalize(candidate(ws.verifyDir, "smt", ws.model), ws.model);
      expect(finalized.ok).toBe(true);

      const published = JSON.parse(readFileSync(crossPath, "utf-8")) as { [k: string]: unknown };
      expect(published.backend).toBe("cross-check");
      expect(published.irHash).toBe(ws.model.irHash().asString());
      // 兄弟集合は lock の中で観測した quint + candidate smt の 2 件。
      expect(Array.isArray(published.crossChecked)).toBe(true);
      const compared = (published.crossChecked as { backend: string }[]).map((e) => e.backend).sort();
      expect(compared).toEqual(["quint", "smt"]);
      expect(tempEntries(ws.verifyDir)).toEqual([]);
      expect(existsSync(join(ws.verifyDir, STALE_CROSS_CHECK))).toBe(false);
    } finally {
      rmSync(ws.record, { recursive: true, force: true });
    }
  });

  test("IR が読めない実行は、導けない cross-check を stale のまま残さない", () => {
    const ws = makeWorkspace();
    try {
      const repository = new VerificationDirectoryRepositoryImplementation();
      const schema = schemaOf(schemaPath);
      const finalizer = new VerificationReportFinalizer(repository, schema);
      expect(finalizer.finalize(candidate(ws.verifyDir, "smt", ws.model), ws.model).ok).toBe(true);
      const crossPath = join(ws.verifyDir, "cross-check.json");
      expect(existsSync(crossPath)).toBe(true);

      // 次の実行で IR が読めなくなった——導けないクロスチェックは不在にする。
      const unreadable = VerificationReport.irUnreadable(
        VerificationReportIdentifier.of(ap(ws.verifyDir), "smt"),
        "exhaustive",
        "IR is not a JSON object",
      );
      expect(finalizer.finalizeIrUnreadable(unreadable).ok).toBe(true);
      expect(existsSync(crossPath)).toBe(false);
      expect(existsSync(join(ws.verifyDir, STALE_CROSS_CHECK))).toBe(false);
      const reloaded = repository.findByDirectory(ap(ws.verifyDir));
      expect(reloaded.ok).toBe(true);
      if (reloaded.ok) {
        expect(reloaded.value.reports().toArray().map((r) => r.id().fileName())).toEqual(["smt.json"]);
        expect(reloaded.value.crossCheck()).toBe(null);
      }
    } finally {
      rmSync(ws.record, { recursive: true, force: true });
    }
  });
});
