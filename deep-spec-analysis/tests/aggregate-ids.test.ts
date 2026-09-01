// 集約 ID と ArtifactPath の DP 検査（Repository 裁定・補遺の証人）。
// parse は境界の唯一の構築口、ID は of/ofModel が唯一の構築口で、
// equals は値による恒等比較。domain 90% 床のための分岐網羅。

import { describe, expect, test } from "bun:test";
import { TriggerName, ArtifactPath, BackendName, ContentHash, IrVersion, TargetIds } from "../tools/kernel/domain/index.ts";
import {
  DesignAttributeName,
  DesignBackgroundId,
  DesignEntityName,
  DesignMachineId,
  DesignObligationId,
  DesignObligationNature,
  DesignObligationOrigin,
  DesignScenarioId,
  DesignTransitionId,
  BrRefs,
  DesignIgnores,
  DesignModelId,
  DesignTransitions,
  DesignUnitId,
  InitialStates,
  RefinementMaterialsId,
  LoweredOriginRef,
  LoweredId,
} from "../tools/design/domain/index.ts";
import { ObligationIds } from "../tools/requirements/domain/index.ts";
import { RefinementMapId } from "../tools/refinement/domain/index.ts";
import { DesignRecordId } from "../tools/refcheck/domain/index.ts";
import { FormalModelId } from "../tools/requirements/domain/index.ts";

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

  test("reconstitute is the verbatim rehydration door for frozen documents", () => {
    expect(ContentHash.reconstitute("").asString()).toBe("");
  });
});

describe("IrVersion", () => {
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

  test("reconstitute preserves the legacy tolerant major extraction (NaN on empty)", () => {
    const empty = IrVersion.reconstitute("");
    expect(Number.isNaN(empty.majorVersion())).toBe(true);
    expect(empty.supportsMajor(1)).toBe(false);
    expect(empty.equals(IrVersion.reconstitute(""))).toBe(true);
    expect(empty.equals(IrVersion.reconstitute("1.0.0"))).toBe(false);
  });
});

// requirements 側ファーストクラスコレクション — 不変 add・境界脱出口・集合知識。
import {
  AttributeBound,
  AttributeDeclarations,
  AttributePath,
  AttributeValues,
  BackgroundAssumptionId,
  FrRefs,
  ObligationId,
  ObligationNature,
  ScenarioId,
  BackgroundAssumptions,
  CrossCheckedEntries,
  Obligations,
  Obligation,
  Scenarios,
  Scenario,
  VerificationFindings,
  VerificationReports,
  VerificationSkips,
} from "../tools/requirements/domain/index.ts";
import { RequirementIds } from "../tools/kernel/domain/index.ts";

describe("requirements first-class collections", () => {
  test("immutable add and boundary escape across the cluster", () => {
    expect(RequirementIds.of([]).add("FR-1").has("FR-1")).toBe(true);
    expect([...RequirementIds.of(["FR-1"])]).toEqual(["FR-1"]);
    expect([...RequirementIds.extractFrom("- FR-1 と NFR-2.1").toArray()].sort()).toEqual(["FR-1", "NFR-2.1"]);

    const attrs = AttributeDeclarations.of([]).add({ path: AttributePath.reconstitute("o.qty"), kind: "int", min: AttributeBound.reconstitute(0), max: AttributeBound.reconstitute(5) });
    expect(attrs.byPath("o.qty")?.kind).toBe("int");
    expect(attrs.toArray().length).toBe(1);

    const obs = Obligations.of([]).add(Obligation.reconstitute({ id: ObligationId.reconstitute("OB-1"), nature: ObligationNature.reconstitute("invariant"), frRefs: FrRefs.of(["FR-1"]) }));
    expect(obs.byId("OB-1")?.nature().asString()).toBe("invariant");
    expect(obs.ids()).toEqual(["OB-1"]);
    expect([...obs].length).toBe(1);

    const scs = Scenarios.of([]).add(Scenario.reconstitute({ id: ScenarioId.reconstitute("SC-1"), kind: "accept", frRefs: FrRefs.of([]), bindings: {} }));
    expect(scs.byId("SC-1")?.kind()).toBe("accept");
    expect(scs.ids()).toEqual(["SC-1"]);

    const bgs = BackgroundAssumptions.of([]).add({ id: BackgroundAssumptionId.reconstitute("B1"), assert: { op: "bool", value: true } });
    expect([...bgs].length).toBe(1);
    expect(bgs.toArray()[0]?.id.asString()).toBe("B1");

    const finding = { kind: "conflict", frRefs: FrRefs.of([]), targets: TargetIds.of(["OB-1"]), witness: { core: [] }, detail: "d" };
    const fs = VerificationFindings.of([]).add(finding);
    expect(fs.isEmpty()).toBe(false);
    expect(fs.count()).toBe(1);
    expect([...fs.sortedCanonically()]).toEqual([finding]);

    const sk = VerificationSkips.of([]).add({ target: "OB-2", reason: "timeout" })
      .concat(VerificationSkips.of([{ target: "OB-1", reason: "capability" }]));
    expect(sk.count()).toBe(2);
    expect(sk.sortedCanonically().toArray().map((s) => s.target)).toEqual(["OB-1", "OB-2"]);

    const cc = CrossCheckedEntries.of([]).add({ backend: BackendName.reconstitute("smt"), targets: TargetIds.of(["SC-1"]) });
    expect([...cc].length).toBe(1);
    expect(cc.toArray()[0]?.backend.asString()).toBe("smt");

    expect([...VerificationReports.of([])].length).toBe(0);
  });
});

