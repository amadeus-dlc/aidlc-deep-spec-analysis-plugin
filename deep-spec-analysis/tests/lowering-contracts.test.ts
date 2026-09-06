import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { parseDesignModel, parseSiblingVerdictDocument } from "@deep-spec-analysis/design-adapter";
import type { DesignUnit } from "@deep-spec-analysis/design-domain";
import * as D from "@deep-spec-analysis/design-domain";
import {
  VerifyDesignQuintUseCase,
  VerifyDesignSatisfiabilityModuloTheoriesUseCase,
} from "@deep-spec-analysis/design-usecase";
import { readContractSchema } from "@deep-spec-analysis/kernel-adapter";
import * as K from "@deep-spec-analysis/kernel-domain";
import { IllegalArgumentException, ok } from "@deep-spec-analysis/kernel-infrastructure";
import { ObligationIdentifier } from "@deep-spec-analysis/requirements-domain";

function unitWithGuard(nodes: number, transition: boolean, rules = 1): DesignUnit {
  const guard = { op: "and", args: Array.from({ length: nodes - 1 }, () => ({ op: "bool", value: true })) };
  const parsed = parseDesignModel({
    irKind: "design",
    irVersion: "1.0.0",
    units: [
      {
        unit: "u1",
        schema: {
          entities: [
            { name: "t", attributes: [{ name: "state", type: { kind: "enum", values: ["open", "closed"] } }] },
          ],
        },
        obligations: Array.from({ length: transition ? 0 : rules }, (_, index) => ({
          id: `DOB-${index + 1}`,
          nature: "event",
          origin: "entities",
          trigger: "save",
          guard,
          effect: { op: "bool", value: true },
        })),
        stateMachines: transition
          ? [
              {
                id: "SM-1",
                entity: "t",
                attribute: "state",
                initial: ["open"],
                transitions: [{ id: "TR-1", from: "open", to: "closed", trigger: "save", guard }],
              },
            ]
          : [],
        scenarios: [],
        background: [],
        unformalized: [],
      },
    ],
  });
  if (!parsed.ok) throw new Error(parsed.error);
  return [...parsed.value.units][0];
}

test("許容された入力の合成不能をResultで返す", () => {
  for (const transition of [false, true]) {
    const input = unitWithGuard(10_000, transition);
    const lowered = input.lowered({ synthetics: !transition });
    expect(lowered).toEqual({ ok: false, error: { kind: "expression-too-large" } });
    if (!lowered.ok) expect(lowered.error).not.toBeInstanceOf(Error);
  }
});

test("合成後の上限以内ならloweringは成功する", () => {
  expect(unitWithGuard(9998, false).lowered({ synthetics: true }).ok).toBe(true);
  expect(unitWithGuard(9996, true).lowered({ synthetics: false }).ok).toBe(true);
});

test("再構成した発行IDを保ち、追加採番が既存の由来を上書きしない", () => {
  const original = D.LoweredObligation.of({
    id: D.LoweredIdentifier.of("OB-2"),
    origin: D.LoweredOrigin.of({ kind: "passthrough", design: D.LoweredOriginReference.of("DOB-1") }),
    nature: K.ObligationNature.of("invariant"),
    functionalRequirementReferences: K.FunctionalRequirementReferences.of([]),
    assert: { op: "bool", value: true },
  });
  const seed = {
    obligations: D.LoweredObligations.of([original]),
    machines: D.DesignMachines.of([]),
    scenarios: D.LoweredScenarios.of([]),
    background: D.LoweredBackgrounds.of([]),
  };
  const initial = D.LoweredUnit.of(seed);
  const extended = initial.extendedWith(
    D.RefinementQuintInvariants.of([
      D.RefinementQuintInvariant.of(ObligationIdentifier.of("OB-9"), K.FunctionalRequirementReferences.of([]), {
        op: "bool",
        value: true,
      }),
    ]),
  );
  expect(extended.ok).toBe(true);
  if (!extended.ok) return;
  const ids = [...extended.value.obligations()].map((obligation) => obligation.id().asString());
  expect(new Set(ids).size).toBe(2);
  expect(extended.value.index().originOf("OB-2")?.design().asString()).toBe("DOB-1");
  const duplicate = { ...seed, obligations: D.LoweredObligations.of([original, original]) };
  expect(() => D.LoweredUnit.of(duplicate)).toThrow(IllegalArgumentException);
  expect(D.LoweredUnit.parse(duplicate).ok).toBe(false);
});

test("未発行のfindingやskipを含む兄弟文書を正常な結果として採用しない", () => {
  const unit = unitWithGuard(2, false);
  const lowered = unit.lowered({ synthetics: false });
  if (!lowered.ok) throw new Error("fixture must lower");
  for (const unknownKind of ["finding", "skip"]) {
    const document = parseSiblingVerdictDocument({
      backend: "smt",
      method: "exhaustive",
      irVersion: "1.0.0",
      irHash: K.ContentHash.ofText("fixture").asString(),
      findings:
        unknownKind === "finding"
          ? [{ kind: "conflict", frRefs: [], targets: ["OB-999"], witness: { core: ["unknown"] }, detail: "fixture" }]
          : [],
      skipped: unknownKind === "skip" ? [{ target: "OB-999", reason: "timeout" }] : [],
    });
    const result = document.remapVerdicts(unit, lowered.value.index());
    expect(result.unavailable).toContain("unknown-lowered-target");
    expect(result.findings.count()).toBe(0);
  }
});

