import { describe, expect, test } from "bun:test";
import {
  AttributeKind, AttributePath, BindingDeclaration, BindingValue, DeclaredBindings, DeclaredBindingValue,
  EnumMember, ErrorMessage, ErrorMessages, ScenarioBinding, ScenarioBindings,
  FunctionalRequirementReferences, RequirementId,
} from "@deep-spec/kernel-domain";
import { decodeDeclaredBindings, decodeScenarioBindings } from "@deep-spec/kernel-adapter";
import { IllegalArgumentException, assertValueSize } from "@deep-spec/kernel-infrastructure";
import { AttributeValues, IrDeclaredValues } from "@deep-spec/requirements-domain";
import { DeclaredValues, ReqAttributeValues, InitialState, InitialStates, AttrPaths } from "@deep-spec/design-domain";

describe("domain collection element contracts", () => {
  test("ErrorMessages retains diagnostic occurrences and owns its array", () => {
    const first = ErrorMessage.of("same diagnostic");
    const source = [first];
    const messages = ErrorMessages.of(source);
    source.push(ErrorMessage.of("outside"));
    const second = ErrorMessage.of("same diagnostic");
    const extended = messages.add(second);
    expect([...messages]).toEqual([first]);
    expect(extended.toArray()[0]).toBe(first);
    expect(extended.toArray()[1]).toBe(second);
    expect(Object.isFrozen(extended.toArray())).toBe(true);
    expect(() => ErrorMessage.of("")).toThrow(IllegalArgumentException);
    expect(() => ErrorMessages.of(Array(65_537).fill(first))).toThrow(IllegalArgumentException);
  });

  for (const collection of [AttributeValues, IrDeclaredValues, DeclaredValues, ReqAttributeValues]) {
    test(`${collection.name} accepts enum members and owns its array`, () => {
      const open = EnumMember.of("open");
      const source = [open];
      const values = collection.of(source);
      source.push(EnumMember.of("outside"));
      const extended = values.add(EnumMember.of("closed"));
      expect([...values]).toEqual([open]);
      expect(extended.toArray().map((member) => member.asString())).toEqual(["open", "closed"]);
      expect(Object.isFrozen(values.toArray())).toBe(true);
      expect(() => collection.of(Array(10_001).fill(open))).toThrow(IllegalArgumentException);
    });
  }

  test("initial states and attribute paths carry domain elements", () => {
    const state = InitialState.of("open");
    const states = InitialStates.of([state]);
    expect(states.includes("open")).toBe(true);
    expect(states.includes("closed")).toBe(false);
    expect(() => InitialStates.of(Array(10_001).fill(state))).toThrow(IllegalArgumentException);
    const path = AttributePath.of("ticket.state");
    const paths = AttrPaths.of([path]).add(AttributePath.of("ticket.state"));
    expect(paths.toArray()).toHaveLength(1);
    expect(paths.has(AttributePath.of("ticket.state"))).toBe(true);
    expect(EnumMember.of("open").equals(EnumMember.of("open"))).toBe(true);
    expect(EnumMember.of("open").equals(EnumMember.of("closed"))).toBe(false);
  });

  test("primitive elements and raw binding tuples are excluded by TypeScript", () => {
    const acceptsText: string extends Parameters<typeof ErrorMessages.of>[0][number] ? true : false = false;
    const acceptsLiteral: string extends Parameters<typeof DeclaredValues.of>[0][number] ? true : false = false;
    const acceptsTuple: readonly [string, boolean] extends Parameters<typeof ScenarioBindings.of>[0][number] ? true : false = false;
    expect([acceptsText, acceptsLiteral, acceptsTuple]).toEqual([false, false, false]);
    expect("parse" in ErrorMessages).toBe(false);
    expect("parse" in ScenarioBindings).toBe(false);
    expect("parse" in DeclaredBindings).toBe(false);
  });

  test("functional requirement references own their array and preserve typed elements when sorting", () => {
    const reference = RequirementId.of("FR-2");
    const source = [reference, RequirementId.of("FR-1"), reference];
    const references = FunctionalRequirementReferences.of(source);
    source.length = 0;
    expect(references.sortedUnique().toStrings()).toEqual(["FR-1", "FR-2"]);
    expect(references.sortedUnique().toArray()[1]).toBe(reference);
    expect(references.isEmpty()).toBe(false);
    expect(FunctionalRequirementReferences.of([]).isEmpty()).toBe(true);
    expect(Object.isFrozen(references.toArray())).toBe(true);
    expect(() => FunctionalRequirementReferences.of(Array(10_001).fill(reference))).toThrow(IllegalArgumentException);
  });
});

