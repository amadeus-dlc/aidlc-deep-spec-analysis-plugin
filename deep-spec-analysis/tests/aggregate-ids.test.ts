import {
  SkipReason,
  FindingKind,
  TriggerName,
  ArtifactPath,
  BackendName,
  ContentHash,
  IrVersion,
  TargetId,
  TargetIds,
  RequirementId,
  UnitName,
  RequirementIds,
} from "@deep-spec/kernel-domain";

// 集約 ID と ArtifactPath の DP 検査（Repository 裁定・補遺の証人）。
// parse は境界の唯一の構築口、ID は of/ofModel が唯一の構築口で、
// equals は値による恒等比較。domain 90% 床のための分岐網羅。

import { describe, expect, test } from "bun:test";

import {
  DesignAttributeName,
  DesignBackgroundId,
  DesignEntityName,
  DesignFinding,
  DesignMachine,
  DesignMachineId,
  DesignObligationId,
  DesignObligationNature,
  DesignObligationOrigin,
  DesignScenarioId,
  DesignTransitionId,
  BrRefs,
  DesignIgnores,
  DesignModelId,
  DesignIgnore,
  DesignTransition,
  DesignTransitions,
  DesignUnitId,
  InitialStates,
  RefinementMaterialsId,
  LoweredOriginRef,
  LoweredId,
  DesignSkipped,
  DesignInputAnchor,
  DesignCrossCheckedEntry,
  DesignWitness,
  DesignEntityDecls
} from "@deep-spec/design-domain";
import { RefinementMapId } from "@deep-spec/design-domain";
import {
  AttrPaths,
  CheckedUnits,
  DesignBackgroundAssumptions,
  DesignBackgroundAssumption,
  DesignCrossCheckedEntries,
  DesignFindings,
  DesignInputAnchors,
  DesignMachines,
  DesignObligations,
  DesignObligation,
  DesignReports,
  DesignScenarios,
  DesignScenario,
  DesignSkips,
  DesignUnit,
  DesignUnits,
} from "@deep-spec/design-domain";
import { ObligationIds,
  VerificationSkipped,
  VerificationFinding,
  CrossCheckedEntry,
 VerificationWitness,} from "@deep-spec/requirements-domain";
import { FormalModelId } from "@deep-spec/requirements-domain";
import {
  AttributeBound,
  AttributeDeclarations,
  AttributeDeclaration,
  AttributePath,
  AttributeValues,
  BackgroundAssumptionId,
  FrRefs,
  ObligationId,
  ObligationNature,
  ScenarioId,
  BackgroundAssumptions,
  BackgroundAssumption,
  CrossCheckedEntries,
  Obligations,
  Obligation,
  Scenarios,
  Scenario,
  VerificationFindings,
  VerificationReports,
  VerificationSkips,
} from "@deep-spec/requirements-domain";

import { DesignRecordId } from "@deep-spec/refcheck-domain";

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
  test("FormalModelId", () => {
    const id = FormalModelId.of(ap("/r/model.md"));
    expect(id.artifactPath().asString()).toBe("/r/model.md");
    expect(id.equals(FormalModelId.of(ap("/r/model.md")))).toBe(true);
    expect(id.equals(FormalModelId.of(ap("/r/other.md")))).toBe(false);
  });

  test("DesignModelId", () => {
    const id = DesignModelId.of(ap("/r/design.md"));
    expect(id.artifactPath().asString()).toBe("/r/design.md");
    expect(id.equals(DesignModelId.of(ap("/r/design.md")))).toBe(true);
    expect(id.equals(DesignModelId.of(ap("/r/other.md")))).toBe(false);
  });

  test("RefinementMaterialsId is anchored 1:1 to its design model", () => {
    const model = DesignModelId.of(ap("/r/design.md"));
    const id = RefinementMaterialsId.ofModel(model);
    expect(id.modelArtifactPath().asString()).toBe("/r/design.md");
    expect(id.equals(RefinementMaterialsId.ofModel(model))).toBe(true);
    expect(id.equals(RefinementMaterialsId.ofModel(DesignModelId.of(ap("/r/other.md"))))).toBe(false);
  });

  test("DesignRecordId", () => {
    const id = DesignRecordId.of(ap("/r/components.md"));
    expect(id.artifactPath().asString()).toBe("/r/components.md");
    expect(id.equals(DesignRecordId.of(ap("/r/components.md")))).toBe(true);
    expect(id.equals(DesignRecordId.of(ap("/r/contract-summary.md")))).toBe(false);
  });
});

