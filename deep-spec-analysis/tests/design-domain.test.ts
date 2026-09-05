import {
  VerificationMethod,
  RequirementId,
  SkipReason,
  FindingKind,
  FrRefs,
  TargetIds,
  TriggerName,
  type Expression,
  TargetId,
  UnitName,
} from "@deep-spec/kernel-domain";

// design/domain の単体テスト（TDA 波3 — 90% カバレッジ床の維持）。

import { describe, expect, test } from "bun:test";

import { BrRefs, DesignAttributeName, DesignBackgroundDecl, DesignBackgroundId, DesignEntityName, DesignFinding, DesignIgnore, DesignIgnores, DesignMachine, DesignMachineId, DesignTransition, DesignTransitions, InitialStates, DesignObligation, DesignObligationId, DesignObligationNature, DesignObligationOrigin, DesignScenario, DesignScenarioId, DesignTransitionDecl, DesignTransitionId, DeclaredValues, DesignAttributeDecl, DesignAttributeDecls, DesignEntityDecl, DesignEntityDecls, DesignIgnoreDecl, DesignIgnoreDecls, DesignMachineDecl, DesignMachineDecls, DesignObligationDecls, DesignScenarioDecls, DesignBackgroundDecls, DesignTransitionDecls, DesignUnitDecl, DesignUnitId, UnformalizedTargets, DesignSkipped, DesignSkips, LoweredId, LoweredObligation, LoweredScenario, LoweredBackground, LoweredOrigin, LoweredOriginRef, SiblingVerdictDocument, SiblingVerdictFinding, DesignBackgroundAssumption, DesignBackgroundAssumptions, SiblingVerdictFindings, SiblingVerdictSkips, DesignWitness, BrRef, CheckedUnits } from "@deep-spec/design-domain";

const lit = (value: boolean): Expression => ({ op: "lit", value });

describe("design obligation", () => {
  test("inspectExpressions visits every held expression, primes allowed only on the effect", () => {
    const obligation = DesignObligation.of({
      id: DesignObligationId.of("DO-1"),
      nature: DesignObligationNature.of("event"),
      origin: DesignObligationOrigin.of("rules"),
      brRefs: BrRefs.of(Array.from(["BR-1"], (raw) => BrRef.of(raw))),
      frRefs: FrRefs.of(Array.from(["FR-1"], (raw) => RequirementId.of(raw))),
      assert: { op: "a" },
      trigger: TriggerName.of("submit"),
      guard: { op: "g" },
      effect: { op: "e" },
      temporal: { pattern: "leads-to", assert: { op: "ta" }, from: { op: "tf" }, to: { op: "tt" } },
    });
    const seen: [string, boolean][] = [];
    obligation.inspectExpressions((expression, primesAllowed) => seen.push([expression.op, primesAllowed]));
    expect(seen).toEqual([
      ["a", false],
      ["g", false],
      ["e", true],
      ["ta", false],
      ["tf", false],
      ["tt", false],
    ]);
  });

  test("eventDefinition requires a non-empty trigger on top of a complete guarded effect", () => {
    const complete = DesignObligation.of({
      id: DesignObligationId.of("DO-2"),
      nature: DesignObligationNature.of("event"),
      origin: DesignObligationOrigin.of("rules"),
      brRefs: BrRefs.of([]),
      frRefs: FrRefs.of([]),
      trigger: TriggerName.of("submit"),
      guard: lit(true),
      effect: lit(false),
    });
    expect(complete.eventDefinition()?.trigger.asString()).toBe("submit");
    expect(
      DesignObligation.of({
        id: DesignObligationId.of("DO-3"),
        nature: DesignObligationNature.of("event"),
        origin: DesignObligationOrigin.of("rules"),
        brRefs: BrRefs.of([]),
        frRefs: FrRefs.of([]),
        guard: lit(true),
        effect: lit(false),
      }).eventDefinition(),
    ).toBeNull();
  });

  test("of round-trips every field through the accessors, and temporal() hands out a copy", () => {
    const obligation = DesignObligation.of({
      id: DesignObligationId.of("DO-4"),
      nature: DesignObligationNature.of("invariant"),
      origin: DesignObligationOrigin.of("rules"),
      brRefs: BrRefs.of(Array.from(["BR-2"], (raw) => BrRef.of(raw))),
      frRefs: FrRefs.of(Array.from(["FR-3"], (raw) => RequirementId.of(raw))),
      assert: lit(true),
      temporal: { pattern: "always", assert: lit(true) },
    });
    expect(obligation.id().asString()).toBe("DO-4");
    expect(obligation.nature().asString()).toBe("invariant");
    expect(obligation.origin().asString()).toBe("rules");
    expect(obligation.brRefs().toStrings()).toEqual(["BR-2"]);
    expect(obligation.frRefs().toStrings()).toEqual(["FR-3"]);
    expect(obligation.assertion()).toEqual(lit(true));
    expect(obligation.trigger()).toBeUndefined();
    expect(obligation.guard()).toBeUndefined();
    expect(obligation.effect()).toBeUndefined();
    expect(obligation.temporal()?.pattern).toBe("always");
    expect(obligation.temporal()).not.toBe(obligation.temporal());
    expect(obligation.isInvariantLike()).toBe(true);
    expect(obligation.isEvent()).toBe(false);
    expect(obligation.guardedEffect()).toBeNull();
  });
});

