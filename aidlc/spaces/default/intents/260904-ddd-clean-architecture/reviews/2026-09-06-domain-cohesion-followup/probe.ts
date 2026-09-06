// mainの公開APIを観測するレビュー用再現器。アプリケーションは変更しない。
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import * as K from "../../../../../../../deep-spec-analysis/src/kernel/domain/index.ts";
import * as R from "../../../../../../../deep-spec-analysis/src/refcheck/domain/index.ts";
import * as A from "../../../../../../../deep-spec-analysis/src/refcheck/adapter/index.ts";
import * as D from "../../../../../../../deep-spec-analysis/src/design/domain/index.ts";

const source = "67c8736afee7706ca7b7fc6a5779a13d0efd65c0";
const root = resolve(import.meta.dir, "../../../../../../..");
execFileSync("git", ["diff", "--exit-code", source, "--", "deep-spec-analysis/src"], { cwd: root });
const path = K.ArtifactPath.of;
const report = (families: readonly string[]) => R.ReferenceCheckReport.open(
  R.ReferenceCheckReportIdentifier.of(path("/review/output"), "functional-design"),
  R.CheckFamilies.of(families.map(R.CheckFamily.of)),
);
const emptyEntities = R.DeclaredEntities.of({
  entities: R.EntityDeclarations.of([]), rels: R.RelationshipDeclarations.of([]), shapeErrors: R.ShapeErrors.of([]),
});
const evidence: Record<string, unknown> = { source };

// パーサが成功を返した値から、照会時に初めて構築例外が発生する。
const machineCases = ["E".repeat(128), "E".repeat(129), ".state"].map((name) => {
  const parsed = R.MachineSpecification.parse(name);
  const checkReport = report(["FD-S1", "FD-S2"]);
  let failure: { name: string; message: string } | null = null;
  try {
    A.parseFunctionalSpecDocument(`### State Machine: ${name}\n\n\`\`\`mermaid\nstateDiagram-v2\n[*] --> open\n\`\`\`\n`)
      .check(checkReport, path("functional-spec.md"), path("entities.md"), emptyEntities);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    failure = { name: error.constructor.name, message: error.message };
  }
  return { nameLength: name.length, label: name.startsWith(".") ? name : `E × ${name.length}`, parseOk: parsed.ok, failure };
});
assert.equal(machineCases[0]?.failure, null);
assert.equal(machineCases[1]?.parseOk, true);
assert.equal(machineCases[1]?.failure?.name, "IllegalArgumentException");
assert.equal(machineCases[2]?.parseOk, true);
assert.equal(machineCases[2]?.failure?.name, "IllegalArgumentException");
evidence.machineConstruction = machineCases;

// 正常な2実体に対し、一方の図だけを追加したとき未検査のもう一方が消える。
const lifecycleEntity = (name: string) => R.EntityDeclaration.of({
  name: R.EntityName.of(name), element: R.ElementPath.of(`entities.${name}`),
  attrs: R.AttributeDeclarations.of([R.AttributeDeclaration.of({
    name: R.AttributeName.of("status"), element: R.ElementPath.of(`entities.${name}.status`),
    type: R.TypeName.of("enum"), uniqueIsTrue: false, references: null,
    allowed: R.AllowedValues.of([R.AllowedValue.of("open")]), def: null,
    minDeclared: false, maxDeclared: false, min: null, max: null,
  })]), rels: R.RelationshipDeclarations.of([]),
});
const entities = R.DeclaredEntities.of({
  entities: R.EntityDeclarations.of([lifecycleEntity("Order"), lifecycleEntity("Invoice")]),
  rels: R.RelationshipDeclarations.of([]), shapeErrors: R.ShapeErrors.of([]),
});
const machineCoverage = (specification: string) => {
  const output = report(["FD-S1", "FD-S2"]);
  A.parseFunctionalSpecDocument(specification).check(output, path("functional-spec.md"), path("entities.md"), entities);
  return { checked: output.checked().toStrings(), skipped: output.skipped().toArray().map(s => s.detail()), findings: output.findingsCount() };
};
const noDiagram = machineCoverage("");
const orderOnly = machineCoverage("### State Machine: Order\n\n```mermaid\nstateDiagram-v2\n[*] --> open\n```\n");
assert.equal(noDiagram.skipped.length, 4);
assert.deepEqual(orderOnly.checked, ["check:FD-S1", "check:FD-S2"]);
assert.equal(orderOnly.skipped.length, 0);
assert.equal(orderOnly.findings, 0);
evidence.partialMachineCoverage = { entities: ["Order", "Invoice"], noDiagram, orderOnly };

// 索引に対する変更命令なしで、外部Map・返却レコードから診断が変わる。
const row = { name: R.EntityName.of("Order"), attrs: R.AttributeNames.of([R.AttributeName.of("qty")]) };
const members = new Map([["order", row]]);
const siblingIndex = R.SiblingUnitIndex.of(new Map([["u1", members]]));
const sketches = R.DomainEntitySketches.of([R.DomainEntitySketch.of({
  name: R.EntityName.of("Order"), component: R.ComponentName.of("Core"),
  attributes: R.AttributeNames.of([R.AttributeName.of("qty")]),
})]);
const siblingDiagnostics = () => {
  const output = report(["XS-1", "XS-2", "XS-3"]);
  sketches.check(output, path("components.md"), siblingIndex, K.UnitName.of("u1"));
  return output.findings().toArray().map(f => f.detail());
};
const original = siblingDiagnostics();
members.delete("order");
const afterInputMapDeletion = siblingDiagnostics();
members.set("order", row);
const exposed = siblingIndex.entityDeclaredIn("u1", "order");
assert.ok(exposed);
exposed.attrs = R.AttributeNames.of([]);
const afterReturnedRowMutation = siblingDiagnostics();
assert.deepEqual(original, []);
assert.ok(afterInputMapDeletion[0]?.startsWith("XS-2:"));
assert.ok(afterReturnedRowMutation[0]?.startsWith("XS-3:"));
evidence.siblingIndexOwnership = { original, afterInputMapDeletion, afterReturnedRowMutation };

// 取得時に渡した配列の変更で、取得結果が保持した入力証跡も変化する。
const hash = K.ContentHash.ofText("review");
const mapPath = path("refinement-map.md");
const refinementMap = D.RefinementMap.of({
  id: D.RefinementMapIdentifier.of(mapPath), requirementsIrHash: hash, designIrHash: hash,
  units: D.RefinementUnitMaps.of([]), sourceDocument: new Uint8Array(),
});
const anchors = [D.DesignInputAnchor.of({ artifact: "original.md", sha256: hash })];
const acquisition = D.RefinementMapAcquisition.loaded(refinementMap, mapPath, anchors);
const anchorNames = () => acquisition.match({ absent: () => [], loaded: (_map, _artifact, inputs) => inputs.map(i => i.artifact()) });
const anchorsBefore = anchorNames();
anchors.splice(0, 1, D.DesignInputAnchor.of({ artifact: "replacement.md", sha256: hash }));
const anchorsAfter = anchorNames();
assert.deepEqual(anchorsBefore, ["original.md"]);
assert.deepEqual(anchorsAfter, ["replacement.md"]);
evidence.refinementInputOwnership = { anchorsBefore, anchorsAfter };

writeFileSync(join(import.meta.dir, "runtime-evidence.json"), JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify(evidence, null, 2));