describe("DesignUnitId and RefinementMapId", () => {
  test("DesignUnitId is the unit entity's identity, compared by value", () => {
    const id = DesignUnitId.of("u1-orders");
    expect(id.asString()).toBe("u1-orders");
    expect(id.equals(DesignUnitId.of("u1-orders"))).toBe(true);
    expect(id.equals(DesignUnitId.of("u2-billing"))).toBe(false);
  });

  test("RefinementMapId is the contract-4 map aggregate's identity", () => {
    const id = RefinementMapId.of(ap("/r/deep-spec-analysis-refinement-map.md"));
    expect(id.artifactPath().asString()).toBe("/r/deep-spec-analysis-refinement-map.md");
    expect(id.equals(RefinementMapId.of(ap("/r/deep-spec-analysis-refinement-map.md")))).toBe(true);
    expect(id.equals(RefinementMapId.of(ap("/other/deep-spec-analysis-refinement-map.md")))).toBe(false);
  });
});

describe("ContentHash", () => {
  test("parse accepts exactly 64 lowercase hex chars", () => {
    const ok = ContentHash.parse("a".repeat(64));
    expect(ok.ok).toBe(true);
    for (const bad of ["", "A".repeat(64), "a".repeat(63), "g".repeat(64)]) {
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
    expect(ContentHash.parse("").ok).toBe(false);
    expect(ContentHash.parse("not-a-digest").ok).toBe(false);
    expect("reconstitute" in ContentHash).toBe(false);
  });
});

describe("IrVersion", () => {
  test("equality compares the complete preserved version, not only the supported major", () => {
    const version = IrVersion.of("1.2.3");
    const same = IrVersion.of("1.2.3");
    expect(version.equals(version)).toBe(true);
    expect(version.equals(same)).toBe(true);
    expect(same.equals(version)).toBe(true);
    for (const raw of ["2.2.3", "1.3.3", "1.2.4", "01.2.3"]) {
      expect(version.equals(IrVersion.of(raw))).toBe(false);
    }
  });

  test("parse accepts exactly major.minor.patch", () => {
    const ok = IrVersion.parse("1.2.3");
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.asString()).toBe("1.2.3");
      expect(ok.value.majorVersion()).toBe(1);
      expect(ok.value.supportsMajor(1)).toBe(true);
      expect(ok.value.supportsMajor(2)).toBe(false);
    }
    for (const bad of ["", "1.2", "v1.2.3", "1.2.3-rc1"]) {
      const parsed = IrVersion.parse(bad);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.error).toEqual({ kind: "not-a-semver", raw: bad });
    }
  });

  test("parse keeps the frozen legacy pattern: leading zeros are accepted (strict SemVer is the PR10 lift)", () => {
    const parsed = IrVersion.parse("01.2.3");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.majorVersion()).toBe(1);
  });

  test("of rejects missing versions and preserves valid major-version behavior", () => {
    expect(IrVersion.parse("").ok).toBe(false);
    const version = IrVersion.of("1.2.3");
    expect(version.majorVersion()).toBe(1);
    expect(version.supportsMajor(1)).toBe(true);
    expect(version.supportsMajor(2)).toBe(false);
  });
});

// requirements 側ファーストクラスコレクション — 不変 add・境界脱出口・集合知識。

