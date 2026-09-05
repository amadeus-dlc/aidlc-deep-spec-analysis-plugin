// 対象コミット26324f9の不具合をassertする基線資料。修正後の期待動作はtests/coding-rules-conformance.test.tsで確認する。
// 実行先と依存解決を固定する手順は、同じディレクトリのbaseline-reproduction.mdを参照。
// 型アサーションで不正な引数を作らず、公開APIが受け取る型だけで再現する。
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArtifactPath, ContentHash, DeclaredBound } from "../../../../../../../deep-spec-analysis/src/kernel/domain/index.ts";
import { type Json, canonicalStringify, IllegalArgumentException } from "../../../../../../../deep-spec-analysis/src/kernel/infrastructure/index.ts";
import {
  FormalModelId, RequirementsModel, VerificationReport, VerificationReportId,
  ObligationId, ScenarioId, IrBindingPairs, IrModelDecl, IrEntityDecl, IrEntityDecls, IrEntityName,
  IrAttributeDecl, IrAttributeDecls, IrAttributeName, IrObligationDecls, IrScenarioDecl, IrScenarioDecls, IrBackgroundDecls,
} from "../../../../../../../deep-spec-analysis/src/requirements/domain/index.ts";
import { parseFormalModel, buildSmtPlan, Z3SolverClientImpl } from "../../../../../../../deep-spec-analysis/src/requirements/adapter/index.ts";
import {
  AttrDecl, AttributeName, ElementPath, TypeName, AttributeDefault, NumericBound,
  RuleDecl, DeclaredRuleId, RuleCategory, SourceIds,
} from "../../../../../../../deep-spec-analysis/src/refcheck/domain/index.ts";

const sandbox = mkdtempSync(join(tmpdir(), "coding-rules-audit-"));
function emit(id: string, observed: object): void {
  process.stdout.write(`${JSON.stringify({ id, ...observed })}\n`);
}
function model(raw: Json): RequirementsModel {
  const parsed = parseFormalModel(raw);
  assert(parsed.ok, "reproducer needs the parser to accept this model");
  return RequirementsModel.of({
    ...parsed.value,
    id: FormalModelId.of(ArtifactPath.of(join(sandbox, "model.md"))),
    irHash: ContentHash.ofText(canonicalStringify(raw)),
    sourceDocument: Buffer.from(JSON.stringify(raw)),
  });
}
const valid: Json = {
  irVersion: "1.0.0", schema: { entities: [] },
  obligations: [{ id: "OB-1", nature: "invariant", frRefs: ["FR-1"], assert: { op: "bool", value: false } }],
  scenarios: [], background: [],
};