test("SMTとQuintのユースケースは合成不能をcompile-errorとして保存する", () => {
  const schema = readContractSchema(resolve(import.meta.dir, "../src/entries/data/deep-spec-findings-schema.json"));
  if (!schema.ok) throw new Error("fixture schema must be readable");
  for (const UseCase of [VerifyDesignSatisfiabilityModuloTheoriesUseCase, VerifyDesignQuintUseCase]) {
    const unit = unitWithGuard(10_000, true);
    const model = D.DesignModel.compose({
      id: D.DesignModelIdentifier.of(K.ArtifactPath.of("/model.md")),
      irHash: K.ContentHash.ofText("model"),
      irVersion: K.IntermediateRepresentationVersion.of("1.0.0"),
      sourceDocument: new Uint8Array(),
      units: D.DesignUnits.of([unit]),
    });
    const saved: D.DesignVerifyDirectory[] = [];
    const unexpected = (): never => {
      throw new Error("an uncompilable unit must not invoke a backend");
    };
    const common = [
      { findById: () => ok(model), store: () => ok(undefined) },
      {
        findByDirectory: (directory: K.ArtifactPath) =>
          ok(D.DesignVerifyDirectory.of(directory, D.DesignReports.of([]), null)),
        store: (directory: D.DesignVerifyDirectory) => {
          saved.push(directory);
          return ok(undefined);
        },
      },
      K.FindingsSchema.of(schema.value),
      { runLowered: unexpected, runRefinement: unexpected, probeState: unexpected },
      { findById: (id: D.RefinementMaterialsIdentifier) => ok(D.RefinementMaterials.inactive(id)) },
    ] as const;
    const useCase =
      UseCase === VerifyDesignSatisfiabilityModuloTheoriesUseCase
        ? new VerifyDesignSatisfiabilityModuloTheoriesUseCase(...common, { check: unexpected }, { now: () => 0 })
        : new VerifyDesignQuintUseCase(...common, { now: () => 0 }, 0);
    const outcome = useCase.execute({ modelId: model.id(), verifyDirectory: K.ArtifactPath.of("/reports") });
    expect(outcome.kind).toBe("verified");
    const report = saved[0].publishedReport();
    expect(report.findingsCount()).toBe(0);
    expect(
      report
        .skipped()
        .toArray()
        .every((skip) => skip.reason() === "compile-error"),
    ).toBe(true);
    expect(report.skippedCount()).toBeGreaterThan(0);
  }
});

test("精緻化の置換とフレーム合成も式の予算違反を診断値として返す", () => {
  const large = { op: "and", args: Array.from({ length: 9999 }, () => ({ op: "bool", value: true })) };
  const mappings = D.AttributeMappings.of([
    D.AttributeMapping.of(K.AttributePath.of("r.flag"), { kind: "expression", expr: large }),
  ]);
  const substituted = mappings.substitute({ op: "not", args: [{ op: "ref", path: "r.flag" }] }, false);
  expect(substituted.ok).toBe(false);
  if (!substituted.ok) expect(substituted.error.message()).toContain("expression-too-large");
  const frame = mappings.equalityFor("r.flag");
  expect(frame.ok).toBe(false);
  if (!frame.ok) expect(frame.error.message()).toContain("expression-too-large");
});

test("発行済みIDが予算を満たす場合は追加を拒否し、再構成の名前空間も検査する", () => {
  const origin = D.LoweredOrigin.of({ kind: "passthrough", design: D.LoweredOriginReference.of("DOB-1") });
  const references = K.FunctionalRequirementReferences.of([]);
  const obligation = (id: string) =>
    D.LoweredObligation.of({
      id: D.LoweredIdentifier.of(id),
      origin,
      nature: K.ObligationNature.of("invariant"),
      functionalRequirementReferences: references,
      assert: { op: "bool", value: true },
    });
  const empty = {
    machines: D.DesignMachines.of([]),
    scenarios: D.LoweredScenarios.of([]),
    background: D.LoweredBackgrounds.of([]),
  };
  const bad = D.LoweredObligations.of([obligation("SC-1")]);
  expect(() => D.LoweredUnit.of({ ...empty, obligations: bad })).toThrow(IllegalArgumentException);
  expect(D.LoweringIndex.parse(bad, empty.scenarios, empty.machines, empty.background).ok).toBe(false);
  expect(D.LoweringIndex.parse(D.LoweredObligations.of([]), empty.scenarios, empty.machines, empty.background).ok).toBe(
    true,
  );
  const full = D.LoweredUnit.of({
    ...empty,
    obligations: D.LoweredObligations.of(Array.from({ length: 65_536 }, (_, n) => obligation(`OB-${n + 1}`))),
  });
  const extended = full.extendedWith(
    D.RefinementQuintInvariants.of([
      D.RefinementQuintInvariant.of(ObligationIdentifier.of("OB-9"), references, { op: "bool", value: true }),
    ]),
  );
  expect(extended).toEqual({ ok: false, error: { kind: "too-many-lowered-identifiers" } });
});

test("単独では有効な二規則でも包摂検査の合成予算超過をResultで返す", () => {
  const input = unitWithGuard(5000, false, 2);
  expect(input.lowered({ synthetics: false }).ok).toBe(true);
  expect(input.lowered({ synthetics: true })).toEqual({ ok: false, error: { kind: "expression-too-large" } });
});
