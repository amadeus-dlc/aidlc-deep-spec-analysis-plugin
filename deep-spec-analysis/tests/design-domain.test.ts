// design/domain の単体テスト（TDA 波3 — 90% カバレッジ床の維持）。

import { describe, expect, test } from "bun:test";
import { FrRefs, TargetIds, TriggerName, type Expression } from "../tools/kernel/domain/index.ts";
import {
  BrRefs,
  DesignAttributeName,
  DesignBackgroundDecl,
  DesignBackgroundId,
  DesignEntityName,
  DesignFinding,
  DesignIgnore,
  DesignIgnores,
  DesignMachine,
  DesignMachineId,
  DesignTransition,
  DesignTransitions,
  InitialStates,
  DesignObligation,
  DesignObligationId,
  DesignObligationNature,
  DesignObligationOrigin,
  DesignScenario,
  DesignScenarioId,
  DesignTransitionDecl,
  DesignTransitionId,
} from "../tools/design/domain/index.ts";

const lit = (value: boolean): Expression => ({ op: "lit", value });

describe("design obligation", () => {
  test("inspectExpressions visits every held expression, primes allowed only on the effect", () => {
    const obligation = DesignObligation.reconstitute({
      id: DesignObligationId.reconstitute("DO-1"),
      nature: DesignObligationNature.reconstitute("event"),
      origin: DesignObligationOrigin.reconstitute("rules"),
      brRefs: BrRefs.of(["BR-1"]),
      frRefs: FrRefs.of(["FR-1"]),
      assert: { op: "a" },
      trigger: TriggerName.reconstitute("submit"),
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
    const complete = DesignObligation.reconstitute({
      id: DesignObligationId.reconstitute("DO-2"),
      nature: DesignObligationNature.reconstitute("event"),
      origin: DesignObligationOrigin.reconstitute("rules"),
      brRefs: BrRefs.of([]),
      frRefs: FrRefs.of([]),
      trigger: TriggerName.reconstitute("submit"),
      guard: lit(true),
      effect: lit(false),
    });
    expect(complete.eventDefinition()?.trigger.asString()).toBe("submit");
    expect(
      DesignObligation.reconstitute({
        id: DesignObligationId.reconstitute("DO-3"),
        nature: DesignObligationNature.reconstitute("event"),
        origin: DesignObligationOrigin.reconstitute("rules"),
        brRefs: BrRefs.of([]),
        frRefs: FrRefs.of([]),
        guard: lit(true),
        effect: lit(false),
      }).eventDefinition(),
    ).toBeNull();
  });

  test("reconstitute round-trips every field through the accessors, and temporal() hands out a copy", () => {
    const obligation = DesignObligation.reconstitute({
      id: DesignObligationId.reconstitute("DO-4"),
      nature: DesignObligationNature.reconstitute("invariant"),
      origin: DesignObligationOrigin.reconstitute("rules"),
      brRefs: BrRefs.of(["BR-2"]),
      frRefs: FrRefs.of(["FR-3"]),
      assert: lit(true),
      temporal: { pattern: "always", assert: lit(true) },
    });
    expect(obligation.id().asString()).toBe("DO-4");
    expect(obligation.nature().asString()).toBe("invariant");
    expect(obligation.origin().asString()).toBe("rules");
    expect(obligation.brRefs().toArray()).toEqual(["BR-2"]);
    expect(obligation.frRefs().toArray()).toEqual(["FR-3"]);
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
    DesignScenario.reconstitute({
      id: DesignScenarioId.reconstitute("DS-1"),
      kind,
      brRefs: BrRefs.of(["BR-1"]),
      frRefs: FrRefs.of([]),
      bindings: {},
    });

  test("isViolatedBySatisfiability is the accept/reject truth table", () => {
    expect(scenario("accept").isViolatedBySatisfiability(false)).toBe(true);
    expect(scenario("accept").isViolatedBySatisfiability(true)).toBe(false);
    expect(scenario("reject").isViolatedBySatisfiability(true)).toBe(true);
    expect(scenario("reject").isViolatedBySatisfiability(false)).toBe(false);
  });

  test("reconstitute round-trips every field through the accessors and bindings() hands out a copy", () => {
    const withEvent = DesignScenario.reconstitute({
      id: DesignScenarioId.reconstitute("DS-2"),
      kind: "reject",
      brRefs: BrRefs.of(["BR-7"]),
      frRefs: FrRefs.of(["FR-4"]),
      bindings: { b: 2, a: 1 },
      event: { trigger: TriggerName.reconstitute("close") },
      expect: lit(true),
    });
    expect(withEvent.id().asString()).toBe("DS-2");
    expect(withEvent.kind()).toBe("reject");
    expect(withEvent.brRefs().toArray()).toEqual(["BR-7"]);
    expect(withEvent.frRefs().toArray()).toEqual(["FR-4"]);
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
    DesignTransitionDecl.reconstitute({
      id: DesignTransitionId.reconstitute("T-1"),
      from: "open",
      to: "closed",
      trigger: TriggerName.reconstitute("close"),
      brRefs: BrRefs.of(["BR-1"]),
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

  test("reconstitute round-trips every field through the accessors", () => {
    const full = decl();
    expect(full.id().asString()).toBe("T-1");
    expect(full.fromState()).toBe("open");
    expect(full.toState()).toBe("closed");
    expect(full.trigger()?.asString()).toBe("close");
    expect(full.brRefs()?.toArray()).toEqual(["BR-1"]);
    expect(full.guard()).toEqual(lit(true));
    expect(full.effect()).toEqual(primed);
    const bare = DesignTransitionDecl.reconstitute({ id: DesignTransitionId.reconstitute("T-2") });
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
    const withAssert = DesignBackgroundDecl.reconstitute({
      id: DesignBackgroundId.reconstitute("DBG-1"),
      assert: { op: "ref", path: "t.x" },
    });
    const seen: [string, boolean][] = [];
    withAssert.inspectExpressions((expression, primesAllowed) => seen.push([expression.op, primesAllowed]));
    expect(seen).toEqual([["ref", false]]);
    expect(withAssert.id().asString()).toBe("DBG-1");
    expect(withAssert.assertion()).toEqual({ op: "ref", path: "t.x" });

    const bare = DesignBackgroundDecl.reconstitute({ id: DesignBackgroundId.reconstitute("DBG-2") });
    const none: unknown[] = [];
    bare.inspectExpressions((expression, primesAllowed) => none.push([expression.op, primesAllowed]));
    expect(none).toEqual([]);
    expect(bare.assertion()).toBeUndefined();
  });
});

describe("design transition and ignore (compile-down owners)", () => {
  const primed: Expression = { op: "ref", path: "T.s", prime: true };
  const transition = (withExprs: boolean) =>
    DesignTransition.reconstitute({
      id: DesignTransitionId.reconstitute("TR-1"),
      from: "open",
      to: "closed",
      trigger: TriggerName.reconstitute("close"),
      guard: withExprs ? lit(true) : undefined,
      effect: withExprs ? primed : undefined,
      brRefs: BrRefs.of(["BR-9"]),
    });

  test("reconstitute round-trips every field through the accessors", () => {
    const tr = transition(true);
    expect(tr.id().asString()).toBe("TR-1");
    expect(tr.fromState()).toBe("open");
    expect(tr.toState()).toBe("closed");
    expect(tr.trigger().asString()).toBe("close");
    expect(tr.guard()).toEqual(lit(true));
    expect(tr.effect()).toEqual(primed);
    expect(tr.brRefs().toArray()).toEqual(["BR-9"]);
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
    const ig = DesignIgnore.reconstitute({ state: "closed", trigger: TriggerName.reconstitute("close"), reason: "already closed" });
    expect(ig.state()).toBe("closed");
    expect(ig.trigger().asString()).toBe("close");
    expect(ig.reason()).toBe("already closed");
    expect(ig.loweredGuard("T.s")).toEqual({ op: "eq", args: [{ op: "ref", path: "T.s" }, { op: "enum", value: "closed" }] });
    expect(ig.loweredEffect("T.s")).toEqual({ op: "eq", args: [{ op: "ref", path: "T.s", prime: true }, { op: "ref", path: "T.s" }] });
  });
});

describe("design finding (conflict reinterpretation owner)", () => {
  const finding = (kind: string, targets: string[]) =>
    DesignFinding.reconstitute({
      kind,
      frRefs: FrRefs.of(["FR-1"]),
      targets: TargetIds.of(targets),
      witness: { trace: [{ "T.s": "a" }] },
      unit: "u1",
      detail: "overlap",
    });

  test("reconstitute round-trips every field through the accessors", () => {
    const f = finding("conflict", ["FR-9", "TR-1"]);
    expect(f.kind()).toBe("conflict");
    expect(f.frRefs().toArray()).toEqual(["FR-1"]);
    expect(f.targets().toArray()).toEqual(["FR-9", "TR-1"]);
    expect(f.witness()).toEqual({ trace: [{ "T.s": "a" }] });
    expect(f.unit()).toBe("u1");
    expect(f.detail()).toBe("overlap");
    expect(f.isConflict()).toBe(true);
    expect(finding("unreachable", ["TR-1"]).isConflict()).toBe(false);
  });

  test("a conflict reaching requirement ids ascends to refinement-violation with the frozen wording", () => {
    const v = finding("conflict", ["FR-9", "TR-1"]).asRefinementViolation(new Set(["FR-9", "FR-10"]), "u1");
    expect(v?.kind()).toBe("refinement-violation");
    expect(v?.targets().toArray()).toEqual(["FR-9"]);
    expect(v?.frRefs().toArray()).toEqual(["FR-1"]);
    expect(v?.witness()).toEqual({ trace: [{ "T.s": "a" }] });
    expect(v?.unit()).toBe("u1");
    expect(v?.detail()).toBe(
      "The design machine of unit u1 reaches a state that violates requirements obligation FR-9 under the refinement map (step trace attached): the design can execute its way out of the verified requirements.",
    );
  });

  test("a conflict that misses every requirement id, and any non-conflict, reinterprets to null", () => {
    expect(finding("conflict", ["TR-1"]).asRefinementViolation(new Set(["FR-9"]), "u1")).toBeNull();
    expect(finding("unreachable", ["FR-9"]).asRefinementViolation(new Set(["FR-9"]), "u1")).toBeNull();
  });

  test("withDetail copies every field and replaces only the wording", () => {
    const copy = finding("redundancy", ["TR-1", "TR-2"]).withDetail("mutual");
    expect(copy.kind()).toBe("redundancy");
    expect(copy.frRefs().toArray()).toEqual(["FR-1"]);
    expect(copy.targets().toArray()).toEqual(["TR-1", "TR-2"]);
    expect(copy.witness()).toEqual({ trace: [{ "T.s": "a" }] });
    expect(copy.unit()).toBe("u1");
    expect(copy.detail()).toBe("mutual");
  });
});

describe("design machine (probe candidates and the deterministic waiver)", () => {
  const machine = (deterministic: boolean, id = "SM-1") =>
    DesignMachine.reconstitute({
      id: DesignMachineId.reconstitute(id),
      entity: DesignEntityName.reconstitute("Ticket"),
      attribute: DesignAttributeName.reconstitute("status"),
      initial: InitialStates.of(["open"]),
      transitions: DesignTransitions.of([
        DesignTransition.reconstitute({ id: DesignTransitionId.reconstitute("TR-1"), from: "open", to: "closed", trigger: TriggerName.reconstitute("close"), brRefs: BrRefs.of([]) }),
      ]),
      ignores: DesignIgnores.of([DesignIgnore.reconstitute({ state: "closed", trigger: TriggerName.reconstitute("close"), reason: "" })]),
      deterministic,
    });

  test("reconstitute round-trips every field through the accessors", () => {
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
