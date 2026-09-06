import { expect, test } from "bun:test";
import { decodeItfTrace } from "@deep-spec-analysis/requirements-adapter";
import { TraceStates } from "@deep-spec-analysis/requirements-domain";

const emptyVariableMap = new Map<string, string>();

test("decodeItfTrace returns TraceStates and preserves ITF decoding contracts", () => {
  const result = decodeItfTrace(
    JSON.stringify({
      "#meta": { status: "violation" },
      states: [{ z: { "#bigint": "42" }, "#meta": "ignored", a: false }, null, "not a state", { b: 1, a: true }],
    }),
    new Map([
      ["a", "Ticket.a"],
      ["z", "Ticket.z"],
    ]),
  );

  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value).toBeInstanceOf(TraceStates);
    expect(result.value.toArray().map((state) => state.toDocument())).toEqual([
      { "Ticket.a": false, "Ticket.z": 42 },
      { "Ticket.a": true, b: 1 },
    ]);
  }
});

test("decodeItfTrace treats a missing or malformed states field as an empty trace", () => {
  for (const text of ["{}", JSON.stringify({ states: null }), JSON.stringify({ states: [null, 1, []] })]) {
    const result = decodeItfTrace(text, emptyVariableMap);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.toArray()).toEqual([]);
  }
});

test("decodeItfTrace returns JSON parse failures as Result errors", () => {
  const result = decodeItfTrace("{", emptyVariableMap);

  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
});

test("decodeItfTrace returns attribute path failures as Result errors", () => {
  const result = decodeItfTrace(JSON.stringify({ states: [{ "": true }] }), emptyVariableMap);

  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toContain("empty-attribute-path");
});

test("decodeItfTrace returns trace value failures as Result errors", () => {
  const result = decodeItfTrace(JSON.stringify({ states: [{ value: "x".repeat(65_537) }] }), emptyVariableMap);

  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toContain("value-string-too-long");
});

test("decodeItfTrace rejects a state with more than 65,536 attributes without throwing", () => {
  const state = Object.fromEntries(Array.from({ length: 65_537 }, (_, index) => [`Ticket.a${index}`, index]));
  let result: ReturnType<typeof decodeItfTrace> | undefined;

  expect(() => {
    result = decodeItfTrace(JSON.stringify({ states: [state] }), emptyVariableMap);
  }).not.toThrow();

  expect(result?.ok).toBe(false);
  if (result !== undefined && !result.ok) expect(result.error).toContain("too-many-trace-state-entries");
});

test("decodeItfTrace rejects more than 65,536 states without throwing", () => {
  const text = JSON.stringify({ states: Array.from({ length: 65_537 }, () => ({})) });
  let result: ReturnType<typeof decodeItfTrace> | undefined;

  expect(() => {
    result = decodeItfTrace(text, emptyVariableMap);
  }).not.toThrow();

  expect(result?.ok).toBe(false);
  if (result !== undefined && !result.ok) expect(result.error).toContain("too-many-trace-states");
});

test("decodeItfTrace accepts the 65,536 attribute and state boundaries", () => {
  const state = Object.fromEntries(Array.from({ length: 65_536 }, (_, index) => [`Ticket.a${index}`, index]));
  const attributes = decodeItfTrace(JSON.stringify({ states: [state] }), emptyVariableMap);

  expect(attributes.ok).toBe(true);
  if (attributes.ok) expect(attributes.value.toArray()[0]?.toArray()).toHaveLength(65_536);

  const states = decodeItfTrace(
    JSON.stringify({ states: Array.from({ length: 65_536 }, () => ({})) }),
    emptyVariableMap,
  );

  expect(states.ok).toBe(true);
  if (states.ok) expect(states.value.toArray()).toHaveLength(65_536);
});

test("decodeItfTrace applies the 16 Mi code-unit document budget", () => {
  const result = decodeItfTrace("x".repeat(16_777_217), emptyVariableMap);

  expect(result).toEqual({ ok: false, error: "ITF document exceeds the 16 Mi code-unit budget" });
});
