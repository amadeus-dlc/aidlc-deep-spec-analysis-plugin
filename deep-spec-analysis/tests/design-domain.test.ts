// design/domain の単体テスト（TDA 波3 — 90% カバレッジ床の維持）。

import { describe, expect, test } from "bun:test";
import { FrRefs, TriggerName, type Expression } from "../tools/kernel/domain/index.ts";
import {
  BrRefs,
  DesignBackgroundDecl,
  DesignBackgroundId,
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
