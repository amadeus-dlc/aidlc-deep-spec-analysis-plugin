// 2026-09-05 の監査6件を、公開境界と保存結果で検証する回帰テスト。
import { afterEach, describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Json, type Result, ok } from "@deep-spec/kernel-infrastructure";
import { ArtifactPath, ExpressionTree, FindingsSchema, FrRefs, ObligationNature } from "@deep-spec/kernel-domain";
import {
  FormalModelId, Obligation, ObligationId, VerificationDirectory, VerificationFindings,
  VerificationReport, VerificationReportId, VerificationReports, VerificationSkips,
} from "@deep-spec/requirements-domain";
import { FormalModelRepositoryImpl, VerificationDirectoryRepositoryImpl } from "@deep-spec/requirements-adapter";
import {
  DesignFindings, DesignModelId, DesignReport, DesignReportId, DesignReports, DesignSkips,
  DesignVerifyDirectory, ReachabilityVerdict, RefinementMaterials, RefinementMaterialsId,
  SiblingVerdictDocument, SiblingVerdictFindings, SiblingVerdictSkip, SiblingVerdictSkips,
} from "@deep-spec/design-domain";
import {
  DesignModelRepositoryImpl, DesignVerifyDirectoryRepositoryImpl, RefinementMaterialsRepositoryImpl,
  SiblingBackendClientImpl, parseSiblingVerdictDocument,
} from "@deep-spec/design-adapter";
import {
  VerifyDesignQuintUseCase, VerifyDesignSmtUseCase,
  type DesignVerifyDirectoryRepository, type SiblingBackendClient,
} from "@deep-spec/design-usecase";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = join(pluginRoot, "src/entries/data");
const schema = FindingsSchema.of(JSON.parse(readFileSync(join(data, "deep-spec-findings-schema.json"), "utf-8")));
const directories: string[] = [];
const ap = (path: string) => ArtifactPath.reconstitute(path);
function value<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`test setup: ${JSON.stringify(result.error)}`);
  return result.value;
}
function temporaryDirectory(): string {
  const path = mkdtempSync(join(tmpdir(), "verification-boundaries-"));
  directories.push(path);
  return path;
}
afterEach(() => {
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});
function requirementsModel() {
  return value(new FormalModelRepositoryImpl().findById(FormalModelId.of(ap(
    join(pluginRoot, "tests/fixtures/conformance/deep-spec-analysis-formal-model.md"),
  ))));
}
function designWorkspace() {
  const record = temporaryDirectory();
  cpSync(join(pluginRoot, "tests/fixtures/refinement/record"), record, { recursive: true });
  const modelPath = join(record, "construction/deep-spec-analysis-functional-verify/deep-spec-analysis-functional-formal-model.md");
  const modelId = DesignModelId.of(ap(modelPath));
  const models = new DesignModelRepositoryImpl();
  const model = value(models.findById(modelId));
  const materials = new RefinementMaterialsRepositoryImpl(join(data, "deep-spec-refinement-map-schema.json"));
  return { record, modelId, models, model, materials, input: { modelId, verifyDirectory: ap(join(record, "verify")) } };
}
function reportDocument(overrides: { [k: string]: Json } = {}): Json {
  return { backend: "quint", irVersion: "1.0.0", irHash: "a".repeat(64), method: "bounded", findings: [], skipped: [], ...overrides };
}
class CapturedReports implements DesignVerifyDirectoryRepository {
  readonly saved: DesignVerifyDirectory[] = [];
  findByDirectory(directory: ArtifactPath) {
    return ok(DesignVerifyDirectory.of(directory, DesignReports.of([]), null));
  }
  store(aggregate: DesignVerifyDirectory) {
    this.saved.push(aggregate);
    return ok(undefined);
  }
  document(): { [k: string]: Json } {
    const report = this.saved.at(-1)?.candidate();
    if (!report) throw new Error("test setup: no report was saved");
    return report.toDocument();
  }
}
const cleanSibling: SiblingBackendClient = {
  runLowered: () => ({ exit: 0, note: "", doc: SiblingVerdictDocument.readable("bounded", SiblingVerdictFindings.of([]), SiblingVerdictSkips.of([])) }),
  probeState: () => ReachabilityVerdict.unverified(),
};

