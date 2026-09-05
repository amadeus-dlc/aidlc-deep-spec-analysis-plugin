import { InitialState } from "@deep-spec/design-domain";
import {
  ArtifactPath,
  BackendName,
  ContentHash,
  EnumerationMember,
  EnumerationMembers,
  FindingKind,
  IntermediateRepresentationVersion,
  RequirementIdentifier,
  RequirementIdentifiers,
  SkipReason,
  TargetIdentifier,
  TargetIdentifiers,
  TriggerName,
  UnitName,
} from "@deep-spec/kernel-domain";
import { scenarioBindings } from "./binding-fixtures.ts";

// 集約 ID と ArtifactPath の DP 検査（Repository 裁定・補遺の証人）。
// 通常の生成はparse、再構成はofに揃え、
// equals は値による恒等比較。domain 90% 床のための分岐網羅。

import { describe, expect, test } from "bun:test";
import {
  AttributePaths,
  BusinessRuleReferences,
  CheckedUnits,
  DesignAttributeName,
  DesignBackgroundAssumption,
  DesignBackgroundAssumptions,
  DesignBackgroundIdentifier,
  DesignCrossCheckedEntries,
  DesignCrossCheckedEntry,
  DesignEntityDeclarations,
  DesignEntityName,
  DesignFinding,
  DesignFindings,
  DesignIgnore,
  DesignIgnores,
  DesignInputAnchor,
  DesignInputAnchors,
  DesignMachine,
  DesignMachineIdentifier,
  DesignMachines,
  DesignModelIdentifier,
  DesignObligation,
  DesignObligationIdentifier,
  DesignObligationNature,
  DesignObligationOrigin,
  DesignObligations,
  DesignReports,
  DesignScenario,
  DesignScenarioIdentifier,
  DesignScenarios,
  DesignSkipped,
  DesignSkips,
  DesignTransition,
  DesignTransitionIdentifier,
  DesignTransitions,
  DesignUnit,
  DesignUnitIdentifier,
  DesignUnits,
  DesignWitness,
  InitialStates,
  LoweredIdentifier,
  LoweredOriginReference,
  RefinementMapIdentifier,
  RefinementMaterialsIdentifier,
} from "@deep-spec/design-domain";
import { IllegalArgumentException } from "@deep-spec/kernel-infrastructure";
import { DesignRecordIdentifier } from "@deep-spec/refcheck-domain";
import {
  AttributeBound,
  AttributePath,
  BackgroundAssumption,
  BackgroundAssumptionIdentifier,
  BackgroundAssumptions,
  CrossCheckedEntries,
  CrossCheckedEntry,
  FormalModelIdentifier,
  FunctionalRequirementReferences,
  Obligation,
  ObligationIdentifier,
  ObligationIdentifiers,
  ObligationNature,
  Obligations,
  RequirementAttributeDeclaration,
  RequirementAttributeDeclarations,
  Scenario,
  ScenarioIdentifier,
  Scenarios,
  VerificationFinding,
  VerificationFindings,
  VerificationReports,
  VerificationSkipped,
  VerificationSkips,
  VerificationWitness,
} from "@deep-spec/requirements-domain";

function ap(raw: string): ArtifactPath {
  const parsed = ArtifactPath.parse(raw);
  if (!parsed.ok) throw new Error(`test fixture path is empty: ${raw}`);
  return parsed.value;
}

describe("ArtifactPath", () => {
  test("parse rejects the empty string with a materials-only error", () => {
    const parsed = ArtifactPath.parse("");
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toEqual({ kind: "empty-path" });
  });

  test("parse accepts any non-empty path and keeps the raw value", () => {
    const parsed = ArtifactPath.parse("/a/b.md");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.asString()).toBe("/a/b.md");
  });

  test("equals compares by value", () => {
    expect(ap("/a").equals(ap("/a"))).toBe(true);
    expect(ap("/a").equals(ap("/b"))).toBe(false);
  });
});

