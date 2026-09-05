// 共通 usecase 協力（Workflow 5）の契約テスト（#14）。
//
// ここで固定するのは 3 点：report finalization の実装が 1 か所であること
// （その 1 か所を変えると SMT／Quint の両方が同じ結果になる）、取得境界が
// 5 つの terminal 変種だけを返すこと（compile-time の never 検査 ＋ table
// test）、そして兄弟 report が読めないときに `verified` を返さないこと
// （FR1.4——旧挙動の「黙って成功」の廃止）。
//
// backend 固有の timeout・probe・solver 判定の非退行は既存スイート
// （design-verify / design-pipeline / refinement-pipeline / verify-*-pipeline）
// が担う。ここでは兄弟 backend を stub にして実ソルバーを起動しない。

import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ArtifactPath, FindingsSchema, VerificationMethod } from "@deep-spec/kernel-domain";
import { type Result, err, ok } from "@deep-spec/kernel-infrastructure";
import type { Clock, RepositoryError } from "@deep-spec/kernel-usecase";
import { readContractSchema } from "@deep-spec/kernel-adapter";
import {
  DesignReports,
  DesignVerifyDirectory,
  RefinementMaterials,
  type DesignModel,
  DesignModelId,
  DesignReportId,
  type RefinementMaterialsId,
} from "@deep-spec/design-domain";
import { DesignModelRepositoryImpl, DesignVerifyDirectoryRepositoryImpl } from "@deep-spec/design-adapter";
import {
  DesignReportFinalizer,
  DesignVerificationAcquirer,
  VerifyDesignQuintUseCase,
  VerifyDesignSmtUseCase,
  type DesignAcquisitionTerminal,
  type DesignModelRepository,
  type DesignVerifyDirectoryRepository,
  type ReachabilityProbe,
  type RefinementCheck,
  type RefinementMaterialsRepository,
  type RefinementSolverClient,
  type SiblingBackendClient,
  type SiblingLoweredRun,
  type VerifyDesignOutcome,
} from "@deep-spec/design-usecase";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = join(pluginRoot, "src", "entries", "data", "deep-spec-findings-schema.json");
// 契約2 のスキーマは合成ルート相当のここで一度だけ読む（entry と同じ形）。
const schemaFile = readContractSchema(schemaPath);
const contractSchema = schemaFile.ok ? FindingsSchema.of(schemaFile.value) : FindingsSchema.unreadable(schemaFile.error.cause);
const fixtureModelPath = join(
  pluginRoot,
  "tests",
  "fixtures",
  "design",
  "record",
  "construction",
  "deep-spec-analysis-functional-verify",
  "deep-spec-analysis-functional-formal-model.md",
);

// テスト用: 検証済みパス VO の短縮構築（fixture パスは常に非空）。
function ap(raw: string): ArtifactPath {
  const parsed = ArtifactPath.parse(raw);
  if (!parsed.ok) throw new Error(`test fixture path is empty: ${raw}`);
  return parsed.value;
}

function fixtureModel(): DesignModel {
  const acquired = new DesignModelRepositoryImpl().findById(DesignModelId.of(ap(fixtureModelPath)));
  if (!acquired.ok) throw new Error("design fixture model is unreadable");
  return acquired.value;
}

// major を 2 へ差し替えた同じ fixture（unit を保つので適合前 skip 数が非ゼロ）。
function unsupportedMajorModel(directory: string): DesignModel {
  const path = join(directory, "deep-spec-analysis-functional-formal-model.md");
  writeFileSync(path, readFileSync(fixtureModelPath, "utf-8").replace('"irVersion": "1.0.0"', '"irVersion": "2.0.0"'));
  const acquired = new DesignModelRepositoryImpl().findById(DesignModelId.of(ap(path)));
  if (!acquired.ok) throw new Error("the version-mismatch fixture is unreadable");
  return acquired.value;
}

// 初期 method は strict な門から作る（Workflow 2——正常生成は閉集合を通る）。
function strictMethod(raw: string): VerificationMethod {
  const parsed = VerificationMethod.parse(raw);
  if (!parsed.ok) throw new Error(`test setup: "${raw}" is not a verification method`);
  return parsed.value;
}

function reportIdOf(directory: ArtifactPath): DesignReportId {
  return DesignReportId.of(directory, "smt");
}

function targetCount(model: DesignModel): number {
  return model.units().toArray().reduce((n, u) => n + [...u.allTargets()].length, 0);
}

// --- 注入する協力者 ---------------------------------------------------------

class FixedClock implements Clock {
  now(): number {
    return 1_700_000_000_000;
  }
}

// findings 文書を返さない兄弟——全対象が unavailable skip になり、実ソルバーを
// 起動しないまま組成〜finalization まで到達する。
class StubSiblingBackendClient implements SiblingBackendClient {
  runLowered(): SiblingLoweredRun {
    return { exit: 0, doc: null, note: "stub sibling produced no findings document" };
  }

