import { describe, expect, test } from "bun:test";
import {
  Declaration, DeclaredBindingValue, AttributeKind, AttributePath, ExpressionTree, FindingsSchema,
  FunctionalRequirementReferences, ScenarioBindings, TriggerName, FindingKind,
} from "@deep-spec/kernel-domain";
import { TraceValue, VerificationWitness } from "@deep-spec/requirements-domain";
import { AttributeMapping, DesignWitness, LoweredScenario, LoweredIdentifier, SiblingVerdictFinding, RefinementMapDefect } from "@deep-spec/design-domain";
import { TargetIdentifier } from "@deep-spec/kernel-domain";
import { IllegalArgumentException, type Json, err, ok, flatMapResult } from "@deep-spec/kernel-infrastructure";

function rejects(value: Json): void {
  expect(() => Declaration.of(value)).toThrow(IllegalArgumentException);
  const result = Declaration.parse(value);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).not.toBeInstanceOf(Error);
}

function nested(depth: number): Json {
  let value: Json = null;
  for (let level = 0; level < depth; level++) value = [value];
  return value;
}

function changingValue() {
  let first = true;
  return {
    get value(): string {
      const value = first ? "checked" : "x".repeat(65_537);
      first = false;
      return value;
    },
  };
}

describe("Declaration is a protected value, not a parameter alias", () => {
  test("raw data and a lookalike public shape cannot substitute for a constructed Declaration", () => {
    type Input = Parameters<typeof DeclaredBindingValue.of>[0];
    const rawAccepted: Json extends Input ? true : false = false;
    const shapeAccepted: Pick<Declaration, keyof Declaration> extends Input ? true : false = false;
    expect([rawAccepted, shapeAccepted]).toEqual([false, false]);
    const declaration = Declaration.parse(7);
    expect(declaration.ok).toBe(true);
    if (declaration.ok) expect(DeclaredBindingValue.of(declaration.value).fits(AttributeKind.of("int"), () => false)).toBe(true);
  });

  test("size, node count, total text and depth have explicit boundaries", () => {
    expect(Declaration.parse("x".repeat(4096)).ok).toBe(true);
    rejects("x".repeat(4097));
    rejects({ ["x".repeat(4097)]: null });
    expect(Declaration.parse(Array.from({ length: 4095 }, () => null)).ok).toBe(true);
    rejects(Array.from({ length: 4096 }, () => null));
    expect(Declaration.parse(Array.from({ length: 16 }, () => "x".repeat(4096))).ok).toBe(true);
    rejects([...Array.from({ length: 16 }, () => "x".repeat(4096)), "x"]);
    expect(Declaration.parse(nested(32)).ok).toBe(true);
    rejects(nested(33));
    const cyclic: Json[] = [];
    cyclic.push(cyclic);
    rejects(cyclic);
  });

  test("non-finite numbers cannot masquerade as JSON null", () => {
    for (const value of [NaN, Infinity, -Infinity]) {
      rejects(value);
      rejects({ nested: [value] });
    }
    expect(Declaration.parse(1.5).ok).toBe(true);
    expect(Declaration.parse(Number.MAX_SAFE_INTEGER + 1).ok).toBe(true);
    const declaration = Declaration.of(1.5);
    expect(DeclaredBindingValue.of(declaration).fits(AttributeKind.of("int"), () => false)).toBe(false);
  });

  test("mutating the input cannot alter the public value or equality", () => {
    const source = { nested: [1, 2] };
    const declaration = Declaration.of(source);
    source.nested.push(3);
    expect(declaration.describe()).toBe('{"nested":[1,2]}');
    expect(declaration.equals(Declaration.of({ nested: [1, 2] }))).toBe(true);
    expect(declaration.equals(Declaration.of({ nested: [2, 1] }))).toBe(false);
    expect(Declaration.of({ b: 2, a: 1 }).equals(Declaration.of({ a: 1, b: 2 }))).toBe(true);
    expect(Declaration.of({ ["__proto__"]: { value: "data" } }).describe()).toBe('{"__proto__":{"value":"data"}}');
  });

  test("the value that passes the size check is the value retained", () => {
    expect(Declaration.of(changingValue()).describe()).toBe('{"value":"checked"}');
    const defect = { get value(): string { throw new TypeError("input read failed"); } };
    expect(() => Declaration.parse(defect)).toThrow(TypeError);
  });
});