describe("aggregate ids resolve forward, by their own identity", () => {
  test("FormalModelIdentifier", () => {
    const id = FormalModelIdentifier.of(ap("/r/model.md"));
    expect(id.artifactPath().asString()).toBe("/r/model.md");
    expect(id.equals(FormalModelIdentifier.of(ap("/r/model.md")))).toBe(true);
    expect(id.equals(FormalModelIdentifier.of(ap("/r/other.md")))).toBe(false);
  });

  test("DesignModelIdentifier", () => {
    const id = DesignModelIdentifier.of(ap("/r/design.md"));
    expect(id.artifactPath().asString()).toBe("/r/design.md");
    expect(id.equals(DesignModelIdentifier.of(ap("/r/design.md")))).toBe(true);
    expect(id.equals(DesignModelIdentifier.of(ap("/r/other.md")))).toBe(false);
  });

  test("RefinementMaterialsIdentifier is anchored 1:1 to its design model", () => {
    const model = DesignModelIdentifier.of(ap("/r/design.md"));
    const id = RefinementMaterialsIdentifier.of(model);
    expect(id.modelArtifactPath().asString()).toBe("/r/design.md");
    expect(id.equals(RefinementMaterialsIdentifier.of(model))).toBe(true);
    expect(id.equals(RefinementMaterialsIdentifier.of(DesignModelIdentifier.of(ap("/r/other.md"))))).toBe(false);
  });

  test("DesignRecordIdentifier", () => {
    const id = DesignRecordIdentifier.of(ap("/r/components.md"));
    expect(id.artifactPath().asString()).toBe("/r/components.md");
    expect(id.equals(DesignRecordIdentifier.of(ap("/r/components.md")))).toBe(true);
    expect(id.equals(DesignRecordIdentifier.of(ap("/r/contract-summary.md")))).toBe(false);
  });
});

describe("DesignUnitIdentifier and RefinementMapIdentifier", () => {
  test("DesignUnitIdentifier is the unit entity's identity, compared by value", () => {
    const id = DesignUnitIdentifier.of("u1-orders");
    expect(id.asString()).toBe("u1-orders");
    expect(id.equals(DesignUnitIdentifier.of("u1-orders"))).toBe(true);
    expect(id.equals(DesignUnitIdentifier.of("u2-billing"))).toBe(false);
  });

  test("RefinementMapIdentifier is the contract-4 map aggregate's identity", () => {
    const id = RefinementMapIdentifier.of(ap("/r/deep-spec-analysis-refinement-map.md"));
    expect(id.artifactPath().asString()).toBe("/r/deep-spec-analysis-refinement-map.md");
    expect(id.equals(RefinementMapIdentifier.of(ap("/r/deep-spec-analysis-refinement-map.md")))).toBe(true);
    expect(id.equals(RefinementMapIdentifier.of(ap("/other/deep-spec-analysis-refinement-map.md")))).toBe(false);
  });
});

describe("ContentHash", () => {
  test("parse accepts exactly 64 lowercase hex chars", () => {
    const ok = ContentHash.parse("a".repeat(64));
    expect(ok.ok).toBe(true);
    for (const bad of [
      "",
      "A".repeat(64),
      "a".repeat(63),
      "a".repeat(65),
      "a".repeat(1_000_000),
      "g".repeat(64),
      "ａ".repeat(64),
      `${"a".repeat(63)}\n`,
      `${"a".repeat(64)}\n`,
    ]) {
      const parsed = ContentHash.parse(bad);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.error).toEqual({ kind: "not-a-sha256-hex", raw: bad });
    }
  });

  test("ofText matches the known digest of the empty string, and equals compares by value", () => {
    expect(ContentHash.ofText("").asString()).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(ContentHash.ofText("").equals(ContentHash.ofText(""))).toBe(true);
    expect(ContentHash.ofBytes(new Uint8Array([])).equals(ContentHash.ofText(""))).toBe(true);
    expect(ContentHash.ofText("a").equals(ContentHash.ofText("b"))).toBe(false);
  });

  test("of rejects invalid digests on every construction path", () => {
    expect(() => ContentHash.of("")).toThrow(IllegalArgumentException);
    expect(() => ContentHash.of("g".repeat(64))).toThrow(IllegalArgumentException);
    expect("reconstitute" in ContentHash).toBe(false);
  });
});