describe("requirements first-class collections", () => {
  test("immutable add and boundary escape across the cluster", () => {
    expect(RequirementIds.of([]).add(RequirementId.of("FR-1")).has(RequirementId.of("FR-1"))).toBe(true);
    expect([...RequirementIds.of(Array.from(["FR-1"], (raw) => RequirementId.of(raw)))].map((id) => id.asString())).toEqual(["FR-1"]);
    expect([...RequirementIds.extractFrom("- FR-1 と NFR-2.1").toStrings()].sort()).toEqual(["FR-1", "NFR-2.1"]);

    const attrs = AttributeDeclarations.of([]).add(AttributeDeclaration.of({ path: AttributePath.of("o.qty"), kind: "int", min: AttributeBound.of(0), max: AttributeBound.of(5) }));
    expect(attrs.byPath(AttributePath.of("o.qty"))?.isInt()).toBe(true);
    expect(attrs.byPath(AttributePath.of("o.qty"))?.match({ bool: () => "b", int: (min, max) => `${min?.asNumber()}..${max?.asNumber()}`, enum: () => "e" })).toBe("0..5");
    expect(attrs.toArray().length).toBe(1);

    const obs = Obligations.of([]).add(Obligation.of({ id: ObligationId.of("OB-1"), nature: ObligationNature.of("invariant"), frRefs: FrRefs.of(Array.from(["FR-1"], (raw) => RequirementId.of(raw))) }));
    expect(obs.byId("OB-1")?.nature().asString()).toBe("invariant");
    expect(obs.ids()).toEqual(["OB-1"]);
    expect([...obs].length).toBe(1);

    const scs = Scenarios.of([]).add(Scenario.of({ id: ScenarioId.of("SC-1"), kind: "accept", frRefs: FrRefs.of([]), bindings: {} }));
    expect(scs.byId("SC-1")?.kind()).toBe("accept");
    expect(scs.ids()).toEqual(["SC-1"]);

    const bgs = BackgroundAssumptions.of([]).add(BackgroundAssumption.of({ id: BackgroundAssumptionId.of("B1"), assert: { op: "bool", value: true } }));
    expect([...bgs].length).toBe(1);
    expect(bgs.toArray()[0]?.id().asString()).toBe("B1");
    expect(bgs.toArray()[0]?.assertion()).toEqual({ op: "bool", value: true });

    const finding = VerificationFinding.of({ kind: FindingKind.of("conflict"), frRefs: FrRefs.of([]), targets: TargetIds.of(Array.from(["OB-1"], (raw) => TargetId.of(raw))), witness: VerificationWitness.core([]), detail: "d" });
    const fs = VerificationFindings.of([]).add(finding);
    expect(fs.isEmpty()).toBe(false);
    expect(fs.count()).toBe(1);
    expect([...fs.sortedCanonically()]).toEqual([finding]);

    const sk = VerificationSkips.of([]).add(VerificationSkipped.of({ target: TargetId.of("OB-2"), reason: SkipReason.of("timeout")}))
      .concat(VerificationSkips.of([VerificationSkipped.of({ target: TargetId.of("OB-1"), reason: SkipReason.of("capability")})]));
    expect(sk.count()).toBe(2);
    expect(sk.sortedCanonically().toArray().map((s) => s.target().asString())).toEqual(["OB-1", "OB-2"]);

    const cc = CrossCheckedEntries.of([]).add(CrossCheckedEntry.of({ backend: BackendName.of("smt"), targets: TargetIds.of(Array.from(["SC-1"], (raw) => TargetId.of(raw))) }));
    expect([...cc].length).toBe(1);
    expect(cc.toArray()[0]?.backend().asString()).toBe("smt");

    expect([...VerificationReports.of([])].length).toBe(0);
  });
});

// design 側ファーストクラスコレクション — 不変 add・境界脱出口・集合知識。