describe("design scenario", () => {
  const scenario = (kind: "accept" | "reject") =>
    DesignScenario.of({
      id: DesignScenarioId.of("DS-1"),
      kind,
      brRefs: BrRefs.of(Array.from(["BR-1"], (raw) => BrRef.of(raw))),
      frRefs: FrRefs.of([]),
      bindings: {},
    });

  test("isViolatedBySatisfiability is the accept/reject truth table", () => {
    expect(scenario("accept").isViolatedBySatisfiability(false)).toBe(true);
    expect(scenario("accept").isViolatedBySatisfiability(true)).toBe(false);
    expect(scenario("reject").isViolatedBySatisfiability(true)).toBe(true);
    expect(scenario("reject").isViolatedBySatisfiability(false)).toBe(false);
  });

  test("of round-trips every field through the accessors and bindings() hands out a copy", () => {
    const withEvent = DesignScenario.of({
      id: DesignScenarioId.of("DS-2"),
      kind: "reject",
      brRefs: BrRefs.of(Array.from(["BR-7"], (raw) => BrRef.of(raw))),
      frRefs: FrRefs.of(Array.from(["FR-4"], (raw) => RequirementId.of(raw))),
      bindings: { b: 2, a: 1 },
      event: { trigger: TriggerName.of("close") },
      expect: lit(true),
    });
    expect(withEvent.id().asString()).toBe("DS-2");
    expect(withEvent.kind()).toBe("reject");
    expect(withEvent.brRefs().toStrings()).toEqual(["BR-7"]);
    expect(withEvent.frRefs().toStrings()).toEqual(["FR-4"]);
    expect(withEvent.eventTrigger()?.asString()).toBe("close");
    expect(withEvent.expectation()).toEqual(lit(true));
    expect(withEvent.isAccept()).toBe(false);
    expect(withEvent.isReject()).toBe(true);
    expect(withEvent.hasEvent()).toBe(true);
    expect(scenario("accept").hasEvent()).toBe(false);
    expect(withEvent.bindingEntriesCanonically()).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
    const leaked = withEvent.bindings();
    (leaked as Record<string, number>).c = 3;
    expect(withEvent.bindings()).toEqual({ b: 2, a: 1 });
  });
});