describe("到達性は完了した検査または到達の証跡からだけ判断する", () => {
  const verdictCases = [
    { name: "到達", verdict: ReachabilityVerdict.reached(), findings: 0, skipped: 0 },
    { name: "範囲内で非到達", verdict: ReachabilityVerdict.notReachedWithinBound(), findings: 2, skipped: 0 },
    { name: "未検証", verdict: ReachabilityVerdict.unverified(), findings: 0, skipped: 1 },
  ];
  test.each(verdictCases)("$name をusecaseまで同じ判定として渡す", ({ verdict, findings, skipped }) => {
    const ws = designWorkspace();
    const reports = new CapturedReports();
    const sibling: SiblingBackendClient = { ...cleanSibling, probeState: () => verdict };
    const outcome = new VerifyDesignQuintUseCase(ws.models, reports, schema, sibling,
      { findById: (id) => ok(RefinementMaterials.inactive(id)) }, { now: () => 0 }, 2).execute(ws.input);
    expect(outcome.kind).toBe("verified");
    expect(reports.document().findings).toHaveLength(findings);
    expect(reports.document().skipped).toHaveLength(skipped);
  });

  test("到達性の値は生成したインスタンスによらず、三つの判定を区別する", () => {
    const copies = [ReachabilityVerdict.reached(), ReachabilityVerdict.notReachedWithinBound(), ReachabilityVerdict.unverified()];
    for (const [i, { verdict }] of verdictCases.entries()) {
      for (const [j, copy] of copies.entries()) expect(verdict.equals(copy)).toBe(i === j);
    }
  });

  test("読めた文書はmethodが必須で、matchとremapの成功先でも省略されない", () => {
    // 型契約の検査。門が nullable / optional に戻ると、この代入がコンパイルで落ちる。
    const acceptsNull: null extends Parameters<typeof SiblingVerdictDocument.readable>[0] ? true : false = false;
    const acceptsUndefined: undefined extends Parameters<typeof SiblingVerdictDocument.readable>[0] ? true : false = false;
    expect(acceptsNull || acceptsUndefined).toBe(false);
    const ws = designWorkspace();
    const readable = SiblingVerdictDocument.readable("bounded", SiblingVerdictFindings.of([]), SiblingVerdictSkips.of([]));
    expect(readable.match({ unreadable: () => "unreadable", unavailable: (_reason, method) => method.toUpperCase(), readable: (method) => method.toUpperCase() })).toBe("BOUNDED");
    const unit = ws.model.units().toArray()[0];
    const remapped = readable.remapVerdicts(unit, unit.lowered({ synthetics: false }).index());
    expect(remapped.unavailable).toBeNull();
    if (remapped.unavailable === null) expect(remapped.method.toUpperCase()).toBe("BOUNDED");
    expect(SiblingVerdictDocument.unavailable("timeout", "bounded").reachabilityOf("ticket.phase", "closed").equals(ReachabilityVerdict.unverified())).toBe(true);
  });

  test.each(["timeout", "compile-error", "capability", "unavailable"])("%s を非到達へ変換しない", (reason) => {
    const document = parseSiblingVerdictDocument(reportDocument({ skipped: [{ target: "OB-9999", reason }] }));
    expect(document.reachabilityOf("ticket.phase", "closed").equals(ReachabilityVerdict.unverified())).toBe(true);
  });

  test("不正文書・simulation・証跡のないconflictから非到達を導かない", () => {
    for (const raw of [[], reportDocument({ skipped: null }), reportDocument({ findings: [false] }), reportDocument({ method: "simulation" }),
      reportDocument({ findings: [{ kind: "conflict", targets: ["OB-9999"], frRefs: [], detail: "no trace", witness: {} }] })]) {
      expect(parseSiblingVerdictDocument(raw).reachabilityOf("ticket.phase", "closed").equals(ReachabilityVerdict.unverified())).toBe(true);
    }
    expect(parseSiblingVerdictDocument(reportDocument()).reachabilityOf("ticket.phase", "closed").equals(ReachabilityVerdict.notReachedWithinBound())).toBe(true);
    const proof = reportDocument({ method: "simulation", findings: [{ kind: "conflict", targets: ["OB-9999"], frRefs: [], detail: "trace", witness: { trace: [{ "ticket.phase": "closed" }] } }] });
    expect(parseSiblingVerdictDocument(proof).reachabilityOf("ticket.phase", "closed").equals(ReachabilityVerdict.reached())).toBe(true);
  });

  test("実adapterがtimeout文書を読んでも、usecaseは到達不能findingを保存しない", () => {
    const ws = designWorkspace();
    const tool = join(ws.record, "probe.ts");
    writeFileSync(tool, `import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
const model = process.argv[process.argv.indexOf('--output-path') + 1];
const dir = join(dirname(model), 'deep-spec-verify');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'quint.json'), ${JSON.stringify(JSON.stringify(reportDocument({ skipped: [{ target: "OB-9999", reason: "timeout" }] })))});
`);
    const adapter = new SiblingBackendClientImpl({ siblingToolPaths: { smt: tool, quint: tool }, workingDirectory: pluginRoot });
    let probes = 0;
    const sibling: SiblingBackendClient = { ...cleanSibling, probeState: (...args) => { probes++; return adapter.probeState(...args); } };
    const reports = new CapturedReports();
    const outcome = new VerifyDesignQuintUseCase(ws.models, reports, schema, sibling,
      { findById: (id) => ok(RefinementMaterials.inactive(id)) }, { now: () => 0 }, 2).execute(ws.input);
    expect(outcome.kind).toBe("verified");
    expect(probes).toBe(2);
    expect(reports.document().findings).toEqual([]);
    expect(reports.document().skipped).toEqual([expect.objectContaining({ target: "SM-1" })]);
  });
});