describe("IntermediateRepresentationVersion", () => {
  test("equality compares the complete preserved version, not only the supported major", () => {
    const version = IntermediateRepresentationVersion.of("1.2.3");
    const same = IntermediateRepresentationVersion.of("1.2.3");
    expect(version.equals(version)).toBe(true);
    expect(version.equals(same)).toBe(true);
    expect(same.equals(version)).toBe(true);
    for (const raw of ["2.2.3", "1.3.3", "1.2.4", "01.2.3"]) {
      expect(version.equals(IntermediateRepresentationVersion.of(raw))).toBe(false);
    }
  });

  test("parse accepts exactly major.minor.patch", () => {
    const ok = IntermediateRepresentationVersion.parse("1.2.3");
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.asString()).toBe("1.2.3");
      expect(ok.value.majorVersion()).toBe(1);
      expect(ok.value.supportsMajor(1)).toBe(true);
      expect(ok.value.supportsMajor(2)).toBe(false);
    }
    for (const bad of ["", "1.2", "v1.2.3", "1.2.3-rc1"]) {
      const parsed = IntermediateRepresentationVersion.parse(bad);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.error).toEqual({ kind: "not-a-semver", raw: bad });
    }
  });

  test("parse keeps the frozen legacy pattern: leading zeros are accepted (strict SemVer is the PR10 lift)", () => {
    const parsed = IntermediateRepresentationVersion.parse("01.2.3");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.majorVersion()).toBe(1);
  });

  test("of rejects missing versions and preserves valid major-version behavior", () => {
    expect(IntermediateRepresentationVersion.parse("").ok).toBe(false);
    const version = IntermediateRepresentationVersion.of("1.2.3");
    expect(version.majorVersion()).toBe(1);
    expect(version.supportsMajor(1)).toBe(true);
    expect(version.supportsMajor(2)).toBe(false);
  });
});

// requirements 側ファーストクラスコレクション — 不変 add・境界脱出口・集合知識。

describe("requirements first-class collections", () => {
  test("immutable add and boundary escape across the cluster", () => {
    expect(
      RequirementIdentifiers.of([]).add(RequirementIdentifier.of("FR-1")).has(RequirementIdentifier.of("FR-1")),
    ).toBe(true);
    expect(
      [...RequirementIdentifiers.of(Array.from(["FR-1"], (raw) => RequirementIdentifier.of(raw)))].map((id) =>
        id.asString(),
      ),
    ).toEqual(["FR-1"]);
    expect([...RequirementIdentifiers.extractFrom("- FR-1 と NFR-2.1").toStrings()].sort()).toEqual([
      "FR-1",
      "NFR-2.1",
    ]);

    const attrs = RequirementAttributeDeclarations.of([]).add(
      RequirementAttributeDeclaration.of({
        path: AttributePath.of("o.qty"),
        kind: "int",
        min: AttributeBound.of(0),
        max: AttributeBound.of(5),
      }),
    );
    expect(attrs.byPath(AttributePath.of("o.qty"))?.isInt()).toBe(true);
    expect(
      attrs
        .byPath(AttributePath.of("o.qty"))
        ?.match({ bool: () => "b", int: (min, max) => `${min?.asNumber()}..${max?.asNumber()}`, enum: () => "e" }),
    ).toBe("0..5");
    expect(attrs.toArray().length).toBe(1);

    const obs = Obligations.of([]).add(
      Obligation.of({
        id: ObligationIdentifier.of("OB-1"),
        nature: ObligationNature.of("invariant"),
        functionalRequirementReferences: FunctionalRequirementReferences.of(
          Array.from(["FR-1"], (raw) => RequirementIdentifier.of(raw)),
        ),
      }),
    );
    expect(obs.byId("OB-1")?.nature().asString()).toBe("invariant");
    expect(obs.ids()).toEqual(["OB-1"]);
    expect([...obs].length).toBe(1);

    const scs = Scenarios.of([]).add(
      Scenario.of({
        id: ScenarioIdentifier.of("SC-1"),
        kind: "accept",
        functionalRequirementReferences: FunctionalRequirementReferences.of([]),
        bindings: scenarioBindings({}),
      }),
    );
    expect(scs.byId("SC-1")?.kind()).toBe("accept");
    expect(scs.ids()).toEqual(["SC-1"]);

    const bgs = BackgroundAssumptions.of([]).add(
      BackgroundAssumption.of({ id: BackgroundAssumptionIdentifier.of("BG-1"), assert: { op: "bool", value: true } }),
    );
    expect([...bgs].length).toBe(1);
    expect(bgs.toArray()[0]?.id().asString()).toBe("BG-1");
    expect(bgs.toArray()[0]?.assertion()).toEqual({ op: "bool", value: true });

    const finding = VerificationFinding.of({
      kind: FindingKind.of("conflict"),
      functionalRequirementReferences: FunctionalRequirementReferences.of([]),
      targets: TargetIdentifiers.of(Array.from(["OB-1"], (raw) => TargetIdentifier.of(raw))),
      witness: VerificationWitness.core([]),
      detail: "d",
    });
    const fs = VerificationFindings.of([]).add(finding);
    expect(fs.isEmpty()).toBe(false);
    expect(fs.count()).toBe(1);
    expect([...fs.sortedCanonically()]).toEqual([finding]);

    const sk = VerificationSkips.of([])
      .add(VerificationSkipped.of({ target: TargetIdentifier.of("OB-2"), reason: SkipReason.of("timeout") }))
      .concat(
        VerificationSkips.of([
          VerificationSkipped.of({ target: TargetIdentifier.of("OB-1"), reason: SkipReason.of("capability") }),
        ]),
      );
    expect(sk.count()).toBe(2);
    expect(
      sk
        .sortedCanonically()
        .toArray()
        .map((s) => s.target().asString()),
    ).toEqual(["OB-1", "OB-2"]);

    const cc = CrossCheckedEntries.of([]).add(
      CrossCheckedEntry.of({
        backend: BackendName.of("smt"),
        targets: TargetIdentifiers.of(Array.from(["SC-1"], (raw) => TargetIdentifier.of(raw))),
      }),
    );
    expect([...cc].length).toBe(1);
    expect(cc.toArray()[0]?.backend().asString()).toBe("smt");

    expect([...VerificationReports.of([])].length).toBe(0);
  });
});