describe("design transition decl", () => {
  const primed: Expression = { op: "ref", path: "Ticket.state", prime: true };
  const decl = (overrides: { from?: string; trigger?: TriggerName; guard?: Expression; effect?: Expression } = {}) =>
    DesignTransitionDecl.of({
      id: DesignTransitionId.of("T-1"),
      from: "open",
      to: "closed",
      trigger: TriggerName.of("close"),
      brRefs: BrRefs.of(Array.from(["BR-1"], (raw) => BrRef.of(raw))),
      guard: lit(true),
      effect: primed,
      ...overrides,
    });

  test("stateEntries enumerates both endpoints in order", () => {
    expect(decl().stateEntries()).toEqual([
      ["from", "open"],
      ["to", "closed"],
    ]);
    expect(decl({ from: undefined }).stateEntries()).toEqual([
      ["from", undefined],
      ["to", "closed"],
    ]);
  });

  test("cellKey joins from and trigger, and stays null when either is missing", () => {
    expect(decl().cellKey()).toBe("open|close");
    expect(decl({ from: undefined }).cellKey()).toBeNull();
    expect(decl({ trigger: undefined }).cellKey()).toBeNull();
  });

  test("assignsPrimedReferenceTo detects a primed ref to the path only", () => {
    expect(decl().assignsPrimedReferenceTo("Ticket.state")).toBe(true);
    expect(decl().assignsPrimedReferenceTo("Ticket.priority")).toBe(false);
    expect(decl({ effect: { op: "ref", path: "Ticket.state" } }).assignsPrimedReferenceTo("Ticket.state")).toBe(false);
    expect(decl({ effect: undefined }).assignsPrimedReferenceTo("Ticket.state")).toBe(false);
  });

  test("inspectExpressions visits guard and effect, primes allowed only on the effect", () => {
    const seen: [string, boolean][] = [];
    decl().inspectExpressions((expression, primesAllowed) => seen.push([expression.op, primesAllowed]));
    expect(seen).toEqual([
      ["lit", false],
      ["ref", true],
    ]);
  });

  test("of round-trips every field through the accessors", () => {
    const full = decl();
    expect(full.id().asString()).toBe("T-1");
    expect(full.fromState()).toBe("open");
    expect(full.toState()).toBe("closed");
    expect(full.trigger()?.asString()).toBe("close");
    expect(full.brRefs()?.toStrings()).toEqual(["BR-1"]);
    expect(full.guard()).toEqual(lit(true));
    expect(full.effect()).toEqual(primed);
    const bare = DesignTransitionDecl.of({ id: DesignTransitionId.of("T-2") });
    expect(bare.fromState()).toBeUndefined();
    expect(bare.toState()).toBeUndefined();
    expect(bare.trigger()).toBeUndefined();
    expect(bare.brRefs()).toBeUndefined();
    expect(bare.guard()).toBeUndefined();
    expect(bare.effect()).toBeUndefined();
  });
});

describe("design background decl", () => {
  test("inspectExpressions visits the assertion with primes forbidden, and silence when absent", () => {
    const withAssert = DesignBackgroundDecl.of({
      id: DesignBackgroundId.of("DBG-1"),
      assert: { op: "ref", path: "t.x" },
    });
    const seen: [string, boolean][] = [];
    withAssert.inspectExpressions((expression, primesAllowed) => seen.push([expression.op, primesAllowed]));
    expect(seen).toEqual([["ref", false]]);
    expect(withAssert.id().asString()).toBe("DBG-1");
    expect(withAssert.assertion()).toEqual({ op: "ref", path: "t.x" });

    const bare = DesignBackgroundDecl.of({ id: DesignBackgroundId.of("DBG-2") });
    const none: unknown[] = [];
    bare.inspectExpressions((expression, primesAllowed) => none.push([expression.op, primesAllowed]));
    expect(none).toEqual([]);
    expect(bare.assertion()).toBeUndefined();
  });
});

describe("design transition and ignore (compile-down owners)", () => {
  const primed: Expression = { op: "ref", path: "T.s", prime: true };
  const transition = (withExprs: boolean) =>
    DesignTransition.of({
      id: DesignTransitionId.of("TR-1"),
      from: "open",
      to: "closed",
      trigger: TriggerName.of("close"),
      guard: withExprs ? lit(true) : undefined,
      effect: withExprs ? primed : undefined,
      brRefs: BrRefs.of(Array.from(["BR-9"], (raw) => BrRef.of(raw))),
    });

  test("of round-trips every field through the accessors", () => {
    const tr = transition(true);
    expect(tr.id().asString()).toBe("TR-1");
    expect(tr.fromState()).toBe("open");
    expect(tr.toState()).toBe("closed");
    expect(tr.trigger().asString()).toBe("close");
    expect(tr.guard()).toEqual(lit(true));
    expect(tr.effect()).toEqual(primed);
    expect(tr.brRefs().toStrings()).toEqual(["BR-9"]);
    expect(transition(false).guard()).toBeUndefined();
    expect(transition(false).effect()).toBeUndefined();
  });

  test("lowered guard/effect pair the implicit state frame with the explicit expressions", () => {
    const framed = transition(true);
    expect(framed.loweredGuard("T.s")).toEqual({ op: "and", args: [{ op: "eq", args: [{ op: "ref", path: "T.s" }, { op: "enum", value: "open" }] }, lit(true)] });
    expect(framed.loweredEffect("T.s")).toEqual({ op: "and", args: [{ op: "eq", args: [{ op: "ref", path: "T.s", prime: true }, { op: "enum", value: "closed" }] }, primed] });
    const bare = transition(false);
    expect(bare.loweredGuard("T.s")).toEqual({ op: "eq", args: [{ op: "ref", path: "T.s" }, { op: "enum", value: "open" }] });
    expect(bare.loweredEffect("T.s")).toEqual({ op: "eq", args: [{ op: "ref", path: "T.s", prime: true }, { op: "enum", value: "closed" }] });
    expect(bare.stateAssignment("T.s")).toEqual(["T.s", { op: "enum", value: "closed" }]);
  });

  test("ignore lowers to an explicit no-op event and round-trips its fields", () => {
    const ig = DesignIgnore.of({ state: "closed", trigger: TriggerName.of("close") });
    expect(ig.state()).toBe("closed");
    expect(ig.trigger().asString()).toBe("close");
    expect(ig.loweredGuard("T.s")).toEqual({ op: "eq", args: [{ op: "ref", path: "T.s" }, { op: "enum", value: "closed" }] });
    expect(ig.loweredEffect("T.s")).toEqual({ op: "eq", args: [{ op: "ref", path: "T.s", prime: true }, { op: "ref", path: "T.s" }] });
  });
});