describe("design first-class collections", () => {
  const ob = DesignObligation.of({ id: DesignObligationId.of("DOB-1"), nature: DesignObligationNature.of("invariant"), origin: DesignObligationOrigin.of(""), brRefs: BrRefs.of([]), frRefs: FrRefs.of([]), assert: { op: "bool", value: true } });
  const machine = DesignMachine.of({
    id: DesignMachineId.of("SM-1"),
    entity: DesignEntityName.of("T"),
    attribute: DesignAttributeName.of("s"),
    initial: InitialStates.of(["a"]),
    deterministic: true,
    transitions: DesignTransitions.of([DesignTransition.of({ id: DesignTransitionId.of("TR-1"), from: "a", to: "b", trigger: TriggerName.of("t"), brRefs: BrRefs.of([]) })]),
    ignores: DesignIgnores.of([]),
  });

  test("immutable add, iteration, and set knowledge", () => {
    expect(DesignObligations.of([]).add(ob).ids()).toEqual(["DOB-1"]);
    expect([...DesignObligations.of([ob])].length).toBe(1);
    expect(DesignMachines.of([]).add(machine).transitionIds()).toEqual(["TR-1"]);
    expect([...DesignMachines.of([machine])].length).toBe(1);
    expect(DesignMachines.of([machine]).toArray().length).toBe(1);
    expect(DesignObligations.of([ob]).toArray().length).toBe(1);
    expect(DesignScenarios.of([DesignScenario.of({ id: DesignScenarioId.of("DSC-9"), kind: "reject", brRefs: BrRefs.of([]), frRefs: FrRefs.of([]), bindings: {} })]).toArray().length).toBe(1);
    expect(DesignScenarios.of([]).add(DesignScenario.of({ id: DesignScenarioId.of("DSC-1"), kind: "accept", brRefs: BrRefs.of([]), frRefs: FrRefs.of([]), bindings: {} })).ids()).toEqual(["DSC-1"]);
    expect([...DesignScenarios.of([])].length).toBe(0);
    expect(DesignBackgroundAssumptions.of([]).add(DesignBackgroundAssumption.of({ id: DesignBackgroundId.of("DBG-1"), assert: { op: "bool", value: true } })).toArray().length).toBe(1);
    expect([...DesignBackgroundAssumptions.of([])].length).toBe(0);
    const paths = AttrPaths.of(["T.s"]).add("T.x");
    expect(paths.has("T.x")).toBe(true);
    expect([...paths].sort()).toEqual(["T.s", "T.x"]);
    expect([...AttrPaths.of([]).toArray()]).toEqual([]);

    const u = DesignUnit.of({
      unit: "u2", entities: DesignEntityDecls.of([]),
      obligations: DesignObligations.of([ob]),
      machines: DesignMachines.of([machine]),
      scenarios: DesignScenarios.of([]),
      background: DesignBackgroundAssumptions.of([]),
    });
    const units = DesignUnits.of([]).add(u);
    expect(units.isEmpty()).toBe(false);
    expect(units.sortedByName().toArray()[0]?.name()).toBe("u2");
    expect([...units].length).toBe(1);

    const finding = DesignFinding.of({ kind: FindingKind.of("conflict"), frRefs: FrRefs.of([]), targets: TargetIds.of(Array.from(["DOB-1"], (raw) => TargetId.of(raw))), witness: DesignWitness.refs([]), unit: UnitName.of("u2"), detail: "d" });
    const fs = DesignFindings.of([]).add(finding);
    expect(fs.isEmpty()).toBe(false);
    expect(fs.count()).toBe(1);
    expect([...fs.sortedCanonically()].length).toBe(1);
    const sk = DesignSkips.of([]).add(DesignSkipped.of({ target: TargetId.of("DOB-1"), reason: SkipReason.of("timeout"), unit: UnitName.of("u2")}))
      .concat(DesignSkips.of([DesignSkipped.of({ target: TargetId.of("DOB-0"), reason: SkipReason.of("capability"), unit: UnitName.of("u2")})]));
    expect(sk.count()).toBe(2);
    expect(sk.sortedCanonically().toArray()[0]?.target().asString()).toBe("DOB-0");
    expect([...sk].length).toBe(2);

    const anchors = DesignInputAnchors.of([]).add(DesignInputAnchor.of({ artifact: "b.md", sha256: ContentHash.of("2".repeat(64)) }))
      .add(DesignInputAnchor.of({ artifact: "a.md", sha256: ContentHash.of("1".repeat(64)) }));
    expect(anchors.sortedByArtifact().toArray().map((a) => a.artifact())).toEqual(["a.md", "b.md"]);
    expect([...anchors].length).toBe(2);

    const checked = CheckedUnits.of(Array.from(["unit:u2", "unit:u1", "unit:u1"], (raw) => UnitName.of(raw))).add(UnitName.of("unit:u3"));
    expect(checked.sortedUniqueCanonically().toStrings()).toEqual(["unit:u1", "unit:u2", "unit:u3"]);
    expect([...checked].length).toBe(4);

    const cc = DesignCrossCheckedEntries.of([]).add(DesignCrossCheckedEntry.of({ backend: BackendName.of("smt"), targets: TargetIds.of(Array.from(["DSC-1"], (raw) => TargetId.of(raw))) }));
    expect(cc.toArray()[0]?.backend().asString()).toBe("smt");
    expect([...cc].length).toBe(1);
    expect([...DesignReports.of([])].length).toBe(0);
    expect(DesignReports.of([]).toArray().length).toBe(0);
  });
});