// design 側ファーストクラスコレクション — 不変 add・境界脱出口・集合知識。

describe("design first-class collections", () => {
  const ob = DesignObligation.of({
    id: DesignObligationIdentifier.of("DOB-1"),
    nature: DesignObligationNature.of("invariant"),
    origin: DesignObligationOrigin.of(""),
    businessRuleReferences: BusinessRuleReferences.of([]),
    functionalRequirementReferences: FunctionalRequirementReferences.of([]),
    assert: { op: "bool", value: true },
  });
  const machine = DesignMachine.of({
    id: DesignMachineIdentifier.of("SM-1"),
    entity: DesignEntityName.of("T"),
    attribute: DesignAttributeName.of("s"),
    initial: InitialStates.of(["a"].map((value) => InitialState.of(value))),
    deterministic: true,
    transitions: DesignTransitions.of([
      DesignTransition.of({
        id: DesignTransitionIdentifier.of("TR-1"),
        from: "a",
        to: "b",
        trigger: TriggerName.of("t"),
        businessRuleReferences: BusinessRuleReferences.of([]),
      }),
    ]),
    ignores: DesignIgnores.of([]),
  });

  test("immutable add, iteration, and set knowledge", () => {
    expect(DesignObligations.of([]).add(ob).ids()).toEqual(["DOB-1"]);
    expect([...DesignObligations.of([ob])].length).toBe(1);
    expect(DesignMachines.of([]).add(machine).transitionIds()).toEqual(["TR-1"]);
    expect([...DesignMachines.of([machine])].length).toBe(1);
    expect(DesignMachines.of([machine]).toArray().length).toBe(1);
    expect(DesignObligations.of([ob]).toArray().length).toBe(1);
    expect(
      DesignScenarios.of([
        DesignScenario.of({
          id: DesignScenarioIdentifier.of("DSC-9"),
          kind: "reject",
          businessRuleReferences: BusinessRuleReferences.of([]),
          functionalRequirementReferences: FunctionalRequirementReferences.of([]),
          bindings: scenarioBindings({}),
        }),
      ]).toArray().length,
    ).toBe(1);
    expect(
      DesignScenarios.of([])
        .add(
          DesignScenario.of({
            id: DesignScenarioIdentifier.of("DSC-1"),
            kind: "accept",
            businessRuleReferences: BusinessRuleReferences.of([]),
            functionalRequirementReferences: FunctionalRequirementReferences.of([]),
            bindings: scenarioBindings({}),
          }),
        )
        .ids(),
    ).toEqual(["DSC-1"]);
    expect([...DesignScenarios.of([])].length).toBe(0);
    expect(
      DesignBackgroundAssumptions.of([])
        .add(
          DesignBackgroundAssumption.of({
            id: DesignBackgroundIdentifier.of("DBG-1"),
            assert: { op: "bool", value: true },
          }),
        )
        .toArray().length,
    ).toBe(1);
    expect([...DesignBackgroundAssumptions.of([])].length).toBe(0);
    const paths = AttributePaths.of(["T.s"].map((value) => AttributePath.of(value))).add(AttributePath.of("T.x"));
    expect(paths.has(AttributePath.of("T.x"))).toBe(true);
    expect([...paths].map((value) => value.asString()).sort()).toEqual(["T.s", "T.x"]);
    expect([...AttributePaths.of([]).toArray()]).toEqual([]);

    const u = DesignUnit.of({
      unit: "u2",
      entities: DesignEntityDeclarations.of([]),
      obligations: DesignObligations.of([ob]),
      machines: DesignMachines.of([machine]),
      scenarios: DesignScenarios.of([]),
      background: DesignBackgroundAssumptions.of([]),
    });
    const units = DesignUnits.of([]).add(u);
    expect(units.isEmpty()).toBe(false);
    expect(units.sortedByName().toArray()[0]?.name()).toBe("u2");
    expect([...units].length).toBe(1);

    const finding = DesignFinding.of({
      kind: FindingKind.of("conflict"),
      functionalRequirementReferences: FunctionalRequirementReferences.of([]),
      targets: TargetIdentifiers.of(Array.from(["DOB-1"], (raw) => TargetIdentifier.of(raw))),
      witness: DesignWitness.refs([]),
      unit: UnitName.of("u2"),
      detail: "d",
    });
    const fs = DesignFindings.of([]).add(finding);
    expect(fs.isEmpty()).toBe(false);
    expect(fs.count()).toBe(1);
    expect([...fs.sortedCanonically()].length).toBe(1);
    const sk = DesignSkips.of([])
      .add(
        DesignSkipped.of({
          target: TargetIdentifier.of("DOB-1"),
          reason: SkipReason.of("timeout"),
          unit: UnitName.of("u2"),
        }),
      )
      .concat(
        DesignSkips.of([
          DesignSkipped.of({
            target: TargetIdentifier.of("DOB-0"),
            reason: SkipReason.of("capability"),
            unit: UnitName.of("u2"),
          }),
        ]),
      );
    expect(sk.count()).toBe(2);
    expect(sk.sortedCanonically().toArray()[0]?.target().asString()).toBe("DOB-0");
    expect([...sk].length).toBe(2);

    const anchors = DesignInputAnchors.of([])
      .add(DesignInputAnchor.of({ artifact: "b.md", sha256: ContentHash.of("2".repeat(64)) }))
      .add(DesignInputAnchor.of({ artifact: "a.md", sha256: ContentHash.of("1".repeat(64)) }));
    expect(
      anchors
        .sortedByArtifact()
        .toArray()
        .map((a) => a.artifact()),
    ).toEqual(["a.md", "b.md"]);
    expect([...anchors].length).toBe(2);

    const checked = CheckedUnits.of(Array.from(["unit:u2", "unit:u1", "unit:u1"], (raw) => UnitName.of(raw))).add(
      UnitName.of("unit:u3"),
    );
    expect(checked.sortedUniqueCanonically().toStrings()).toEqual(["unit:u1", "unit:u2", "unit:u3"]);
    expect([...checked].length).toBe(4);

    const cc = DesignCrossCheckedEntries.of([]).add(
      DesignCrossCheckedEntry.of({
        backend: BackendName.of("smt"),
        targets: TargetIdentifiers.of(Array.from(["DSC-1"], (raw) => TargetIdentifier.of(raw))),
      }),
    );
    expect(cc.toArray()[0]?.backend().asString()).toBe("smt");
    expect([...cc].length).toBe(1);
    expect([...DesignReports.of([])].length).toBe(0);
    expect(DesignReports.of([]).toArray().length).toBe(0);
  });
});