describe("design finding (conflict reinterpretation owner)", () => {
  const finding = (kind: string, targets: string[]) =>
    DesignFinding.of({
      kind: FindingKind.of(kind),
      frRefs: FrRefs.of(Array.from(["FR-1"], (raw) => RequirementId.of(raw))),
      targets: TargetIds.of(Array.from(targets, (raw) => TargetId.of(raw))),
      witness: DesignWitness.trace([{ "T.s": "a" }]),
      unit: UnitName.of("u1"),
      detail: "overlap",
    });

  test("of round-trips every field through the accessors", () => {
    const f = finding("conflict", ["OB-9", "TR-1"]);
    expect(f.kind()).toBe("conflict");
    expect(f.frRefs().toStrings()).toEqual(["FR-1"]);
    expect(f.targets().toStrings()).toEqual(["OB-9", "TR-1"]);
    expect(f.witness().toDocument()).toEqual({ trace: [{ "T.s": "a" }] });
    expect(f.unit()).toBe("u1");
    expect(f.detail()).toBe("overlap");
    expect(f.isConflict()).toBe(true);
    expect(finding("unreachable", ["TR-1"]).isConflict()).toBe(false);
  });

  test("a conflict reaching requirement ids ascends to refinement-violation with the frozen wording", () => {
    const v = finding("conflict", ["OB-9", "TR-1"]).asRefinementViolation(new Set(["OB-9", "OB-10"]), UnitName.of("u1"));
    expect(v?.kind()).toBe("refinement-violation");
    expect(v?.targets().toStrings()).toEqual(["OB-9"]);
    expect(v?.frRefs().toStrings()).toEqual(["FR-1"]);
    expect(v?.witness().toDocument()).toEqual({ trace: [{ "T.s": "a" }] });
    expect(v?.unit()).toBe("u1");
    expect(v?.detail()).toBe(
      "The design machine of unit u1 reaches a state that violates requirements obligation OB-9 under the refinement map (step trace attached): the design can execute its way out of the verified requirements.",
    );
  });

  test("a conflict that misses every requirement id, and any non-conflict, reinterprets to null", () => {
    expect(finding("conflict", ["TR-1"]).asRefinementViolation(new Set(["OB-9"]), UnitName.of("u1"))).toBeNull();
    expect(finding("unreachable", ["OB-9"]).asRefinementViolation(new Set(["OB-9"]), UnitName.of("u1"))).toBeNull();
  });

  test("withDetail copies every field and replaces only the wording", () => {
    const copy = finding("redundancy", ["TR-1", "TR-2"]).withDetail("mutual");
    expect(copy.kind()).toBe("redundancy");
    expect(copy.frRefs().toStrings()).toEqual(["FR-1"]);
    expect(copy.targets().toStrings()).toEqual(["TR-1", "TR-2"]);
    expect(copy.witness().toDocument()).toEqual({ trace: [{ "T.s": "a" }] });
    expect(copy.unit()).toBe("u1");
    expect(copy.detail()).toBe("mutual");
  });
});