// design 側ファーストクラスコレクション — 不変 add・境界脱出口・集合知識。
import {
  AttrPaths,
  CheckedUnits,
  DesignBackgroundAssumptions,
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
} from "../tools/design/domain/index.ts";

describe("design first-class collections", () => {
  const ob = DesignObligation.reconstitute({ id: DesignObligationId.reconstitute("DOB-1"), nature: DesignObligationNature.reconstitute("invariant"), origin: DesignObligationOrigin.reconstitute(""), brRefs: BrRefs.of([]), frRefs: FrRefs.of([]), assert: { op: "bool", value: true } });
  const machine = {
    id: DesignMachineId.reconstitute("SM-1"),
    entity: DesignEntityName.reconstitute("T"),
    attribute: DesignAttributeName.reconstitute("s"),
    initial: InitialStates.of(["a"]),
    deterministic: true,
    transitions: DesignTransitions.of([{ id: DesignTransitionId.reconstitute("TR-1"), from: "a", to: "b", trigger: TriggerName.reconstitute("t"), brRefs: BrRefs.of([]) }]),
    ignores: DesignIgnores.of([]),
  };

  test("immutable add, iteration, and set knowledge", () => {
    expect(DesignObligations.of([]).add(ob).ids()).toEqual(["DOB-1"]);
    expect([...DesignObligations.of([ob])].length).toBe(1);
    expect(DesignMachines.of([]).add(machine).transitionIds()).toEqual(["TR-1"]);
    expect([...DesignMachines.of([machine])].length).toBe(1);
    expect(DesignMachines.of([machine]).toArray().length).toBe(1);
    expect(DesignObligations.of([ob]).toArray().length).toBe(1);
    expect(DesignScenarios.of([DesignScenario.reconstitute({ id: DesignScenarioId.reconstitute("DSC-9"), kind: "reject", brRefs: BrRefs.of([]), frRefs: FrRefs.of([]), bindings: {} })]).toArray().length).toBe(1);
    expect(DesignScenarios.of([]).add(DesignScenario.reconstitute({ id: DesignScenarioId.reconstitute("DSC-1"), kind: "accept", brRefs: BrRefs.of([]), frRefs: FrRefs.of([]), bindings: {} })).ids()).toEqual(["DSC-1"]);
    expect([...DesignScenarios.of([])].length).toBe(0);
    expect(DesignBackgroundAssumptions.of([]).add({ id: DesignBackgroundId.reconstitute("DBG-1"), assert: { op: "bool", value: true } }).toArray().length).toBe(1);
    expect([...DesignBackgroundAssumptions.of([])].length).toBe(0);
    const paths = AttrPaths.of(["T.s"]).add("T.x");
    expect(paths.has("T.x")).toBe(true);
    expect([...paths].sort()).toEqual(["T.s", "T.x"]);
    expect([...AttrPaths.of([]).toArray()]).toEqual([]);

    const u = DesignUnit.reconstitute({
      unit: "u2", rawEntities: [],
      attrPaths: AttrPaths.of([]),
      obligations: DesignObligations.of([ob]),
      machines: DesignMachines.of([machine]),
      scenarios: DesignScenarios.of([]),
      background: DesignBackgroundAssumptions.of([]),
    });
    const units = DesignUnits.of([]).add(u);
    expect(units.isEmpty()).toBe(false);
    expect(units.sortedByName().toArray()[0]?.name()).toBe("u2");
    expect([...units].length).toBe(1);

    const finding = { kind: "conflict", frRefs: FrRefs.of([]), targets: TargetIds.of(["DOB-1"]), witness: { refs: [] }, unit: "u2", detail: "d" };
    const fs = DesignFindings.of([]).add(finding);
    expect(fs.isEmpty()).toBe(false);
    expect(fs.count()).toBe(1);
    expect([...fs.sortedCanonically()].length).toBe(1);
    const sk = DesignSkips.of([]).add({ target: "DOB-1", reason: "timeout", unit: "u2" })
      .concat(DesignSkips.of([{ target: "DOB-0", reason: "capability", unit: "u2" }]));
    expect(sk.count()).toBe(2);
    expect(sk.sortedCanonically().toArray()[0]?.target).toBe("DOB-0");
    expect([...sk].length).toBe(2);

    const anchors = DesignInputAnchors.of([]).add({ artifact: "b.md", sha256: ContentHash.reconstitute("2".repeat(64)) })
      .add({ artifact: "a.md", sha256: ContentHash.reconstitute("1".repeat(64)) });
    expect(anchors.sortedByArtifact().toArray().map((a) => a.artifact)).toEqual(["a.md", "b.md"]);
    expect([...anchors].length).toBe(2);

    const checked = CheckedUnits.of(["unit:u2", "unit:u1", "unit:u1"]).add("unit:u3");
    expect(checked.sortedUniqueCanonically().toArray()).toEqual(["unit:u1", "unit:u2", "unit:u3"]);
    expect([...checked].length).toBe(4);

    const cc = DesignCrossCheckedEntries.of([]).add({ backend: BackendName.reconstitute("smt"), targets: TargetIds.of(["DSC-1"]) });
    expect(cc.toArray()[0]?.backend.asString()).toBe("smt");
    expect([...cc].length).toBe(1);
    expect([...DesignReports.of([])].length).toBe(0);
    expect(DesignReports.of([]).toArray().length).toBe(0);
  });
});