describe("refinementの対象はfindingとskipの両方に写す", () => {
  test.each(["timeout", "compile-error"])("追加要件の%sを残し、設計本体のskipは重複させない", (reason) => {
    const ws = designWorkspace();
    let calls = 0;
    const sibling: SiblingBackendClient = {
      ...cleanSibling,
      runLowered: (_backend, _unit, lowered) => {
        calls++;
        const skips = calls === 1 ? [] : [...lowered.obligations()].map((o) =>
          SiblingVerdictSkip.reconstitute({ target: o.id(), reason, detail: "regression" }));
        return { exit: 0, note: "", doc: SiblingVerdictDocument.readable("simulation", SiblingVerdictFindings.of([]), SiblingVerdictSkips.of(skips)) };
      },
    };
    const reports = new CapturedReports();
    const outcome = new VerifyDesignQuintUseCase(ws.models, reports, schema, sibling, ws.materials, { now: () => 0 }, 0).execute(ws.input);
    expect(outcome.kind).toBe("verified");
    expect(calls).toBe(2);
    const skipped = reports.document().skipped;
    expect(skipped).toContainEqual(expect.objectContaining({ target: "OB-1", reason }));
    expect(JSON.stringify(skipped)).not.toContain('"target":"DOB-');
  });
});

describe("不正な兄弟文書を正常な集約へ復元しない", () => {
  const malformed: Json[] = [[], null, reportDocument({ findings: null }), reportDocument({ skipped: null }),
    reportDocument({ findings: [7] }), reportDocument({ skipped: [{ target: "OB-1" }] }),
    reportDocument({ crossChecked: [{ backend: "smt", targets: "SC-1" }] }),
    reportDocument({ inputs: [{ artifact: "x" }] }), reportDocument({ checked: [3] }),
    reportDocument({ unavailable: {} }), reportDocument({ method: null }), reportDocument({ backend: "smt" })];
  for (const context of ["requirements", "design"] as const) {
    test(`${context}: 不正な形を全件corruptとして返す`, () => {
      const directory = temporaryDirectory();
      const repository = context === "requirements" ? new VerificationDirectoryRepositoryImpl() : new DesignVerifyDirectoryRepositoryImpl();
      for (const document of malformed) {
        writeFileSync(join(directory, "quint.json"), JSON.stringify(document));
        const result = repository.findByDirectory(ap(directory));
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.kind).toBe("corrupt");
      }
      writeFileSync(join(directory, "quint.json"), JSON.stringify(reportDocument()));
      expect(repository.findByDirectory(ap(directory)).ok).toBe(true);
      // 導出物の不正だけは再計算できるので、兄弟と違って不在として扱う。
      writeFileSync(join(directory, "cross-check.json"), "[]");
      const loaded = repository.findByDirectory(ap(directory));
      expect(loaded.ok && loaded.value.crossCheck() === null).toBe(true);
    });
  }
});

describe("式の所有権を集約の内側に閉じる", () => {
  test("入力、公開面、visitorのいずれからも式の木を書き換えられない", () => {
    const leaf = { op: "ref", path: "order.state" };
    const expression = { op: "eq", args: [leaf, { op: "enum", value: "done" }] };
    const tree = ExpressionTree.of(expression);
    const obligation = Obligation.reconstitute({ id: ObligationId.reconstitute("OB-1"), nature: ObligationNature.reconstitute("invariant"), frRefs: FrRefs.of([]), assert: expression });
    leaf.path = "changed";
    expect(tree.referencedPaths()).toEqual(["order.state"]);
    expect(obligation.assertion()?.args?.[0].path).toBe("order.state");
    expect(Reflect.set(tree.asExpression(), "op", "broken")).toBe(false);
    tree.walk((node) => expect(Reflect.set(node, "op", "broken")).toBe(false));
    obligation.inspectExpressions((node) => expect(Reflect.set(node, "op", "broken")).toBe(false));
  });

  test("実Repositoryのモデルを経由しても、内容とハッシュと原文の対応を壊せない", () => {
    const model = requirementsModel();
    const before = model.obligations().toArray().map((o) => o.assertion());
    const hash = model.irHash();
    const bytes = model.sourceDocument();
    for (const ob of model.obligations()) {
      ob.inspectExpressions((expression) => {
        expect(Reflect.set(expression, "op", "broken")).toBe(false);
        if (expression.args) expect(Reflect.set(expression.args, "0", { op: "bool", value: false })).toBe(false);
      });
    }
    expect(model.obligations().toArray().map((o) => o.assertion())).toEqual(before);
    expect(model.irHash().equals(hash)).toBe(true);
    expect(model.sourceDocument()).toEqual(bytes);
  });
});

