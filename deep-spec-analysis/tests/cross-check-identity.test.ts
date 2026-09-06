import { expect, test } from "bun:test";
import { parseDesignModel, parseSiblingDesignReportDocument } from "@deep-spec-analysis/design-adapter";
import * as D from "@deep-spec-analysis/design-domain";
import * as K from "@deep-spec-analysis/kernel-domain";
import { requireSuccess } from "./result-fixtures.ts";

function model(name: string, hash = K.ContentHash.ofText("model")): D.DesignModel {
  const parsed = requireSuccess(
    parseDesignModel({
      irKind: "design",
      irVersion: "1.0.0",
      units: ["u1", "u2"].map((unit) => ({
        unit,
        schema: { entities: [{ name: "t", attributes: [{ name: "active", type: { kind: "bool" } }] }] },
        scenarios: [{ id: "DSC-1", kind: "accept", bindings: { "t.active": true } }],
        obligations: [],
        stateMachines: [],
        background: [],
        unformalized: [],
      })),
    }),
  );
  return D.DesignModel.compose({
    ...parsed,
    id: D.DesignModelIdentifier.of(K.ArtifactPath.of(`/${name}/model.md`)),
    irHash: hash,
    sourceDocument: new Uint8Array(),
  });
}
function report(input: D.DesignModel, backend: string, skipped: string[] = []) {
  return D.DesignReport.compose({
    id: D.DesignReportIdentifier.of(K.ArtifactPath.of("/reports"), backend),
    irVersion: input.irVersion(),
    irHash: input.irHash(),
    method: "exhaustive",
    findings: D.DesignFindings.of([]),
    skipped: D.DesignSkips.of(
      skipped.map((unit) =>
        D.DesignSkipped.of({
          unit: K.UnitName.of(unit),
          target: K.TargetIdentifier.of("DSC-1"),
          reason: K.SkipReason.capability(),
        }),
      ),
    ),
  });
}

test("比較済みシナリオのユニットを出力と復号の両方で保持する", () => {
  const input = model("a");
  const id = D.DesignReportIdentifier.of(K.ArtifactPath.of("/reports"), "cross-check");
  const compare = (skipped: string[]) =>
    D.DesignReports.of([report(input, "quint", skipped), report(input, "smt", skipped)]).crossChecked(
      id,
      input,
      input.irHash(),
    );
  expect(compare(["u2"]).toDocument().crossChecked).toEqual([
    { backend: "quint", unit: "u1", targets: ["DSC-1"] },
    { backend: "smt", unit: "u1", targets: ["DSC-1"] },
  ]);
  expect(compare(["u1"]).toDocument().crossChecked).toEqual([
    { backend: "quint", unit: "u2", targets: ["DSC-1"] },
    { backend: "smt", unit: "u2", targets: ["DSC-1"] },
  ]);
  const both = compare([]);
  expect(both.crossChecked()?.toArray().length).toBe(4);
  const restored = requireSuccess(
    parseSiblingDesignReportDocument(K.ArtifactPath.of("/reports"), "cross-check.json", both.toDocument()),
  );
  expect(restored.toDocument()).toEqual(both.toDocument());
});

test("異なるモデルの版から取得した判定は比較型の構築時に拒否する", () => {
  const first = model("a", K.ContentHash.ofText("first"));
  const second = model("b", K.ContentHash.ofText("second"));
  const target = K.TargetIdentifier.of("DSC-1");
  const unit = K.UnitName.of("u1");
  const a = report(first, "smt").scenarioVerdictFor(unit, target, first.irHash());
  const b = report(second, "quint").scenarioVerdictFor(unit, target, second.irHash());
  expect(K.ScenarioComparison.parse(a, b).ok).toBe(false);
});

test("精緻化材料は内容が同じでも別のモデル識別子には適用できない", () => {
  const first = model("a");
  const second = model("b");
  const materials = D.RefinementMaterials.inactive(D.RefinementMaterialsIdentifier.of(first.id()));
  expect([...materials.prepare(first)]).toEqual([]);
  expect(() => materials.prepare(second)).toThrow("refinement-model-mismatch");
});

test("unitのない設計用比較記録を旧形式として補完しない", () => {
  const input = model("a");
  const old = { ...report(input, "cross-check").toDocument(), crossChecked: [{ backend: "smt", targets: ["DSC-1"] }] };
  expect(parseSiblingDesignReportDocument(K.ArtifactPath.of("/reports"), "cross-check.json", old).ok).toBe(false);
});
