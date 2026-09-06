import { expect, test } from "bun:test";
import { AttributePath } from "@deep-spec-analysis/kernel-domain";
import { IllegalArgumentException } from "@deep-spec-analysis/kernel-infrastructure";
import {
  TraceState,
  TraceStateEntry,
  TraceStates,
  TraceValue,
  VerificationWitness,
} from "@deep-spec-analysis/requirements-domain";

type TraceFixtureValue =
  | null
  | boolean
  | number
  | string
  | readonly TraceFixtureValue[]
  | { readonly [key: string]: TraceFixtureValue };

const entry = (path: string, value: TraceFixtureValue): TraceStateEntry =>
  TraceStateEntry.of(AttributePath.of(path), TraceValue.of(value));

test("toDocument serializes accepted special keys as own properties in insertion order", () => {
  const state = TraceState.of([entry("__proto__", { safe: true }), entry("constructor", "safe")]);

  expect(JSON.stringify(state.toDocument())).toBe('{"__proto__":{"safe":true},"constructor":"safe"}');
});

test("special trace keys remain in a serialized VerificationWitness trace", () => {
  const state = TraceState.of([entry("__proto__", { safe: true }), entry("constructor", "safe")]);

  expect(JSON.stringify(VerificationWitness.trace([state]).toDocument())).toBe(
    '{"trace":[{"__proto__":{"safe":true},"constructor":"safe"}]}',
  );
});

test("equals compares the mapping independently of key insertion order and is symmetric", () => {
  const left = TraceState.of([entry("Account.open", true), entry("Account.count", 1)]);
  const right = TraceState.of([entry("Account.count", 1), entry("Account.open", true)]);

  expect(left.equals(right)).toBe(true);
  expect(right.equals(left)).toBe(true);
});

test("equals rejects a changed value or a changed key in either direction", () => {
  const state = TraceState.of([entry("Account.open", true)]);
  const changedValue = TraceState.of([entry("Account.open", false)]);
  const changedKey = TraceState.of([entry("Account.closed", true)]);
  const nullState = TraceState.of([entry("Account.open", null)]);
  const nullChangedKey = TraceState.of([entry("Account.closed", null)]);

  expect(state.equals(changedValue)).toBe(false);
  expect(changedValue.equals(state)).toBe(false);
  expect(state.equals(changedKey)).toBe(false);
  expect(changedKey.equals(state)).toBe(false);
  expect(nullState.equals(nullChangedKey)).toBe(false);
  expect(nullChangedKey.equals(nullState)).toBe(false);
});

test("equals ignores top-level key order while preserving TraceValue nested JSON key order", () => {
  const first = TraceState.of([entry("Account.active", true), entry("Account.settings", { first: 1, second: 2 })]);
  const topLevelReordered = TraceState.of([
    entry("Account.settings", { first: 1, second: 2 }),
    entry("Account.active", true),
  ]);
  const nestedKeysReordered = TraceState.of([
    entry("Account.settings", { second: 2, first: 1 }),
    entry("Account.active", true),
  ]);

  expect(first.equals(topLevelReordered)).toBe(true);
  expect(topLevelReordered.equals(first)).toBe(true);
  expect(first.equals(nestedKeysReordered)).toBe(false);
  expect(nestedKeysReordered.equals(first)).toBe(false);
});

test("equals distinguishes an absent key from an explicit null value", () => {
  const path = AttributePath.of("Account.value");
  const absent = TraceState.empty();
  const explicitNull = TraceState.of([entry(path.asString(), null)]);

  expect(absent.valueAt(path).equals(explicitNull.valueAt(path))).toBe(true);
  expect(absent.equals(explicitNull)).toBe(false);
  expect(explicitNull.equals(absent)).toBe(false);
  expect(JSON.stringify(absent.toDocument())).toBe("{}");
  expect(JSON.stringify(explicitNull.toDocument())).toBe('{"Account.value":null}');
});

test("duplicate keys use the last value while retaining the first key position", () => {
  const path = AttributePath.of("Account.open");
  const state = TraceState.of([entry(path.asString(), true), entry(path.asString(), false), entry("Account.count", 1)]);

  expect(state.valueAt(path).toDocument()).toBe(false);
  expect(JSON.stringify(state.toDocument())).toBe('{"Account.open":false,"Account.count":1}');
});

test("construction owns an input snapshot and tail/filter leave the source state unchanged", () => {
  const source = [entry("Account.open", true), entry("Account.count", 1), entry("Account.name", "Ada")];
  const state = TraceState.of(source);
  const before = JSON.stringify(state.toDocument());
  const sourceBefore = JSON.stringify(source.map((value) => value.path().asString()));

  const tail = state.tail();
  const filtered = state.filter((value) => value.path().equals(AttributePath.of("Account.count")));

  expect(JSON.stringify(state.toDocument())).toBe(before);
  expect(JSON.stringify(source.map((value) => value.path().asString()))).toBe(sourceBefore);
  expect(JSON.stringify(tail.toDocument())).toBe('{"Account.count":1,"Account.name":"Ada"}');
  expect(JSON.stringify(filtered.toDocument())).toBe('{"Account.count":1}');

  source.splice(0, source.length, entry("Account.changed", false));
  expect(JSON.stringify(state.toDocument())).toBe(before);
  expect(JSON.stringify(source.map((value) => value.path().asString()))).toBe('["Account.changed"]');
});

test("TraceStates.include uses TraceState mapping equality", () => {
  const original = TraceState.of([entry("Account.open", true), entry("Account.count", 1)]);
  const reordered = TraceState.of([entry("Account.count", 1), entry("Account.open", true)]);
  const changed = TraceState.of([entry("Account.count", 2), entry("Account.open", true)]);

  const states = TraceStates.of([original]);
  expect(states.include(reordered)).toBe(true);
  expect(states.include(changed)).toBe(false);
});

test("the entry cap is checked before deduplication by of and parse", () => {
  const duplicate = entry("Account.open", true);
  const oversized = Array.from({ length: 65_537 }, () => duplicate);

  expect(() => TraceState.of(oversized)).toThrow(IllegalArgumentException);
  const parsed = TraceState.parse(oversized);
  expect(parsed.ok).toBe(false);
  if (parsed.ok) throw new Error("expected TraceState.parse to return a ParseError");
  expect(parsed.error).not.toBeInstanceOf(Error);
  expect(parsed.error).toEqual({ kind: "too-many-trace-state-entries", raw: 65_537 });
});

test("numeric-looking keys retain iteration order and the existing JSON numeric-key order", () => {
  const state = TraceState.of([entry("2", true), entry("1", false)]);
  expect([...state].map((item) => item.path().asString())).toEqual(["2", "1"]);
  expect(JSON.stringify(state.toDocument())).toBe('{"1":false,"2":true}');
});