describe("requirements value collections (first-class operations)", () => {
  test("FunctionalRequirementReferences and EnumerationMembers hold declaration order and ordinal knowledge", () => {
    const refs = FunctionalRequirementReferences.of(Array.from(["FR-2"], (raw) => RequirementIdentifier.of(raw))).add(
      RequirementIdentifier.of("FR-1"),
    );
    expect([...refs].map((r) => r.asString())).toEqual(["FR-2", "FR-1"]);
    expect(refs.toStrings()).toEqual(["FR-2", "FR-1"]);

    const values = EnumerationMembers.of(["open"].map((value) => EnumerationMember.of(value))).add(
      EnumerationMember.of("closed"),
    );
    expect([...values].map((value) => value.asString())).toEqual(["open", "closed"]);
    expect(values.indexOf("closed")).toBe(1);
    expect(values.indexOf("ghost")).toBe(-1);
    expect(values.valueAt(0)?.asString()).toBe("open");
    expect(values.valueAt(9)).toBe(undefined);
    expect(values.count()).toBe(2);
    expect(values.toArray().map((value) => value.asString())).toEqual(["open", "closed"]);
  });
});

describe("design part collections (first-class operations)", () => {
  test("DesignTransitions and DesignIgnores own their frozen orders under add", () => {
    const t1 = DesignTransition.of({
      id: DesignTransitionIdentifier.of("TR-2"),
      from: "a",
      to: "b",
      trigger: TriggerName.of("t"),
      businessRuleReferences: BusinessRuleReferences.of([]),
    });
    const t2 = DesignTransition.of({
      id: DesignTransitionIdentifier.of("TR-10"),
      from: "a",
      to: "b",
      trigger: TriggerName.of("t"),
      businessRuleReferences: BusinessRuleReferences.of([]),
    });
    const trs = DesignTransitions.of([t2]).add(t1);
    expect([...trs].length).toBe(2);
    expect(trs.ids()).toEqual(["TR-10", "TR-2"]);
    expect(
      trs
        .sortedCanonically()
        .toArray()
        .map((t) => t.id().asString()),
    ).toEqual(["TR-2", "TR-10"]);

    const igs = DesignIgnores.of([DesignIgnore.of({ state: "y", trigger: TriggerName.of("go") })]).add(
      DesignIgnore.of({ state: "x", trigger: TriggerName.of("go") }),
    );
    expect([...igs].length).toBe(2);
    expect(
      igs
        .sortedByStateTrigger()
        .toArray()
        .map((i) => i.state()),
    ).toEqual(["x", "y"]);
    expect(igs.toArray().length).toBe(2);
  });
});