describe("requirements value collections (first-class operations)", () => {
  test("FrRefs and AttributeValues hold declaration order and ordinal knowledge", () => {
    const refs = FrRefs.of(["FR-2"]).add("FR-1");
    expect([...refs]).toEqual(["FR-2", "FR-1"]);
    expect(refs.toArray()).toEqual(["FR-2", "FR-1"]);

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
    const t1 = { id: DesignTransitionId.reconstitute("TR-2"), from: "a", to: "b", trigger: TriggerName.reconstitute("t"), brRefs: BrRefs.of([]) };
    const t2 = { id: DesignTransitionId.reconstitute("TR-10"), from: "a", to: "b", trigger: TriggerName.reconstitute("t"), brRefs: BrRefs.of([]) };
    const trs = DesignTransitions.of([t2]).add(t1);
    expect([...trs].length).toBe(2);
    expect(trs.ids()).toEqual(["TR-10", "TR-2"]);
    expect(trs.sortedCanonically().toArray().map((t) => t.id.asString())).toEqual(["TR-2", "TR-10"]);

    const igs = DesignIgnores.of([{ state: "y", trigger: TriggerName.reconstitute("go"), reason: "" }]).add({ state: "x", trigger: TriggerName.reconstitute("go"), reason: "" });
    expect([...igs].length).toBe(2);
    expect(igs.sortedByStateTrigger().toArray().map((i) => i.state)).toEqual(["x", "y"]);
    expect(igs.toArray().length).toBe(2);
  });
});