  probeState(): ReachabilityProbe {
    return { kind: "failed" };
  }
}

class InactiveMaterialsRepository implements RefinementMaterialsRepository {
  findById(id: RefinementMaterialsId): Result<RefinementMaterials, RepositoryError> {
    return ok(RefinementMaterials.inactive(id));
  }
}

class UnusedSolverClient implements RefinementSolverClient {
  check(): RefinementCheck {
    throw new Error("the refinement solver must not run while the materials are inactive");
  }
}

class StubModelRepository implements DesignModelRepository {
  readonly #result: Result<DesignModel, RepositoryError>;

  constructor(result: Result<DesignModel, RepositoryError>) {
    this.#result = result;
  }

  findById(): Result<DesignModel, RepositoryError> {
    return this.#result;
  }

  store(): Result<void, RepositoryError> {
    return ok(undefined);
  }
}

// finalization の継ぎ目を 1 か所に持つ Repository double。集約は空の
// ディレクトリとして解決し、保存された集約を順に記録する。失敗はこの 1 か所
// からだけ注入する。クロスチェックを伴う finalization と伴わない
// finalization の区別は、保存された集約が cross-check を持つかで読む——
// Repository のメソッド変種ではなく集約の可変部が語る（オーナー裁定 2026-09-04）。
class SeamRepository implements DesignVerifyDirectoryRepository {
  readonly storedAggregates: DesignVerifyDirectory[] = [];
  readonly #failure: RepositoryError | null;

  constructor(failure: RepositoryError | null = null) {
    this.#failure = failure;
  }

  findByDirectory(directory: ArtifactPath): Result<DesignVerifyDirectory, RepositoryError> {
    return ok(DesignVerifyDirectory.of(directory, DesignReports.of([]), null));
  }

  store(aggregate: DesignVerifyDirectory): Result<void, RepositoryError> {
    this.storedAggregates.push(aggregate);
    return this.#failure === null ? ok(undefined) : err(this.#failure);
  }

  // 導けなかった cross-check を伴わない finalization（IR unreadable 経路）。
  withoutCrossCheck(): DesignVerifyDirectory[] {
    return this.storedAggregates.filter((a) => a.crossCheck() === null);
  }

  // 両文書 finalization。
  withCrossCheck(): DesignVerifyDirectory[] {
    return this.storedAggregates.filter((a) => a.crossCheck() !== null);
  }

  fileNamesFinalized(): string[] {
    return this.withCrossCheck().map((a) => a.candidate()?.id().fileName() ?? "");
  }
}

function runSmt(reports: DesignVerifyDirectoryRepository, verifyDir: string, schema: FindingsSchema = contractSchema, modelPath = fixtureModelPath): VerifyDesignOutcome {
  return new VerifyDesignSmtUseCase(
    new DesignModelRepositoryImpl(),
    reports,
    schema,
    new StubSiblingBackendClient(),
    new InactiveMaterialsRepository(),
    new UnusedSolverClient(),
    new FixedClock(),
  ).execute({ modelId: DesignModelId.of(ap(modelPath)), verifyDirectory: ap(verifyDir) });
}

function runQuint(reports: DesignVerifyDirectoryRepository, verifyDir: string, schema: FindingsSchema = contractSchema, modelPath = fixtureModelPath): VerifyDesignOutcome {
  return new VerifyDesignQuintUseCase(
    new DesignModelRepositoryImpl(),
    reports,
    schema,
    new StubSiblingBackendClient(),
    new InactiveMaterialsRepository(),
    new FixedClock(),
    2,
  ).execute({ modelId: DesignModelId.of(ap(modelPath)), verifyDirectory: ap(verifyDir) });
}

// --- #14 共通 finalization は 1 実装 ----------------------------------------