describe("bounded snapshots apply to every owner of raw structured input", () => {
  test("trace and both witness types retain the checked input", () => {
    expect(TraceValue.of(changingValue()).toDocument()).toEqual({ value: "checked" });
    expect(DesignWitness.of(changingValue()).toDocument()).toEqual({ value: "checked" });
    expect(VerificationWitness.of({ model: changingValue() }).toDocument()).toEqual({ model: { value: "checked" } });
    const source = { value: "before" };
    const value = TraceValue.of(source);
    source.value = "after";
    expect(value.toDocument()).toEqual({ value: "before" });
  });

  test("expressions validate the snapshot they retain", () => {
    let first = true;
    const source = { get op(): string { const op = first ? "bool" : "x".repeat(129); first = false; return op; }, value: true };
    const tree = ExpressionTree.parse(source);
    expect(tree.ok).toBe(true);
    if (tree.ok) expect(tree.value.asExpression()).toEqual({ op: "bool", value: true });
  });

  test("attribute mappings own validation and never keep mutable parameter records", () => {
    const path = AttributePath.of("requirement.state");
    const cases = { draft: "open" };
    const mapping = AttributeMapping.parse(path, { kind: "enum-cases", from: AttributePath.of("design.phase"), cases });
    expect(mapping.ok).toBe(true);
    cases.draft = "changed";
    if (mapping.ok) expect(mapping.value.producedValuesOutside({ includes: (value) => value === "open" })).toEqual([]);
    const invalid = { kind: "expression", expr: { op: "ref", path: "x".repeat(258) } } as const;
    expect(() => AttributeMapping.of(path, invalid)).toThrow(IllegalArgumentException);
    const rejected = AttributeMapping.parse(path, invalid);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.error).not.toBeInstanceOf(Error);
  });

  test("a schema cannot change its validation rules through the original input", () => {
    const source = { type: "object", required: ["name"] };
    const schema = FindingsSchema.parse(source);
    expect(schema.ok).toBe(true);
    source.required.length = 0;
    if (schema.ok) {
      expect(schema.value.degradationReasonFor({})).not.toBeNull();
      expect(schema.value.degradationReasonFor({ name: "present" })).toBeNull();
    }
  });
});

test("Result composition propagates a non-exception failure without running the next constructor", () => {
  const failure = { kind: "input-invalid" };
  let called = false;
  expect(flatMapResult(err(failure), () => { called = true; return ok(1); })).toEqual({ ok: false, error: failure });
  expect(called).toBe(false);
  expect(flatMapResult(ok(1), (value) => ok(value + 1))).toEqual({ ok: true, value: 2 });
});

test("lowered event data and sibling targets do not retain mutable argument containers", () => {
  const event = { trigger: TriggerName.of("go") };
  const lowered = LoweredScenario.of({ id: LoweredIdentifier.of("SC-1"), kind: "accept", functionalRequirementReferences: FunctionalRequirementReferences.of([]), bindings: ScenarioBindings.of([]), event });
  event.trigger = TriggerName.of("changed");
  expect(lowered.event()?.trigger).toBe("go");
  const output = lowered.event();
  if (output !== undefined) Reflect.set(output, "trigger", "outside");
  expect(lowered.event()?.trigger).toBe("go");

  const targets = [LoweredIdentifier.of("OB-1")];
  const finding = SiblingVerdictFinding.of({ kind: FindingKind.conflict(), functionalRequirementReferences: FunctionalRequirementReferences.of([]), targets, witness: DesignWitness.core([]), detail: "fixture" });
  targets.push(LoweredIdentifier.of("OB-2"));
  expect(finding.targets().map((target) => target.asString())).toEqual(["OB-1"]);
});

test("an unsupported effect is reported as a domain compile-error skip", () => {
  const defect = RefinementMapDefect.effectNotAssignmentConjunction();
  expect(defect.message()).toBe("requirements effect is not a conjunction of primed assignments");
  const skip = defect.asCompileErrorSkip(TargetIdentifier.of("OB-1"), "unit-one");
  expect(skip.target().asString()).toBe("OB-1");
  expect(skip.reason()).toBe("compile-error");
  expect(skip.detail()).toBe("alpha substitution failed: requirements effect is not a conjunction of primed assignments");
});
