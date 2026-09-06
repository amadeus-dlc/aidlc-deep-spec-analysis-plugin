// mainの公開APIを使う追加精査。アプリケーションコードは変更しない。
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import * as D from "../../../../../../../deep-spec-analysis/src/design/domain/index.ts";
import * as A from "../../../../../../../deep-spec-analysis/src/design/adapter/index.ts";
import * as K from "../../../../../../../deep-spec-analysis/src/kernel/domain/index.ts";
import * as R from "../../../../../../../deep-spec-analysis/src/requirements/domain/index.ts";
import { canonicalStringify, type Json, type Schema, validateSchema } from "../../../../../../../deep-spec-analysis/src/kernel/infrastructure/index.ts";

const root = resolve(import.meta.dir, "../../../../../../..");
const source = "b33e6878e14652570e111815d8daaf2e4e1bf88b";
execFileSync("git", ["diff", "--exit-code", source, "--", "deep-spec-analysis/src"], { cwd: root });
const path = K.ArtifactPath.of;
const version = K.IntermediateRepresentationVersion.of("1.0.0");
const references = K.FunctionalRequirementReferences.of([]);
const schema: Schema = JSON.parse(readFileSync(join(root, "deep-spec-analysis/src/entries/data/deep-spec-design-ir-schema.json"), "utf8"));
function model(raw: Json, name = "a"): D.DesignModel {
  const errors: string[] = [];
  assert.equal(validateSchema(schema, schema, raw, "", errors), true, errors.join("\n"));
  const parsed = A.parseDesignModel(raw);
  assert.ok(parsed.ok);
  return D.DesignModel.compose({ ...parsed.value, id: D.DesignModelIdentifier.of(path(`/records/${name}/model.md`)),
    irHash: K.ContentHash.ofText(canonicalStringify(raw)), sourceDocument: new TextEncoder().encode(JSON.stringify(raw)) });
}
const rawUnit = (name: string, expectation = true) => ({ unit: name, schema: { entities: [{ name: "t", attributes: [{ name: "active", type: { kind: "bool" } }] }] }, obligations: [], stateMachines: [], unformalized: [],
  scenarios: [{ id: "DSC-1", kind: "accept", bindings: { "t.active": true }, expect: { op: "bool", value: expectation } }], background: [] });
const rawModel = (units: Json[]) => ({ irKind: "design", irVersion: "1.0.0", units });
const findings = (unit: string, target: string) => D.DesignFindings.of([D.DesignFinding.of({
  kind: K.FindingKind.scenarioViolation(), unit: K.UnitName.of(unit), targets: K.TargetIdentifiers.of([K.TargetIdentifier.of(target)]),
  functionalRequirementReferences: references, witness: D.DesignWitness.model({ "t.active": true }), detail: "scenario does not satisfy its expectation",
})]);
function report(m: D.DesignModel, backend: string, skippedUnits: string[] = [], fs = D.DesignFindings.of([])) {
  return D.DesignReport.compose({ id: D.DesignReportIdentifier.of(path("/reports"), backend), irVersion: version,
    irHash: m.irHash(), method: "exhaustive", findings: fs,
    skipped: D.DesignSkips.of(skippedUnits.map(unit => D.DesignSkipped.of({
      unit: K.UnitName.of(unit), target: K.TargetIdentifier.of("DSC-1"), reason: K.SkipReason.capability(),
    }))),
  });
}
const evidence: Record<string, unknown> = { source };

// 正常なモデルの二つのユニットに同じローカルIDがある。
const twoUnits = model(rawModel([rawUnit("u1"), rawUnit("u2")]));
const crossId = D.DesignReportIdentifier.of(path("/reports"), "cross-check");
const coverage = (skip: string[]) => D.DesignReports.of([report(twoUnits, "quint", skip), report(twoUnits, "smt", skip)])
  .crossChecked(crossId, twoUnits, twoUnits.irHash()).toDocument();
const u1Only = coverage(["u2"]);
const u2Only = coverage(["u1"]);
const both = coverage([]);
assert.deepEqual(u1Only, u2Only);
assert.deepEqual(u1Only, both);
evidence.crossCheckedScopeLoss = { compared: ["u1のみ", "u2のみ", "両方"],
  documentsIdentical: true, u1Only, u2Only, both };

