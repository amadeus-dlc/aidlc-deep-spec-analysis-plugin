import {
  compareCanonically,
  isObject,
  type Json,
  validateSchema,
  canonicalStringify,
  type Result,
  err,
  ok,
  unreachable,
} from "@deep-spec/kernel-infrastructure";

// kernel/domain の単体テスト（DDD 移行 PR1、issue #14）。
//
// この層は 90% カバレッジ床の対象。エラー文言は refcheck findings の detail・
// ir-valid の errors[]・契約2 の unavailable.reason として golden バイトに
// 現れるため、文言は「含む」ではなく完全一致で固定する。

import { AttributeBound, ContentHash, RequirementIds, TargetId, TargetIds, FunctionalRequirementReferences, NormalizedName, KeyedIndex, KeySet, RequirementId, QueryLabel, AttributeKind, VerificationMethod, FindingKind } from "@deep-spec/kernel-domain";
import { describe, expect, test } from "bun:test";
import { extractFences, parseMarkdownTables, parseYamlSubset } from "@deep-spec/kernel-adapter";
import { smtIntOf, smtLit, smtName, smtVar } from "@deep-spec/kernel-adapter";

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

describe("json", () => {
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

describe("canonical id order (owned by the id value object, ruling 1)", () => {
  const cmp = compareCanonically;
  test("letter skeleton orders before numeric segments", () => {
    expect(cmp("DD-2", "FD-1")).toBeLessThan(0);
    expect(cmp("OB-2", "OB-10")).toBeLessThan(0);
    expect(cmp("BR1.2", "BR1.10")).toBeLessThan(0);
    expect(cmp("OB-1", "OB-1")).toBe(0);
  });

  test("a shorter id sorts before its extension (missing segment pads with -1)", () => {
    expect(cmp("BR1", "BR1.1")).toBeLessThan(0);
  });

  test("the collections deduplicate then sort canonically", () => {
    expect(TargetIds.of(Array.from(["OB-10", "OB-2", "OB-2"], (raw) => TargetId.of(raw))).sortedUniqueCanonically().toStrings()).toEqual(["OB-2", "OB-10"]);
    expect(FunctionalRequirementReferences.of(Array.from(["FR-10", "FR-2", "FR-2"], (raw) => RequirementId.of(raw))).sortedUnique().toStrings()).toEqual(["FR-2", "FR-10"]);
  });
});

describe("fence", () => {
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

describe("yaml — accepted shapes", () => {
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

describe("yaml — rejections with exact error strings", () => {
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

describe("md-table", () => {
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

describe("schema — per-keyword exact messages", () => {
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

describe("target id (the target vocabulary's primitive)", () => {
  test("parse admits the findings-schema shapes and rejects the rest", () => {
    for (const raw of ["OB-1", "SC-12", "BR1.2", "DOB-3", "DSC-1", "DBG-2", "SM-1", "TR-10", "component:Order", "unit:u1-orders", "check:DD-1"]) {
      const r = TargetId.parse(raw);
      expect(r.ok && r.value.asString()).toBe(raw);
    }
    for (const raw of ["", "ob-1", "OB1", "BG-1", "FR-1", "entity:Order Item", "X-1"]) {
      expect(TargetId.parse(raw).ok).toBe(false);
    }
  });

  test("of rejects invalid ids and preserves equality and canonical ordering", () => {
    expect(TargetId.parse("weird id").ok).toBe(false);
    const id = TargetId.of("OB-1");
    expect(id.equals(TargetId.of("OB-1"))).toBe(true);
    expect(id.equals(TargetId.of("OB-2"))).toBe(false);
    expect(id.compareTo(TargetId.of("OB-10"))).toBeLessThan(0);
    expect(id.asString()).toBe("OB-1");
  });

  test("target ids collect primitives, collect typed ids, and escape through toStrings", () => {
    const ids = TargetIds.of([TargetId.of("OB-10")]).add(TargetId.of("OB-2")).add(TargetId.of("OB-2"));
    expect(ids.toStrings()).toEqual(["OB-10", "OB-2", "OB-2"]);
    expect(ids.count()).toBe(3);
    expect(ids.toArray().length).toBe(3);
    expect(ids.includes(TargetId.of("OB-2"))).toBe(true);
    expect(ids.includes(TargetId.of("OB-3"))).toBe(false);
    expect(ids.excluding(TargetId.of("OB-2")).toStrings()).toEqual(["OB-10"]);
    expect(ids.excluding(TargetId.of("OB-3")).toStrings()).toEqual(["OB-10", "OB-2", "OB-2"]);
    expect([...ids].map((t) => t.asString())).toEqual(["OB-10", "OB-2", "OB-2"]);
    expect(TargetIds.of(Array.from(["SC-1", "OB-1"], (raw) => TargetId.of(raw))).joined(",")).toBe("SC-1,OB-1");
    // sortedCanonically keeps duplicates; sortedUniqueCanonically folds them.
    const mixed = TargetIds.of(Array.from(["OB-10", "OB-2", "OB-2", "SC-1"], (raw) => TargetId.of(raw)));
    expect(mixed.sortedCanonically().toStrings()).toEqual(["OB-2", "OB-2", "OB-10", "SC-1"]);
    expect(mixed.sortedUniqueCanonically().toStrings()).toEqual(["OB-2", "OB-10", "SC-1"]);
  });
});

describe("target-ids / requirement-ids / names", () => {
  test("safeTarget sanitizes out-of-alphabet characters and empty tokens", () => {
    expect(TargetIds.safe("unit", "u1-orders")).toBe("unit:u1-orders");
    expect(TargetIds.safe("entity", "Order Item")).toBe("entity:Order-Item");
    expect(TargetIds.safe("component", "")).toBe("component:unknown");
    // 置換であって削除ではない: 各文字が "-" になる（凍結挙動の記録）。
    expect(TargetIds.safe("attr", "注文")).toBe("attr:--");
  });

  test("requirementIds finds FR/NFR ids with optional dash and dotted segments", () => {
    expect([...RequirementIds.extractFrom("FR-1 covers NFR2.1 but FRX-9 does not; FR-1 repeats")].map((id) => id.asString()).sort()).toEqual(["FR-1", "NFR2.1"]);
  });

  test("normalizeName casefolds and strips non-alphanumerics", () => {
    expect(NormalizedName.of("Order_Item").asString()).toBe("orderitem");
    expect(NormalizedName.of("Order_Item").equals(NormalizedName.of("order item"))).toBe(true);
    expect(NormalizedName.of("OrderItem").asString()).toBe("orderitem");
  });
});

describe("smt-symbols — shared rendering vocabulary (PR8, thaw #34 item 4)", () => {
  test("smtVar / smtName render the frozen encodings", () => {
    expect(smtVar("order.qty", false)).toBe("v_order_qty");
    expect(smtVar("order.qty", true)).toBe("p_order_qty");
    expect(smtName("ob", "OB-1")).toBe("ob_OB_1");
  });

  test("smtLit stays byte-identical in the safe range and exact beyond it", () => {
    expect(smtLit(0)).toBe("0");
    expect(smtLit(42)).toBe("42");
    expect(smtLit(-7)).toBe("(- 7)");
    expect(smtLit(Number.MAX_SAFE_INTEGER)).toBe("9007199254740991");
    expect(smtLit(-Number.MAX_SAFE_INTEGER)).toBe("(- 9007199254740991)");
    // 範囲外の整数は String(n) だと "1e+21"（SMT-LIB 数字列でない）に落ちる
    // ——BigInt 経由の正確な十進で描画する。
    expect(smtLit(1e21)).toBe("1000000000000000000000");
    expect(smtLit(-1e21)).toBe("(- 1000000000000000000000)");
    // 非整数は呼び手のガードが弾く前提で従来描画を保存。
    expect(smtLit(1.5)).toBe("1.5");
  });

  test("smtIntOf decodes both numeral forms", () => {
    expect(smtIntOf("42")).toBe(42);
    expect(smtIntOf("(- 7)")).toBe(-7);
  });
});

describe("attribute-bound — the parse door gates integer sanity (thaw #34 item 4)", () => {
  test("safe integers pass; non-integers and unsafe magnitudes carry their material", () => {
    const ok = AttributeBound.parse(7);
    expect(ok.ok && ok.value.asNumber()).toBe(7);
    const frac = AttributeBound.parse(1.5);
    expect(!frac.ok && frac.error).toEqual({ kind: "non-integer-bound", raw: 1.5 });
    const huge = AttributeBound.parse(1e21);
    expect(!huge.ok && huge.error).toEqual({ kind: "unsafe-bound", raw: 1e21 });
  });
});

describe("KeyedIndex (the keyed-index representation primitive, ruling 3-1)", () => {
  const id = (raw: string) => TargetId.of(raw);

  test("keys are compared by their string form, insertion order is kept, and with() replaces in place", () => {
    const empty = KeyedIndex.empty<TargetId, number>();
    expect(empty.isEmpty()).toBe(true);
    expect(empty.size()).toBe(0);
    expect(empty.get(id("OB-1"))).toBe(undefined);
    const index = KeyedIndex.of<TargetId, number>([[id("OB-2"), 2], [id("OB-1"), 1]]);
    expect(index.has(id("OB-1"))).toBe(true);
    expect(index.has(id("OB-3"))).toBe(false);
    expect(index.get(id("OB-2"))).toBe(2);
    expect(index.size()).toBe(2);
    expect(index.isEmpty()).toBe(false);
    const replaced = index.with(id("OB-2"), 20).with(id("OB-3"), 3);
    expect([...replaced.keys()].map((k) => k.asString())).toEqual(["OB-2", "OB-1", "OB-3"]);
    expect([...replaced.values()]).toEqual([20, 1, 3]);
    expect([...replaced].map(([k, v]) => `${k.asString()}=${v}`)).toEqual(["OB-2=20", "OB-1=1", "OB-3=3"]);
    // the original is untouched
    expect(index.get(id("OB-2"))).toBe(2);
    expect(index.has(id("OB-3"))).toBe(false);
  });
});

describe("the 2026-09-03 kernel primitives (rulings 3-1 to 3-3)", () => {
  test("KeySet keeps insertion order, dedupes by string form, and with() is a no-op for a present key", () => {
    const empty = KeySet.empty<TargetId>();
    expect(empty.isEmpty()).toBe(true);
    expect(empty.size()).toBe(0);
    const set = KeySet.of([TargetId.of("OB-2"), TargetId.of("OB-1"), TargetId.of("OB-2")]);
    expect(set.size()).toBe(2);
    expect(set.has(TargetId.of("OB-1"))).toBe(true);
    expect(set.has(TargetId.of("OB-9"))).toBe(false);
    expect(set.with(TargetId.of("OB-1"))).toBe(set);
    const grown = set.with(TargetId.of("OB-3"));
    expect([...grown].map((t) => t.asString())).toEqual(["OB-2", "OB-1", "OB-3"]);
    expect(grown.toArray().length).toBe(3);
    expect(set.size()).toBe(2);
  });

  test("RequirementId, QueryLabel and RequirementIds", () => {
    const a = RequirementId.of("FR-2");
    expect(a.equals(RequirementId.of("FR-2"))).toBe(true);
    expect(a.equals(RequirementId.of("FR-10"))).toBe(false);
    expect(a.compareTo(RequirementId.of("FR-10"))).toBeLessThan(0);
    expect(a.asString()).toBe("FR-2");
    const ids = RequirementIds.of([a, RequirementId.of("NFR-1")]);
    expect(ids.has(a)).toBe(true);
    expect(ids.toArray().map((id) => id.asString())).toEqual(["FR-2", "NFR-1"]);
    expect(ids.add(RequirementId.of("FR-3")).toStrings()).toEqual(["FR-2", "NFR-1", "FR-3"]);
    const q = QueryLabel.of("gap:submit");
    expect(q.equals(QueryLabel.of("gap:submit"))).toBe(true);
    expect(q.compareTo(QueryLabel.of("global"))).toBeLessThan(0);
    expect(q.compareTo(QueryLabel.of("gap:submit"))).toBe(0);
    expect(QueryLabel.of("z").compareTo(q)).toBeGreaterThan(0);
    expect(q.asString()).toBe("gap:submit");
  });

  test("AttributeKind and VerificationMethod", () => {
    const k = AttributeKind.of("enum");
    expect(k.isEnum()).toBe(true);
    expect(k.isInt()).toBe(false);
    expect(k.isBool()).toBe(false);
    expect(k.equals(AttributeKind.of("enum"))).toBe(true);
    expect(AttributeKind.of("").asString()).toBe("");
    const m = VerificationMethod.of("bounded");
    expect(m.equals(VerificationMethod.of("bounded"))).toBe(true);
    expect(m.equals(VerificationMethod.of("static"))).toBe(false);
    expect(m.asString()).toBe("bounded");
    expect(FindingKind.of("conflict").compareTo(FindingKind.of("redundancy"))).toBeLessThan(0);
  });
});
