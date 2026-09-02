// requirements/domain の単体テスト（TDA 波3 — 90% カバレッジ床の維持）。

import { describe, expect, test } from "bun:test";
import { FrRefs, TriggerName, type Expression } from "../tools/kernel/domain/index.ts";
import {
  BackgroundAssumptionId,
  IrBackgroundDecl,
  Obligation,
  ObligationId,
  ObligationNature,
  QuintMachineRunVerdict,
  Scenario,
  ScenarioId,
  TraceStates,
} from "../tools/requirements/domain/index.ts";

const lit = (value: boolean): Expression => ({ op: "lit", value });

describe("obligation", () => {
  const event = (overrides: { trigger?: TriggerName; guard?: Expression; effect?: Expression } = {}) =>
    Obligation.reconstitute({
      id: ObligationId.reconstitute("OB-1"),
      nature: ObligationNature.reconstitute("event"),
      frRefs: FrRefs.of(["FR-1"]),
      trigger: TriggerName.reconstitute("submit"),
      guard: lit(true),
      effect: lit(false),
      ...overrides,
    });

  test("eventDefinition requires an event nature, a non-empty trigger, and both expressions", () => {
    const definition = event().eventDefinition();
    expect(definition?.trigger.asString()).toBe("submit");
    expect(definition?.guard).toEqual(lit(true));
    expect(definition?.effect).toEqual(lit(false));
    expect(event({ trigger: TriggerName.reconstitute("") }).eventDefinition()).toBeNull();
    expect(event({ guard: undefined }).eventDefinition()).toBeNull();
    expect(
      Obligation.reconstitute({
        id: ObligationId.reconstitute("OB-2"),
        nature: ObligationNature.reconstitute("invariant"),
        frRefs: FrRefs.of([]),
        assert: lit(true),
      }).eventDefinition(),
    ).toBeNull();
  });

  test("vacuityAntecedent surfaces the antecedent of an implies assertion only", () => {
    const antecedent = lit(true);
    const implied = Obligation.reconstitute({
      id: ObligationId.reconstitute("OB-3"),
      nature: ObligationNature.reconstitute("invariant"),
      frRefs: FrRefs.of([]),
      assert: { op: "implies", args: [antecedent, lit(false)] },
    });
    expect(implied.vacuityAntecedent()).toBe(antecedent);
    expect(
      Obligation.reconstitute({
        id: ObligationId.reconstitute("OB-4"),
        nature: ObligationNature.reconstitute("invariant"),
        frRefs: FrRefs.of([]),
        assert: lit(true),
      }).vacuityAntecedent(),
    ).toBeUndefined();
  });

  test("inspectExpressions visits every held expression, primes allowed only on the effect", () => {
    const obligation = Obligation.reconstitute({
      id: ObligationId.reconstitute("OB-5"),
      nature: ObligationNature.reconstitute("state-temporal"),
      frRefs: FrRefs.of([]),
      assert: { op: "a" },
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

  test("reconstitute round-trips every field through the accessors, and temporal() hands out a copy", () => {
    const obligation = Obligation.reconstitute({
      id: ObligationId.reconstitute("OB-6"),
      nature: ObligationNature.reconstitute("numeric"),
      frRefs: FrRefs.of(["FR-9"]),
      ears: "the system shall ...",
      assert: lit(true),
      trigger: TriggerName.reconstitute("tick"),
      guard: lit(true),
      effect: lit(false),
      temporal: { pattern: "always", assert: lit(true) },
    });
    expect(obligation.id().asString()).toBe("OB-6");
    expect(obligation.nature().asString()).toBe("numeric");
    expect(obligation.frRefs().toArray()).toEqual(["FR-9"]);
    expect(obligation.ears()).toBe("the system shall ...");
    expect(obligation.assertion()).toEqual(lit(true));
    expect(obligation.trigger()?.asString()).toBe("tick");
    expect(obligation.guard()).toEqual(lit(true));
    expect(obligation.effect()).toEqual(lit(false));
    expect(obligation.temporal()?.pattern).toBe("always");
    const leaked = obligation.temporal();
    expect(leaked).not.toBe(obligation.temporal());
    expect(obligation.isInvariantLike()).toBe(true);
    expect(obligation.isEvent()).toBe(false);
    expect(obligation.isStateTemporal()).toBe(false);
  });
});

describe("scenario", () => {
  const scenario = (kind: "accept" | "reject") =>
    Scenario.reconstitute({
      id: ScenarioId.reconstitute("SC-1"),
      kind,
      frRefs: FrRefs.of(["FR-1"]),
      bindings: { b: 2, a: 1 },
    });

  test("reconstitute round-trips every field through the accessors", () => {
    const withEvent = Scenario.reconstitute({
      id: ScenarioId.reconstitute("SC-2"),
      kind: "accept",
      frRefs: FrRefs.of(["FR-1", "FR-2"]),
      bindings: { a: 1 },
      event: { trigger: TriggerName.reconstitute("submit") },
      expect: lit(true),
    });
    expect(withEvent.id().asString()).toBe("SC-2");
    expect(withEvent.kind()).toBe("accept");
    expect(withEvent.frRefs().toArray()).toEqual(["FR-1", "FR-2"]);
    expect(withEvent.eventTrigger()?.asString()).toBe("submit");
    expect(withEvent.expectation()).toEqual(lit(true));
    expect(withEvent.isAccept()).toBe(true);
    expect(withEvent.isReject()).toBe(false);
    expect(withEvent.hasEvent()).toBe(true);
    expect(scenario("reject").isAccept()).toBe(false);
    expect(scenario("reject").isReject()).toBe(true);
    expect(scenario("reject").hasEvent()).toBe(false);
    expect(scenario("reject").eventTrigger()).toBeUndefined();
    expect(scenario("reject").expectation()).toBeUndefined();
  });

  test("isViolatedBySatisfiability is the accept/reject truth table", () => {
    expect(scenario("accept").isViolatedBySatisfiability(false)).toBe(true);
    expect(scenario("accept").isViolatedBySatisfiability(true)).toBe(false);
    expect(scenario("reject").isViolatedBySatisfiability(true)).toBe(true);
    expect(scenario("reject").isViolatedBySatisfiability(false)).toBe(false);
  });

  test("bindingEntriesCanonically sorts by key and bindings() hands out a copy", () => {
    expect(scenario("accept").bindingEntriesCanonically()).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
    const out = scenario("accept").bindings();
    (out as Record<string, number>).c = 3;
    expect(scenario("accept").bindings()).toEqual({ b: 2, a: 1 });
  });
});

describe("ir background decl", () => {
  test("inspectExpressions visits the assertion with primes forbidden, and silence when absent", () => {
    const withAssert = IrBackgroundDecl.reconstitute({
      id: BackgroundAssumptionId.reconstitute("BG-1"),
      assert: { op: "ref", path: "a.b" },
    });
    const seen: [string, boolean][] = [];
    withAssert.inspectExpressions((expression, primesAllowed) => seen.push([expression.op, primesAllowed]));
    expect(seen).toEqual([["ref", false]]);
    expect(withAssert.id().asString()).toBe("BG-1");
    expect(withAssert.assertion()).toEqual({ op: "ref", path: "a.b" });

    const bare = IrBackgroundDecl.reconstitute({ id: BackgroundAssumptionId.reconstitute("BG-2") });
    const none: unknown[] = [];
    bare.inspectExpressions((expression, primesAllowed) => none.push([expression.op, primesAllowed]));
    expect(none).toEqual([]);
    expect(bare.assertion()).toBeUndefined();
  });
});

describe("quint machine run verdict", () => {
  const targets = ["OB-1", "OB-2"];

  test("timeout and run-failed abort the machine targets and skip each of them with the frozen wording", () => {
    const timeout = QuintMachineRunVerdict.timeout();
    expect(timeout.abortsMachineTargets()).toBe(true);
    expect(timeout.skipsFor(targets, true)).toEqual([
      { target: "OB-1", reason: "timeout", detail: "machine invariant check exceeded its budget" },
      { target: "OB-2", reason: "timeout", detail: "machine invariant check exceeded its budget" },
    ]);
    const failed = QuintMachineRunVerdict.runFailed("boom");
    expect(failed.abortsMachineTargets()).toBe(true);
    expect(failed.skipsFor(targets, false).map((s) => s.detail)).toEqual([
      "quint run failed unexpectedly: boom",
      "quint run failed unexpectedly: boom",
    ]);
    expect(failed.skipsFor(["OB-1"], true)).toEqual([{ target: "OB-1", reason: "unavailable", detail: "quint verify failed unexpectedly: boom" }]);
    expect([timeout, failed].some((v) => v.isDeadlock() || v.isViolation())).toBe(false);
  });

  test("deadlock and violation carry the trace as the witness, with the model fallback and the final state", () => {
    const trace = TraceStates.of([{ "T.ok": true }, { "T.ok": false }]);
    const deadlock = QuintMachineRunVerdict.deadlock(trace);
    expect(deadlock.abortsMachineTargets()).toBe(false);
    expect(deadlock.skipsFor(targets, true)).toEqual([]);
    expect(deadlock.isDeadlock()).toBe(true);
    expect(deadlock.isViolation()).toBe(false);
    expect(deadlock.witness()).toEqual({ trace: [{ "T.ok": true }, { "T.ok": false }] });
    const silent = QuintMachineRunVerdict.deadlock(null);
    expect(silent.witness()).toEqual({ model: {} });
    expect(silent.finalState()).toEqual({});
    const violation = QuintMachineRunVerdict.violation(trace);
    expect(violation.abortsMachineTargets()).toBe(false);
    expect(violation.isViolation()).toBe(true);
    expect(violation.isDeadlock()).toBe(false);
    expect(violation.witness()).toEqual({ trace: [{ "T.ok": true }, { "T.ok": false }] });
    expect(violation.finalState()).toEqual({ "T.ok": false });
  });

  test("a clean run neither aborts, skips, nor reports", () => {
    const clean = QuintMachineRunVerdict.clean();
    expect(clean.abortsMachineTargets()).toBe(false);
    expect(clean.skipsFor(targets, false)).toEqual([]);
    expect(clean.isDeadlock()).toBe(false);
    expect(clean.isViolation()).toBe(false);
  });
});
