// requirements/domain の単体テスト（TDA 波3 — 90% カバレッジ床の維持）。

import { describe, expect, test } from "bun:test";
import { FrRefs, TargetId, TargetIds, TriggerName, type Expression } from "../tools/kernel/domain/index.ts";
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
  IrAttributeDecl,
  IrAttributeDecls,
  IrAttributeName,
  IrEntityDecl,
  IrEntityName,
  IrTemporalDecl,
  VerificationSkipped,
  QuintScenarioVerdict,
  QuintTemporalVerdict,
 VerificationWitness, AttributePath,} from "../tools/requirements/domain/index.ts";

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
  const targets = TargetIds.reconstitute(["OB-1", "OB-2"]);
  const flat = (skips: readonly VerificationSkipped[]) =>
    skips.map((s) => `${s.target().asString()}:${s.reason()}:${s.detail()}`);

  test("timeout and run-failed abort the machine targets and skip each of them with the frozen wording", () => {
    const timeout = QuintMachineRunVerdict.timeout();
    expect(timeout.abortsMachineTargets()).toBe(true);
    expect(flat(timeout.skipsFor(targets, true))).toEqual([
      "OB-1:timeout:machine invariant check exceeded its budget",
      "OB-2:timeout:machine invariant check exceeded its budget",
    ]);
    const failed = QuintMachineRunVerdict.runFailed("boom");
    expect(failed.abortsMachineTargets()).toBe(true);
    expect(failed.skipsFor(targets, false).map((s) => s.detail())).toEqual([
      "quint run failed unexpectedly: boom",
      "quint run failed unexpectedly: boom",
    ]);
    expect(flat(failed.skipsFor(TargetIds.reconstitute(["OB-1"]), true))).toEqual(["OB-1:unavailable:quint verify failed unexpectedly: boom"]);
    expect([timeout, failed].some((v) => v.isDeadlock() || v.isViolation())).toBe(false);
  });

  test("deadlock and violation carry the trace as the witness, with the model fallback and the final state", () => {
    const trace = TraceStates.of([{ "T.ok": true }, { "T.ok": false }]);
    const deadlock = QuintMachineRunVerdict.deadlock(trace);
    expect(deadlock.abortsMachineTargets()).toBe(false);
    expect(deadlock.skipsFor(targets, true)).toEqual([]);
    expect(deadlock.isDeadlock()).toBe(true);
    expect(deadlock.isViolation()).toBe(false);
    expect(deadlock.witness().toDocument()).toEqual({ trace: [{ "T.ok": true }, { "T.ok": false }] });
    const silent = QuintMachineRunVerdict.deadlock(null);
    expect(silent.witness().toDocument()).toEqual({ model: {} });
    expect(silent.finalState()).toEqual({});
    const violation = QuintMachineRunVerdict.violation(trace);
    expect(violation.abortsMachineTargets()).toBe(false);
    expect(violation.isViolation()).toBe(true);
    expect(violation.isDeadlock()).toBe(false);
    expect(violation.witness().toDocument()).toEqual({ trace: [{ "T.ok": true }, { "T.ok": false }] });
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

describe("ir entity and temporal decls (well-formedness materials own their judgements)", () => {
  test("entity decl visits attributes with their coordinate and flags a repeated name from its second occurrence", () => {
    const attr = (name: string) => IrAttributeDecl.reconstitute({ name: IrAttributeName.reconstitute(name), kind: "bool" });
    const entity = IrEntityDecl.reconstitute({ name: IrEntityName.reconstitute("order"), attributes: IrAttributeDecls.of([attr("qty"), attr("qty"), attr("paid")]) });
    const seen: [string, boolean][] = [];
    entity.inspectAttributes((coordinate, attribute, duplicated) => seen.push([`${coordinate}=${attribute.name().asString()}`, duplicated]));
    expect(seen).toEqual([["order.qty=qty", false], ["order.qty=qty", true], ["order.paid=paid", false]]);
    expect(entity.name().asString()).toBe("order");
    expect(entity.attributes().toArray().length).toBe(3);
  });

  test("temporal decl visits assert, from and to in that order with primes forbidden, and silence when absent", () => {
    const full = IrTemporalDecl.reconstitute({ assert: lit(true), from: { op: "ref", path: "a" }, to: { op: "ref", path: "b" } });
    const seen: [string, boolean][] = [];
    full.inspectExpressions((expression, primesAllowed) => seen.push([expression.op, primesAllowed]));
    expect(seen).toEqual([["lit", false], ["ref", false], ["ref", false]]);
    const none: unknown[] = [];
    IrTemporalDecl.reconstitute({}).inspectExpressions((expression) => none.push(expression));
    expect(none).toEqual([]);
  });
});

describe("quint temporal and scenario verdicts", () => {
  test("a temporal timeout skips its obligation with the frozen wording; a violation carries its trace; clean stays silent", () => {
    const target = TargetId.reconstitute("OB-3");
    const timeout = QuintTemporalVerdict.timeout();
    expect(timeout.skipFor(target)?.reason()).toBe("timeout");
    expect(timeout.skipFor(target)?.detail()).toBe("temporal check exceeded its budget");
    expect(timeout.isViolation()).toBe(false);
    expect(timeout.witness().toDocument()).toEqual({ model: {} });
    const violation = QuintTemporalVerdict.violation(TraceStates.of([{ "T.ok": false }]));
    expect(violation.skipFor(target)).toBeNull();
    expect(violation.isViolation()).toBe(true);
    expect(violation.witness().toDocument()).toEqual({ trace: [{ "T.ok": false }] });
    expect(QuintTemporalVerdict.clean().skipFor(target)).toBeNull();
    expect(QuintTemporalVerdict.clean().isViolation()).toBe(false);
  });

  test("a scenario timeout or failed run skips with the frozen wording; only an evaluated verdict can be violated", () => {
    const target = TargetId.reconstitute("SC-1");
    expect(QuintScenarioVerdict.timeout().skipFor(target)?.detail()).toBe("scenario evaluation exceeded its budget");
    const failed = QuintScenarioVerdict.runFailed("boom");
    expect(failed.skipFor(target)?.reason()).toBe("unavailable");
    expect(failed.skipFor(target)?.detail()).toBe("quint run failed unexpectedly: boom");
    expect(failed.isViolated()).toBe(false);
    expect(QuintScenarioVerdict.evaluated(true).skipFor(target)).toBeNull();
    expect(QuintScenarioVerdict.evaluated(true).isViolated()).toBe(true);
    expect(QuintScenarioVerdict.evaluated(false).isViolated()).toBe(false);
  });
});

describe("verification witness (the contract-2 witness owns its document face)", () => {
  test("each face serializes verbatim and the document round-trips through the frozen blind cast", () => {
    expect(VerificationWitness.core(["b", "a"]).toDocument()).toEqual({ core: ["b", "a"] });
    expect(VerificationWitness.model({ "T.ok": true, "T.n": 2 }).toDocument()).toEqual({ model: { "T.ok": true, "T.n": 2 } });
    expect(VerificationWitness.verdicts({ quint: "violated", smt: "clean" }).toDocument()).toEqual({ verdicts: { quint: "violated", smt: "clean" } });
    expect(VerificationWitness.trace([{ "T.ok": true }, { "T.ok": false }]).toDocument()).toEqual({ trace: [{ "T.ok": true }, { "T.ok": false }] });
    expect(VerificationWitness.fromDocument(undefined).toDocument()).toEqual({ core: [] });
    expect(VerificationWitness.fromDocument({ model: { x: 1 } }).toDocument()).toEqual({ model: { x: 1 } });
  });
});

describe("attribute paths order canonically (ruling 1)", () => {
  test("segments compare numerically after the letter skeleton", () => {
    expect(AttributePath.reconstitute("R.a2").compareTo(AttributePath.reconstitute("R.a10"))).toBeLessThan(0);
    expect(AttributePath.reconstitute("R.b").compareTo(AttributePath.reconstitute("R.a"))).toBeGreaterThan(0);
  });
});
