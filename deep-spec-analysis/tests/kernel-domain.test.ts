// kernel/domain の単体テスト（DDD 移行 PR1、issue #14）。
//
// この層は 90% カバレッジ床の対象。エラー文言は refcheck findings の detail・
// ir-valid の errors[]・契約2 の unavailable.reason として golden バイトに
// 現れるため、文言は「含む」ではなく完全一致で固定する。

import { ContentHash, RequirementIds } from "../tools/kernel/domain/index.ts";
import { describe, expect, test } from "bun:test";
import {
  canonicalStringify,
  extractFences,
  isObject,
  parseMarkdownTables,
  parseYamlSubset,
  type Json,
  validateSchema,
} from "../tools/kernel/adapter/index.ts";
import { type Result, err, ok, unreachable } from "../tools/kernel/infrastructure/index.ts";
import {
  idCompare,
  normalizeName,
  safeTarget,
  sortedUnique,
} from "../tools/kernel/domain/index.ts";

describe("result", () => {
  test("ok and err narrow through the ok discriminant", () => {
    const good: Result<number, string> = ok(42);
    const bad: Result<number, string> = err("boom");
    expect(good.ok && good.value).toBe(42);
    expect(!bad.ok && bad.error).toBe("boom");
  });

  test("an Err propagates unchanged into a Result of another value type", () => {
    const parse = (): Result<number, { kind: "empty" }> => err({ kind: "empty" });
    const use = (): Result<string, { kind: "empty" }> => {
      const r = parse();
      if (!r.ok) return r;
      return ok(String(r.value));
    };
    const out = use();
    expect(!out.ok && out.error.kind).toBe("empty");
  });

  test("unreachable throws a defect naming the impossible variant", () => {
    expect(() => unreachable("rogue" as never)).toThrow('defect: unreachable variant "rogue"');
  });
});

describe("json-value", () => {
  test("isObject accepts plain objects and rejects null, arrays, and scalars", () => {
    expect(isObject({})).toBe(true);
    expect(isObject(null)).toBe(false);
    expect(isObject([])).toBe(false);
    expect(isObject("x")).toBe(false);
    expect(isObject(1)).toBe(false);
    expect(isObject(true)).toBe(false);
  });
});