describe("requirements value collections (first-class operations)", () => {
  test("FrRefs and AttributeValues hold declaration order and ordinal knowledge", () => {
    const refs = FrRefs.of(Array.from(["FR-2"], (raw) => RequirementId.of(raw))).add(RequirementId.of("FR-1"));
    expect([...refs].map((r) => r.asString())).toEqual(["FR-2", "FR-1"]);
    expect(refs.toStrings()).toEqual(["FR-2", "FR-1"]);

    const values = AttributeValues.of(["open"]).add("closed");
    expect([...values]).toEqual(["open", "closed"]);
    expect(values.indexOf("closed")).toBe(1);
    expect(values.indexOf("ghost")).toBe(-1);
    expect(values.valueAt(0)).toBe("open");
    expect(values.valueAt(9)).toBe(undefined);
    expect(values.count()).toBe(2);
    expect(values.toArray()).toEqual(["open", "closed"]);
  });
});

describe("design part collections (first-class operations)", () => {
  test("DesignTransitions and DesignIgnores own their frozen orders under add", () => {
    const t1 = DesignTransition.of({ id: DesignTransitionId.of("TR-2"), from: "a", to: "b", trigger: TriggerName.of("t"), brRefs: BrRefs.of([]) });
    const t2 = DesignTransition.of({ id: DesignTransitionId.of("TR-10"), from: "a", to: "b", trigger: TriggerName.of("t"), brRefs: BrRefs.of([]) });
    const trs = DesignTransitions.of([t2]).add(t1);
    expect([...trs].length).toBe(2);
    expect(trs.ids()).toEqual(["TR-10", "TR-2"]);
    expect(trs.sortedCanonically().toArray().map((t) => t.id().asString())).toEqual(["TR-2", "TR-10"]);

    const igs = DesignIgnores.of([DesignIgnore.of({ state: "y", trigger: TriggerName.of("go") })]).add(DesignIgnore.of({ state: "x", trigger: TriggerName.of("go") }));
    expect([...igs].length).toBe(2);
    expect(igs.sortedByStateTrigger().toArray().map((i) => i.state())).toEqual(["x", "y"]);
    expect(igs.toArray().length).toBe(2);
  });
});