describe("design machine (probe candidates and the deterministic waiver)", () => {
  const machine = (deterministic: boolean, id = "SM-1") =>
    DesignMachine.of({
      id: DesignMachineId.of(id),
      entity: DesignEntityName.of("Ticket"),
      attribute: DesignAttributeName.of("status"),
      initial: InitialStates.of(["open"]),
      transitions: DesignTransitions.of([
        DesignTransition.of({ id: DesignTransitionId.of("TR-1"), from: "open", to: "closed", trigger: TriggerName.of("close"), brRefs: BrRefs.of([]) }),
      ]),
      ignores: DesignIgnores.of([DesignIgnore.of({ state: "closed", trigger: TriggerName.of("close") })]),
      deterministic,
    });

  test("of round-trips every field through the accessors", () => {
    const sm = machine(true);
    expect(sm.id().asString()).toBe("SM-1");
    expect(sm.entity().asString()).toBe("Ticket");
    expect(sm.attribute().asString()).toBe("status");
    expect(sm.transitions().ids()).toEqual(["TR-1"]);
    expect(sm.ignores().sortedByStateTrigger().toArray()[0]?.state()).toBe("closed");
  });

  test("nonInitialCandidates drops the initial states and sorts the rest ascending", () => {
    expect(machine(true).nonInitialCandidates(["closed", "open", "archived"])).toEqual(["archived", "closed"]);
    expect(machine(true).nonInitialCandidates(["open"])).toEqual([]);
  });

  test("waivesOverlapOf holds only when every target is this machine's and determinism is waived", () => {
    const sm = machine(false);
    expect(sm.waivesOverlapOf([sm, sm])).toBe(true);
    expect(machine(true).waivesOverlapOf([sm, sm])).toBe(false);
    expect(sm.waivesOverlapOf([sm, machine(false, "SM-2")])).toBe(false);
    expect(sm.waivesOverlapOf([sm, null])).toBe(false);
  });
});

describe("design decls (well-formedness materials own their judgements)", () => {
  const attr = (name: string) => DesignAttributeDecl.of({ name: DesignAttributeName.of(name), kind: "enum", values: DeclaredValues.of(["open", "closed"]) });

  test("entity decl visits attributes with their coordinate and flags a repeated name from its second occurrence", () => {
    const entity = DesignEntityDecl.of({
      name: DesignEntityName.of("ticket"),
      attributes: DesignAttributeDecls.of([attr("status"), attr("status"), attr("owner")]),
    });
    const seen: [string, boolean][] = [];
    entity.inspectAttributes((coordinate, attribute, duplicated) => seen.push([`${coordinate}=${attribute.name().asString()}`, duplicated]));
    expect(seen).toEqual([["ticket.status=status", false], ["ticket.status=status", true], ["ticket.owner=owner", false]]);
    expect(entity.name().asString()).toBe("ticket");
    expect(entity.attributes().toArray().length).toBe(3);
  });

  test("ignore decl knows whether its state belongs to the machine's state set and its transition cell key", () => {
    const ig = DesignIgnoreDecl.of({ state: "closed", trigger: TriggerName.of("close") });
    expect(ig.isStateAmong(DeclaredValues.of(["open", "closed"]))).toBe(true);
    expect(ig.isStateAmong(DeclaredValues.of(["open"]))).toBe(false);
    expect(ig.cellKey()).toBe("closed|close");
    expect(ig.state()).toBe("closed");
    expect(ig.trigger().asString()).toBe("close");
  });

  test("machine decl selects the initial states outside the state set in declaration order and round-trips its parts", () => {
    const sm = DesignMachineDecl.of({
      id: DesignMachineId.of("SM-1"),
      attrPath: "ticket.status",
      initial: InitialStates.of(["ghost", "open", "phantom"]),
      transitions: DesignTransitionDecls.of([]),
      ignores: DesignIgnoreDecls.of([]),
    });
    expect(sm.initialStatesOutside(DeclaredValues.of(["open", "closed"]))).toEqual(["ghost", "phantom"]);
    expect(sm.id().asString()).toBe("SM-1");
    expect(sm.attrPath()).toBe("ticket.status");
    expect([...sm.initial()]).toEqual(["ghost", "open", "phantom"]);
    expect(sm.transitions().toArray()).toEqual([]);
    expect(sm.ignores().toArray()).toEqual([]);
  });

  test("unit decl owns the construction-directory judgement and round-trips its materials", () => {
    const build = (directoryExists: boolean) => DesignUnitDecl.of({
      unit: DesignUnitId.of("u1"),
      entities: DesignEntityDecls.of([]),
      obligations: DesignObligationDecls.of([]),
      stateMachines: DesignMachineDecls.of([]),
      scenarios: DesignScenarioDecls.of([]),
      background: DesignBackgroundDecls.of([]),
      unformalizedTargets: UnformalizedTargets.of(Array.from(["BR1.1"], (raw) => TargetId.of(raw))),
      directoryExists,
      rulesMarkdown: "# rules",
    });
    expect(build(false).lacksConstructionDirectory()).toBe(true);
    const present = build(true);
    expect(present.lacksConstructionDirectory()).toBe(false);
    expect(present.unit().asString()).toBe("u1");
    expect(present.entities().toArray()).toEqual([]);
    expect(present.obligations().toArray()).toEqual([]);
    expect(present.stateMachines().toArray()).toEqual([]);
    expect(present.scenarios().toArray()).toEqual([]);
    expect(present.background().toArray()).toEqual([]);
    expect(present.unformalizedTargets().toStrings()).toEqual(["BR1.1"]);
    expect(present.rulesMarkdown()).toBe("# rules");
  });
});