describe("requirements identity primitives (issue #46 wave 5a)", () => {
  test("parse rejects the empty token, reconstitute is verbatim, equals is by value", () => {
    expect(ObligationId.parse("").ok).toBe(false);
    const ob = ObligationId.parse("OB-1");
    if (!ob.ok) throw new Error("unreachable");
    expect(ob.value.equals(ObligationId.reconstitute("OB-1"))).toBe(true);
    expect(ob.value.asString()).toBe("OB-1");

    expect(ScenarioId.parse("").ok).toBe(false);
    const sc = ScenarioId.parse("SC-1");
    if (!sc.ok) throw new Error("unreachable");
    expect(sc.value.equals(ScenarioId.reconstitute("SC-1"))).toBe(true);

    expect(BackgroundAssumptionId.parse("").ok).toBe(false);
    const bg = BackgroundAssumptionId.parse("B1");
    if (!bg.ok) throw new Error("unreachable");
    expect(bg.value.equals(BackgroundAssumptionId.reconstitute("B1"))).toBe(true);
    expect(bg.value.asString()).toBe("B1");

    expect(AttributePath.parse("").ok).toBe(false);
    const ap2 = AttributePath.parse("T.x");
    if (!ap2.ok) throw new Error("unreachable");
    expect(ap2.value.equals(AttributePath.reconstitute("T.x"))).toBe(true);
    expect(ap2.value.asString()).toBe("T.x");

    expect(AttributeBound.parse(1.5).ok).toBe(false);
    const b = AttributeBound.parse(-3);
    if (!b.ok) throw new Error("unreachable");
    expect(b.value.equals(AttributeBound.reconstitute(-3))).toBe(true);
    expect(b.value.asNumber()).toBe(-3);
  });

  test("ObligationNature owns the known-nature predicates; unknown natures pass through", () => {
    expect(ObligationNature.reconstitute("invariant").isInvariant()).toBe(true);
    expect(ObligationNature.reconstitute("numeric").isNumeric()).toBe(true);
    expect(ObligationNature.reconstitute("event").isEvent()).toBe(true);
    expect(ObligationNature.reconstitute("state-temporal").isStateTemporal()).toBe(true);
    const mystery = ObligationNature.reconstitute("mystery");
    expect(mystery.isInvariant() || mystery.isNumeric() || mystery.isEvent() || mystery.isStateTemporal()).toBe(false);
    expect(mystery.asString()).toBe("mystery");
    expect(mystery.equals(ObligationNature.reconstitute("mystery"))).toBe(true);
  });

  test("BackendName parses strictly and rehydrates verbatim", () => {
    expect(BackendName.parse("").ok).toBe(false);
    const b = BackendName.parse("smt");
    if (!b.ok) throw new Error("unreachable");
    expect(b.value.equals(BackendName.reconstitute("smt"))).toBe(true);
    expect(b.value.asString()).toBe("smt");
  });
});

describe("design identity primitives (issue #46 wave 5b)", () => {
  test("parse rejects the empty token, reconstitute is verbatim, equals is by value", () => {
    expect(DesignObligationId.parse("").ok).toBe(false);
    const ob = DesignObligationId.parse("DOB-1");
    if (!ob.ok) throw new Error("unreachable");
    expect(ob.value.equals(DesignObligationId.reconstitute("DOB-1"))).toBe(true);
    expect(ob.value.asString()).toBe("DOB-1");

    expect(DesignScenarioId.parse("").ok).toBe(false);
    const sc = DesignScenarioId.parse("DSC-1");
    if (!sc.ok) throw new Error("unreachable");
    expect(sc.value.equals(DesignScenarioId.reconstitute("DSC-1"))).toBe(true);
    expect(sc.value.asString()).toBe("DSC-1");

    expect(DesignTransitionId.parse("").ok).toBe(false);
    const tr = DesignTransitionId.parse("TR-1");
    if (!tr.ok) throw new Error("unreachable");
    expect(tr.value.equals(DesignTransitionId.reconstitute("TR-1"))).toBe(true);
    expect(tr.value.asString()).toBe("TR-1");

    expect(DesignBackgroundId.parse("").ok).toBe(false);
    const bg = DesignBackgroundId.parse("BG-1");
    if (!bg.ok) throw new Error("unreachable");
    expect(bg.value.equals(DesignBackgroundId.reconstitute("BG-1"))).toBe(true);
    expect(bg.value.asString()).toBe("BG-1");

    expect(DesignMachineId.parse("").ok).toBe(false);
    const sm = DesignMachineId.parse("SM-1");
    if (!sm.ok) throw new Error("unreachable");
    expect(sm.value.equals(DesignMachineId.reconstitute("SM-1"))).toBe(true);
    expect(sm.value.asString()).toBe("SM-1");

    expect(DesignEntityName.parse("").ok).toBe(false);
    const en = DesignEntityName.parse("Ticket");
    if (!en.ok) throw new Error("unreachable");
    expect(en.value.equals(DesignEntityName.reconstitute("Ticket"))).toBe(true);
    expect(en.value.asString()).toBe("Ticket");

    expect(DesignAttributeName.parse("").ok).toBe(false);
    const an = DesignAttributeName.parse("status");
    if (!an.ok) throw new Error("unreachable");
    expect(an.value.equals(DesignAttributeName.reconstitute("status"))).toBe(true);
    expect(an.value.asString()).toBe("status");
  });

  test("DesignObligationNature owns event/invariant predicates; unknown natures pass through", () => {
    expect(DesignObligationNature.reconstitute("event").isEvent()).toBe(true);
    expect(DesignObligationNature.reconstitute("invariant").isInvariant()).toBe(true);
    const mystery = DesignObligationNature.reconstitute("mystery");
    expect(mystery.isEvent() || mystery.isInvariant()).toBe(false);
    expect(mystery.asString()).toBe("mystery");
    expect(mystery.equals(DesignObligationNature.reconstitute("mystery"))).toBe(true);
  });

  test("DesignObligationOrigin owns the rules predicate; the empty origin passes through", () => {
    expect(DesignObligationOrigin.reconstitute("rules").isRules()).toBe(true);
    const undeclared = DesignObligationOrigin.reconstitute("");
    expect(undeclared.isRules()).toBe(false);
    expect(undeclared.asString()).toBe("");
    expect(undeclared.equals(DesignObligationOrigin.reconstitute(""))).toBe(true);
  });
});