describe("refinement入力の取得失敗を適用外と混同しない", () => {
  for (const backend of ["smt", "quint"] as const) {
    test(`${backend}: I/O失敗でも既に完了した設計検査を保存してから失敗を返す`, () => {
      const ws = designWorkspace();
      const reqPath = join(ws.record, "inception/deep-spec-analysis-verify/deep-spec-analysis-formal-model.md");
      rmSync(reqPath);
      mkdirSync(reqPath);
      const materials = ws.materials.findById(RefinementMaterialsId.ofModel(ws.modelId));
      expect(materials.ok).toBe(false);
      if (!materials.ok) expect(materials.error.kind).toBe("io-failed");
      const reports = new CapturedReports();
      const useCase = backend === "quint"
        ? new VerifyDesignQuintUseCase(ws.models, reports, schema, cleanSibling, ws.materials, { now: () => 0 }, 0)
        : new VerifyDesignSmtUseCase(ws.models, reports, schema, cleanSibling, ws.materials,
          { check: () => { throw new Error("solver must not run with unreadable inputs"); } }, { now: () => 0 });
      expect(useCase.execute(ws.input).kind).toBe("acquisition-failed");
      expect(reports.saved.length).toBe(1);
      expect(reports.document().checked).toEqual(["unit:u1-orders"]);
      expect(reports.document().unavailable).toBeDefined();
    });
  }
  test("不正JSON・不正構造はcorrupt、不在だけがinactive", () => {
    const ws = designWorkspace();
    const reqPath = join(ws.record, "inception/deep-spec-analysis-verify/deep-spec-analysis-formal-model.md");
    for (const body of ["{invalid", "{}", "[]"]) {
      writeFileSync(reqPath, `\n\`\`\`json\n${body}\n\`\`\`\n`);
      const result = ws.materials.findById(RefinementMaterialsId.ofModel(ws.modelId));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe("corrupt");
    }
    rmSync(reqPath);
    expect(value(ws.materials.findById(RefinementMaterialsId.ofModel(ws.modelId))).isActive()).toBe(false);
  });
});

describe("cross-checkの不変条件は呼び順に依存しない", () => {
  test("requirements: 候補の降格で古い導出物を捨て、一操作でも正しく準備できる", () => {
    const model = requirementsModel();
    const directory = ap(temporaryDirectory());
    const report = (backend: string, method: string) => VerificationReport.compose({ id: VerificationReportId.of(directory, backend), irVersion: model.irVersion(), irHash: model.irHash(), method, findings: VerificationFindings.of([]), skipped: VerificationSkips.of([]) });
    const initial = VerificationDirectory.of(directory, VerificationReports.of([report("smt", "exhaustive")]), null);
    const candidate = report("quint", "unknown");
    const wrongOrder = initial.finalizing(candidate).crossChecked(model, model.irHash()).conformedTo(schema);
    expect(wrongOrder.candidate()?.isUnavailable()).toBe(true);
    expect(wrongOrder.crossCheck()).toBeNull();
    const prepared = initial.finalizedWith(candidate, model, schema);
    expect(prepared.candidate()?.isUnavailable()).toBe(true);
    expect(prepared.crossCheck()?.toDocument().crossChecked).toEqual([]);
    expect(initial.finalizedWith(candidate, null, schema).crossCheck()).toBeNull();
  });
  test("design: 候補の降格で古い導出物を捨て、一操作でも正しく準備できる", () => {
    const ws = designWorkspace();
    const directory = ws.input.verifyDirectory;
    const report = (backend: string, method: string) => DesignReport.compose({ id: DesignReportId.of(directory, backend), irVersion: ws.model.irVersion(), irHash: ws.model.irHash(), method, findings: DesignFindings.of([]), skipped: DesignSkips.of([]) });
    const initial = DesignVerifyDirectory.of(directory, DesignReports.of([report("smt", "exhaustive")]), null);
    const candidate = report("quint", "unknown");
    const wrongOrder = initial.finalizing(candidate).crossChecked(ws.model, ws.model.irHash()).conformedTo(schema);
    expect(wrongOrder.candidate()?.isUnavailable()).toBe(true);
    expect(wrongOrder.crossCheck()).toBeNull();
    const prepared = initial.finalizedWith(candidate, ws.model, schema);
    expect(prepared.crossCheck()?.toDocument().crossChecked).toEqual([]);
    expect(initial.finalizedWith(candidate, null, schema).crossCheck()).toBeNull();
  });
});