describe("design skipped (a skip record owns its identity and canonical order)", () => {
  test("round-trips its parts, answers isFor, and sorts by unit, then target, then reason", () => {
    const a = DesignSkipped.of({ target: TargetId.of("TR-2"), reason: SkipReason.of("timeout"), unit: UnitName.of("u2"), detail: "budget" });
    const b = DesignSkipped.of({ target: TargetId.of("TR-10"), reason: SkipReason.of("waived"), unit: UnitName.of("u1")});
    const c = DesignSkipped.of({ target: TargetId.of("TR-2"), reason: SkipReason.of("capability"), unit: UnitName.of("u1")});
    expect(a.target().asString()).toBe("TR-2");
    expect(a.reason()).toBe("timeout");
    expect(a.unit()).toBe("u2");
    expect(a.detail()).toBe("budget");
    expect(b.detail()).toBeUndefined();
    expect(a.isFor(TargetId.of("TR-2"))).toBe(true);
    expect(a.isFor(TargetId.of("TR-3"))).toBe(false);
    expect(DesignSkips.of([a, b, c]).sortedCanonically().toArray().map((s) => `${s.unit()}:${s.target().asString()}:${s.reason()}`)).toEqual([
      "u1:TR-2:capability",
      "u1:TR-10:waived",
      "u2:TR-2:timeout",
    ]);
    expect(a.compareTo(a)).toBe(0);
  });
});