describe("requirements identity primitives (issue #46 wave 5a)", () => {
  test("parse rejects the empty token, of constructs valid values, equals is by value", () => {
    expect(ObligationIdentifier.parse("").ok).toBe(false);
    const ob = ObligationIdentifier.parse("OB-1");
    if (!ob.ok) throw new Error("unreachable");
    expect(ob.value.equals(ObligationIdentifier.of("OB-1"))).toBe(true);
    expect(ob.value.asString()).toBe("OB-1");

    expect(ScenarioIdentifier.parse("").ok).toBe(false);
    const sc = ScenarioIdentifier.parse("SC-1");
    if (!sc.ok) throw new Error("unreachable");
    expect(sc.value.equals(ScenarioIdentifier.of("SC-1"))).toBe(true);

    expect(BackgroundAssumptionIdentifier.parse("").ok).toBe(false);
    const bg = BackgroundAssumptionIdentifier.parse("BG-1");
    if (!bg.ok) throw new Error("unreachable");
    expect(bg.value.equals(BackgroundAssumptionIdentifier.of("BG-1"))).toBe(true);
    expect(bg.value.asString()).toBe("BG-1");

    expect(AttributePath.parse("").ok).toBe(false);
    const ap2 = AttributePath.parse("T.x");
    if (!ap2.ok) throw new Error("unreachable");
    expect(ap2.value.equals(AttributePath.of("T.x"))).toBe(true);
    expect(ap2.value.asString()).toBe("T.x");

    expect(AttributeBound.parse(1.5).ok).toBe(false);
    const b = AttributeBound.parse(-3);
    if (!b.ok) throw new Error("unreachable");
    expect(b.value.equals(AttributeBound.of(-3))).toBe(true);
    expect(b.value.asNumber()).toBe(-3);
  });

  test("ObligationNature owns the known-nature predicates; unknown natures pass through", () => {
    expect(ObligationNature.of("invariant").isInvariant()).toBe(true);
    expect(ObligationNature.of("numeric").isNumeric()).toBe(true);
    expect(ObligationNature.of("event").isEvent()).toBe(true);
    expect(ObligationNature.of("state-temporal").isStateTemporal()).toBe(true);
    const mystery = ObligationNature.of("mystery");
    expect(mystery.isInvariant() || mystery.isNumeric() || mystery.isEvent() || mystery.isStateTemporal()).toBe(false);
    expect(mystery.asString()).toBe("mystery");
    expect(mystery.equals(ObligationNature.of("mystery"))).toBe(true);
  });

  test("BackendName parses strictly and rehydrates verbatim", () => {
    expect(BackendName.parse("").ok).toBe(false);
    const b = BackendName.parse("smt");
    if (!b.ok) throw new Error("unreachable");
    expect(b.value.equals(BackendName.of("smt"))).toBe(true);
    expect(b.value.asString()).toBe("smt");
  });
});