describe("requirements identity primitives (issue #46 wave 5a)", () => {
  test("parse rejects the empty token, of constructs valid values, equals is by value", () => {
    expect(ObligationId.parse("").ok).toBe(false);
    const ob = ObligationId.parse("OB-1");
    if (!ob.ok) throw new Error("unreachable");
    expect(ob.value.equals(ObligationId.of("OB-1"))).toBe(true);
    expect(ob.value.asString()).toBe("OB-1");

    expect(ScenarioId.parse("").ok).toBe(false);
    const sc = ScenarioId.parse("SC-1");
    if (!sc.ok) throw new Error("unreachable");
    expect(sc.value.equals(ScenarioId.of("SC-1"))).toBe(true);

    expect(BackgroundAssumptionId.parse("").ok).toBe(false);
    const bg = BackgroundAssumptionId.parse("B1");
    if (!bg.ok) throw new Error("unreachable");
    expect(bg.value.equals(BackgroundAssumptionId.of("B1"))).toBe(true);
    expect(bg.value.asString()).toBe("B1");

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
    expect(DesignObligationId.parse("").ok).toBe(false);
    const ob = DesignObligationId.parse("DOB-1");
    if (!ob.ok) throw new Error("unreachable");
    expect(ob.value.equals(DesignObligationId.of("DOB-1"))).toBe(true);
    expect(ob.value.asString()).toBe("DOB-1");

    expect(DesignScenarioId.parse("").ok).toBe(false);
    const sc = DesignScenarioId.parse("DSC-1");
    if (!sc.ok) throw new Error("unreachable");
    expect(sc.value.equals(DesignScenarioId.of("DSC-1"))).toBe(true);
    expect(sc.value.asString()).toBe("DSC-1");

    expect(DesignTransitionId.parse("").ok).toBe(false);
    const tr = DesignTransitionId.parse("TR-1");
    if (!tr.ok) throw new Error("unreachable");
    expect(tr.value.equals(DesignTransitionId.of("TR-1"))).toBe(true);
    expect(tr.value.asString()).toBe("TR-1");

    expect(DesignBackgroundId.parse("").ok).toBe(false);
    const bg = DesignBackgroundId.parse("BG-1");
    if (!bg.ok) throw new Error("unreachable");
    expect(bg.value.equals(DesignBackgroundId.of("BG-1"))).toBe(true);
    expect(bg.value.asString()).toBe("BG-1");

    expect(DesignMachineId.parse("").ok).toBe(false);
    const sm = DesignMachineId.parse("SM-1");
    if (!sm.ok) throw new Error("unreachable");
    expect(sm.value.equals(DesignMachineId.of("SM-1"))).toBe(true);
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
        id: DesignMachineId.of(id),
        entity: DesignEntityName.of("Ticket"),
        attribute: DesignAttributeName.of("status"),
        initial: InitialStates.of(["open"]),
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

describe("lowered identity primitives and ObligationIds (issue #46 wave 5d)", () => {
  test("LoweredId / LoweredOriginRef parse-reject the empty token and rehydrate verbatim", () => {
    expect(LoweredId.parse("").ok).toBe(false);
    const lid = LoweredId.parse("OB-1");
    if (!lid.ok) throw new Error("unreachable");
    expect(lid.value.equals(LoweredId.of("OB-1"))).toBe(true);
    expect(lid.value.asString()).toBe("OB-1");

    expect(LoweredOriginRef.parse("").ok).toBe(false);
    const ref = LoweredOriginRef.parse("TR-1");
    if (!ref.ok) throw new Error("unreachable");
    expect(ref.value.equals(LoweredOriginRef.of("TR-1"))).toBe(true);
    expect(ref.value.asString()).toBe("TR-1");
  });

  test("ObligationIds keeps declaration order and escapes only at the boundary", () => {
    const ids = ObligationIds.of([ObligationId.of("OB-2")]).add(ObligationId.of("OB-1"));
    expect([...ids].map((i) => i.asString())).toEqual(["OB-2", "OB-1"]);
    expect(ids.isEmpty()).toBe(false);
    expect(ObligationIds.of([]).isEmpty()).toBe(true);
    expect(ids.toStrings()).toEqual(["OB-2", "OB-1"]);
  });
});