// 既知のIDと未発行のIDを、同じ子バックエンド文書の復号・再割当て経路に渡す。
const single = model(rawModel([rawUnit("u1")]));
const unit = [...single][0];
const lowered = unit.lowered({ synthetics: false });
const loweredHash = K.ContentHash.ofText(canonicalStringify(A.renderLoweredDocument(unit, lowered)));
const findingsSchema: Schema = JSON.parse(readFileSync(join(root, "deep-spec-analysis/src/entries/data/deep-spec-findings-schema.json"), "utf8"));
function remappedViolation(id: string) {
  const raw = { backend: "smt", irVersion: "1.0.0", irHash: loweredHash.asString(),
    method: "exhaustive", skipped: [], findings: [{ kind: "scenario-violation", frRefs: [], targets: [id], witness: { model: { "t.active": true } }, detail: "violated" }] };
  const errors: string[] = [];
  assert.equal(validateSchema(findingsSchema, findingsSchema, raw, "", errors), true, errors.join("\n"));
  const doc = A.parseSiblingVerdictDocument(raw);
  const remapped = doc.remapVerdicts(unit, lowered.index());
  const remappedReport = D.SiblingVerificationResult.completed(doc, null).recordedIn(
    D.DesignReport.started(D.DesignReportIdentifier.of(path("/reports"), "smt"), single, K.VerificationMethod.of("exhaustive")),
    single, unit, lowered,
  );
  const compared = D.DesignReports.of([remappedReport, report(single, "quint")]).crossChecked(crossId, single, single.irHash());
  return { schemaAccepted: true, readable: doc.isReadable(), unavailable: remapped.unavailable,
    remappedTargets: remapped.findings.toArray().flatMap(f => f.targets().toStrings()),
    crossCheckFindings: compared.findingsCount(), crossChecked: compared.toDocument().crossChecked };
}
const known = remappedViolation("SC-1");
const unknown = remappedViolation("SC-999");
assert.equal(known.crossCheckFindings, 1);
assert.equal(unknown.readable, true);
assert.equal(unknown.unavailable, null);
assert.deepEqual(unknown.remappedTargets, ["SC-999"]);
assert.equal(unknown.crossCheckFindings, 0);
evidence.unissuedTarget = { known, unknown };

// 再構成後のIDの連番は保証されていないが、追加採番は件数から始まる。
const existing = D.LoweredObligation.of({ id: D.LoweredIdentifier.of("OB-2"),
  origin: D.LoweredOrigin.of({ kind: "passthrough", design: D.LoweredOriginReference.of("DOB-1") }),
  nature: K.ObligationNature.of("invariant"), functionalRequirementReferences: references, assert: { op: "bool", value: true } });
const restored = D.LoweredUnit.of({ obligations: D.LoweredObligations.of([existing]), machines: D.DesignMachines.of([]),
  scenarios: D.LoweredScenarios.of([]), background: D.LoweredBackgrounds.of([]) });
const extended = restored.extendedWith(D.RefinementQuintInvariants.of([
  D.RefinementQuintInvariant.of(R.ObligationIdentifier.of("OB-9"), references, { op: "bool", value: true }),
]));
const duplicateIds = [...extended.obligations()].map(obligation => obligation.id().asString());
assert.deepEqual(duplicateIds, ["OB-2", "OB-2"]);
evidence.loweredIdentityCollision = { before: restored.index().resolveDesignTarget("OB-2").design,
  after: extended.index().resolveDesignTarget("OB-2").design, duplicateIds };

// 許容されたノード数の式が、合成プローブの包装によって予算を超える。
const composition = [9998, 10000].map(inputNodes => {
  const guard = { op: "and", args: Array.from({ length: inputNodes - 1 }, () => ({ op: "bool", value: true })) };
  const parsed = K.ExpressionTree.parse(guard);
  assert.ok(parsed.ok);
  const large = model(rawModel([{ ...rawUnit("u1"), obligations: [{ id: "DOB-1", nature: "event", origin: "entities",
    trigger: "save", guard, effect: { op: "bool", value: true } }] }]));
  const largeUnit = [...large][0];
  assert.equal(largeUnit.lowered({ synthetics: false }).obligations().count(), 1);
  let failure: { name: string; message: string } | null = null;
  try { largeUnit.lowered({ synthetics: true }); }
  catch (error) {
    if (!(error instanceof Error)) throw error;
    failure = { name: error.constructor.name, message: error.message };
  }
  return { inputNodes, inputExpressionAccepted: true, schemaAccepted: true, ordinaryLoweringAccepted: true, failure };
});
assert.equal(composition[0].failure, null);
assert.equal(composition[1].failure?.name, "IllegalArgumentException");
evidence.expressionComposition = composition;