describe("design identity primitives (issue #46 wave 5b)", () => {
  test("parse rejects the empty token, of constructs valid values, equals is by value", () => {
    expect(DesignObligationIdentifier.parse("").ok).toBe(false);
    const ob = DesignObligationIdentifier.parse("DOB-1");
    if (!ob.ok) throw new Error("unreachable");
    expect(ob.value.equals(DesignObligationIdentifier.of("DOB-1"))).toBe(true);
    expect(ob.value.asString()).toBe("DOB-1");

    expect(DesignScenarioIdentifier.parse("").ok).toBe(false);
    const sc = DesignScenarioIdentifier.parse("DSC-1");
    if (!sc.ok) throw new Error("unreachable");
    expect(sc.value.equals(DesignScenarioIdentifier.of("DSC-1"))).toBe(true);
    expect(sc.value.asString()).toBe("DSC-1");

    expect(DesignTransitionIdentifier.parse("").ok).toBe(false);
    const tr = DesignTransitionIdentifier.parse("TR-1");
    if (!tr.ok) throw new Error("unreachable");
    expect(tr.value.equals(DesignTransitionIdentifier.of("TR-1"))).toBe(true);
    expect(tr.value.asString()).toBe("TR-1");

    expect(DesignBackgroundIdentifier.parse("").ok).toBe(false);
    const bg = DesignBackgroundIdentifier.parse("DBG-1");
    if (!bg.ok) throw new Error("unreachable");
    expect(bg.value.equals(DesignBackgroundIdentifier.of("DBG-1"))).toBe(true);
    expect(bg.value.asString()).toBe("DBG-1");

    expect(DesignMachineIdentifier.parse("").ok).toBe(false);
    const sm = DesignMachineIdentifier.parse("SM-1");
    if (!sm.ok) throw new Error("unreachable");
    expect(sm.value.equals(DesignMachineIdentifier.of("SM-1"))).toBe(true);
    expect(sm.value.asString()).toBe("SM-1");

    expect(DesignEntityName.parse("").ok).toBe(false);
    const en = DesignEntityName.parse("Ticket");
    if (!en.ok) throw new Error("unreachable");
    expect(en.value.equals(DesignEntityName.of("Ticket"))).toBe(true);
    expect(en.value.asString()).toBe("Ticket");

    expect(DesignAttributeName.parse("").ok).toBe(false);
    const an = DesignAttributeName.parse("status");
    if (!an.ok) throw new Error("unreachable");
    expect(an.value.equals(DesignAttributeName.of("status"))).toBe(true);
    expect(an.value.asString()).toBe("status");
  });

  test("DesignObligationNature owns event/invariant predicates; unknown natures pass through", () => {
    expect(DesignObligationNature.of("event").isEvent()).toBe(true);
    expect(DesignObligationNature.of("invariant").isInvariant()).toBe(true);
    const mystery = DesignObligationNature.of("mystery");
    expect(mystery.isEvent() || mystery.isInvariant()).toBe(false);
    expect(mystery.asString()).toBe("mystery");
    expect(mystery.equals(DesignObligationNature.of("mystery"))).toBe(true);
  });

  test("DesignObligationOrigin owns the rules predicate; the empty origin passes through", () => {
    expect(DesignObligationOrigin.of("rules").isRules()).toBe(true);
    const undeclared = DesignObligationOrigin.of("");
    expect(undeclared.isRules()).toBe(false);
    expect(undeclared.asString()).toBe("");
    expect(undeclared.equals(DesignObligationOrigin.of(""))).toBe(true);
  });
});