describe("scenario binding contracts", () => {
  test("declarations retain malformed values for diagnosis without mutable aliases", () => {
    const payload = { values: [1] };
    const value = DeclaredBindingValue.of(payload);
    const declaration = BindingDeclaration.of(AttributePath.of("ticket.state"), value);
    const source = [declaration];
    const declarations = DeclaredBindings.of(source);
    payload.values.push(99);
    source.length = 0;
    expect([...declarations][0]).toBe(declaration);
    expect(value.describe()).toBe('{"values":[1]}');
    expect(value.fits(AttributeKind.of("bool"), () => false)).toBe(false);
    expect(BindingValue.resolve(value).ok).toBe(false);
    expect(declarations.add(declaration).toArray()).toHaveLength(2);
    expect(Object.isFrozen(declarations.toArray())).toBe(true);
    expect(() => DeclaredBindings.of(Array(10_001).fill(declaration))).toThrow(IllegalArgumentException);
  });

  test("logical values own their integer and literal constraints and expression meaning", () => {
    for (const [primitive, op] of [[true, "bool"], [12, "int"], ["open", "enum"]] as const) {
      const value = BindingValue.of(primitive);
      expect(value.equals(BindingValue.of(primitive))).toBe(true);
      expect(value.asExpression()).toEqual({ op, value: primitive });
      expect(BindingValue.resolve(DeclaredBindingValue.of(primitive)).ok).toBe(true);
    }
    for (const value of [1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => BindingValue.of(value)).toThrow(IllegalArgumentException);
      expect(BindingValue.resolve(DeclaredBindingValue.of(value)).ok).toBe(false);
    }
    expect(() => BindingValue.of("x".repeat(4097))).toThrow(IllegalArgumentException);
    expect(BindingValue.resolve(DeclaredBindingValue.of(null)).ok).toBe(false);
  });

  test("scenario bindings preserve entities, sort paths and reject duplicate assignments", () => {
    const a = AttributePath.of("ticket.a");
    const b = AttributePath.of("ticket.b");
    const first = ScenarioBinding.of(b, BindingValue.of(false));
    const source = [first];
    const bindings = ScenarioBindings.of(source);
    source.length = 0;
    const extended = bindings.add(ScenarioBinding.of(a, BindingValue.of(1)));
    expect(extended.entriesCanonically().map((binding) => binding.path().asString())).toEqual(["ticket.a", "ticket.b"]);
    expect(extended.valueAt(AttributePath.of("ticket.b"))?.toDocument()).toBe(false);
    expect(bindings.valueAt(a)).toBeNull();
    expect(extended.covers([a, b])).toBe(true);
    expect(bindings.covers([a, b])).toBe(false);
    const output = extended.toDocument();
    output["ticket.a"] = 9;
    expect(extended.valueAt(a)?.toDocument()).toBe(1);
    expect(() => bindings.add(ScenarioBinding.of(b, BindingValue.of(true)))).toThrow(IllegalArgumentException);
    expect(() => ScenarioBindings.of(Array(10_001).fill(first))).toThrow(IllegalArgumentException);
  });

  test("input decoding reports invalid values and oversized paths as Results", () => {
    expect(decodeScenarioBindings({ "ticket.state": "open", "ticket.active": true }).ok).toBe(true);
    const invalid: Parameters<typeof decodeScenarioBindings>[0][] = [{ "": true }, { ["x".repeat(258)]: true }, { "ticket.state": null }, { "ticket.state": 1.5 }, { "ticket.state": "x".repeat(4097) }];
    for (const input of invalid) {
      expect(decodeScenarioBindings(input).ok).toBe(false);
    }
    expect(decodeDeclaredBindings({ "ticket.state": { nested: [null] } }).ok).toBe(true);
  });
});

test("recursive value size budgets reject before copying", () => {
  const limits = { string: 4, nodes: 8, depth: 2, total: 8 };
  expect(() => assertValueSize({ a: [1, null, "x"] }, limits)).not.toThrow();
  const oversized: Parameters<typeof assertValueSize>[0][] = ["xxxxx", { xxxxx: 1 }, Array(9).fill(0), { a: { b: { c: 1 } } }, ["abcd", "abcd", "a"], { abcd: "abcd", x: 1 }];
  for (const value of oversized) {
    expect(() => assertValueSize(value, limits)).toThrow(IllegalArgumentException);
  }
  expect(DeclaredBindingValue.parse({ a: "x".repeat(4097) }).ok).toBe(false);
});