// 状態遷移の暗黙条件でも同じ問題が起き、Quint向けの通常loweringにも影響する。
const transitionComposition = [9996, 10000].map(inputNodes => {
  const guard = { op: "and", args: Array.from({ length: inputNodes - 1 }, () => ({ op: "bool", value: true })) };
  assert.ok(K.ExpressionTree.parse(guard).ok);
  const input = model(rawModel([{ ...rawUnit("u1"),
    schema: { entities: [{ name: "t", attributes: [{ name: "active", type: { kind: "bool" } },
      { name: "state", type: { kind: "enum", values: ["open", "closed"] } }] }] },
    stateMachines: [{ id: "SM-1", entity: "t", attribute: "state", initial: ["open"],
      transitions: [{ id: "TR-1", from: "open", to: "closed", trigger: "save", guard }] }],
    scenarios: [{ id: "DSC-1", kind: "accept", bindings: { "t.active": true, "t.state": "open" }, expect: { op: "bool", value: true } }],
  }]));
  let failure: { name: string; message: string } | null = null;
  try { [...input][0].lowered({ synthetics: false }); }
  catch (error) {
    if (!(error instanceof Error)) throw error;
    failure = { name: error.constructor.name, message: error.message };
  }
  return { inputNodes, inputExpressionAccepted: true, schemaAccepted: true, synthetics: false, failure };
});
assert.equal(transitionComposition[0].failure, null);
assert.equal(transitionComposition[1].failure?.name, "IllegalArgumentException");
evidence.transitionComposition = transitionComposition;

// 別モデルに対して判定を正常取得し、それを比較型に組み合わせられる。
const changedModel = model(rawModel([rawUnit("u1", false)]), "b");
const aReport = report(single, "smt");
const bReport = report(changedModel, "quint", [], findings("u1", "DSC-1"));
const target = K.TargetIdentifier.of("DSC-1");
const name = K.UnitName.of("u1");
const foreignComparison = K.ScenarioComparison.parse(aReport.scenarioVerdictFor(name, target, single.irHash()),
  bReport.scenarioVerdictFor(name, target, changedModel.irHash()));
assert.ok(foreignComparison.ok);
assert.equal(single.irHash().equals(changedModel.irHash()), false);
const safeReportPath = D.DesignReports.of([aReport, bReport]).crossChecked(crossId, single, single.irHash());
evidence.comparisonModelScope = { sameHash: false, comparisonAccepted: foreignComparison.ok,
  comparisonDisagrees: foreignComparison.value.disagrees(), normalReportPathFindings: safeReportPath.findingsCount(), normalReportPathComparisons: safeReportPath.crossChecked()?.toArray().length };

// 精緻化材料の所属IDはaだが、同じ内容のbモデルにも計画が作られる。
const otherRecord = model(rawModel([rawUnit("u1")]), "b");
const requirements = D.RefinementRequirements.of({ id: R.FormalModelIdentifier.of(path("/records/a/requirements.md")),
  hash: K.ContentHash.ofText("requirements"), attributes: D.RefinementAttributes.of([]),
  obligations: D.RefinementObligations.of([]), scenarios: D.RefinementScenarios.of([]) });
const mapArtifact = path("/records/a/map.md");
const map = D.RefinementMap.of({ id: D.RefinementMapIdentifier.of(mapArtifact), requirementsIrHash: requirements.hash(),
  designIrHash: single.irHash(), sourceDocument: new Uint8Array(), units: D.RefinementUnitMaps.of([
    D.RefinementUnitMap.of({ unit: unit.id(), attrMap: D.AttributeMappings.of([]), eventMap: D.EventMappings.of([]), unmapped: D.UnmappedDeclarations.of([]) }),
  ]) });
const materials = D.RefinementMaterials.active(D.RefinementMaterialsIdentifier.of(single.id()), requirements,
  D.RefinementMapAcquisition.loaded(map, mapArtifact, D.DesignInputAnchors.of([D.DesignInputAnchor.of({ artifact: mapArtifact.asString(), sha256: K.ContentHash.ofText("map") })])));
assert.equal(single.id().equals(otherRecord.id()), false);
assert.equal(single.irHash().equals(otherRecord.irHash()), true);
const correct = materials.prepare(single);
const foreign = materials.prepare(otherRecord);
assert.equal([...correct].length, 1);
assert.equal([...foreign].length, 1);
evidence.materialModelScope = { materialsFor: materials.id().modelArtifactPath().asString(), requestedModel: otherRecord.id().artifactPath().asString(),
  sameModelId: false, sameContentHash: true, plansForCorrectModel: [...correct].length, plansForForeignModel: [...foreign].length,
  foreignInputAnchors: foreign.recordedIn(report(otherRecord, "smt")).inputs()?.toArray().map(anchor => anchor.artifact()) };

writeFileSync(join(import.meta.dir, "runtime-evidence.json"), JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify(evidence, null, 2));