describe("DesignMachines frozen probe order (PR#55 review)", () => {
  test("sortedById restores id order regardless of input order (legacy verbatim comparator)", () => {
    const mk = (id: string) =>
      DesignMachine.of({
        id: DesignMachineIdentifier.of(id),
        entity: DesignEntityName.of("Ticket"),
        attribute: DesignAttributeName.of("status"),
        initial: InitialStates.of(["open"].map((value) => InitialState.of(value))),
        deterministic: true,
        transitions: DesignTransitions.of([]),
        ignores: DesignIgnores.of([]),
      });
    const sorted = DesignMachines.of([mk("SM-2"), mk("SM-1")]).sortedById();
    expect(sorted.toArray().map((m) => m.id().asString())).toEqual(["SM-1", "SM-2"]);
  });
});

describe("DesignObligationNature closed set (tell-don't-ask consolidation)", () => {
  test("owns all four nature predicates; unknown natures pass through", () => {
    expect(DesignObligationNature.of("numeric").isNumeric()).toBe(true);
    expect(DesignObligationNature.of("state-temporal").isStateTemporal()).toBe(true);
    const mystery = DesignObligationNature.of("mystery");
    expect(mystery.isNumeric() || mystery.isStateTemporal()).toBe(false);
  });
});

describe("TriggerName (issue #46 wave 5c-3)", () => {
  test("of rejects empty triggers and preserves token equality", () => {
    expect(TriggerName.parse("").ok).toBe(false);
    const trigger = TriggerName.of("submit");
    expect(trigger.asString()).toBe("submit");
    expect(trigger.equals(TriggerName.of("submit"))).toBe(true);
    expect(trigger.equals(TriggerName.of("cancel"))).toBe(false);
  });
});

describe("lowered identity primitives and ObligationIdentifiers (issue #46 wave 5d)", () => {
  test("LoweredIdentifier / LoweredOriginReference parse-reject the empty token and rehydrate verbatim", () => {
    expect(LoweredIdentifier.parse("").ok).toBe(false);
    const lid = LoweredIdentifier.parse("OB-1");
    if (!lid.ok) throw new Error("unreachable");
    expect(lid.value.equals(LoweredIdentifier.of("OB-1"))).toBe(true);
    expect(lid.value.asString()).toBe("OB-1");

    expect(LoweredOriginReference.parse("").ok).toBe(false);
    const ref = LoweredOriginReference.parse("TR-1");
    if (!ref.ok) throw new Error("unreachable");
    expect(ref.value.equals(LoweredOriginReference.of("TR-1"))).toBe(true);
    expect(ref.value.asString()).toBe("TR-1");
  });

  test("ObligationIdentifiers keeps declaration order and escapes only at the boundary", () => {
    const ids = ObligationIdentifiers.of([ObligationIdentifier.of("OB-2")]).add(ObligationIdentifier.of("OB-1"));
    expect([...ids].map((i) => i.asString())).toEqual(["OB-2", "OB-1"]);
    expect(ids.isEmpty()).toBe(false);
    expect(ObligationIdentifiers.of([]).isEmpty()).toBe(true);
    expect(ids.toStrings()).toEqual(["OB-2", "OB-1"]);
  });
});