describe("canonical-json + content-hash", () => {
  test("object keys are sorted, arrays keep their order, nesting recurses", () => {
    const v: Json = { b: [2, 1], a: { d: null, c: "x" } };
    expect(canonicalStringify(v)).toBe('{"a":{"c":"x","d":null},"b":[2,1]}');
  });

  test("scalars serialize as plain JSON", () => {
    expect(canonicalStringify(null)).toBe("null");
    expect(canonicalStringify(1.5)).toBe("1.5");
    expect(canonicalStringify("s")).toBe('"s"');
  });

  test("sha256 matches the known digest of the empty string", () => {
    expect(ContentHash.ofText("").asString()).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});

describe("id-order", () => {
  test("letter skeleton orders before numeric segments", () => {
    expect(idCompare("DD-2", "FD-1")).toBeLessThan(0);
    expect(idCompare("OB-2", "OB-10")).toBeLessThan(0);
    expect(idCompare("BR1.2", "BR1.10")).toBeLessThan(0);
    expect(idCompare("OB-1", "OB-1")).toBe(0);
  });

  test("a shorter id sorts before its extension (missing segment pads with -1)", () => {
    expect(idCompare("BR1", "BR1.1")).toBeLessThan(0);
  });

  test("sortedUnique deduplicates then sorts with the given comparator", () => {
    expect(sortedUnique(["OB-10", "OB-2", "OB-2"], idCompare)).toEqual(["OB-2", "OB-10"]);
  });
});

describe("markdown-fences", () => {
  test("captures body and 1-based opening line, filters by language", () => {
    const md = "intro\n```yaml\na: 1\n```\n```json\n{}\n```\n";
    const yaml = extractFences(md, "yaml");
    expect(yaml).toEqual([{ info: "yaml", body: "a: 1", line: 2 }]);
    expect(extractFences(md, "json")[0]?.body).toBe("{}");
  });

  test("an info string with extra words still matches its language prefix", () => {
    expect(extractFences("```yaml orders\nx: 1\n```\n", "yaml")).toHaveLength(1);
  });

  test("an unclosed fence yields nothing", () => {
    expect(extractFences("```yaml\na: 1\n", "yaml")).toHaveLength(0);
  });
});

describe("yaml-subset — accepted shapes", () => {
  test("block mapping with scalars, booleans, null, integers, floats", () => {
    const r = parseYamlSubset("name: Order\nactive: true\nnothing: null\ntilde: ~\ncount: 3\nratio: 1.5\nneg: -2\n");
    expect(r.value).toEqual({ name: "Order", active: true, nothing: null, tilde: null, count: 3, ratio: 1.5, neg: -2 });
  });

  test("block sequence, nested mapping, inline sequence, quoted scalars", () => {
    const r = parseYamlSubset('items:\n  - a\n  - b\nmeta:\n  tags: [x, y]\n  label: "hello: world"\n  single: \'q\'\n');
    expect(r.value).toEqual({ items: ["a", "b"], meta: { tags: ["x", "y"], label: "hello: world", single: "q" } });
  });

  test("sequence of inline mappings folds continuation lines", () => {
    const r = parseYamlSubset("components:\n  - name: A\n    owns: [x]\n  - name: B\n");
    expect(r.value).toEqual({ components: [{ name: "A", owns: ["x"] }, { name: "B" }] });
  });

  test("a bare dash followed by a deeper block nests the block as the item", () => {
    const r = parseYamlSubset("seq:\n  -\n    name: A\n");
    expect(r.value).toEqual({ seq: [{ name: "A" }] });
  });

  test("literal and folded blocks join with newline and space respectively", () => {
    const lit = parseYamlSubset("text: |\n  one\n  two\n");
    expect(lit.value).toEqual({ text: "one\ntwo" });
    const folded = parseYamlSubset("text: >\n  one\n  two\n");
    expect(folded.value).toEqual({ text: "one two" });
  });

  test("comments, blank lines, tabs, empty input, empty inline sequence, bare dash", () => {
    expect(parseYamlSubset("# only a comment\n\n").value).toBe(null);
    expect(parseYamlSubset("a: 1 # trailing\n").value).toEqual({ a: 1 });
    expect(parseYamlSubset("\tx: 1\n").value).toEqual({ x: 1 });
    expect(parseYamlSubset("empty: []\n").value).toEqual({ empty: [] });
    expect(parseYamlSubset("seq:\n  -\n  - a\n").value).toEqual({ seq: [null, "a"] });
    expect(parseYamlSubset("key:\n").value).toEqual({ key: null });
  });
});

describe("yaml-subset — rejections with exact error strings", () => {
  test("anchor, alias, and tag scalars", () => {
    expect(parseYamlSubset("a: &x 1\n").error).toBe('line 1: unsupported YAML feature (anchor/alias/tag): "&x 1"');
    expect(parseYamlSubset("a: *x\n").error).toBe('line 1: unsupported YAML feature (anchor/alias/tag): "*x"');
    expect(parseYamlSubset("a: !!str x\n").error).toBe('line 1: unsupported YAML feature (anchor/alias/tag): "!!str x"');
  });

  test("flow mapping", () => {
    expect(parseYamlSubset("a: {x: 1}\n").error).toBe('line 1: unsupported YAML feature (flow mapping): "{x: 1}"');
  });

  test("unterminated quoted scalar and inline sequence", () => {
    expect(parseYamlSubset('a: "open\n').error).toBe('line 1: unterminated quoted scalar: ""open"');
    expect(parseYamlSubset("a: [1, 2\n").error).toBe('line 1: unterminated inline sequence: "[1, 2"');
  });

  test("a non-mapping line inside a mapping block", () => {
    expect(parseYamlSubset("a: 1\njust words\n").error).toBe('line 2: not a mapping entry: "just words"');
  });

  test("content outside the top-level block", () => {
    expect(parseYamlSubset("  a: 1\nb: 2\n").error).toBe("line 2: content outside the top-level block");
  });
});

describe("markdown-tables", () => {
  test("parses header, separator, rows with 1-based lines; ignores prose", () => {
    const md = "prose\n| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\nafter\n";
    const tables = parseMarkdownTables(md);
    expect(tables).toEqual([
      { header: ["A", "B"], line: 2, rows: [{ cells: ["1", "2"], line: 4 }, { cells: ["3", "4"], line: 5 }] },
    ]);
  });

  test("a pipe row without a separator line is not a table", () => {
    expect(parseMarkdownTables("| A |\n| 1 |\n")).toEqual([]);
  });
});

describe("schema-validator — per-keyword exact messages", () => {
  const check = (schema: Json, value: Json): string[] => {
    const errors: string[] = [];
    validateSchema(schema as never, schema as never, value, "", errors);
    return errors;
  };

  test("type / const / enum / pattern", () => {
    expect(check({ type: "string" }, 1)).toEqual([": expected type string"]);
    expect(check({ const: "a" }, "b")).toEqual([': expected const "a"']);
    expect(check({ enum: ["a", "b"] }, "c")).toEqual([': not one of ["a","b"]']);
    expect(check({ type: "string", pattern: "^[a-z]+$" }, "UP")).toEqual([": does not match pattern ^[a-z]+$"]);
    expect(check({ type: "integer" }, 1.5)).toEqual([": expected type integer"]);
    expect(check({ type: "null" }, 0)).toEqual([": expected type null"]);
  });

  test("array keywords: minItems / maxItems / uniqueItems / items path", () => {
    expect(check({ type: "array", minItems: 2 }, [1])).toEqual([": fewer than 2 items"]);
    expect(check({ type: "array", maxItems: 1 }, [1, 2])).toEqual([": more than 1 items"]);
    expect(check({ type: "array", uniqueItems: true }, [1, 1])).toEqual([": items are not unique"]);
    expect(check({ type: "array", items: { type: "string" } }, ["a", 2])).toEqual(["/1: expected type string"]);
  });

  test("object keywords: required / minProperties / additionalProperties / propertyNames", () => {
    expect(check({ type: "object", required: ["x"] }, {})).toEqual([': missing required property "x"']);
    expect(check({ type: "object", minProperties: 1 }, {})).toEqual([": fewer than 1 properties"]);
    expect(check({ type: "object", properties: {}, additionalProperties: false }, { y: 1 })).toEqual([': unexpected property "y"']);
    expect(check({ type: "object", additionalProperties: { type: "string" } }, { y: 1 })).toEqual(["/y: expected type string"]);
    expect(check({ type: "object", propertyNames: { pattern: "^[a-z]+$" }, additionalProperties: {} }, { UP: 1 })).toEqual([
      ': property name "UP" does not match required pattern',
    ]);
  });

  test("oneOf counts matching branches exactly", () => {
    const schema = { oneOf: [{ type: "string" }, { type: "number" }] };
    expect(check(schema, true)).toEqual([": matches 0 oneOf branches (must match exactly 1)"]);
    const overlapping = { oneOf: [{ type: "number" }, { type: "integer" }] };
    expect(check(overlapping, 1)).toEqual([": matches 2 oneOf branches (must match exactly 1)"]);
    expect(check(schema, "s")).toEqual([]);
  });

  test("$ref resolves through definitions; nested property paths accumulate", () => {
    const schema = {
      definitions: { name: { type: "string" } },
      type: "object",
      properties: { who: { $ref: "#/definitions/name" } },
    };
    expect(check(schema, { who: 1 })).toEqual(["/who: expected type string"]);
    expect(check(schema, { who: "x" })).toEqual([]);
  });

  test("an unsupported or unresolvable $ref throws (defect, not a finding)", () => {
    expect(() => check({ $ref: "#/nope" }, 1)).toThrow("unsupported $ref: #/nope");
    expect(() => check({ definitions: {}, $ref: "#/definitions/ghost" } as Json, 1)).toThrow(
      "unresolvable $ref: #/definitions/ghost",
    );
  });
});

describe("target-id / requirement-ids / name-normalize", () => {
  test("safeTarget sanitizes out-of-alphabet characters and empty tokens", () => {
    expect(safeTarget("unit", "u1-orders")).toBe("unit:u1-orders");
    expect(safeTarget("entity", "Order Item")).toBe("entity:Order-Item");
    expect(safeTarget("component", "")).toBe("component:unknown");
    // 置換であって削除ではない: 各文字が "-" になる（凍結挙動の記録）。
    expect(safeTarget("attr", "注文")).toBe("attr:--");
  });

  test("requirementIds finds FR/NFR ids with optional dash and dotted segments", () => {
    expect([...RequirementIds.extractFrom("FR-1 covers NFR2.1 but FRX-9 does not; FR-1 repeats")].sort()).toEqual(["FR-1", "NFR2.1"]);
  });

  test("normalizeName casefolds and strips non-alphanumerics", () => {
    expect(normalizeName("Order_Item")).toBe("orderitem");
    expect(normalizeName("OrderItem")).toBe("orderitem");
  });
});