describe("lowered records (the v1 payload the sibling backends receive)", () => {
  test("obligation knows whether it is an event and carries its optional parts", () => {
    const invariant = LoweredObligation.of({ id: LoweredId.of("OB-1"), nature: "invariant", frRefs: FrRefs.of(Array.from(["FR-1"], (raw) => RequirementId.of(raw))), assert: { op: "bool", value: true } });
    const event = LoweredObligation.of({
      id: LoweredId.of("OB-2"), nature: "event", frRefs: FrRefs.of([]), trigger: "close",
      guard: { op: "bool", value: true }, effect: { op: "bool", value: true },
      temporal: { pattern: "always", assert: { op: "bool", value: false } },
    });
    expect(invariant.isEvent()).toBe(false);
    expect(event.isEvent()).toBe(true);
    expect(invariant.id().asString()).toBe("OB-1");
    expect(invariant.nature()).toBe("invariant");
    expect(invariant.frRefs().toStrings()).toEqual(["FR-1"]);
    expect(invariant.assertion()).toEqual({ op: "bool", value: true });
    expect(invariant.trigger()).toBeUndefined();
    expect(event.trigger()).toBe("close");
    expect(event.guard()).toEqual({ op: "bool", value: true });
    expect(event.effect()).toEqual({ op: "bool", value: true });
    expect(event.temporal()?.pattern).toBe("always");
  });

  test("scenario knows accept from reject and carries its bindings, event, and expectation", () => {
    const accept = LoweredScenario.of({ id: LoweredId.of("SC-1"), kind: "accept", frRefs: FrRefs.of(Array.from(["FR-2"], (raw) => RequirementId.of(raw))), bindings: { "T.x": 1 } });
    const reject = LoweredScenario.of({ id: LoweredId.of("SC-2"), kind: "reject", frRefs: FrRefs.of([]), bindings: {}, event: { trigger: "go" }, expect: { op: "bool", value: true } });
    expect(accept.isAccept()).toBe(true);
    expect(reject.isAccept()).toBe(false);
    expect(accept.id().asString()).toBe("SC-1");
    expect(accept.kind()).toBe("accept");
    expect(accept.frRefs().toStrings()).toEqual(["FR-2"]);
    expect(accept.bindings()).toEqual({ "T.x": 1 });
    expect(accept.event()).toBeUndefined();
    expect(reject.event()).toEqual({ trigger: "go" });
    expect(reject.expectation()).toEqual({ op: "bool", value: true });
    const bg = LoweredBackground.of({ id: LoweredId.of("BG-1"), assert: { op: "bool", value: true } });
    expect(bg.id().asString()).toBe("BG-1");
    expect(bg.assertion()).toEqual({ op: "bool", value: true });
  });

  test("origin tells probes from attributions and pairs a shadow probe (a lone origin pairs with itself)", () => {
    const dead = LoweredOrigin.of({ design: LoweredOriginRef.of("TR-1"), kind: "vac-dead" });
    const shadow = LoweredOrigin.of({ design: LoweredOriginRef.of("TR-1|TR-2"), kind: "vac-shadow", pair: [LoweredOriginRef.of("TR-1"), LoweredOriginRef.of("TR-2")] });
    const plain = LoweredOrigin.of({ design: LoweredOriginRef.of("DOB-1"), kind: "passthrough" });
    expect(dead.isSyntheticProbe()).toBe(true);
    expect(shadow.isSyntheticProbe()).toBe(true);
    expect(plain.isSyntheticProbe()).toBe(false);
    expect(plain.isKind("passthrough")).toBe(true);
    expect(plain.isKind("passthrough")).toBe(true);
    expect(shadow.pairRefs().map((r) => r.asString())).toEqual(["TR-1", "TR-2"]);
    expect(plain.pairRefs().map((r) => r.asString())).toEqual(["DOB-1", "DOB-1"]);
    expect(dead.design().asString()).toBe("TR-1");
  });
});

describe("sibling verdict document and finding (the backend's answer owns its interpretation)", () => {
  const finding = SiblingVerdictFinding.of({
    kind: FindingKind.of("conflict"),
    frRefs: FrRefs.of(Array.from(["FR-1"], (raw) => RequirementId.of(raw))),
    targets: [LoweredId.of("OB-1")],
    witness: DesignWitness.of({ core: ["g_OB_1", 7] }),
    detail: "x",
  });
  const readable = SiblingVerdictDocument.readable( VerificationMethod.of("exhaustive"), SiblingVerdictFindings.of([finding]), SiblingVerdictSkips.of([]));

  test("only an unavailable document reports a reason", () => {
    expect(SiblingVerdictDocument.unreadable().unavailableReason()).toBe(null);
    expect(SiblingVerdictDocument.unavailable("z3 missing", VerificationMethod.of("simulation")).unavailableReason()).toBe("z3 missing");
    expect(readable.unavailableReason()).toBe(null);
  });

  test("match hands each kind its own plan", () => {
    const describeDoc = (doc: SiblingVerdictDocument): string =>
      doc.match({
        unreadable: () => "unreadable",
        unavailable: (reason, method) => `unavailable:${reason}:${method}`,
        readable: (method, findings, skipped) => `readable:${method}:${findings.toArray().length}:${skipped.toArray().length}`,
      });
    expect(describeDoc(SiblingVerdictDocument.unreadable())).toBe("unreadable");
    expect(describeDoc(SiblingVerdictDocument.unavailable("boom", VerificationMethod.of("simulation")))).toBe("unavailable:boom:simulation");
    expect(describeDoc(readable)).toBe("readable:exhaustive:1:0");
  });

  test("a finding answers its kind and remaps only an unsat-core witness", () => {
    expect(finding.isKind("conflict")).toBe(true);
    expect(finding.isKind("conflict")).toBe(true);
    expect(finding.isKind("gap")).toBe(false);
    expect(finding.frRefs().toStrings()).toEqual(["FR-1"]);
    expect(finding.targets().map((t) => t.asString())).toEqual(["OB-1"]);
    expect(finding.detail()).toBe("x");
    // core のラベルだけが書き換わり、文字列でない要素と core 以外の witness は逐語（凍結挙動）。
    const upper = (label: string): string => label.toUpperCase();
    expect(finding.witnessRemappedBy(upper).toDocument()).toEqual({ core: ["G_OB_1", 7] });
    const model = SiblingVerdictFinding.of({ kind: FindingKind.of("completeness-gap"), frRefs: FrRefs.of([]), targets: [], witness: DesignWitness.model({ a: 1 }), detail: "" });
    expect(model.witnessRemappedBy(upper).toDocument()).toEqual({ model: { a: 1 } });
    const bare = SiblingVerdictFinding.of({ kind: FindingKind.of("completeness-gap"), frRefs: FrRefs.of([]), targets: [], witness: DesignWitness.of(null), detail: "" });
    expect(bare.witnessRemappedBy(upper).toDocument()).toBe(null);
    const emptyCore = DesignWitness.of({ core: null });
    expect(emptyCore.remapCore(upper).toDocument()).toEqual({ core: null });
    expect(DesignWitness.core(["b"]).remapCore(upper).toDocument()).toEqual({ core: ["B"] });
    expect(DesignWitness.verdicts({ smt: "clean" }).toDocument()).toEqual({ verdicts: { smt: "clean" } });
    expect(DesignWitness.refs([{ artifact: "a.md", element: "e" }]).toDocument()).toEqual({ refs: [{ artifact: "a.md", element: "e" }] });
    expect(DesignWitness.of(null).toDocument()).toBe(null);
  });
});