try {
  // R1: 子プロセスは正常終了するが、発行されたクエリの結果が欠けている。
  const child = join(sandbox, "empty-results.mjs");
  writeFileSync(child, 'process.stdout.write(JSON.stringify({ results: [] }) + "\\n");');
  const input = model(valid);
  const queries = buildSmtPlan(input).queries.length;
  assert(queries > 0);
  const run = new Z3SolverClientImpl({ selfPath: child, perQueryTimeoutMs: 100, runtimeOverride: "node", workingDirectory: sandbox }).check(input);
  assert.equal(run.result.kind, "solved");
  assert(run.result.kind === "solved");
  const interpreted = run.plan.interpret(input, run.result.verdicts);
  const report = VerificationReport.compose({
    id: VerificationReportId.of(ArtifactPath.of(sandbox), "smt"), irVersion: input.irVersion(), irHash: input.irHash(), method: "exhaustive",
    findings: interpreted.findings, skipped: interpreted.skipped,
  });
  assert.equal(report.passes(), true);
  assert.equal(report.findingsCount(), 0);
  assert.equal(report.skippedCount(), 0);
  const complete = join(sandbox, "complete-results.mjs");
  writeFileSync(complete, 'process.stdout.write(JSON.stringify({ results: [{ id: "global", status: "unsat", core: [] }] }));');
  const control = new Z3SolverClientImpl({ selfPath: complete, perQueryTimeoutMs: 100, runtimeOverride: "node", workingDirectory: sandbox }).check(input);
  assert(control.result.kind === "solved");
  const controlFindings = control.plan.interpret(input, control.result.verdicts).findings.toArray().length;
  assert.equal(controlFindings, 1);
  emit("R1", { issuedQueries: queries, childResults: 0, result: run.result.kind, pass: report.passes(), findings: report.findingsCount(), skipped: report.skippedCount(), controlCompleteUnsatFindings: controlFindings });

  // R2: parseで受理済みのIDが、通常の公開操作でpanicする。
  const parsedId = ObligationId.parse("OB-invalid");
  assert(parsedId.ok);
  assert.throws(() => parsedId.value.asTargetId(), IllegalArgumentException);
  const malformedIdModel = model({
    irVersion: "1.0.0", schema: { entities: [] },
    obligations: [{ id: "OB-invalid", nature: "temporal", frRefs: [], temporal: { pattern: "always", assert: { op: "bool", value: true } } }],
    scenarios: [], background: [],
  });
  assert.throws(() => buildSmtPlan(malformedIdModel), IllegalArgumentException);
  const validId = ObligationId.parse("OB-1");
  assert(validId.ok);
  assert.equal(validId.value.asTargetId().asString(), "OB-1");
  const scenarioId = ScenarioId.parse("SC-invalid");
  assert(scenarioId.ok);
  assert.throws(() => scenarioId.value.asTargetId(), IllegalArgumentException);
  emit("R2", { scenario: { input: "SC-invalid", parse: "ok", asTargetId: "IllegalArgumentException" }, input: "OB-invalid", parse: "ok", asTargetId: "IllegalArgumentException", modelParse: "ok", smtPlan: "IllegalArgumentException" });

  // R3: 入力の型は正しいまま、所有者の操作なしで同じ宣言の判断が変わる。
  const seed = {
    name: AttributeName.of("count"), element: ElementPath.of("entities[0].attributes[0]"), type: TypeName.of("integer"), uniqueIsTrue: false,
    references: null, allowed: null, def: AttributeDefault.of(5), minDeclared: true, maxDeclared: true,
    min: NumericBound.of(0), max: NumericBound.of(10),
  };
  const attribute = AttrDecl.of(seed);
  const before = attribute.boundsInverted();
  seed.min = NumericBound.of(20);
  const after = attribute.boundsInverted();
  assert.equal(before, false);
  assert.equal(after, true);
  const missing: string[] = [];
  const rule = RuleDecl.of({ id: DeclaredRuleId.of("BR1.1"), element: ElementPath.of("rules[0]"), category: RuleCategory.of("constraint"), appliesTo: null, sourceIds: SourceIds.of([]), missing });
  missing.push("statement");
  assert.deepEqual(rule.missing(), ["statement"]);
  const entry: [string, number] = ["count", 1];
  const pairs = IrBindingPairs.of([entry]);
  entry[1] = 99;
  assert.equal(pairs.toArray()[0]?.[1], 99);
  emit("R3", { beforeBoundsInverted: before, afterBoundsInverted: after, missingAfterCallerMutation: rule.missing(), bindingAfterCallerMutation: pairs.toArray()[0]?.[1] });

  // R4: JSONの宣言を運ぶAPIがunknownのため、非JSON値も型検査を通る。
  const nonJsonBindings = IrBindingPairs.of([["e.count", 1n]]);
  const declared = IrModelDecl.of({
    entities: IrEntityDecls.of([IrEntityDecl.of({ name: IrEntityName.of("e"), attributes: IrAttributeDecls.of([
      IrAttributeDecl.of({ name: IrAttributeName.of("count"), kind: "int", min: DeclaredBound.of(0), max: DeclaredBound.of(10) }),
    ]) })]),
    obligations: IrObligationDecls.of([]),
    scenarios: IrScenarioDecls.of([IrScenarioDecl.of({ id: ScenarioId.of("SC-1"), bindings: nonJsonBindings, hasEvent: false })]),
    background: IrBackgroundDecls.of([]),
  });
  assert.throws(() => declared.wellFormednessErrors(), TypeError);
  emit("R4", { inputType: "bigint", construction: "accepted", diagnostic: "TypeError from JSON.stringify" });

  // 追加観測: 文書パーサの寛容性は既存コメントに明記されているため、
  // 変更可否を別途整理する。現時点の出力を記録するだけでR1-R3へ混ぜない。
  const absentSections = parseFormalModel({ irVersion: "1.0.0" });
  assert(absentSections.ok);
  emit("O1", { input: { irVersion: "1.0.0" }, parse: "ok", obligations: absentSections.value.obligations.toArray().length });
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
