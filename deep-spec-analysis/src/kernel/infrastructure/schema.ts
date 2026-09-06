// JSON Schema（draft-07 サブセット）検証器。エラー文言は ir-valid の errors[]
// と契約2 の unavailable.reason として観測面に出るため逐語凍結。
// deep-spec-lib.ts からの逐語移動（ir-valid のローカル複製の統合は PR7）。I/O を
// 一切持たない純関数なので最内層に置く——契約2 の自己検証は FindingsSchema
//（kernel/domain）の内側の検査で、schema ファイルの読込は adapter に残る。

import { isObject, type Json } from "./json.ts";

export type Schema = { [k: string]: Json };

function typeMatches(t: string, v: Json): boolean {
  switch (t) {
    case "object":
      return isObject(v);
    case "array":
      return Array.isArray(v);
    case "string":
      return typeof v === "string";
    case "boolean":
      return typeof v === "boolean";
    case "integer":
      return typeof v === "number" && Number.isInteger(v);
    case "number":
      return typeof v === "number";
    case "null":
      return v === null;
    default:
      return false;
  }
}

function resolveRef(root: Schema, ref: string): Schema {
  const m = ref.match(/^#\/definitions\/([A-Za-z0-9_-]+)$/);
  if (!m) throw new Error(`unsupported $ref: ${ref}`);
  const defs = root.definitions;
  if (!isObject(defs) || !isObject(defs[m[1] ?? ""])) {
    throw new Error(`unresolvable $ref: ${ref}`);
  }
  return defs[m[1] ?? ""] as Schema;
}

export function validateSchema(root: Schema, schema: Schema, value: Json, path: string, errors: string[]): boolean {
  const before = errors.length;
  for (const error of schemaErrors(root, schema, value, path)) errors.push(error);
  return errors.length === before;
}

// 候補の値条件を先に照合し、入力キーの順序による再帰の増幅を防ぐ。
function matchesSchema(root: Schema, schema: Schema, value: Json, path: string): boolean {
  if (typeof schema.$ref === "string") return matchesSchema(root, resolveRef(root, schema.$ref), value, path);
  if (Array.isArray(schema.oneOf)) return schemaErrors(root, schema, value, path).next().done === true;
  if (isObject(value) && isObject(schema.properties)) {
    for (const [key, property] of Object.entries(schema.properties)) {
      if (!(key in value) || !isObject(property)) continue;
      let resolved = property;
      while (typeof resolved.$ref === "string") resolved = resolveRef(root, resolved.$ref);
      if (Array.isArray(resolved.oneOf)) continue;
      const condition: Schema = {};
      if ("const" in resolved) condition.const = resolved.const;
      if (Array.isArray(resolved.enum)) condition.enum = resolved.enum;
      if (Object.keys(condition).length > 0 && !schemaErrors(root, condition, value[key], `${path}/${key}`).next().done)
        return false;
    }
  }
  return schemaErrors(root, schema, value, path).next().done === true;
}

// 診断を遅延生成する。oneOfは最初の不一致で候補の走査を止められる。
function* schemaErrors(root: Schema, schema: Schema, value: Json, path: string): IterableIterator<string> {
  if (typeof schema.$ref === "string") {
    yield* schemaErrors(root, resolveRef(root, schema.$ref), value, path);
    return;
  }
  if (Array.isArray(schema.oneOf)) {
    let matched = 0;
    for (const branch of schema.oneOf) {
      if (!isObject(branch)) continue;
      if (matchesSchema(root, branch as Schema, value, path)) matched++;
    }
    if (matched !== 1) {
      yield `${path}: matches ${matched} oneOf branches (must match exactly 1)`;
    }
    return;
  }
  if (typeof schema.type === "string" && !typeMatches(schema.type, value)) {
    yield `${path}: expected type ${schema.type}`;
    return;
  }
  if ("const" in schema && JSON.stringify(schema.const) !== JSON.stringify(value)) {
    yield `${path}: expected const ${JSON.stringify(schema.const)}`;
    return;
  }
  if (Array.isArray(schema.enum)) {
    const hit = schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(value));
    if (!hit) {
      yield `${path}: not one of ${JSON.stringify(schema.enum)}`;
      return;
    }
  }
  if (typeof value === "string" && typeof schema.pattern === "string") {
    if (!new RegExp(schema.pattern).test(value)) {
      yield `${path}: does not match pattern ${schema.pattern}`;
    }
  }
  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      yield `${path}: fewer than ${schema.minItems} items`;
    }
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
      yield `${path}: more than ${schema.maxItems} items`;
    }
    if (schema.uniqueItems === true) {
      const seen = new Set(value.map((v) => JSON.stringify(v)));
      if (seen.size !== value.length) yield `${path}: items are not unique`;
    }
    if (isObject(schema.items)) {
      for (const [index, item] of value.entries())
        yield* schemaErrors(root, schema.items as Schema, item, `${path}/${index}`);
    }
  }
  if (isObject(value)) {
    const props = isObject(schema.properties) ? (schema.properties as { [k: string]: Json }) : {};
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (typeof key === "string" && !(key in value)) {
          yield `${path}: missing required property "${key}"`;
        }
      }
    }
    if (typeof schema.minProperties === "number" && Object.keys(value).length < schema.minProperties) {
      yield `${path}: fewer than ${schema.minProperties} properties`;
    }
    for (const [key, val] of Object.entries(value)) {
      if (key in props && isObject(props[key])) {
        yield* schemaErrors(root, props[key] as Schema, val, `${path}/${key}`);
      } else if (schema.additionalProperties === false) {
        yield `${path}: unexpected property "${key}"`;
      } else if (isObject(schema.additionalProperties)) {
        yield* schemaErrors(root, schema.additionalProperties as Schema, val, `${path}/${key}`);
      }
      if (isObject(schema.propertyNames) && typeof (schema.propertyNames as Schema).pattern === "string") {
        if (!new RegExp((schema.propertyNames as Schema).pattern as string).test(key)) {
          yield `${path}: property name "${key}" does not match required pattern`;
        }
      }
    }
  }
  return;
}