describe("#14 report finalization は 1 実装——1 か所の変更が両 backend へ届く", () => {
  test("継ぎ目の失敗も成功も、SMT と Quint に同じ形で現れる", () => {
    const verifyDir = "/design-usecase-collaboration/deep-spec-design-verify";
    const failure: RepositoryError = {
      kind: "io-failed",
      operation: "write",
      path: `${verifyDir}/cross-check.json`,
      cause: "the shared finalization seam failed",
    };

    const failing = new SeamRepository(failure);
    expect(runSmt(failing, verifyDir)).toEqual({ kind: "save-failed", error: failure });
    expect(runQuint(failing, verifyDir)).toEqual({ kind: "save-failed", error: failure });
    // 失敗した finalization は自文書も公開していない（cross-check 無し経路へ落ちない）。
    expect(failing.withoutCrossCheck()).toEqual([]);

    // 同じ継ぎ目を成功へ変えると、両 backend がそろって verified になる。
    const succeeding = new SeamRepository(null);
    const smt = runSmt(succeeding, verifyDir);
    const quint = runQuint(succeeding, verifyDir);
    expect(smt.kind).toBe("verified");
    expect(quint.kind).toBe("verified");
    expect(succeeding.fileNamesFinalized()).toEqual(["smt.json", "quint.json"]);
    expect(succeeding.withoutCrossCheck()).toEqual([]);
    // 適合は集約ごとに 1 度（BR1.1）——保存された 2 つの集約はどちらも適合済み
    // で、読めるスキーマなので降格していない。
    expect(succeeding.storedAggregates.length).toBe(2);
    expect(succeeding.storedAggregates.map((a) => a.candidate()?.isUnavailable())).toEqual([false, false]);
  });

  test("store が受け取る集約の候補は適合済みで、同じ値が cross-check も適合させる", () => {
    const verifyDir = "/design-usecase-collaboration/deep-spec-design-verify";
    // 適合が文書を書き換える場合でも、保存されるのは適合済みのその集約。
    const marked = new SeamRepository(null);
    expect(runSmt(marked, verifyDir, FindingsSchema.unreadable("boom")).kind).toBe("verified");
    expect(marked.storedAggregates.length).toBe(1);
    const aggregate = marked.storedAggregates[0];
    expect(aggregate?.candidate()?.unavailableReason()).toBe("findings schema unreadable: boom");
    // 同じ 1 つの FindingsSchema が cross-check にも及ぶ（適合先は 2 文書）。
    expect(aggregate?.crossCheck()?.unavailableReason()).toBe("findings schema unreadable: boom");
    // 集約の中の兄弟集合にも適合済みの候補が入っている（cross-check の導出元）。
    expect(aggregate?.reports().toArray().map((r) => r.isUnavailable())).toEqual([true]);
  });

  test("verdict は適合済み report から導かれ、永続化に成功したときだけ返る", () => {
    const verifyDir = "/design-usecase-collaboration/deep-spec-design-verify";
    const outcome = runSmt(new SeamRepository(null), verifyDir, FindingsSchema.unreadable("contract 2 schema is unreadable"));
    expect(outcome).toEqual({ kind: "verified", pass: false, findingsCount: 0, skippedCount: 0, method: "exhaustive" });
  });
});

// --- 取得境界の閉じた結果（compile-time ＋ table） ---------------------------

type IsNever<T> = [T] extends [never] ? true : false;

// Acquirer は成功も backend 固有 outcome も返せない——型で証明する。
const noVerifiedInTerminal: IsNever<Extract<DesignAcquisitionTerminal, { kind: "verified" }>> = true;
const noBackendUnavailableInTerminal: IsNever<Extract<DesignAcquisitionTerminal, { kind: "backend-unavailable" }>> = true;
// terminal はちょうど 5 変種（増えても減っても、この 2 行の型が壊れる）。
const noExtraTerminalKind: IsNever<
  Exclude<DesignAcquisitionTerminal["kind"], "not-applicable" | "acquisition-failed" | "model-unreadable" | "version-mismatch" | "save-failed">
> = true;
const noMissingTerminalKind: IsNever<
  Exclude<"not-applicable" | "acquisition-failed" | "model-unreadable" | "version-mismatch" | "save-failed", DesignAcquisitionTerminal["kind"]>
> = true;