describe("DesignMachines frozen probe order (PR#55 review)", () => {
  test("sortedById restores id order regardless of input order (legacy verbatim comparator)", () => {
    const mk = (id: string) => ({
      id: DesignMachineId.reconstitute(id),
      entity: DesignEntityName.reconstitute("Ticket"),
      attribute: DesignAttributeName.reconstitute("status"),
      initial: InitialStates.of(["open"]),
      deterministic: true,
      transitions: DesignTransitions.of([]),
      ignores: DesignIgnores.of([]),
    });
    const sorted = DesignMachines.of([mk("SM-2"), mk("SM-1")]).sortedById();
    expect(sorted.toArray().map((m) => m.id.asString())).toEqual(["SM-1", "SM-2"]);
  });
});

describe("DesignObligationNature closed set (tell-don't-ask consolidation)", () => {
  test("owns all four nature predicates; unknown natures pass through", () => {
    expect(DesignObligationNature.reconstitute("numeric").isNumeric()).toBe(true);
    expect(DesignObligationNature.reconstitute("state-temporal").isStateTemporal()).toBe(true);
    const mystery = DesignObligationNature.reconstitute("mystery");
    expect(mystery.isNumeric() || mystery.isStateTemporal()).toBe(false);
  });
});

describe("TriggerName (issue #46 wave 5c-3)", () => {
  test("parse rejects the empty token; reconstitute passes it through and isEmpty owns the old falsy check", () => {
    expect(TriggerName.parse("").ok).toBe(false);
    const t = TriggerName.parse("close");
    if (!t.ok) throw new Error("unreachable");
    expect(t.value.equals(TriggerName.reconstitute("close"))).toBe(true);
    expect(t.value.asString()).toBe("close");
    expect(t.value.isEmpty()).toBe(false);
    expect(TriggerName.reconstitute("").isEmpty()).toBe(true);
  });
});

describe("lowered identity primitives and ObligationIds (issue #46 wave 5d)", () => {
  test("LoweredId / LoweredOriginRef parse-reject the empty token and rehydrate verbatim", () => {
    expect(LoweredId.parse("").ok).toBe(false);
    const lid = LoweredId.parse("OB-1");
    if (!lid.ok) throw new Error("unreachable");
    expect(lid.value.equals(LoweredId.reconstitute("OB-1"))).toBe(true);
    expect(lid.value.asString()).toBe("OB-1");

    expect(LoweredOriginRef.parse("").ok).toBe(false);
    const ref = LoweredOriginRef.parse("TR-1");
    if (!ref.ok) throw new Error("unreachable");
    expect(ref.value.equals(LoweredOriginRef.reconstitute("TR-1"))).toBe(true);
    expect(ref.value.asString()).toBe("TR-1");
  });

  test("ObligationIds keeps declaration order and escapes only at the boundary", () => {
    const ids = ObligationIds.of([ObligationId.reconstitute("OB-2")]).add(ObligationId.reconstitute("OB-1"));
    expect([...ids].map((i) => i.asString())).toEqual(["OB-2", "OB-1"]);
    expect(ids.isEmpty()).toBe(false);
    expect(ObligationIds.of([]).isEmpty()).toBe(true);
    expect(ids.toStrings()).toEqual(["OB-2", "OB-1"]);
  });
});