describe("design background assumption (an assumption owns its identity and canonical order)", () => {
  test("id, assertion and the numeric-tail order", () => {
    const bg = (id: string, value: boolean): DesignBackgroundAssumption =>
      DesignBackgroundAssumption.of({ id: DesignBackgroundId.of(id), assert: { op: "bool", value } });
    const b10 = bg("BG-10", true);
    const b2 = bg("BG-2", false);
    expect(b10.id().asString()).toBe("BG-10");
    expect(b2.assertion()).toEqual({ op: "bool", value: false });
    expect(b2.compareTo(b10)).toBeLessThan(0);
    expect(b10.compareTo(b2)).toBeGreaterThan(0);
    expect(b2.compareTo(bg("BG-2", true))).toBe(0);
    expect(DesignBackgroundAssumptions.of([b10, b2]).sortedCanonically().toArray().map((b) => b.id().asString())).toEqual(["BG-2", "BG-10"]);
  });
});

describe("the design-side primitives of ruling 3-1 (BrRef, BrRefs, CheckedUnits, UnformalizedTargets)", () => {
  test("BrRef compares by plain string order and BrRefs takes primitives through of()", () => {
    const a = BrRef.of("BR1.2");
    expect(a.equals(BrRef.of("BR1.2"))).toBe(true);
    expect(a.compareTo(BrRef.of("BR1.10"))).toBeGreaterThan(0);
    expect(a.compareTo(BrRef.of("BR1.2"))).toBe(0);
    expect(a.compareTo(BrRef.of("BR2.0"))).toBeLessThan(0);
    const refs = BrRefs.of([a]).add(BrRef.of("BR2.0"));
    expect(refs.toArray().map((r) => r.asString())).toEqual(["BR1.2", "BR2.0"]);
    expect(refs.toStrings()).toEqual(["BR1.2", "BR2.0"]);
  });

  test("CheckedUnits and UnformalizedTargets take primitives through of() and iterate them", () => {
    const units = CheckedUnits.of([UnitName.of("unit:u2")]).add(UnitName.of("unit:u1"));
    expect([...units].map((u) => u.asString())).toEqual(["unit:u2", "unit:u1"]);
    expect(units.toArray().length).toBe(2);
    expect(units.sortedUniqueCanonically().toStrings()).toEqual(["unit:u1", "unit:u2"]);
    const targets = UnformalizedTargets.of([TargetId.of("BR1.1")]);
    expect(targets.covers(TargetId.of("BR1.1"))).toBe(true);
    expect(targets.toArray().map((t) => t.asString())).toEqual(["BR1.1"]);
    expect(targets.add(TargetId.of("BR1.1")).toStrings()).toEqual(["BR1.1"]);
  });
});