describe("DesignVerificationAcquirer は取得専用の 5 変種へ結果を閉じる", () => {
  test("compile-time の never 検査：成功と backend 固有 outcome は terminal に入らない", () => {
    expect(noVerifiedInTerminal).toBe(true);
    expect(noBackendUnavailableInTerminal).toBe(true);
    expect(noExtraTerminalKind).toBe(true);
    expect(noMissingTerminalKind).toBe(true);
  });

  test("5 つの terminal 変種を網羅する（table）", () => {
    const workspace = mkdtempSync(join(tmpdir(), "design-acquisition-"));
    try {
      const verifyDir = ap(join(workspace, "deep-spec-design-verify"));
      const mismatched = unsupportedMajorModel(workspace);
      const saveFailure: RepositoryError = { kind: "io-failed", operation: "write", path: "smt.json", cause: "disk is full" };
      const method = "exhaustive";

      const rows: readonly {
        readonly name: string;
        readonly model: Result<DesignModel, RepositoryError>;
        readonly failure: RepositoryError | null;
        readonly expected: DesignAcquisitionTerminal["kind"];
      }[] = [
        { name: "不在は not-applicable", model: err({ kind: "not-found", path: "model.md" }), failure: null, expected: "not-applicable" },
        {
          name: "I/O 失敗は acquisition-failed",
          model: err({ kind: "io-failed", operation: "read", path: "model.md", cause: "permission denied" }),
          failure: null,
          expected: "acquisition-failed",
        },
        {
          name: "読めない入力は保存に成功すれば model-unreadable",
          model: err({ kind: "corrupt", path: "model.md", cause: "formal model does not contain exactly one readable ```json fence" }),
          failure: null,
          expected: "model-unreadable",
        },
        {
          name: "読めない入力は保存に失敗すれば save-failed",
          model: err({ kind: "corrupt", path: "model.md", cause: "formal model does not contain exactly one readable ```json fence" }),
          failure: saveFailure,
          expected: "save-failed",
        },
        { name: "未対応 major は保存に成功すれば version-mismatch", model: ok(mismatched), failure: null, expected: "version-mismatch" },
        { name: "未対応 major は保存に失敗すれば save-failed", model: ok(mismatched), failure: saveFailure, expected: "save-failed" },
      ];

      for (const row of rows) {
        const reports = new SeamRepository(row.failure);
        const acquirer = new DesignVerificationAcquirer(new StubModelRepository(row.model), new DesignReportFinalizer(reports, contractSchema));
        const acquired = acquirer.acquire(DesignModelId.of(ap("/records/model.md")), reportIdOf(verifyDir), strictMethod(method));
        expect(`${row.name}: ${acquired.kind}`).toBe(`${row.name}: terminal`);
        if (acquired.kind !== "terminal") continue;
        expect(`${row.name}: ${acquired.outcome.kind}`).toBe(`${row.name}: ${row.expected}`);
        if (acquired.outcome.kind === "version-mismatch") {
          // 適合前の skip 数が verdict 行に載る（凍結挙動）。
          expect(acquired.outcome.skippedCount).toBe(targetCount(mismatched));
          expect(acquired.outcome.skippedCount).toBeGreaterThan(0);
        }
        if (acquired.outcome.kind === "model-unreadable") {
          // IR が読めない経路は cross-check を書けない——集約は cross-check を
          // 持たないまま保存される。
          expect(reports.withoutCrossCheck().length).toBe(1);
          expect(reports.withCrossCheck()).toEqual([]);
          expect(reports.withoutCrossCheck()[0]?.candidate()?.method()).toBe(method);
        }
        if (acquired.outcome.kind === "version-mismatch") {
          expect(reports.withCrossCheck().length).toBe(1);
          expect(reports.withoutCrossCheck()).toEqual([]);
        }
      }
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  test("対応 version なら同じ model と IR hash を ready として返す", () => {
    const model = fixtureModel();
    const reports = new SeamRepository();
    const acquirer = new DesignVerificationAcquirer(new StubModelRepository(ok(model)), new DesignReportFinalizer(reports, contractSchema));
    const acquired = acquirer.acquire(model.id(), reportIdOf(ap("/records/deep-spec-design-verify")), strictMethod("exhaustive"));
    expect(acquired.kind).toBe("ready");
    if (acquired.kind !== "ready") return;
    expect(acquired.model).toBe(model);
    expect(acquired.irHash.equals(model.irHash())).toBe(true);
    // ready は何も書かない。
    expect(reports.storedAggregates).toEqual([]);
  });
});

// --- FR1.4 兄弟が読めないときに verified を返さない --------------------------

describe("FR1.4 兄弟 report が読めないとき verified を返さない", () => {
  test("壊れた兄弟 *.json は両 backend で save-failed になり、公開ファイルを増やさない", () => {
    const workspace = mkdtempSync(join(tmpdir(), "design-sibling-unreadable-"));
    try {
      const verifyDir = join(workspace, "deep-spec-design-verify");
      mkdirSync(verifyDir, { recursive: true });
      writeFileSync(join(verifyDir, "broken.json"), "{ this is not JSON");
      const reports = new DesignVerifyDirectoryRepositoryImpl();

      const smt = runSmt(reports, verifyDir);
      expect(smt.kind).toBe("save-failed");
      const quint = runQuint(reports, verifyDir);
      expect(quint.kind).toBe("save-failed");

      expect(existsSync(join(verifyDir, "smt.json"))).toBe(false);
      expect(existsSync(join(verifyDir, "quint.json"))).toBe(false);
      expect(existsSync(join(verifyDir, "cross-check.json"))).toBe(false);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  test("兄弟が読めるときは同じ経路が verified になる（沈黙ではなく実際の成功）", () => {
    const workspace = mkdtempSync(join(tmpdir(), "design-sibling-readable-"));
    try {
      const verifyDir = join(workspace, "deep-spec-design-verify");
      mkdirSync(verifyDir, { recursive: true });
      const reports = new DesignVerifyDirectoryRepositoryImpl();
      expect(runSmt(reports, verifyDir).kind).toBe("verified");
      expect(existsSync(join(verifyDir, "smt.json"))).toBe(true);
      expect(existsSync(join(verifyDir, "cross-check.json"))).toBe(true);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
