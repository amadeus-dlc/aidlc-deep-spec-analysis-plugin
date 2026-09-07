// @bun
// src/entries/aidlc-sensor-deep-spec-design-ir-valid.ts
import { dirname as dirname5, join as join8 } from "path";
import { fileURLToPath } from "url";

// src/kernel/infrastructure/illegal-argument-exception.ts
class IllegalArgumentException extends Error {
  problem;
  constructor(problem) {
    super(`Illegal argument: ${problem.kind}`);
    this.name = "IllegalArgumentException";
    this.problem = Object.freeze({ ...problem });
  }
}

// src/kernel/infrastructure/bounded-collection-snapshot.ts
function boundedCollectionSnapshot(values, maximum, problemKind) {
  if (values.length > maximum)
    throw new IllegalArgumentException({ kind: problemKind, raw: values.length });
  const snapshot = [];
  let inspected = 0;
  for (const value of values) {
    if (inspected >= maximum)
      throw new IllegalArgumentException({ kind: problemKind, raw: inspected + 1 });
    inspected++;
    snapshot.push(value);
  }
  return Object.freeze(snapshot);
}
// src/kernel/infrastructure/bounded-value-snapshot.ts
function boundedValueSnapshot(value, limits) {
  let nodes = 0;
  let total = 0;
  const chargeText = (text, kind) => {
    if (text.length > limits.string)
      throw new IllegalArgumentException({ kind, raw: text.length });
    total += text.length;
    if (total > limits.total)
      throw new IllegalArgumentException({ kind: "value-text-too-large" });
  };
  const copy = (current, depth) => {
    if (++nodes > limits.nodes || depth > limits.depth)
      throw new IllegalArgumentException({ kind: "value-tree-too-large" });
    if (typeof current === "string") {
      chargeText(current, "value-string-too-long");
      return current;
    }
    if (current === null || typeof current !== "object")
      return current;
    if (Array.isArray(current)) {
      const count = current.length;
      if (count > limits.nodes - nodes)
        throw new IllegalArgumentException({ kind: "value-tree-too-large" });
      const values = [];
      for (let index = 0;index < count; index++)
        values.push(copy(current[index], depth + 1));
      return values;
    }
    const record = current;
    const entries = [];
    for (const key in record) {
      if (!Object.hasOwn(record, key))
        continue;
      chargeText(key, "value-key-too-long");
      entries.push([key, copy(record[key], depth + 1)]);
    }
    return Object.fromEntries(entries);
  };
  return copy(value, 0);
}
// src/kernel/infrastructure/canonical-json.ts
function canonicalStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const record = value;
    const keys = Object.keys(record).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(record[k] ?? null)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
function jsonEquals(left, right) {
  if (Object.is(left, right))
    return true;
  if (left === null || right === null || typeof left !== typeof right)
    return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length)
      return false;
    for (let index = 0;index < left.length; index++) {
      if (!jsonEquals(left[index], right[index]))
        return false;
    }
    return true;
  }
  if (typeof left !== "object" || typeof right !== "object")
    return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length)
    return false;
  for (const key of leftKeys) {
    if (!Object.hasOwn(right, key) || !jsonEquals(left[key], right[key]))
      return false;
  }
  return true;
}
// src/kernel/infrastructure/canonical-order.ts
function numSegments(id) {
  return (id.match(/[0-9]+/g) ?? []).map((s) => Number.parseInt(s, 10));
}
function compareCanonically(a, b) {
  const pa = a.replace(/[0-9.]/g, "");
  const pb = b.replace(/[0-9.]/g, "");
  if (pa !== pb)
    return pa < pb ? -1 : 1;
  const na = numSegments(a);
  const nb = numSegments(b);
  for (let i = 0;i < Math.max(na.length, nb.length); i++) {
    const da = na[i] ?? -1;
    const db = nb[i] ?? -1;
    if (da !== db)
      return da - db;
  }
  return 0;
}
function sortedUniqueCanonically(values) {
  return [...new Set(values)].sort(compareCanonically);
}
// src/kernel/infrastructure/hash-code.ts
var SEED = 1;
var MULTIPLIER = 31;
var TRUE_HASH = 1231;
var FALSE_HASH = 1237;
function hashOfString(value) {
  let hash = 0;
  for (let index = 0;index < value.length; index++)
    hash = MULTIPLIER * hash + value.charCodeAt(index) | 0;
  return hash;
}
function hashOfNumber(value) {
  if (Number.isNaN(value))
    return 0;
  if (Number.isSafeInteger(value))
    return value === 0 ? 0 : value | 0;
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  return view.getInt32(0) ^ view.getInt32(4) | 0;
}
function hashOfBoolean(value) {
  return value ? TRUE_HASH : FALSE_HASH;
}
function hashOfNullable(value, hash) {
  return value === null || value === undefined ? 0 : hash(value);
}
function combinedHash(hashes) {
  let hash = SEED;
  for (const element of hashes)
    hash = MULTIPLIER * hash + element | 0;
  return hash;
}
// src/kernel/infrastructure/json.ts
function isObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
var strArr = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
// src/kernel/infrastructure/result.ts
function ok(value) {
  return { ok: true, value };
}
function err(error) {
  return { ok: false, error };
}

// src/kernel/infrastructure/parse-construction.ts
function parseConstruction(construct) {
  try {
    return ok(construct());
  } catch (error) {
    if (error instanceof IllegalArgumentException) {
      const failure = Object.freeze({
        kind: error.problem.kind,
        ...error.problem.raw === undefined ? {} : { raw: error.problem.raw }
      });
      return err(failure);
    }
    throw error;
  }
}
// src/kernel/infrastructure/result-composition.ts
function matchResult(result, cases) {
  return result.ok ? cases.ok(result.value) : cases.err(result.error);
}
function flatMapResult(result, next) {
  return result.ok ? next(result.value) : result;
}
function combineResults(fields) {
  const values = Array.isArray(fields) ? new Array(fields.length) : {};
  for (const key of Reflect.ownKeys(fields)) {
    if (Array.isArray(fields) && key === "length")
      continue;
    const field = fields[key];
    if (!field.ok)
      return err(field.error);
    Object.defineProperty(values, key, {
      configurable: true,
      enumerable: true,
      value: field.value,
      writable: true
    });
  }
  return ok(values);
}
function traverseResult(values, parse) {
  const parsed = [];
  for (const value of values) {
    const result = parse(value);
    if (!result.ok)
      return err(result.error);
    parsed.push(result.value);
  }
  return ok(parsed);
}
// src/kernel/infrastructure/schema.ts
function typeMatches(t, v) {
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
function resolveRef(root, ref) {
  const m = ref.match(/^#\/definitions\/([A-Za-z0-9_-]+)$/);
  if (!m)
    throw new Error(`unsupported $ref: ${ref}`);
  const defs = root.definitions;
  if (!isObject(defs) || !isObject(defs[m[1] ?? ""])) {
    throw new Error(`unresolvable $ref: ${ref}`);
  }
  return defs[m[1] ?? ""];
}
function validateSchema(root, schema, value, path, errors) {
  const before = errors.length;
  for (const error of schemaErrors(root, schema, value, path))
    errors.push(error);
  return errors.length === before;
}
function matchesSchema(root, schema, value, path) {
  if (typeof schema.$ref === "string")
    return matchesSchema(root, resolveRef(root, schema.$ref), value, path);
  if (Array.isArray(schema.oneOf))
    return schemaErrors(root, schema, value, path).next().done === true;
  if (isObject(value) && isObject(schema.properties)) {
    for (const [key, property] of Object.entries(schema.properties)) {
      if (!(key in value) || !isObject(property))
        continue;
      let resolved = property;
      while (typeof resolved.$ref === "string")
        resolved = resolveRef(root, resolved.$ref);
      if (Array.isArray(resolved.oneOf))
        continue;
      const condition = {};
      if ("const" in resolved)
        condition.const = resolved.const;
      if (Array.isArray(resolved.enum))
        condition.enum = resolved.enum;
      if (Object.keys(condition).length > 0 && !schemaErrors(root, condition, value[key], `${path}/${key}`).next().done)
        return false;
    }
  }
  return schemaErrors(root, schema, value, path).next().done === true;
}
function* schemaErrors(root, schema, value, path) {
  if (typeof schema.$ref === "string") {
    yield* schemaErrors(root, resolveRef(root, schema.$ref), value, path);
    return;
  }
  if (Array.isArray(schema.oneOf)) {
    let matched = 0;
    for (const branch of schema.oneOf) {
      if (!isObject(branch))
        continue;
      if (matchesSchema(root, branch, value, path))
        matched++;
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
      if (seen.size !== value.length)
        yield `${path}: items are not unique`;
    }
    if (isObject(schema.items)) {
      for (const [index, item] of value.entries())
        yield* schemaErrors(root, schema.items, item, `${path}/${index}`);
    }
  }
  if (isObject(value)) {
    const props = isObject(schema.properties) ? schema.properties : {};
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
        yield* schemaErrors(root, props[key], val, `${path}/${key}`);
      } else if (schema.additionalProperties === false) {
        yield `${path}: unexpected property "${key}"`;
      } else if (isObject(schema.additionalProperties)) {
        yield* schemaErrors(root, schema.additionalProperties, val, `${path}/${key}`);
      }
      if (isObject(schema.propertyNames) && typeof schema.propertyNames.pattern === "string") {
        if (!new RegExp(schema.propertyNames.pattern).test(key)) {
          yield `${path}: property name "${key}" does not match required pattern`;
        }
      }
    }
  }
  return;
}
// src/kernel/domain/artifact-path.ts
class ArtifactPath {
  #value;
  constructor(raw) {
    if (raw.length > 4096)
      throw new IllegalArgumentException({ kind: "artifact-path-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-path" });
    this.#value = raw;
  }
  static of(raw) {
    return new ArtifactPath(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new ArtifactPath(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/attribute-bound.ts
class AttributeBound {
  #value;
  constructor(raw) {
    if (!Number.isInteger(raw))
      throw new IllegalArgumentException({ kind: "non-integer-bound", raw });
    if (!Number.isSafeInteger(raw))
      throw new IllegalArgumentException({ kind: "unsafe-bound", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new AttributeBound(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new AttributeBound(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfNumber(this.#value);
  }
  asNumber() {
    return this.#value;
  }
  exceeds(other) {
    return this.#value > other.#value;
  }
}
// src/kernel/domain/attribute-kind.ts
class AttributeKind {
  #value;
  constructor(value) {
    if (value.length > 128)
      throw new IllegalArgumentException({ kind: "attribute-kind-too-long", raw: value.length });
    this.#value = value;
  }
  static parse(value) {
    return parseConstruction(() => new AttributeKind(value));
  }
  static of(raw) {
    return new AttributeKind(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  isBool() {
    return this.#value === "bool";
  }
  isInt() {
    return this.#value === "int";
  }
  isEnum() {
    return this.#value === "enum";
  }
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/attribute-path.ts
class AttributePath {
  #value;
  constructor(raw) {
    if (raw.length > 257)
      throw new IllegalArgumentException({ kind: "attribute-path-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-attribute-path", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new AttributePath(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new AttributePath(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  compareTo(other) {
    return compareCanonically(this.#value, other.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/backend-name.ts
class BackendName {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "backend-name-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-backend-name", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new BackendName(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new BackendName(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/binding-declaration.ts
class BindingDeclaration {
  #path;
  #value;
  constructor(path, value) {
    this.#path = path;
    this.#value = value;
  }
  static of(path, value) {
    return new BindingDeclaration(path, value);
  }
  path() {
    return this.#path;
  }
  value() {
    return this.#value;
  }
  equals(other) {
    return this.#path.equals(other.#path) && this.#value.equals(other.#value);
  }
  hashCode() {
    return combinedHash([this.#path.hashCode(), this.#value.hashCode()]);
  }
}
// src/kernel/domain/binding-value.ts
class BindingValue {
  #value;
  constructor(value) {
    if (typeof value === "string" && value.length > 4096)
      throw new IllegalArgumentException({ kind: "binding-literal-too-long", raw: value.length });
    if (typeof value === "number" && !Number.isSafeInteger(value)) {
      throw new IllegalArgumentException({ kind: "invalid-binding-integer", raw: value });
    }
    this.#value = value;
  }
  static of(value) {
    return new BindingValue(value);
  }
  static parse(value) {
    return parseConstruction(() => new BindingValue(value));
  }
  static resolve(declaration) {
    return declaration.match({
      literal: (value) => {
        const result = BindingValue.parse(value);
        return result.ok ? result : err(JSON.stringify(result.error));
      },
      nonLiteral: () => err(`binding value ${declaration.describe()} is not a boolean, safe integer, or enum literal`)
    });
  }
  toDocument() {
    return this.#value;
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return this.match({
      bool: (value) => hashOfBoolean(value),
      int: (value) => hashOfNumber(value),
      enum: (value) => hashOfString(value)
    });
  }
  match(cases) {
    if (typeof this.#value === "boolean")
      return cases.bool(this.#value);
    if (typeof this.#value === "number")
      return cases.int(this.#value);
    return cases.enum(this.#value);
  }
  asExpression() {
    return this.match({
      bool: (value) => ({ op: "bool", value }),
      int: (value) => ({ op: "int", value }),
      enum: (value) => ({ op: "enum", value })
    });
  }
}
// src/kernel/domain/content-hash.ts
import { createHash } from "crypto";

class ContentHash {
  #value;
  constructor(raw) {
    if (raw.length !== 64)
      throw new IllegalArgumentException({ kind: "not-a-sha256-hex", raw });
    if (/[^0-9a-f]/.test(raw))
      throw new IllegalArgumentException({ kind: "not-a-sha256-hex", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new ContentHash(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new ContentHash(raw));
  }
  static ofText(text) {
    return new ContentHash(createHash("sha256").update(text, "utf-8").digest("hex"));
  }
  static ofBytes(bytes) {
    return new ContentHash(createHash("sha256").update(bytes).digest("hex"));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/declaration.ts
class Declaration {
  #value;
  constructor(value) {
    const snapshot = boundedValueSnapshot(value, { string: 4096, total: 65536, nodes: 4096, depth: 32 });
    const checkNumbers = (current) => {
      if (typeof current === "number" && !Number.isFinite(current)) {
        throw new IllegalArgumentException({ kind: "non-finite-declaration-number", raw: current });
      }
      if (Array.isArray(current)) {
        for (const child of current)
          checkNumbers(child);
      } else if (current !== null && typeof current === "object") {
        for (const child of Object.values(current))
          checkNumbers(child);
      }
    };
    checkNumbers(snapshot);
    this.#value = snapshot;
  }
  static of(value) {
    return new Declaration(value);
  }
  static parse(value) {
    return parseConstruction(() => new Declaration(value));
  }
  match(cases) {
    if (typeof this.#value === "boolean" || typeof this.#value === "number" || typeof this.#value === "string")
      return cases.literal(this.#value);
    return cases.nonLiteral();
  }
  equals(other) {
    return jsonEquals(this.#value, other.#value);
  }
  hashCode() {
    return hashOfString(canonicalStringify(this.#value));
  }
  describe() {
    return JSON.stringify(this.#value);
  }
}
// src/kernel/domain/declared-binding-value.ts
class DeclaredBindingValue {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static of(value) {
    return new DeclaredBindingValue(value);
  }
  fits(kind, admitsEnum) {
    return this.#value.match({
      literal: (value) => kind.isBool() && typeof value === "boolean" || kind.isInt() && typeof value === "number" && Number.isSafeInteger(value) || kind.isEnum() && typeof value === "string" && admitsEnum(value),
      nonLiteral: () => false
    });
  }
  match(cases) {
    return this.#value.match(cases);
  }
  describe() {
    return this.#value.describe();
  }
  equals(other) {
    return this.#value.equals(other.#value);
  }
  hashCode() {
    return this.#value.hashCode();
  }
}
// src/kernel/domain/collection-operations.ts
var MAX_COLLECTION_ELEMENTS = 65536;
function invalidIndex(index) {
  return new IllegalArgumentException({ kind: "invalid-collection-index", raw: index });
}
function checkReadBudget(operation, inspected) {
  if (inspected >= MAX_COLLECTION_ELEMENTS)
    throw new IllegalArgumentException({ kind: `${operation}-too-large`, raw: inspected + 1 });
}
function collectionAt(source, index) {
  if (!Number.isSafeInteger(index) || index < 0 || index >= MAX_COLLECTION_ELEMENTS)
    throw invalidIndex(index);
  let position = 0;
  for (const element of source) {
    if (position === index)
      return element;
    position++;
  }
  throw invalidIndex(index);
}
function collectionHead(source) {
  for (const element of source)
    return element;
  throw new IllegalArgumentException({ kind: "empty-collection-head" });
}
function collectionTail(source) {
  const tail = [];
  let inspected = 0;
  let foundHead = false;
  for (const element of source) {
    checkReadBudget("collection-tail", inspected);
    inspected++;
    if (!foundHead) {
      foundHead = true;
      continue;
    }
    tail.push(element);
  }
  if (!foundHead)
    throw new IllegalArgumentException({ kind: "empty-collection-tail" });
  return tail;
}
function collectionInclude(source, target) {
  let inspected = 0;
  for (const element of source) {
    checkReadBudget("collection-include", inspected);
    inspected++;
    if (element.equals(target))
      return true;
  }
  return false;
}
function collectionExists(source, predicate) {
  let inspected = 0;
  for (const element of source) {
    checkReadBudget("collection-exists", inspected);
    inspected++;
    if (predicate(element))
      return true;
  }
  return false;
}
function collectionFilter(source, predicate) {
  const values = [];
  let inspected = 0;
  for (const element of source) {
    checkReadBudget("collection-filter", inspected);
    inspected++;
    if (predicate(element))
      values.push(element);
  }
  return values;
}
function collectionMap(source, transform) {
  const values = [];
  let inspected = 0;
  for (const element of source) {
    checkReadBudget("collection-map", inspected);
    inspected++;
    values.push(transform(element));
  }
  return values;
}
function collectionEquals(left, right) {
  const leftIterator = left[Symbol.iterator]();
  const rightIterator = right[Symbol.iterator]();
  let inspected = 0;
  for (;; ) {
    checkReadBudget("collection-equals", inspected);
    inspected++;
    const leftStep = leftIterator.next();
    const rightStep = rightIterator.next();
    if (leftStep.done === true || rightStep.done === true)
      return leftStep.done === rightStep.done;
    if (!leftStep.value.equals(rightStep.value))
      return false;
  }
}
function collectionHashCode(source) {
  let hash = 1;
  let inspected = 0;
  for (const element of source) {
    checkReadBudget("collection-hash-code", inspected);
    inspected++;
    hash = 31 * hash + element.hashCode() | 0;
  }
  return hash;
}
function collectionCount(source) {
  let inspected = 0;
  for (const _element of source) {
    checkReadBudget("collection-count", inspected);
    inspected++;
  }
  return inspected;
}
function collectionCombine(left, right) {
  const values = [];
  for (const source of [left, right])
    for (const element of source) {
      checkReadBudget("collection-combine", values.length);
      values.push(element);
    }
  return values;
}
function collectionFoldLeft(source, initial, accumulate) {
  let accumulator = initial;
  let inspected = 0;
  for (const element of source) {
    checkReadBudget("collection-fold-left", inspected);
    inspected++;
    accumulator = accumulate(accumulator, element);
  }
  return accumulator;
}

// src/kernel/domain/non-empty-first-class-collection-base.ts
class NonEmptyFirstClassCollectionBase {
  constructor() {}
  at(index) {
    return collectionAt(this, index);
  }
  head() {
    return collectionHead(this);
  }
  tail() {
    return this.rebuild(collectionTail(this));
  }
  include(element) {
    return collectionInclude(this, element);
  }
  exists(predicate) {
    return collectionExists(this, predicate);
  }
  filter(predicate) {
    return this.rebuild(collectionFilter(this, predicate));
  }
  equals(other) {
    return this === other || collectionEquals(this, other);
  }
  hashCode() {
    return collectionHashCode(this);
  }
  count() {
    return collectionCount(this);
  }
  foldLeft(initial, accumulate) {
    return collectionFoldLeft(this, initial, accumulate);
  }
  mapTo(transform, factory) {
    return factory(collectionMap(this, transform));
  }
  combineTo(other, factory) {
    return factory(collectionCombine(this, other));
  }
}

// src/kernel/domain/first-class-collection-base.ts
class FirstClassCollectionBase extends NonEmptyFirstClassCollectionBase {
  constructor() {
    super();
  }
  isEmpty() {
    for (const _element of this)
      return false;
    return true;
  }
}

// src/kernel/domain/declared-bindings.ts
var MAX_DECLARED_BINDINGS = 1e4;

class DeclaredBindings extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, MAX_DECLARED_BINDINGS, "too-many-binding-declarations");
  }
  rebuild(values) {
    return new DeclaredBindings(values);
  }
  map(transform) {
    return this.mapTo(transform, DeclaredBindings.of);
  }
  combine(other) {
    return this.combineTo(other, DeclaredBindings.of);
  }
  static parse(values) {
    return parseConstruction(() => new DeclaredBindings(values));
  }
  static of(values) {
    return new DeclaredBindings(values);
  }
  add(value) {
    return new DeclaredBindings([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  matchesVerbatim(other) {
    if (this.count() !== other.count())
      return false;
    const otherValues = other.#values;
    return !this.#values.some((binding, index) => {
      const counterpart = otherValues[index];
      return counterpart === undefined || !binding.path().equals(counterpart.path()) || binding.value().describe() !== counterpart.value().describe();
    });
  }
  verbatimHashCode() {
    return combinedHash(this.#values.map((binding) => combinedHash([binding.path().hashCode(), hashOfString(binding.value().describe())])));
  }
  toArray() {
    return this.#values;
  }
  isEmpty() {
    return this.#values.length === 0;
  }
}
// src/kernel/domain/declared-bound.ts
class DeclaredBound {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static of(value) {
    return new DeclaredBound(value);
  }
  static parse(value) {
    return parseConstruction(() => new DeclaredBound(value));
  }
  asNumber() {
    return this.#value;
  }
  isSafeInteger() {
    return AttributeBound.parse(this.#value).ok;
  }
  exceeds(other) {
    return this.#value > other.#value;
  }
}
// src/kernel/domain/declared-digest.ts
class DeclaredDigest {
  #value;
  constructor(value) {
    if (value.length > 4096)
      throw new IllegalArgumentException({ kind: "declared-digest-too-long", raw: value.length });
    this.#value = value;
  }
  static parse(value) {
    return parseConstruction(() => new DeclaredDigest(value));
  }
  static of(value) {
    return new DeclaredDigest(value);
  }
  asString() {
    return this.#value;
  }
  matches(actual) {
    return this.#value === actual.asString();
  }
}
// src/kernel/domain/enumeration-member.ts
class EnumerationMember {
  #value;
  constructor(value) {
    if (value.length > 4096)
      throw new IllegalArgumentException({ kind: "enum-member-too-long", raw: value.length });
    this.#value = value;
  }
  static of(value) {
    return new EnumerationMember(value);
  }
  static parse(value) {
    return parseConstruction(() => new EnumerationMember(value));
  }
  matchesLiteral(value) {
    return this.#value === value;
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  compareTo(other) {
    return compareCanonically(this.#value, other.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/enumeration-members.ts
var MAX_ENUMERATION_MEMBERS = 1e4;

class EnumerationMembers extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, MAX_ENUMERATION_MEMBERS, "too-many-enum-members");
  }
  rebuild(values) {
    return new EnumerationMembers(values);
  }
  map(transform) {
    return this.mapTo(transform, EnumerationMembers.of);
  }
  combine(other) {
    return this.combineTo(other, EnumerationMembers.of);
  }
  static parse(values) {
    return parseConstruction(() => new EnumerationMembers(values));
  }
  static of(values) {
    return new EnumerationMembers(values);
  }
  add(value) {
    return new EnumerationMembers([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  includes(value) {
    return this.#values.some((member) => member.matchesLiteral(value));
  }
  sortedUniqueCanonically() {
    const members = new Map(this.#values.map((member) => [member.asString(), member]));
    return new EnumerationMembers([...members.values()].sort((a, b) => a.compareTo(b)));
  }
  indexOf(value) {
    return this.#values.findIndex((member) => member.matchesLiteral(value));
  }
  valueAt(index) {
    return this.#values[index];
  }
  count() {
    return this.#values.length;
  }
  toArray() {
    return this.#values;
  }
  isEmpty() {
    return this.#values.length === 0;
  }
}
// src/kernel/domain/error-message.ts
class ErrorMessage {
  #value;
  constructor(value) {
    if (value.length > 65536)
      throw new IllegalArgumentException({ kind: "error-message-too-long", raw: value.length });
    if (value.length === 0)
      throw new IllegalArgumentException({ kind: "empty-error-message" });
    this.#value = value;
  }
  static of(value) {
    return new ErrorMessage(value);
  }
  static parse(value) {
    return parseConstruction(() => new ErrorMessage(value));
  }
  asString() {
    return this.#value;
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
}
// src/kernel/domain/error-messages.ts
var MAX_MESSAGES = 65536;

class ErrorMessages extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, MAX_MESSAGES, "too-many-error-messages");
  }
  rebuild(values) {
    return new ErrorMessages(values);
  }
  map(transform) {
    return this.mapTo(transform, ErrorMessages.of);
  }
  combine(other) {
    return this.combineTo(other, ErrorMessages.of);
  }
  static parse(values) {
    return parseConstruction(() => new ErrorMessages(values));
  }
  static of(values) {
    return new ErrorMessages(values);
  }
  static collect(diagnostics) {
    const values = [];
    for (const diagnostic of diagnostics) {
      if (values.length === MAX_MESSAGES) {
        values[values.length - 1] = ErrorMessage.of("validation diagnostic limit reached (65536 messages); additional diagnostics omitted");
        break;
      }
      values.push(diagnostic.ok ? diagnostic.value : ErrorMessage.of("validation diagnostic could not be represented within its text budget"));
    }
    return new ErrorMessages(values);
  }
  asDiagnostics() {
    return [...this.#values].map((message) => ok(message));
  }
  add(value) {
    return new ErrorMessages([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  isEmpty() {
    return this.#values.length === 0;
  }
  toArray() {
    return this.#values;
  }
}
// src/kernel/domain/expression-tree.ts
class ExpressionTree {
  #root;
  constructor(root) {
    const snapshot = boundedValueSnapshot(root, { string: 4096, nodes: 1e5, depth: 258, total: 16777216 });
    let nodes = 0;
    const measure = (node, depth) => {
      if (++nodes > 1e4 || depth > 128 || (node.args?.length ?? 0) > 1e4 - nodes) {
        throw new IllegalArgumentException({ kind: "expression-too-large" });
      }
      if ((node.op?.length ?? 0) > 128 || (node.path?.length ?? 0) > 257 || typeof node.value === "string" && node.value.length > 4096) {
        throw new IllegalArgumentException({ kind: "expression-token-too-long" });
      }
      for (const child of node.args ?? [])
        measure(child, depth + 1);
    };
    measure(snapshot, 0);
    const visited = new WeakSet;
    const freeze = (value) => {
      if (visited.has(value))
        return;
      visited.add(value);
      for (const child of Object.values(value)) {
        if (child !== null && typeof child === "object")
          freeze(child);
      }
      Object.freeze(value);
    };
    freeze(snapshot);
    this.#root = snapshot;
  }
  static of(root) {
    return new ExpressionTree(root);
  }
  static parse(root) {
    return parseConstruction(() => new ExpressionTree(root));
  }
  asExpression() {
    return this.#root;
  }
  walk(visit) {
    const go = (e) => {
      visit(e);
      for (const a of e.args ?? [])
        go(a);
    };
    go(this.#root);
  }
  inspectTerms(handlers) {
    const compared = new Map;
    this.walk((node) => {
      const args = node.args ?? [];
      if (args.length !== 2)
        return;
      const reference = args.find((arg) => arg.op === "ref" && typeof arg.path === "string");
      const literal = args.find((arg) => arg.op === "enum");
      if (reference?.path !== undefined && literal !== undefined)
        compared.set(literal, reference.path);
    });
    this.walk((node) => {
      if (node.op === "ref" && typeof node.path === "string")
        handlers.reference(node.path, node.prime === true);
      if (node.op === "enum" && typeof node.value === "string")
        handlers.enumLiteral(node.value, compared.get(node));
    });
  }
  usesPrime() {
    let found = false;
    this.walk((node) => {
      if (node.op === "ref" && node.prime === true)
        found = true;
    });
    return found;
  }
  referencedPaths() {
    const refs = new Set;
    this.walk((node) => {
      if (node.op === "ref" && typeof node.path === "string")
        refs.add(node.path);
    });
    return [...refs].sort();
  }
  assignsPrimed(path) {
    let assigned = false;
    this.walk((node) => {
      if (node.op === "ref" && node.prime === true && node.path === path)
        assigned = true;
    });
    return assigned;
  }
  isCanonicallyEqual(other) {
    return canonicalStringify(this.#root) === canonicalStringify(other.#root);
  }
  equals(other) {
    return this.isCanonicallyEqual(other);
  }
  hashCode() {
    return hashOfString(canonicalStringify(this.#root));
  }
}
// src/kernel/domain/finding-kind.ts
var KIND_RANK = {
  conflict: 0,
  "completeness-gap": 1,
  "scenario-violation": 2,
  unreachable: 3,
  redundancy: 4,
  "refinement-violation": 5,
  "mapping-gap": 6,
  "structure-invalid": 7,
  "reference-broken": 8,
  "consistency-mismatch": 9,
  "cross-check-disagreement": 10
};

class FindingKind {
  #value;
  constructor(raw) {
    if (raw.length > 24)
      throw new IllegalArgumentException({ kind: "finding-kind-too-long", raw: raw.length });
    if (!Object.hasOwn(KIND_RANK, raw))
      throw new IllegalArgumentException({ kind: "unknown-finding-kind", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new FindingKind(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new FindingKind(raw));
  }
  static conflict() {
    return FindingKind.of("conflict");
  }
  static completenessGap() {
    return FindingKind.of("completeness-gap");
  }
  static scenarioViolation() {
    return FindingKind.of("scenario-violation");
  }
  static unreachable() {
    return FindingKind.of("unreachable");
  }
  static redundancy() {
    return FindingKind.of("redundancy");
  }
  static refinementViolation() {
    return FindingKind.of("refinement-violation");
  }
  static mappingGap() {
    return FindingKind.of("mapping-gap");
  }
  static structureInvalid() {
    return FindingKind.of("structure-invalid");
  }
  static referenceBroken() {
    return FindingKind.of("reference-broken");
  }
  static consistencyMismatch() {
    return FindingKind.of("consistency-mismatch");
  }
  static crossCheckDisagreement() {
    return FindingKind.of("cross-check-disagreement");
  }
  static canonicalOrder() {
    return Object.keys(KIND_RANK);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  compareTo(other) {
    return KIND_RANK[this.#value] - KIND_RANK[other.#value];
  }
  isConflict() {
    return this.#value === "conflict";
  }
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/target-identifier.ts
var TARGET_ID_PATTERNS = [
  /^(OB|SC)-[0-9]+$/,
  /^BR[0-9]+\.[0-9]+$/,
  /^(DOB|DSC|DBG|SM|TR)-[0-9]+$/,
  /^(component|entity|attr|unit|contract|state|check):[A-Za-z0-9_./-]+$/
];

class TargetIdentifier {
  #value;
  constructor(raw) {
    if (raw.length > 1024)
      throw new IllegalArgumentException({ kind: "target-id-too-long", raw: raw.length });
    if (!TARGET_ID_PATTERNS.some((pattern) => pattern.test(raw)))
      throw new IllegalArgumentException({ kind: "malformed-target-id", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new TargetIdentifier(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new TargetIdentifier(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  compareTo(other) {
    return compareCanonically(this.#value, other.#value);
  }
  isRequirementObligation() {
    return this.#value.startsWith("OB-");
  }
  asString() {
    return this.#value;
  }
}

// src/kernel/domain/target-identifiers.ts
var MAX_TARGET_IDENTIFIERS = 65536;

class TargetIdentifiers extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, MAX_TARGET_IDENTIFIERS, "too-many-target-identifiers");
  }
  rebuild(values) {
    return new TargetIdentifiers(values);
  }
  static of(values) {
    return new TargetIdentifiers(values);
  }
  map(transform) {
    return this.mapTo(transform, TargetIdentifiers.of);
  }
  combine(other) {
    return this.combineTo(other, TargetIdentifiers.of);
  }
  static parse(values) {
    return parseConstruction(() => new TargetIdentifiers(values));
  }
  static safe(prefix, raw) {
    const token = raw.replace(/[^A-Za-z0-9_./-]/g, "-");
    return `${prefix}:${token === "" ? "unknown" : token}`;
  }
  add(value) {
    return new TargetIdentifiers([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  count() {
    return this.#values.length;
  }
  excluding(value) {
    return new TargetIdentifiers(this.#values.filter((v) => !v.equals(value)));
  }
  sortedCanonically() {
    return new TargetIdentifiers([...this.#values].sort((a, b) => a.compareTo(b)));
  }
  sortedUniqueCanonically() {
    return TargetIdentifiers.of(Array.from(sortedUniqueCanonically(this.toStrings()), (raw) => TargetIdentifier.of(raw)));
  }
  joined(separator) {
    return this.toStrings().join(separator);
  }
  toArray() {
    return this.#values;
  }
  toStrings() {
    return this.#values.map((v) => v.asString());
  }
  isEmpty() {
    return this.#values.length === 0;
  }
}

// src/kernel/domain/finding-targets.ts
var MAX_FINDING_TARGETS = 65536;

class FindingTargets extends NonEmptyFirstClassCollectionBase {
  #values;
  constructor(head, tail) {
    super();
    if (tail.length >= MAX_FINDING_TARGETS)
      throw new IllegalArgumentException({ kind: "too-many-finding-targets", raw: tail.length + 1 });
    const snapshot = [head];
    for (const value of tail) {
      if (snapshot.length === MAX_FINDING_TARGETS)
        throw new IllegalArgumentException({ kind: "too-many-finding-targets", raw: snapshot.length + 1 });
      snapshot.push(value);
    }
    this.#values = Object.freeze(snapshot);
  }
  rebuild(values) {
    return TargetIdentifiers.of(values);
  }
  map(transform) {
    return this.mapTo(transform, ([head, ...tail]) => FindingTargets.of(head, tail));
  }
  combine(other) {
    return this.combineTo(other, ([head, ...tail]) => FindingTargets.of(head, tail));
  }
  static of(head, tail) {
    return new FindingTargets(head, tail);
  }
  static parse(head, tail) {
    return parseConstruction(() => new FindingTargets(head, tail));
  }
  static parseWithTail(head, tail) {
    return parseConstruction(() => new FindingTargets(head, [...tail]));
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  count() {
    return this.#values.length;
  }
  sortedCanonically() {
    const [head, ...tail] = [...this.#values].sort((a, b) => a.compareTo(b));
    return new FindingTargets(head, tail);
  }
  sortedUniqueCanonically() {
    const unique = new Map(this.#values.map((target) => [target.asString(), target]));
    const [head, ...tail] = [...unique.values()].sort((a, b) => a.compareTo(b));
    return new FindingTargets(head, tail);
  }
  joined(separator) {
    return this.toStrings().join(separator);
  }
  toArray() {
    return this.#values;
  }
  toStrings() {
    return this.#values.map((target) => target.asString());
  }
}
// src/kernel/domain/findings-schema.ts
var CONTRACT_BASENAME = "deep-spec-findings-schema.json";

class FindingsSchema {
  #schema;
  #reason;
  constructor(schema, reason) {
    this.#schema = schema === null ? null : boundedValueSnapshot(schema, { string: 65536, nodes: 1e5, depth: 128, total: 16777216 });
    this.#reason = reason;
  }
  static of(schema) {
    return new FindingsSchema(schema, null);
  }
  static parse(schema) {
    return parseConstruction(() => new FindingsSchema(schema, null));
  }
  static unreadable(cause) {
    return new FindingsSchema(null, cause);
  }
  degradationReasonFor(document) {
    const schema = this.#schema;
    if (schema === null) {
      return `findings schema unreadable: ${this.#reason ?? ""}`;
    }
    const errors = [];
    validateSchema(schema, schema, document, "", errors);
    const first = errors[0];
    if (first === undefined)
      return null;
    return `self-validation against ${CONTRACT_BASENAME} failed: ${first}`;
  }
}
// src/kernel/domain/functional-requirement-references.ts
var MAX_FUNCTIONAL_REQUIREMENT_REFERENCES = 1e4;

class FunctionalRequirementReferences extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, MAX_FUNCTIONAL_REQUIREMENT_REFERENCES, "too-many-functional-requirement-references");
  }
  rebuild(values) {
    return new FunctionalRequirementReferences(values);
  }
  map(transform) {
    return this.mapTo(transform, FunctionalRequirementReferences.of);
  }
  combine(other) {
    return this.combineTo(other, FunctionalRequirementReferences.of);
  }
  static parse(values) {
    return parseConstruction(() => new FunctionalRequirementReferences(values));
  }
  static of(values) {
    return new FunctionalRequirementReferences(values);
  }
  add(value) {
    return new FunctionalRequirementReferences([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  isEmpty() {
    return this.#values.length === 0;
  }
  sortedUnique() {
    const unique = new Map(this.#values.map((value) => [value.asString(), value]));
    return new FunctionalRequirementReferences([...unique.values()].sort((a, b) => a.compareTo(b)));
  }
  toArray() {
    return this.#values;
  }
  toStrings() {
    return this.#values.map((v) => v.asString());
  }
}
// src/kernel/domain/intermediate-representation-version.ts
class IntermediateRepresentationVersion {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "ir-version-too-long", raw: raw.length });
    if (!/^\d+\.\d+\.\d+$/.test(raw))
      throw new IllegalArgumentException({ kind: "not-a-semver", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new IntermediateRepresentationVersion(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new IntermediateRepresentationVersion(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  majorVersion() {
    return Number.parseInt(this.#value.split(".")[0] ?? "", 10);
  }
  supportsMajor(major) {
    return this.majorVersion() === major;
  }
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/key-set.ts
class KeySet {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static empty() {
    return new KeySet(new Map);
  }
  static of(keys) {
    const map = new Map;
    for (const key of keys)
      if (!map.has(key.asString()))
        map.set(key.asString(), key);
    return new KeySet(map);
  }
  with(key) {
    if (this.#values.has(key.asString()))
      return this;
    const map = new Map(this.#values);
    map.set(key.asString(), key);
    return new KeySet(map);
  }
  has(key) {
    return this.#values.has(key.asString());
  }
  size() {
    return this.#values.size;
  }
  isEmpty() {
    return this.#values.size === 0;
  }
  *[Symbol.iterator]() {
    yield* this.#values.values();
  }
  toArray() {
    return [...this.#values.values()];
  }
}
// src/kernel/domain/keyed-index.ts
class KeyedIndex {
  #entries;
  constructor(entries) {
    this.#entries = entries;
  }
  static empty() {
    return new KeyedIndex(new Map);
  }
  static of(entries) {
    const map = new Map;
    for (const [key, value] of entries)
      map.set(key.asString(), [key, value]);
    return new KeyedIndex(map);
  }
  with(key, value) {
    const map = new Map(this.#entries);
    map.set(key.asString(), [key, value]);
    return new KeyedIndex(map);
  }
  get(key) {
    return this.#entries.get(key.asString())?.[1];
  }
  has(key) {
    return this.#entries.has(key.asString());
  }
  size() {
    return this.#entries.size;
  }
  isEmpty() {
    return this.#entries.size === 0;
  }
  *keys() {
    for (const [key] of this.#entries.values())
      yield key;
  }
  *values() {
    for (const [, value] of this.#entries.values())
      yield value;
  }
  *[Symbol.iterator]() {
    yield* this.#entries.values();
  }
}
// src/kernel/domain/normalized-name.ts
class NormalizedName {
  #value;
  constructor(value) {
    if (value.length > 4096)
      throw new IllegalArgumentException({ kind: "normalized-name-too-long", raw: value.length });
    this.#value = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  }
  static of(raw) {
    return new NormalizedName(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new NormalizedName(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/obligation-nature.ts
class ObligationNature {
  #value;
  constructor(value) {
    if (value.length > 128)
      throw new IllegalArgumentException({ kind: "obligation-nature-too-long", raw: value.length });
    this.#value = value;
  }
  static parse(value) {
    return parseConstruction(() => new ObligationNature(value));
  }
  static of(raw) {
    return new ObligationNature(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  asString() {
    return this.#value;
  }
  isInvariant() {
    return this.#value === "invariant";
  }
  isNumeric() {
    return this.#value === "numeric";
  }
  isEvent() {
    return this.#value === "event";
  }
  isStateTemporal() {
    return this.#value === "state-temporal";
  }
}
// src/kernel/domain/query-label.ts
class QueryLabel {
  #value;
  constructor(value) {
    if (value.length > 2048)
      throw new IllegalArgumentException({ kind: "query-label-too-long", raw: value.length });
    if (value === "")
      throw new IllegalArgumentException({ kind: "empty-query-label", raw: value });
    this.#value = value;
  }
  static of(raw) {
    return new QueryLabel(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new QueryLabel(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  compareTo(other) {
    return this.#value < other.#value ? -1 : this.#value > other.#value ? 1 : 0;
  }
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/requirement-identifier.ts
class RequirementIdentifier {
  #value;
  constructor(value) {
    if (value.length > 128)
      throw new IllegalArgumentException({ kind: "requirement-id-too-long", raw: value.length });
    if (!/^(?:FR|NFR)-?[0-9]+(?:\.[0-9]+)*$/.test(value))
      throw new IllegalArgumentException({ kind: "malformed-requirement-id", raw: value });
    this.#value = value;
  }
  static of(raw) {
    return new RequirementIdentifier(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new RequirementIdentifier(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  compareTo(other) {
    return compareCanonically(this.#value, other.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/requirement-identifiers.ts
var MAX_REQUIREMENT_IDENTIFIERS = 65536;

class RequirementIdentifiers extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    const snapshot = boundedCollectionSnapshot(values, MAX_REQUIREMENT_IDENTIFIERS, "too-many-requirement-identifiers");
    this.#values = KeySet.of(snapshot);
  }
  rebuild(values) {
    return new RequirementIdentifiers(values);
  }
  static of(values) {
    return new RequirementIdentifiers(values);
  }
  map(transform) {
    return this.mapTo(transform, RequirementIdentifiers.of);
  }
  combine(other) {
    return this.combineTo(other, RequirementIdentifiers.of);
  }
  static parse(values) {
    return parseConstruction(() => new RequirementIdentifiers(values));
  }
  add(value) {
    if (this.#values.has(value))
      return this;
    return new RequirementIdentifiers([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  has(value) {
    return this.#values.has(value);
  }
  toArray() {
    return this.#values.toArray();
  }
  toStrings() {
    return this.#values.toArray().map((v) => v.asString());
  }
  isEmpty() {
    return this.#values.isEmpty();
  }
}
// src/kernel/domain/scenario-binding.ts
class ScenarioBinding {
  #path;
  #value;
  constructor(path, value) {
    this.#path = path;
    this.#value = value;
  }
  static of(path, value) {
    return new ScenarioBinding(path, value);
  }
  path() {
    return this.#path;
  }
  value() {
    return this.#value;
  }
  isFor(path) {
    return this.#path.equals(path);
  }
  equals(other) {
    return this.#path.equals(other.#path) && this.#value.equals(other.#value);
  }
  hashCode() {
    return combinedHash([this.#path.hashCode(), this.#value.hashCode()]);
  }
}
// src/kernel/domain/scenario-bindings.ts
class ScenarioBindings extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    const snapshot = boundedCollectionSnapshot(values, 1e4, "too-many-scenario-bindings");
    const paths = new Set;
    for (const binding of snapshot) {
      const path = binding.path().asString();
      if (paths.has(path))
        throw new IllegalArgumentException({ kind: "duplicate-scenario-binding", raw: path });
      paths.add(path);
    }
    this.#values = snapshot;
  }
  rebuild(values) {
    return new ScenarioBindings(values);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  map(transform) {
    return this.mapTo(transform, ScenarioBindings.of);
  }
  combine(other) {
    return this.combineTo(other, ScenarioBindings.of);
  }
  static parse(values) {
    return parseConstruction(() => new ScenarioBindings(values));
  }
  static of(values) {
    return new ScenarioBindings(values);
  }
  add(value) {
    return new ScenarioBindings([...this.#values, value]);
  }
  has(path) {
    return this.#values.some((binding) => binding.isFor(path));
  }
  valueAt(path) {
    return this.#values.find((binding) => binding.isFor(path))?.value() ?? null;
  }
  covers(paths) {
    return paths.every((path) => this.has(path));
  }
  entriesCanonically() {
    return [...this.#values].sort((a, b) => a.path().asString() < b.path().asString() ? -1 : a.path().asString() > b.path().asString() ? 1 : 0);
  }
  toDocument() {
    return Object.fromEntries(this.entriesCanonically().map((binding) => [binding.path().asString(), binding.value().toDocument()]));
  }
  isEmpty() {
    return this.#values.length === 0;
  }
}
// src/kernel/domain/scenario-comparison.ts
class ScenarioComparison {
  #first;
  #second;
  constructor(first, second) {
    if (!first.sameSubjectAs(second))
      throw new IllegalArgumentException({ kind: "different-comparison-subjects" });
    if (!first.isComparable() || !second.isComparable())
      throw new IllegalArgumentException({ kind: "uncomparable-scenario-verdict" });
    if (first.backend().equals(second.backend()))
      throw new IllegalArgumentException({ kind: "same-comparison-backend" });
    this.#first = first;
    this.#second = second;
  }
  static of(first, second) {
    return new ScenarioComparison(first, second);
  }
  static parse(first, second) {
    return parseConstruction(() => new ScenarioComparison(first, second));
  }
  isFor(target, unit) {
    return this.#first.isFor(target, unit);
  }
  disagrees() {
    return !this.#first.agreesWith(this.#second);
  }
  backends() {
    return [this.#first.backend(), this.#second.backend()];
  }
  description() {
    return `Backends "${this.#first.backend().asString()}" and "${this.#second.backend().asString()}"`;
  }
  toVerdictTable() {
    return Object.fromEntries([
      [this.#first.backend().asString(), this.#first.verdictLabel()],
      [this.#second.backend().asString(), this.#second.verdictLabel()]
    ]);
  }
}
// src/kernel/domain/scenario-expectation.ts
class ScenarioExpectation {
  #kind;
  constructor(value) {
    if (value.length > 6)
      throw new IllegalArgumentException({ kind: "scenario-expectation-too-long", raw: value.length });
    if (value !== "accept" && value !== "reject")
      throw new IllegalArgumentException({ kind: "unknown-scenario-expectation", raw: value });
    this.#kind = value;
  }
  static of(value) {
    return new ScenarioExpectation(value);
  }
  static parse(value) {
    return parseConstruction(() => new ScenarioExpectation(value));
  }
  isAccept() {
    return this.#kind === "accept";
  }
  isReject() {
    return this.#kind === "reject";
  }
  isViolatedBySatisfiability(satisfiable) {
    return this.#kind === "accept" ? !satisfiable : satisfiable;
  }
  asString() {
    return this.#kind;
  }
}
// src/kernel/domain/scenario-verdict.ts
class ScenarioVerdict {
  #backend;
  #modelHash;
  #state;
  #target;
  #unit;
  constructor(backend, modelHash, target, unit, state) {
    this.#backend = backend;
    this.#modelHash = modelHash;
    this.#state = state;
    this.#target = target;
    this.#unit = unit;
  }
  static clean(backend, modelHash, target, unit) {
    return new ScenarioVerdict(backend, modelHash, target, unit, "clean");
  }
  static violated(backend, modelHash, target, unit) {
    return new ScenarioVerdict(backend, modelHash, target, unit, "violated");
  }
  static skipped(backend, modelHash, target, unit) {
    return new ScenarioVerdict(backend, modelHash, target, unit, "skipped");
  }
  static unavailable(backend, modelHash, target, unit) {
    return new ScenarioVerdict(backend, modelHash, target, unit, "unavailable");
  }
  backend() {
    return this.#backend;
  }
  isComparable() {
    return this.#state === "clean" || this.#state === "violated";
  }
  isFor(target, unit) {
    return this.#target.equals(target) && (this.#unit === null ? unit === null : unit !== null && this.#unit.equals(unit));
  }
  sameSubjectAs(other) {
    return this.#modelHash.equals(other.#modelHash) && this.isFor(other.#target, other.#unit);
  }
  agreesWith(other) {
    return this.#state === other.#state;
  }
  equals(other) {
    return this.#backend.equals(other.#backend) && this.#modelHash.equals(other.#modelHash) && this.#state === other.#state && this.#target.equals(other.#target) && (this.#unit === null ? other.#unit === null : other.#unit !== null && this.#unit.equals(other.#unit));
  }
  hashCode() {
    return combinedHash([
      this.#backend.hashCode(),
      this.#modelHash.hashCode(),
      hashOfString(this.#state),
      this.#target.hashCode(),
      hashOfNullable(this.#unit, (unit) => unit.hashCode())
    ]);
  }
  verdictLabel() {
    if (this.#state !== "clean" && this.#state !== "violated")
      throw new Error("defect: an unverified scenario has no verdict label");
    return this.#state;
  }
}
// src/kernel/domain/scenario-verdicts.ts
class ScenarioVerdicts extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    const snapshot = boundedCollectionSnapshot(values, 128, "too-many-scenario-verdicts");
    const comparable = snapshot.filter((value) => value.isComparable());
    if (comparable.some((value) => !value.sameSubjectAs(comparable[0])))
      throw new IllegalArgumentException({ kind: "different-scenario-subjects" });
    if (KeySet.of(comparable.map((value) => value.backend())).size() !== comparable.length)
      throw new IllegalArgumentException({ kind: "duplicate-scenario-backend" });
    this.#values = [...comparable];
  }
  rebuild(values) {
    return new ScenarioVerdicts(values);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  static of(values) {
    return new ScenarioVerdicts(values);
  }
  map(transform) {
    return this.mapTo(transform, ScenarioVerdicts.of);
  }
  combine(other) {
    return this.combineTo(other, ScenarioVerdicts.of);
  }
  static parse(values) {
    return parseConstruction(() => new ScenarioVerdicts(values));
  }
  *comparisons() {
    for (let i = 0;i < this.#values.length; i++)
      for (let j = i + 1;j < this.#values.length; j++) {
        const comparison = ScenarioComparison.parse(this.#values[i], this.#values[j]);
        if (!comparison.ok)
          throw new Error(`defect: validated scenario verdicts cannot be compared (${comparison.error.kind})`);
        yield comparison.value;
      }
  }
  isEmpty() {
    return this.#values.length === 0;
  }
}
// src/kernel/domain/skip-reason.ts
var KNOWN_REASONS = new Set([
  "unavailable",
  "timeout",
  "capability",
  "compile-error",
  "waived",
  "absent-input",
  "stale-input",
  "ir-version-mismatch",
  "unrecognized-format"
]);

class SkipReason {
  #value;
  constructor(raw) {
    if (raw.length > 19)
      throw new IllegalArgumentException({ kind: "skip-reason-too-long", raw: raw.length });
    if (!KNOWN_REASONS.has(raw))
      throw new IllegalArgumentException({ kind: "unknown-skip-reason", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new SkipReason(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new SkipReason(raw));
  }
  static unavailable() {
    return SkipReason.of("unavailable");
  }
  static timeout() {
    return SkipReason.of("timeout");
  }
  static capability() {
    return SkipReason.of("capability");
  }
  static compileError() {
    return SkipReason.of("compile-error");
  }
  static waived() {
    return SkipReason.of("waived");
  }
  static absentInput() {
    return SkipReason.of("absent-input");
  }
  static staleInput() {
    return SkipReason.of("stale-input");
  }
  static irVersionMismatch() {
    return SkipReason.of("ir-version-mismatch");
  }
  static unrecognizedFormat() {
    return SkipReason.of("unrecognized-format");
  }
  asString() {
    return this.#value;
  }
  compareTo(other) {
    return this.#value < other.#value ? -1 : this.#value > other.#value ? 1 : 0;
  }
}
// src/kernel/domain/trigger-name.ts
class TriggerName {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "trigger-name-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-trigger-name", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new TriggerName(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new TriggerName(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/unit-name.ts
class UnitName {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "unit-name-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-unit-name", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new UnitName(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new UnitName(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/validation-assessment.ts
class ValidationAssessment {
  #errors;
  constructor(errors) {
    this.#errors = errors;
  }
  static of(errors) {
    return new ValidationAssessment(errors);
  }
  passes() {
    return this.#errors.isEmpty();
  }
  errors() {
    return this.#errors;
  }
}
// src/kernel/domain/verification-method.ts
var KNOWN_METHODS = new Set(["exhaustive", "bounded", "simulation", "static"]);

class VerificationMethod {
  #value;
  constructor(raw) {
    if (raw.length > 10)
      throw new IllegalArgumentException({ kind: "unknown-verification-method", raw });
    if (!KNOWN_METHODS.has(raw))
      throw new IllegalArgumentException({ kind: "unknown-verification-method", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new VerificationMethod(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new VerificationMethod(raw));
  }
  isBounded() {
    return this.#value === "bounded";
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/requirements/domain/background-assumption.ts
class BackgroundAssumption {
  #id;
  #assert;
  constructor(props) {
    this.#id = props.id;
    this.#assert = ExpressionTree.of(props.assert).asExpression();
  }
  static parse(props) {
    return parseConstruction(() => new BackgroundAssumption(props));
  }
  static of(props) {
    return new BackgroundAssumption(props);
  }
  id() {
    return this.#id;
  }
  equals(other) {
    const assertionsEqual = this.#assert === undefined ? other.#assert === undefined : other.#assert !== undefined && ExpressionTree.of(this.#assert).isCanonicallyEqual(ExpressionTree.of(other.#assert));
    return this.#id.equals(other.#id) && assertionsEqual;
  }
  hashCode() {
    return combinedHash([
      this.#id.hashCode(),
      hashOfNullable(this.#assert, (value) => hashOfString(canonicalStringify(value)))
    ]);
  }
  assertion() {
    return this.#assert;
  }
}
// src/requirements/domain/background-assumption-identifier.ts
class BackgroundAssumptionIdentifier {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "background-assumption-id-too-long", raw: raw.length });
    if (!/^BG-[0-9]+$/.test(raw))
      throw new IllegalArgumentException({ kind: "malformed-background-assumption-id", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new BackgroundAssumptionIdentifier(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new BackgroundAssumptionIdentifier(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/requirements/domain/background-assumptions.ts
class BackgroundAssumptions extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-background-assumptions");
  }
  rebuild(values) {
    return new BackgroundAssumptions(values);
  }
  map(transform) {
    return this.mapTo(transform, BackgroundAssumptions.of);
  }
  combine(other) {
    return this.combineTo(other, BackgroundAssumptions.of);
  }
  static parse(values) {
    return parseConstruction(() => new BackgroundAssumptions(values));
  }
  static of(values) {
    return new BackgroundAssumptions(values);
  }
  add(value) {
    return new BackgroundAssumptions([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/requirements/domain/cross-checked-entries.ts
class CrossCheckedEntries extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-cross-checked-entries");
  }
  rebuild(values) {
    return new CrossCheckedEntries(values);
  }
  map(transform) {
    return this.mapTo(transform, CrossCheckedEntries.of);
  }
  combine(other) {
    return this.combineTo(other, CrossCheckedEntries.of);
  }
  static parse(values) {
    return parseConstruction(() => new CrossCheckedEntries(values));
  }
  static of(values) {
    return new CrossCheckedEntries(values);
  }
  add(value) {
    return new CrossCheckedEntries([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toDocuments() {
    return this.#values.map((entry) => ({ backend: entry.backend().asString(), targets: entry.targets().toStrings() }));
  }
  toArray() {
    return this.#values;
  }
}
// src/requirements/domain/cross-checked-entry.ts
class CrossCheckedEntry {
  #backend;
  #targets;
  constructor(props) {
    this.#backend = props.backend;
    const outside = props.targets.filter((target) => !target.asString().startsWith("SC-"));
    if (!outside.isEmpty())
      throw new IllegalArgumentException({ kind: "invalid-cross-checked-target", raw: outside.head().asString() });
    this.#targets = props.targets;
  }
  static of(props) {
    return new CrossCheckedEntry(props);
  }
  static parse(props) {
    return parseConstruction(() => new CrossCheckedEntry(props));
  }
  backend() {
    return this.#backend;
  }
  targets() {
    return this.#targets;
  }
  equals(other) {
    return this.#backend.equals(other.#backend) && this.#targets.equals(other.#targets);
  }
  hashCode() {
    return combinedHash([this.#backend.hashCode(), this.#targets.hashCode()]);
  }
  compareByBackend(other) {
    const a = this.#backend.asString();
    const b = other.#backend.asString();
    return a < b ? -1 : a > b ? 1 : 0;
  }
}
// src/requirements/domain/formal-model-identifier.ts
class FormalModelIdentifier {
  #path;
  constructor(path) {
    this.#path = path;
  }
  static of(path) {
    return new FormalModelIdentifier(path);
  }
  equals(other) {
    return this.#path.equals(other.#path);
  }
  hashCode() {
    return this.#path.hashCode();
  }
  artifactPath() {
    return this.#path;
  }
}
// src/requirements/domain/functional-requirement-reference-claim.ts
class FunctionalRequirementReferenceClaim {
  #owner;
  #functionalRequirementReferences;
  constructor(owner, functionalRequirementReferences) {
    this.#owner = owner;
    this.#functionalRequirementReferences = functionalRequirementReferences;
  }
  static of(owner, functionalRequirementReferences) {
    return new FunctionalRequirementReferenceClaim(owner, functionalRequirementReferences);
  }
  ownerDescription() {
    return this.#owner;
  }
  referenceCount() {
    return this.#functionalRequirementReferences.count();
  }
  equals(other) {
    return this.#owner === other.#owner && this.#functionalRequirementReferences.equals(other.#functionalRequirementReferences);
  }
  hashCode() {
    return combinedHash([hashOfString(this.#owner), this.#functionalRequirementReferences.hashCode()]);
  }
  claimInto(ownersByRef) {
    for (const ref of this.#functionalRequirementReferences) {
      const owners = ownersByRef.get(ref.asString()) ?? [];
      owners.push(this);
      ownersByRef.set(ref.asString(), owners);
    }
  }
  claimIntoKeyed(ownersByRef) {
    for (const ref of this.#functionalRequirementReferences) {
      const existing = ownersByRef.get(ref.asString());
      if (existing === undefined)
        ownersByRef.set(ref.asString(), { key: ref, owners: [this] });
      else
        existing.owners.push(this);
    }
  }
}
// src/requirements/domain/functional-requirement-reference-claims.ts
class FunctionalRequirementReferenceClaims extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-functional-requirement-reference-claims");
  }
  rebuild(values) {
    return new FunctionalRequirementReferenceClaims(values);
  }
  static of(values) {
    return new FunctionalRequirementReferenceClaims(values);
  }
  map(transform) {
    return this.mapTo(transform, FunctionalRequirementReferenceClaims.of);
  }
  combine(other) {
    return this.combineTo(other, FunctionalRequirementReferenceClaims.of);
  }
  static parse(values) {
    return parseConstruction(() => new FunctionalRequirementReferenceClaims(values));
  }
  add(value) {
    return new FunctionalRequirementReferenceClaims([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  ownerDescriptions() {
    return this.#values.map((claim) => claim.ownerDescription());
  }
  toArray() {
    return this.#values;
  }
}
// src/requirements/domain/functional-requirement-reference-index.ts
var MAX_REFERENCE_EXPANSIONS = 65536;

class FunctionalRequirementReferenceIndex extends FirstClassCollectionBase {
  #claims;
  #ownersByRef;
  constructor(claims) {
    super();
    this.#claims = boundedCollectionSnapshot(claims, 65536, "too-many-functional-requirement-reference-claims");
    let referenceExpansions = 0;
    for (const claim of this.#claims) {
      referenceExpansions += claim.referenceCount();
      if (referenceExpansions > MAX_REFERENCE_EXPANSIONS)
        throw new IllegalArgumentException({
          kind: "too-many-functional-requirement-reference-index-entries",
          raw: referenceExpansions
        });
    }
    const ownersByRef = new Map;
    for (const claim of this.#claims)
      claim.claimIntoKeyed(ownersByRef);
    this.#ownersByRef = KeyedIndex.of([...ownersByRef.values()].map(({ key, owners }) => [key, FunctionalRequirementReferenceClaims.of(owners)]));
  }
  static of(claims) {
    return new FunctionalRequirementReferenceIndex(claims);
  }
  map(transform) {
    return this.mapTo(transform, FunctionalRequirementReferenceIndex.of);
  }
  combine(other) {
    return this.combineTo(other, FunctionalRequirementReferenceIndex.of);
  }
  static parse(claims) {
    return parseConstruction(() => new FunctionalRequirementReferenceIndex(claims));
  }
  static parseClaims(claims) {
    return parseConstruction(() => new FunctionalRequirementReferenceIndex([...claims]));
  }
  rebuild(values) {
    return new FunctionalRequirementReferenceIndex(values);
  }
  *[Symbol.iterator]() {
    yield* this.#claims;
  }
  toArray() {
    return this.#claims;
  }
  referencedIds() {
    return [...this.#ownersByRef.keys()].map((ref) => ref.asString());
  }
  missingErrors(known) {
    const missing = [...this.#ownersByRef.keys()].filter((ref) => !known.has(ref)).map((ref) => ref.asString()).sort();
    return missing.map((id) => {
      const owners = [...[...this.#ownersByRef].find(([ref]) => ref.asString() === id)?.[1].ownerDescriptions() ?? []].sort().join(", ");
      return `frRef "${id}" (used by ${owners}) does not exist in requirements.md`;
    });
  }
}
// src/requirements/domain/intermediate-representation-attribute-entry.ts
class IntermediateRepresentationAttributeEntry {
  #owner;
  #path;
  #attribute;
  constructor(owner, attribute) {
    this.#owner = owner;
    this.#path = AttributePath.of(`${owner.asString()}.${attribute.name().asString()}`);
    this.#attribute = attribute;
  }
  static of(owner, attribute) {
    return new IntermediateRepresentationAttributeEntry(owner, attribute);
  }
  static parse(owner, attribute) {
    return parseConstruction(() => new IntermediateRepresentationAttributeEntry(owner, attribute));
  }
  path() {
    return this.#path;
  }
  owner() {
    return this.#owner;
  }
  attribute() {
    return this.#attribute;
  }
  equals(other) {
    return this.#owner.equals(other.#owner) && this.#path.equals(other.#path) && this.#attribute.equals(other.#attribute);
  }
  hashCode() {
    return combinedHash([this.#owner.hashCode(), this.#path.hashCode(), this.#attribute.hashCode()]);
  }
}

// src/requirements/domain/intermediate-representation-attribute-catalog.ts
class IntermediateRepresentationAttributeCatalog extends FirstClassCollectionBase {
  #entries;
  #byPath;
  constructor(entries) {
    super();
    const snapshot = [];
    const paths = new Set;
    for (const entry of entries) {
      if (snapshot.length >= 65536)
        throw new IllegalArgumentException({ kind: "attribute-catalog-too-large", raw: snapshot.length + 1 });
      const path = entry.path().asString();
      if (paths.has(path))
        throw new IllegalArgumentException({ kind: "ambiguous-requirement-attributes", raw: path });
      paths.add(path);
      snapshot.push(entry);
    }
    this.#entries = Object.freeze(snapshot);
    this.#byPath = KeyedIndex.of(this.#entries.map((entry) => [entry.path(), entry.attribute()]));
  }
  rebuild(values) {
    return new IntermediateRepresentationAttributeCatalog(values);
  }
  map(transform) {
    return this.mapTo(transform, (values) => this.rebuild(values));
  }
  combine(other) {
    return this.combineTo(other, (values) => this.rebuild(values));
  }
  *[Symbol.iterator]() {
    yield* this.#entries;
  }
  toArray() {
    return this.#entries;
  }
  #attributeAt(path) {
    const parsed = AttributePath.parse(path);
    return parsed.ok ? this.#byPath.get(parsed.value) : undefined;
  }
  static of(declarations) {
    return new IntermediateRepresentationAttributeCatalog(IntermediateRepresentationAttributeCatalog.entriesOf(declarations));
  }
  static parse(declarations) {
    return parseConstruction(() => new IntermediateRepresentationAttributeCatalog(IntermediateRepresentationAttributeCatalog.entriesOf(declarations)));
  }
  static *entriesOf(declarations) {
    let count = 0;
    for (const entity of declarations) {
      if (++count > 65536)
        throw new IllegalArgumentException({ kind: "attribute-catalog-too-large", raw: count });
      entity.inspectAttributes((_path, _attribute) => {
        if (++count > 65536)
          throw new IllegalArgumentException({ kind: "attribute-catalog-too-large", raw: count });
      });
    }
    if (declarations.hasAmbiguousAttributes())
      throw new IllegalArgumentException({ kind: "ambiguous-requirement-attributes" });
    const entries = [];
    for (const entity of declarations)
      entity.inspectAttributes((_path, attribute) => {
        entries.push(IntermediateRepresentationAttributeEntry.of(entity.name(), attribute));
      });
    yield* entries;
  }
  diagnostics() {
    return ErrorMessages.collect(this.diagnosticStrings().map(ErrorMessage.parse));
  }
  diagnosticStrings() {
    const errors = [];
    const encoded = new Map;
    for (const coordinate of this.#byPath.keys()) {
      const path = coordinate.asString();
      const key = path.replace(/\./g, "_");
      const prior = encoded.get(key);
      if (prior !== undefined) {
        errors.push(`schema: attribute paths "${prior}" and "${path}" collide under the solver variable encoding (dots become underscores)`);
      } else {
        encoded.set(key, path);
      }
    }
    return errors;
  }
  expressionDiagnostics(expression, where, primesAllowed) {
    return ErrorMessages.collect(this.expressionDiagnosticStrings(expression, where, primesAllowed).map(ErrorMessage.parse));
  }
  expressionDiagnosticStrings(expression, where, primesAllowed) {
    const errors = [];
    ExpressionTree.of(expression).inspectTerms({
      reference: (path, primed) => {
        if (!(this.#attributeAt(path) !== undefined))
          errors.push(`${where}: unresolvable reference "${path}"`);
        if (primed && !primesAllowed)
          errors.push(`${where}: primed reference "${path}" is only legal in event effects and event-scenario expectations`);
      },
      enumLiteral: (value) => {
        if (![...this.#byPath.values()].some((attribute) => attribute.admitsEnumLiteral(value)))
          errors.push(`${where}: enum literal "${value}" is not a value of any declared enum attribute`);
      }
    });
    return errors;
  }
  bindingDiagnostics(bindings, context) {
    return ErrorMessages.collect(this.bindingDiagnosticStrings(bindings, context).map(ErrorMessage.parse));
  }
  bindingDiagnosticStrings(bindings, context) {
    const errors = [];
    for (const binding of bindings) {
      const path = binding.path().asString();
      const attribute = this.#attributeAt(path);
      if (!attribute)
        errors.push(`${context}: binding for unknown attribute "${path}"`);
      else if (!attribute.fitsBinding(binding.value()))
        errors.push(`${context}: binding value ${binding.value().describe()} does not fit ${attribute.kindLabel()} attribute "${path}"`);
    }
    return errors;
  }
}
// src/requirements/domain/intermediate-representation-attribute-declaration.ts
class IntermediateRepresentationAttributeDeclaration {
  #name;
  #kind;
  #values;
  #min;
  #max;
  constructor(props) {
    this.#name = props.name;
    this.#kind = props.kind;
    this.#values = props.values;
    this.#min = props.min;
    this.#max = props.max;
  }
  static of(props) {
    return new IntermediateRepresentationAttributeDeclaration(props);
  }
  name() {
    return this.#name;
  }
  boundsInverted() {
    return this.#kind.isInt() && this.#min !== undefined && this.#max !== undefined && this.#min.exceeds(this.#max);
  }
  boundsOutsideSafeRange() {
    return this.#min !== undefined && !this.#min.isSafeInteger() || this.#max !== undefined && !this.#max.isSafeInteger();
  }
  admitsEnumLiteral(value) {
    return this.#kind.isEnum() && (this.#values?.includes(value) ?? false);
  }
  fitsBinding(value) {
    return value.fits(this.#kind, (literal) => this.admitsEnumLiteral(literal));
  }
  kindLabel() {
    return this.#kind.asString();
  }
  equals(other) {
    const valuesEqual = this.#values === undefined ? other.#values === undefined : other.#values !== undefined && this.#values.equals(other.#values);
    return this.#name.equals(other.#name) && this.#kind.equals(other.#kind) && valuesEqual && this.#min?.asNumber() === other.#min?.asNumber() && this.#max?.asNumber() === other.#max?.asNumber();
  }
  hashCode() {
    return combinedHash([
      this.#name.hashCode(),
      this.#kind.hashCode(),
      hashOfNullable(this.#values, (values) => values.hashCode()),
      hashOfNullable(this.#min, (min) => hashOfNumber(min.asNumber())),
      hashOfNullable(this.#max, (max) => hashOfNumber(max.asNumber()))
    ]);
  }
}
// src/requirements/domain/intermediate-representation-attribute-declarations.ts
class IntermediateRepresentationAttributeDeclarations extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-intermediate-representation-attribute-declarations");
  }
  rebuild(values) {
    return new IntermediateRepresentationAttributeDeclarations(values);
  }
  map(transform) {
    return this.mapTo(transform, IntermediateRepresentationAttributeDeclarations.of);
  }
  combine(other) {
    return this.combineTo(other, IntermediateRepresentationAttributeDeclarations.of);
  }
  static parse(values) {
    return parseConstruction(() => new IntermediateRepresentationAttributeDeclarations(values));
  }
  static of(values) {
    return new IntermediateRepresentationAttributeDeclarations(values);
  }
  add(value) {
    return new IntermediateRepresentationAttributeDeclarations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  inspectInDeclarationOrder(visitor) {
    const seen = new Set;
    for (const attribute of this.#values) {
      const name = attribute.name().asString();
      visitor(attribute, seen.has(name));
      seen.add(name);
    }
  }
  toArray() {
    return this.#values;
  }
}
// src/requirements/domain/intermediate-representation-attribute-name.ts
class IntermediateRepresentationAttributeName {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "ir-attribute-name-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-ir-decl-token", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new IntermediateRepresentationAttributeName(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new IntermediateRepresentationAttributeName(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/requirements/domain/intermediate-representation-background-declaration.ts
class IntermediateRepresentationBackgroundDeclaration {
  #id;
  #assert;
  constructor(props) {
    this.#id = props.id;
    this.#assert = props.assert === undefined ? undefined : ExpressionTree.of(props.assert).asExpression();
  }
  static parse(props) {
    return parseConstruction(() => new IntermediateRepresentationBackgroundDeclaration(props));
  }
  static of(props) {
    return new IntermediateRepresentationBackgroundDeclaration(props);
  }
  diagnostics(catalog) {
    return ErrorMessages.collect(this.diagnosticStrings(catalog).map(ErrorMessage.parse));
  }
  diagnosticStrings(catalog) {
    const assertion = this.#assert;
    if (assertion === undefined)
      return [];
    return catalog.expressionDiagnosticStrings(assertion, `background ${this.#id.asString()}`, false);
  }
  id() {
    return this.#id;
  }
  equals(other) {
    const assertionsEqual = this.#assert === undefined ? other.#assert === undefined : other.#assert !== undefined && ExpressionTree.of(this.#assert).isCanonicallyEqual(ExpressionTree.of(other.#assert));
    return this.#id.equals(other.#id) && assertionsEqual;
  }
  hashCode() {
    return combinedHash([
      this.#id.hashCode(),
      hashOfNullable(this.#assert, (value) => hashOfString(canonicalStringify(value)))
    ]);
  }
}
// src/requirements/domain/intermediate-representation-background-declarations.ts
class IntermediateRepresentationBackgroundDeclarations extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-intermediate-representation-background-declarations");
  }
  rebuild(values) {
    return new IntermediateRepresentationBackgroundDeclarations(values);
  }
  map(transform) {
    return this.mapTo(transform, IntermediateRepresentationBackgroundDeclarations.of);
  }
  combine(other) {
    return this.combineTo(other, IntermediateRepresentationBackgroundDeclarations.of);
  }
  static parse(values) {
    return parseConstruction(() => new IntermediateRepresentationBackgroundDeclarations(values));
  }
  static of(values) {
    return new IntermediateRepresentationBackgroundDeclarations(values);
  }
  add(value) {
    return new IntermediateRepresentationBackgroundDeclarations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  diagnosticStrings(catalog, seenIds) {
    const errors = [];
    for (const declaration of this.#values) {
      const id = declaration.id().asString();
      if (seenIds.has(id))
        errors.push(`background ${id}: duplicate id "${id}"`);
      seenIds.add(id);
      if (catalog !== null)
        errors.push(...declaration.diagnosticStrings(catalog));
    }
    return errors;
  }
  toArray() {
    return this.#values;
  }
}
// src/requirements/domain/intermediate-representation-entity-declaration.ts
class IntermediateRepresentationEntityDeclaration {
  #name;
  #attributes;
  constructor(props) {
    this.#name = props.name;
    this.#attributes = props.attributes;
  }
  static of(props) {
    return new IntermediateRepresentationEntityDeclaration(props);
  }
  name() {
    return this.#name;
  }
  equals(other) {
    return this.#name.equals(other.#name) && this.#attributes.equals(other.#attributes);
  }
  hashCode() {
    return combinedHash([this.#name.hashCode(), this.#attributes.hashCode()]);
  }
  attributes() {
    return this.#attributes;
  }
  inspectAttributes(visitor) {
    this.#attributes.inspectInDeclarationOrder((attribute, duplicated) => {
      visitor(`${this.#name.asString()}.${attribute.name().asString()}`, attribute, duplicated);
    });
  }
}
// src/requirements/domain/intermediate-representation-entity-declarations.ts
class IntermediateRepresentationEntityDeclarations extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-intermediate-representation-entity-declarations");
  }
  rebuild(values) {
    return new IntermediateRepresentationEntityDeclarations(values);
  }
  map(transform) {
    return this.mapTo(transform, IntermediateRepresentationEntityDeclarations.of);
  }
  combine(other) {
    return this.combineTo(other, IntermediateRepresentationEntityDeclarations.of);
  }
  static parse(values) {
    return parseConstruction(() => new IntermediateRepresentationEntityDeclarations(values));
  }
  static of(values) {
    return new IntermediateRepresentationEntityDeclarations(values);
  }
  add(value) {
    return new IntermediateRepresentationEntityDeclarations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  #inspect(entityFound, attributeFound) {
    const names = new Set;
    for (const entity of this.#values) {
      const name = entity.name().asString();
      entityFound(entity, names.has(name));
      names.add(name);
      entity.inspectAttributes(attributeFound);
    }
  }
  hasAmbiguousAttributes() {
    let ambiguous = false;
    this.#inspect((_entity, duplicate) => {
      ambiguous ||= duplicate;
    }, (_path, _attribute, duplicate) => {
      ambiguous ||= duplicate;
    });
    return ambiguous;
  }
  diagnostics() {
    return ErrorMessages.collect(this.diagnosticStrings().map(ErrorMessage.parse));
  }
  diagnosticStrings() {
    const messages = [];
    this.#inspect((entity, duplicate) => {
      if (duplicate)
        messages.push(`schema: duplicate entity "${entity.name().asString()}"`);
    }, (coordinate, attribute, duplicate) => {
      if (duplicate)
        messages.push(`schema: duplicate attribute "${coordinate}"`);
      if (attribute.boundsInverted())
        messages.push(`schema: ${coordinate}: min > max`);
      if (attribute.boundsOutsideSafeRange())
        messages.push(`schema: ${coordinate}: bounds must be safe integers`);
    });
    return messages;
  }
  toArray() {
    return this.#values;
  }
}
// src/requirements/domain/intermediate-representation-entity-name.ts
class IntermediateRepresentationEntityName {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "ir-entity-name-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-ir-decl-token", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new IntermediateRepresentationEntityName(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new IntermediateRepresentationEntityName(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/requirements/domain/intermediate-representation-model-declaration.ts
class IntermediateRepresentationModelDeclaration {
  #entities;
  #obligations;
  #scenarios;
  #background;
  constructor(seed) {
    this.#entities = seed.entities;
    this.#obligations = seed.obligations;
    this.#scenarios = seed.scenarios;
    this.#background = seed.background;
  }
  static of(seed) {
    return new IntermediateRepresentationModelDeclaration(seed);
  }
  diagnostics() {
    return ErrorMessages.collect(this.diagnosticStrings().map(ErrorMessage.parse));
  }
  diagnosticStrings() {
    const errors = [...this.#entities.diagnosticStrings()];
    const parsed = IntermediateRepresentationAttributeCatalog.parse(this.#entities);
    const catalog = parsed.ok ? parsed.value : null;
    if (!parsed.ok && parsed.error.kind !== "ambiguous-requirement-attributes")
      errors.push(`schema: attribute catalog: ${parsed.error.kind}`);
    if (catalog !== null)
      errors.push(...catalog.diagnosticStrings());
    const seenIds = new Set;
    errors.push(...this.#obligations.diagnosticStrings(catalog, seenIds));
    errors.push(...this.#scenarios.diagnosticStrings(catalog, seenIds));
    errors.push(...this.#background.diagnosticStrings(catalog, seenIds));
    return errors;
  }
}
// src/requirements/domain/intermediate-representation-obligation-declaration.ts
class IntermediateRepresentationObligationDeclaration {
  #id;
  #assert;
  #guard;
  #effect;
  #temporal;
  constructor(props) {
    this.#id = props.id;
    this.#assert = props.assert === undefined ? undefined : ExpressionTree.of(props.assert).asExpression();
    this.#guard = props.guard === undefined ? undefined : ExpressionTree.of(props.guard).asExpression();
    this.#effect = props.effect === undefined ? undefined : ExpressionTree.of(props.effect).asExpression();
    this.#temporal = props.temporal;
  }
  static parse(props) {
    return parseConstruction(() => new IntermediateRepresentationObligationDeclaration(props));
  }
  static of(props) {
    return new IntermediateRepresentationObligationDeclaration(props);
  }
  diagnostics(catalog) {
    return ErrorMessages.collect(this.diagnosticStrings(catalog).map(ErrorMessage.parse));
  }
  diagnosticStrings(catalog) {
    const context = `obligation ${this.#id.asString()}`;
    const errors = [];
    this.#inspectExpressions((expression, primesAllowed) => {
      errors.push(...catalog.expressionDiagnosticStrings(expression, context, primesAllowed));
    });
    return errors;
  }
  id() {
    return this.#id;
  }
  equals(other) {
    const expressionEqual = (left, right) => left === undefined ? right === undefined : right !== undefined && ExpressionTree.of(left).isCanonicallyEqual(ExpressionTree.of(right));
    return this.#id.equals(other.#id) && expressionEqual(this.#assert, other.#assert) && expressionEqual(this.#guard, other.#guard) && expressionEqual(this.#effect, other.#effect) && (this.#temporal === undefined ? other.#temporal === undefined : other.#temporal !== undefined && this.#temporal.equals(other.#temporal));
  }
  hashCode() {
    const expressionHash = (expression) => hashOfNullable(expression, (value) => hashOfString(canonicalStringify(value)));
    return combinedHash([
      this.#id.hashCode(),
      expressionHash(this.#assert),
      expressionHash(this.#guard),
      expressionHash(this.#effect),
      hashOfNullable(this.#temporal, (temporal) => temporal.hashCode())
    ]);
  }
  #inspectExpressions(visitor) {
    if (this.#assert !== undefined)
      visitor(this.#assert, false);
    if (this.#guard !== undefined)
      visitor(this.#guard, false);
    if (this.#effect !== undefined)
      visitor(this.#effect, true);
    this.#temporal?.inspectExpressions(visitor);
  }
}
// src/requirements/domain/intermediate-representation-obligation-declarations.ts
class IntermediateRepresentationObligationDeclarations extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-intermediate-representation-obligation-declarations");
  }
  rebuild(values) {
    return new IntermediateRepresentationObligationDeclarations(values);
  }
  map(transform) {
    return this.mapTo(transform, IntermediateRepresentationObligationDeclarations.of);
  }
  combine(other) {
    return this.combineTo(other, IntermediateRepresentationObligationDeclarations.of);
  }
  static parse(values) {
    return parseConstruction(() => new IntermediateRepresentationObligationDeclarations(values));
  }
  static of(values) {
    return new IntermediateRepresentationObligationDeclarations(values);
  }
  add(value) {
    return new IntermediateRepresentationObligationDeclarations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  diagnosticStrings(catalog, seenIds) {
    const errors = [];
    for (const declaration of this.#values) {
      const id = declaration.id().asString();
      if (seenIds.has(id))
        errors.push(`obligation ${id}: duplicate id "${id}"`);
      seenIds.add(id);
      if (catalog !== null)
        errors.push(...declaration.diagnosticStrings(catalog));
    }
    return errors;
  }
  toArray() {
    return this.#values;
  }
}
// src/requirements/domain/intermediate-representation-scenario-declaration.ts
class IntermediateRepresentationScenarioDeclaration {
  #id;
  #bindings;
  #hasEvent;
  #expect;
  constructor(props) {
    this.#id = props.id;
    this.#bindings = props.bindings;
    this.#hasEvent = props.hasEvent;
    this.#expect = props.expect === undefined ? undefined : ExpressionTree.of(props.expect).asExpression();
  }
  static parse(props) {
    return parseConstruction(() => new IntermediateRepresentationScenarioDeclaration(props));
  }
  static of(props) {
    return new IntermediateRepresentationScenarioDeclaration(props);
  }
  diagnostics(catalog) {
    return ErrorMessages.collect(this.diagnosticStrings(catalog).map(ErrorMessage.parse));
  }
  diagnosticStrings(catalog) {
    const context = `scenario ${this.#id.asString()}`;
    const errors = [...catalog.bindingDiagnosticStrings(this.#bindings, context)];
    const expectation = this.#expect;
    if (expectation !== undefined)
      errors.push(...catalog.expressionDiagnosticStrings(expectation, context, this.#hasEvent));
    return errors;
  }
  id() {
    return this.#id;
  }
  equals(other) {
    const expressionEqual = this.#expect === undefined ? other.#expect === undefined : other.#expect !== undefined && ExpressionTree.of(this.#expect).isCanonicallyEqual(ExpressionTree.of(other.#expect));
    return this.#id.equals(other.#id) && this.#hasEvent === other.#hasEvent && this.#bindings.matchesVerbatim(other.#bindings) && expressionEqual;
  }
  hashCode() {
    return combinedHash([
      this.#id.hashCode(),
      hashOfBoolean(this.#hasEvent),
      this.#bindings.verbatimHashCode(),
      hashOfNullable(this.#expect, (expr) => hashOfString(canonicalStringify(expr)))
    ]);
  }
}
// src/requirements/domain/intermediate-representation-scenario-declarations.ts
class IntermediateRepresentationScenarioDeclarations extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-intermediate-representation-scenario-declarations");
  }
  rebuild(values) {
    return new IntermediateRepresentationScenarioDeclarations(values);
  }
  static of(values) {
    return new IntermediateRepresentationScenarioDeclarations(values);
  }
  map(transform) {
    return this.mapTo(transform, IntermediateRepresentationScenarioDeclarations.of);
  }
  combine(other) {
    return this.combineTo(other, IntermediateRepresentationScenarioDeclarations.of);
  }
  static parse(values) {
    return parseConstruction(() => new IntermediateRepresentationScenarioDeclarations(values));
  }
  add(value) {
    return new IntermediateRepresentationScenarioDeclarations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  diagnosticStrings(catalog, seenIds) {
    const errors = [];
    for (const declaration of this.#values) {
      const id = declaration.id().asString();
      if (seenIds.has(id))
        errors.push(`scenario ${id}: duplicate id "${id}"`);
      seenIds.add(id);
      if (catalog !== null)
        errors.push(...declaration.diagnosticStrings(catalog));
    }
    return errors;
  }
  toArray() {
    return this.#values;
  }
}
// src/requirements/domain/intermediate-representation-temporal-declaration.ts
class IntermediateRepresentationTemporalDeclaration {
  #assert;
  #from;
  #to;
  constructor(props) {
    this.#assert = props.assert === undefined ? undefined : ExpressionTree.of(props.assert).asExpression();
    this.#from = props.from === undefined ? undefined : ExpressionTree.of(props.from).asExpression();
    this.#to = props.to === undefined ? undefined : ExpressionTree.of(props.to).asExpression();
  }
  static parse(props) {
    return parseConstruction(() => new IntermediateRepresentationTemporalDeclaration(props));
  }
  static of(props) {
    return new IntermediateRepresentationTemporalDeclaration(props);
  }
  equals(other) {
    const expressionEqual = (left, right) => left === undefined ? right === undefined : right !== undefined && ExpressionTree.of(left).isCanonicallyEqual(ExpressionTree.of(right));
    return expressionEqual(this.#assert, other.#assert) && expressionEqual(this.#from, other.#from) && expressionEqual(this.#to, other.#to);
  }
  hashCode() {
    const expressionHash = (expression) => hashOfNullable(expression, (value) => hashOfString(canonicalStringify(value)));
    return combinedHash([expressionHash(this.#assert), expressionHash(this.#from), expressionHash(this.#to)]);
  }
  inspectExpressions(visitor) {
    if (this.#assert !== undefined)
      visitor(this.#assert, false);
    if (this.#from !== undefined)
      visitor(this.#from, false);
    if (this.#to !== undefined)
      visitor(this.#to, false);
  }
}
// src/requirements/domain/source-anchor.ts
class SourceAnchor {
  #declared;
  #actual;
  constructor(declared, actual) {
    this.#declared = declared;
    this.#actual = actual;
  }
  static of(declared, actual) {
    return new SourceAnchor(declared, actual);
  }
  errors() {
    if (this.#declared === null) {
      return [
        `IR has no sourceDigest \u2014 requirements drift would be undetectable; add "sourceDigest": "${this.#actual.asString()}" (sha256 of requirements.md) to the IR`
      ];
    }
    if (!this.#declared.matches(this.#actual)) {
      return [
        `sourceDigest ${this.#declared.asString()} does not match requirements.md (sha256 ${this.#actual.asString()}) \u2014 the requirements changed since formalization; re-formalize against the current text and restamp the digest`
      ];
    }
    return [];
  }
}

// src/requirements/domain/requirements-source-validation.ts
class RequirementsSourceValidation {
  #view;
  #references;
  #declaredDigest;
  constructor(view, references, declaredDigest) {
    this.#view = view;
    this.#references = references;
    this.#declaredDigest = declaredDigest;
  }
  static of(view, references, declaredDigest) {
    return new RequirementsSourceValidation(view, references, declaredDigest);
  }
  assess(source) {
    return ValidationAssessment.of(ErrorMessages.collect(this.#diagnostics(source)));
  }
  *#diagnostics(source) {
    for (const message of this.#view.diagnosticStrings())
      yield ErrorMessage.parse(message);
    if (source === null) {
      yield ErrorMessage.parse("requirements.md not found under this intent record \u2014 frRefs cannot be reverse-verified");
    } else {
      for (const message of this.#references.missingErrors(source.knownIds()))
        yield ErrorMessage.parse(message);
      for (const message of SourceAnchor.of(this.#declaredDigest, source.digest()).errors())
        yield ErrorMessage.parse(message);
    }
  }
}

// src/requirements/domain/verification-findings.ts
function sortVerificationFindings(findings) {
  return [...findings].sort((a, b) => a.compareTo(b));
}

class VerificationFindings extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-verification-findings");
  }
  rebuild(values) {
    return new VerificationFindings(values);
  }
  map(transform) {
    return this.mapTo(transform, VerificationFindings.of);
  }
  combine(other) {
    return this.combineTo(other, VerificationFindings.of);
  }
  static parse(values) {
    return parseConstruction(() => new VerificationFindings(values));
  }
  static of(values) {
    return new VerificationFindings(values);
  }
  add(value) {
    return new VerificationFindings([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  sortedCanonically() {
    return new VerificationFindings(sortVerificationFindings(this.#values));
  }
  count() {
    return this.#values.length;
  }
  distinctConflicts() {
    const seen = new Set;
    return new VerificationFindings(this.#values.filter((finding) => {
      if (!finding.isConflict())
        return true;
      const key = finding.targets().joined(",");
      if (seen.has(key))
        return false;
      seen.add(key);
      return true;
    }));
  }
  toDocuments() {
    return this.#values.map((finding) => {
      const out = {
        kind: finding.kind(),
        frRefs: finding.functionalRequirementReferences().toStrings(),
        targets: finding.targets().toStrings(),
        witness: finding.witness().toDocument(),
        detail: finding.detail()
      };
      return out;
    });
  }
  toArray() {
    return this.#values;
  }
}

// src/requirements/domain/verification-skipped.ts
class VerificationSkipped {
  #target;
  #reason;
  #detail;
  constructor(props) {
    this.#target = props.target;
    this.#reason = props.reason;
    this.#detail = props.detail;
  }
  static of(props) {
    return new VerificationSkipped(props);
  }
  target() {
    return this.#target;
  }
  reason() {
    return this.#reason.asString();
  }
  detail() {
    return this.#detail;
  }
  equals(other) {
    return this.#target.equals(other.#target) && this.#reason.asString() === other.#reason.asString() && this.#detail === other.#detail;
  }
  hashCode() {
    return combinedHash([
      this.#target.hashCode(),
      hashOfString(this.#reason.asString()),
      hashOfNullable(this.#detail, hashOfString)
    ]);
  }
  isFor(target) {
    return this.#target.equals(target);
  }
  compareTo(other) {
    const c = this.#target.compareTo(other.#target);
    if (c !== 0)
      return c;
    return this.#reason.compareTo(other.#reason);
  }
}

// src/requirements/domain/verification-skips.ts
function sortVerificationSkipped(skipped) {
  return [...skipped].sort((a, b) => a.compareTo(b));
}

class VerificationSkips extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-verification-skips");
  }
  rebuild(values) {
    return new VerificationSkips(values);
  }
  map(transform) {
    return this.mapTo(transform, VerificationSkips.of);
  }
  combine(other) {
    return this.combineTo(other, VerificationSkips.of);
  }
  static parse(values) {
    return parseConstruction(() => new VerificationSkips(values));
  }
  static of(values) {
    return new VerificationSkips(values);
  }
  static coveringAll(targets, reason, detail) {
    return new VerificationSkips([...targets].map((target) => VerificationSkipped.of({ target, reason, detail })));
  }
  add(value) {
    return new VerificationSkips([...this.#values, value]);
  }
  concat(other) {
    return new VerificationSkips([...this.#values, ...other.#values]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  sortedCanonically() {
    return new VerificationSkips(sortVerificationSkipped(this.#values));
  }
  count() {
    return this.#values.length;
  }
  toDocuments() {
    return this.#values.map((skipped) => {
      const out = { target: skipped.target().asString(), reason: skipped.reason() };
      const detail = skipped.detail();
      if (detail !== undefined)
        out.detail = detail;
      return out;
    });
  }
  toArray() {
    return this.#values;
  }
}

// src/requirements/domain/verification-report.ts
var SUPPORTED_IR_MAJOR = 1;

class VerificationReport {
  #id;
  #irVersion;
  #irHash;
  #method;
  #findings;
  #skipped;
  #crossChecked;
  #unavailableReason;
  constructor(seed) {
    this.#id = seed.id;
    this.#irVersion = seed.irVersion;
    this.#irHash = seed.irHash;
    this.#method = seed.method;
    this.#findings = seed.findings;
    this.#skipped = seed.skipped;
    this.#crossChecked = seed.crossChecked;
    this.#unavailableReason = seed.unavailableReason;
  }
  static irUnreadable(id, method, cause) {
    return VerificationReport.compose({
      id,
      irVersion: IntermediateRepresentationVersion.of("0.0.0"),
      irHash: ContentHash.ofText(""),
      method,
      findings: VerificationFindings.of([]),
      skipped: VerificationSkips.of([]),
      unavailableReason: `IR unreadable: ${cause} \u2014 see the deep-spec-ir-valid sensor for details`
    });
  }
  static versionMismatch(id, model, method) {
    return VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash: model.irHash(),
      method,
      findings: VerificationFindings.of([]),
      skipped: VerificationSkips.coveringAll(model.allTargets(), SkipReason.of("ir-version-mismatch"), `IR major version ${model.majorVersion()} is not supported by this backend (supports ${SUPPORTED_IR_MAJOR}.x.x)`)
    });
  }
  static solverUnavailable(id, model, planSkipped, reason) {
    return VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash: model.irHash(),
      method: "exhaustive",
      findings: VerificationFindings.of([]),
      skipped: planSkipped.combine(VerificationSkips.coveringAll(model.allTargets().filter((t) => !planSkipped.exists((s) => s.isFor(t))), SkipReason.of("unavailable"), "z3 could not be executed")),
      unavailableReason: reason
    });
  }
  static quintUnavailable(id, model) {
    return VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash: model.irHash(),
      method: "simulation",
      findings: VerificationFindings.of([]),
      skipped: VerificationSkips.coveringAll(model.allTargets(), SkipReason.of("unavailable"), "quint CLI missing"),
      unavailableReason: "quint CLI is not available (install: npm i -g @informalsystems/quint)"
    });
  }
  static quintBackendUnavailable(id, model, reason) {
    const detail = `quint backend unavailable: ${reason.asString()}`;
    return VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash: model.irHash(),
      method: "simulation",
      findings: VerificationFindings.of([]),
      skipped: VerificationSkips.coveringAll(model.allTargets(), SkipReason.of("unavailable"), detail),
      unavailableReason: detail
    });
  }
  static machineUncompilable(id, model, method, machineError) {
    return VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash: model.irHash(),
      method,
      findings: VerificationFindings.of([]),
      skipped: VerificationSkips.coveringAll(model.allTargets(), SkipReason.of("compile-error"), machineError)
    });
  }
  static compose(input) {
    return VerificationReport.of({
      id: input.id,
      irVersion: input.irVersion,
      irHash: input.irHash,
      method: VerificationMethod.of(input.method),
      findings: input.findings.sortedCanonically(),
      skipped: input.skipped.sortedCanonically(),
      crossChecked: input.crossChecked ?? null,
      unavailableReason: input.unavailableReason ?? null
    });
  }
  static interpretationUnavailable(id, model, method, error) {
    return VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash: model.irHash(),
      method: method.asString(),
      findings: VerificationFindings.of([]),
      skipped: VerificationSkips.of([]),
      unavailableReason: `verification evidence could not be represented: ${JSON.stringify(error)}`
    });
  }
  static of(seed) {
    return new VerificationReport(seed);
  }
  degraded(reason) {
    return new VerificationReport({
      id: this.#id,
      irVersion: this.#irVersion,
      irHash: this.#irHash,
      method: this.#method,
      findings: VerificationFindings.of([]),
      skipped: VerificationSkips.of([]),
      crossChecked: null,
      unavailableReason: reason
    });
  }
  scenarioVerdictFor(target, irHash) {
    const backend = this.#id.backendName();
    if (!this.#irHash.equals(irHash) || this.isUnavailable())
      return ScenarioVerdict.unavailable(backend, this.#irHash, target, null);
    if (this.#skipped.exists((skip) => skip.isFor(target)))
      return ScenarioVerdict.skipped(backend, this.#irHash, target, null);
    if (this.#findings.exists((finding) => finding.isKind("scenario-violation") && finding.implicates(target)))
      return ScenarioVerdict.violated(backend, this.#irHash, target, null);
    return ScenarioVerdict.clean(backend, this.#irHash, target, null);
  }
  id() {
    return this.#id;
  }
  irVersion() {
    return this.#irVersion;
  }
  irHash() {
    return this.#irHash;
  }
  method() {
    return this.#method.asString();
  }
  findings() {
    return this.#findings;
  }
  skipped() {
    return this.#skipped;
  }
  crossChecked() {
    return this.#crossChecked;
  }
  equals(other) {
    const crossCheckedEqual = this.#crossChecked === null ? other.#crossChecked === null : other.#crossChecked !== null && this.#crossChecked.equals(other.#crossChecked);
    return this.#id.equals(other.#id) && this.#irVersion.equals(other.#irVersion) && this.#irHash.equals(other.#irHash) && this.#method.equals(other.#method) && this.#findings.equals(other.#findings) && this.#skipped.equals(other.#skipped) && crossCheckedEqual && this.#unavailableReason === other.#unavailableReason;
  }
  hashCode() {
    return combinedHash([
      this.#id.hashCode(),
      this.#irVersion.hashCode(),
      this.#irHash.hashCode(),
      this.#method.hashCode(),
      this.#findings.hashCode(),
      this.#skipped.hashCode(),
      hashOfNullable(this.#crossChecked, (entries) => entries.hashCode()),
      hashOfNullable(this.#unavailableReason, hashOfString)
    ]);
  }
  unavailableReason() {
    return this.#unavailableReason;
  }
  isUnavailable() {
    return this.#unavailableReason !== null;
  }
  passes() {
    return !this.isUnavailable() && this.#findings.isEmpty();
  }
  findingsCount() {
    return this.#findings.count();
  }
  skippedCount() {
    return this.#skipped.count();
  }
  toDocument() {
    const ordered = {
      backend: this.#id.backendName().asString(),
      irVersion: this.#irVersion.asString(),
      irHash: this.#irHash.asString(),
      method: this.method()
    };
    const reason = this.#unavailableReason;
    if (reason !== null)
      ordered.unavailable = { reason };
    ordered.findings = this.#findings.toDocuments();
    ordered.skipped = this.#skipped.toDocuments();
    const crossChecked = this.#crossChecked;
    if (crossChecked !== null)
      ordered.crossChecked = crossChecked.toDocuments();
    return ordered;
  }
  conformedTo(schema) {
    const reason = schema.degradationReasonFor(this.toDocument());
    return reason === null ? this : this.degraded(reason);
  }
}

// src/requirements/domain/intermediate-representation-validation-materials.ts
class IntermediateRepresentationValidationMaterials {
  #id;
  #irVersion;
  #schemaErrors;
  #view;
  #functionalRequirementReferenceClaims;
  #declaredDigest;
  #sourceId;
  #sourceDocument;
  constructor(seed) {
    this.#id = seed.id;
    this.#irVersion = seed.irVersion;
    this.#schemaErrors = seed.schemaErrors;
    this.#view = seed.view;
    this.#functionalRequirementReferenceClaims = seed.functionalRequirementReferenceClaims;
    this.#declaredDigest = seed.declaredDigest;
    this.#sourceId = seed.sourceId;
    this.#sourceDocument = new Uint8Array(seed.sourceDocument);
  }
  static of(seed) {
    return new IntermediateRepresentationValidationMaterials(seed);
  }
  validate(cases) {
    const errors = ErrorMessages.collect(this.#initialDiagnostics());
    if (!errors.isEmpty())
      return cases.complete(ValidationAssessment.of(errors));
    const references = FunctionalRequirementReferenceIndex.parseClaims(this.#functionalRequirementReferenceClaims);
    if (!references.ok)
      return cases.complete(ValidationAssessment.of(ErrorMessages.collect([
        ErrorMessage.parse(`functional requirement reference index is unusable: ${references.error.kind}`)
      ])));
    return cases.sourceRequired(this.#sourceId, RequirementsSourceValidation.of(this.#view, references.value, this.#declaredDigest));
  }
  *#initialDiagnostics() {
    if (!this.#irVersion.supportsMajor(SUPPORTED_IR_MAJOR)) {
      yield ErrorMessage.parse(`irVersion ${this.#irVersion.asString()}: unsupported major version (this validator supports ${SUPPORTED_IR_MAJOR}.x.x)`);
    }
    yield* this.#schemaErrors.asDiagnostics();
  }
  id() {
    return this.#id;
  }
  sourceDocument() {
    return new Uint8Array(this.#sourceDocument);
  }
}
// src/requirements/domain/intermediate-representation-validation-materials-identifier.ts
class IntermediateRepresentationValidationMaterialsIdentifier {
  #model;
  constructor(model) {
    this.#model = model;
  }
  static of(model) {
    return new IntermediateRepresentationValidationMaterialsIdentifier(model);
  }
  equals(other) {
    return this.#model.equals(other.#model);
  }
  hashCode() {
    return this.#model.hashCode();
  }
  modelId() {
    return this.#model;
  }
}
// src/requirements/domain/verification-finding.ts
class VerificationFinding {
  #kind;
  #functionalRequirementReferences;
  #targets;
  #witness;
  #detail;
  constructor(props) {
    this.#kind = props.kind;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#targets = props.targets;
    this.#witness = props.witness;
    this.#detail = props.detail;
  }
  static of(props) {
    return new VerificationFinding(props);
  }
  isConflict() {
    return this.#kind.asString() === "conflict";
  }
  kind() {
    return this.#kind.asString();
  }
  functionalRequirementReferences() {
    return this.#functionalRequirementReferences;
  }
  targets() {
    return this.#targets;
  }
  witness() {
    return this.#witness;
  }
  detail() {
    return this.#detail;
  }
  equals(other) {
    return this.#kind.equals(other.#kind) && this.#functionalRequirementReferences.equals(other.#functionalRequirementReferences) && this.#targets.equals(other.#targets) && this.#witness.equals(other.#witness) && this.#detail === other.#detail;
  }
  hashCode() {
    return combinedHash([
      this.#kind.hashCode(),
      this.#functionalRequirementReferences.hashCode(),
      this.#targets.hashCode(),
      this.#witness.hashCode(),
      hashOfString(this.#detail)
    ]);
  }
  isKind(kind) {
    const parsed = FindingKind.parse(kind);
    return parsed.ok && this.#kind.equals(parsed.value);
  }
  implicates(target) {
    return this.#targets.include(target);
  }
  compareTo(other) {
    const kr = this.#kind.compareTo(other.#kind);
    if (kr !== 0)
      return kr;
    const ta = this.#targets.joined(",");
    const tb = other.#targets.joined(",");
    if (ta !== tb)
      return ta < tb ? -1 : 1;
    return this.#detail < other.#detail ? -1 : this.#detail > other.#detail ? 1 : 0;
  }
}

// src/requirements/domain/obligation.ts
class Obligation {
  #id;
  #nature;
  #functionalRequirementReferences;
  #ears;
  #assert;
  #trigger;
  #guard;
  #effect;
  #temporal;
  constructor(props) {
    this.#id = props.id;
    this.#nature = props.nature;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#ears = props.ears;
    this.#assert = props.assert === undefined ? undefined : ExpressionTree.of(props.assert).asExpression();
    this.#trigger = props.trigger;
    this.#guard = props.guard === undefined ? undefined : ExpressionTree.of(props.guard).asExpression();
    this.#effect = props.effect === undefined ? undefined : ExpressionTree.of(props.effect).asExpression();
    this.#temporal = props.temporal === undefined ? undefined : {
      ...props.temporal,
      ...props.temporal.assert !== undefined ? { assert: ExpressionTree.of(props.temporal.assert).asExpression() } : {},
      ...props.temporal.from !== undefined ? { from: ExpressionTree.of(props.temporal.from).asExpression() } : {},
      ...props.temporal.to !== undefined ? { to: ExpressionTree.of(props.temporal.to).asExpression() } : {}
    };
  }
  static parse(props) {
    return parseConstruction(() => new Obligation(props));
  }
  static of(props) {
    return new Obligation(props);
  }
  interpretQuintTemporal(method, verdict) {
    if (!this.isStateTemporal() || this.#temporal?.pattern !== "leads-to")
      return ok({ findings: VerificationFindings.of([]), skipped: VerificationSkips.of([]) });
    const target = this.#id.asTargetId();
    let skip = null;
    if (!method.isBounded())
      skip = VerificationSkipped.of({
        target,
        reason: SkipReason.capability(),
        detail: "leads-to temporal properties require bounded mode (quint verify with Apalache); simulation cannot decide them"
      });
    else if (verdict === undefined)
      skip = VerificationSkipped.of({
        target,
        reason: SkipReason.unavailable(),
        detail: "quint returned no run for this temporal obligation"
      });
    else
      skip = verdict.skipFor(target);
    if (skip !== null)
      return ok({ findings: VerificationFindings.of([]), skipped: VerificationSkips.of([skip]) });
    const finding = verdict?.isViolation() ? VerificationFinding.of({
      kind: FindingKind.conflict(),
      functionalRequirementReferences: this.#functionalRequirementReferences.sortedUnique(),
      targets: FindingTargets.of(target, []),
      witness: verdict.witness(),
      detail: `Temporal obligation ${this.#id.asString()} (leads-to) is violated: the attached trace reaches the "from" condition but never the "to" condition.`
    }) : null;
    return ok({
      findings: VerificationFindings.of(finding === null ? [] : [finding]),
      skipped: VerificationSkips.of([])
    });
  }
  id() {
    return this.#id;
  }
  equals(other) {
    const expressionEqual = (left, right) => left === undefined ? right === undefined : right !== undefined && ExpressionTree.of(left).isCanonicallyEqual(ExpressionTree.of(right));
    const temporalEqual = (left, right) => {
      if (left === undefined || right === undefined)
        return left === right;
      return left.pattern === right.pattern && expressionEqual(left.assert, right.assert) && expressionEqual(left.from, right.from) && expressionEqual(left.to, right.to);
    };
    return this.#id.equals(other.#id) && this.#nature.equals(other.#nature) && this.#functionalRequirementReferences.equals(other.#functionalRequirementReferences) && this.#ears === other.#ears && expressionEqual(this.#assert, other.#assert) && (this.#trigger === undefined ? other.#trigger === undefined : other.#trigger !== undefined && this.#trigger.equals(other.#trigger)) && expressionEqual(this.#guard, other.#guard) && expressionEqual(this.#effect, other.#effect) && temporalEqual(this.#temporal, other.#temporal);
  }
  hashCode() {
    const expressionHash = (expression) => hashOfNullable(expression, (value) => hashOfString(canonicalStringify(value)));
    const temporalHash = hashOfNullable(this.#temporal, (temporal) => combinedHash([
      hashOfString(temporal.pattern),
      expressionHash(temporal.assert),
      expressionHash(temporal.from),
      expressionHash(temporal.to)
    ]));
    return combinedHash([
      this.#id.hashCode(),
      this.#nature.hashCode(),
      this.#functionalRequirementReferences.hashCode(),
      hashOfNullable(this.#ears, hashOfString),
      expressionHash(this.#assert),
      hashOfNullable(this.#trigger, (trigger) => trigger.hashCode()),
      expressionHash(this.#guard),
      expressionHash(this.#effect),
      temporalHash
    ]);
  }
  nature() {
    return this.#nature;
  }
  functionalRequirementReferences() {
    return this.#functionalRequirementReferences;
  }
  ears() {
    return this.#ears;
  }
  assertion() {
    return this.#assert;
  }
  trigger() {
    return this.#trigger;
  }
  guard() {
    return this.#guard;
  }
  effect() {
    return this.#effect;
  }
  temporal() {
    return this.#temporal === undefined ? undefined : { ...this.#temporal };
  }
  isInvariantLike() {
    return this.#nature.isInvariant() || this.#nature.isNumeric();
  }
  isEvent() {
    return this.#nature.isEvent();
  }
  isStateTemporal() {
    return this.#nature.isStateTemporal();
  }
  eventDefinition() {
    if (!this.isEvent() || this.#trigger === undefined || this.#guard === undefined || this.#effect === undefined)
      return null;
    return { trigger: this.#trigger, guard: this.#guard, effect: this.#effect };
  }
  vacuityAntecedent() {
    return this.#assert?.op === "implies" ? this.#assert.args?.[0] : undefined;
  }
  inspectExpressions(visitor) {
    if (this.#assert !== undefined)
      visitor(this.#assert, false);
    if (this.#guard !== undefined)
      visitor(this.#guard, false);
    if (this.#effect !== undefined)
      visitor(this.#effect, true);
    if (this.#temporal?.assert !== undefined)
      visitor(this.#temporal.assert, false);
    if (this.#temporal?.from !== undefined)
      visitor(this.#temporal.from, false);
    if (this.#temporal?.to !== undefined)
      visitor(this.#temporal.to, false);
  }
}
// src/requirements/domain/obligation-identifier.ts
class ObligationIdentifier {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "obligation-id-too-long", raw: raw.length });
    if (!/^OB-[0-9]+$/.test(raw))
      throw new IllegalArgumentException({ kind: "malformed-obligation-id", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new ObligationIdentifier(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new ObligationIdentifier(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  compareTo(other) {
    return compareCanonically(this.#value, other.#value);
  }
  asString() {
    return this.#value;
  }
  asTargetId() {
    return TargetIdentifier.of(this.#value);
  }
}
// src/requirements/domain/obligation-identifiers.ts
class ObligationIdentifiers extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-obligation-identifiers");
  }
  rebuild(values) {
    return new ObligationIdentifiers(values);
  }
  map(transform) {
    return this.mapTo(transform, ObligationIdentifiers.of);
  }
  combine(other) {
    return this.combineTo(other, ObligationIdentifiers.of);
  }
  static parse(values) {
    return parseConstruction(() => new ObligationIdentifiers(values));
  }
  static of(values) {
    return new ObligationIdentifiers(values);
  }
  add(value) {
    return new ObligationIdentifiers([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toStrings() {
    return this.#values.map((v) => v.asString());
  }
  toTargetIds() {
    return TargetIdentifiers.of(this.#values.map((v) => v.asTargetId()));
  }
}
// src/requirements/domain/obligations.ts
class Obligations extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-obligations");
  }
  rebuild(values) {
    return new Obligations(values);
  }
  map(transform) {
    return this.mapTo(transform, Obligations.of);
  }
  combine(other) {
    return this.combineTo(other, Obligations.of);
  }
  static parse(values) {
    return parseConstruction(() => new Obligations(values));
  }
  static of(values) {
    return new Obligations(values);
  }
  add(value) {
    return new Obligations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  interpretQuintTemporal(method, runs, skipped) {
    let findings = VerificationFindings.of([]);
    let accumulated = skipped;
    for (const obligation of this.#values) {
      const target = obligation.id().asTargetId();
      if (accumulated.exists((skip) => skip.isFor(target)))
        continue;
      const temporal = obligation.interpretQuintTemporal(method, runs.temporalOf(obligation.id()));
      if (!temporal.ok)
        return temporal;
      findings = findings.combine(temporal.value.findings);
      accumulated = accumulated.combine(temporal.value.skipped);
    }
    return ok({ findings, skipped: accumulated });
  }
  compiledInvariantTargets(compiled) {
    return TargetIdentifiers.of(this.#values.filter((obligation) => obligation.isInvariantLike() && compiled.has(obligation.id())).map((obligation) => obligation.id().asTargetId()));
  }
  byId(id) {
    return this.#values.find((o) => o.id().asString() === id);
  }
  ids() {
    return this.#values.map((o) => o.id().asString());
  }
  toArray() {
    return this.#values;
  }
}
// src/requirements/domain/quint-check-result.ts
class QuintCheckResult {
  #result;
  constructor(result) {
    this.#result = { ...result };
  }
  static of(result) {
    return new QuintCheckResult(result);
  }
  reportFor(model, id) {
    const result = this.#result;
    switch (result.kind) {
      case "cli-unavailable":
        return VerificationReport.quintUnavailable(id, model);
      case "backend-unavailable":
        return VerificationReport.quintBackendUnavailable(id, model, result.reason);
      case "machine-uncompilable":
        return VerificationReport.machineUncompilable(id, model, result.method.asString(), result.error.asString());
      case "checked": {
        const interpreted = result.plan.interpret(model, result.compileSkips, result.method, result.runs);
        if (!interpreted.ok)
          return VerificationReport.interpretationUnavailable(id, model, result.method, interpreted.error);
        return VerificationReport.compose({
          id,
          irVersion: model.irVersion(),
          irHash: model.irHash(),
          method: result.method.asString(),
          findings: interpreted.value.findings,
          skipped: interpreted.value.skipped
        });
      }
    }
  }
  match(cases) {
    switch (this.#result.kind) {
      case "cli-unavailable":
      case "backend-unavailable":
        return cases.unavailable();
      case "machine-uncompilable":
        return cases.uncompilable();
      case "checked":
        return cases.checked();
    }
  }
}
// src/requirements/domain/trace-value.ts
class TraceValue {
  #value;
  constructor(value) {
    this.#value = boundedValueSnapshot(value, { string: 65536, nodes: 1e5, depth: 128, total: 16777216 });
  }
  static of(value) {
    return new TraceValue(value);
  }
  static parse(value) {
    return parseConstruction(() => new TraceValue(value));
  }
  static absent() {
    return new TraceValue(null);
  }
  isTrue() {
    return this.#value === true;
  }
  asNumber() {
    return typeof this.#value === "number" ? this.#value : Number.NaN;
  }
  equals(other) {
    return JSON.stringify(this.#value) === JSON.stringify(other.#value);
  }
  hashCode() {
    return hashOfString(JSON.stringify(this.#value));
  }
  toDocument() {
    return structuredClone(this.#value);
  }
}

// src/requirements/domain/quint-machine-component.ts
function evaluate(e, state) {
  const arg = (i) => evaluate((e.args ?? [])[i], state);
  switch (e.op) {
    case "and":
      return TraceValue.of((e.args ?? []).every((a) => evaluate(a, state).isTrue()));
    case "or":
      return TraceValue.of((e.args ?? []).some((a) => evaluate(a, state).isTrue()));
    case "not":
      return TraceValue.of(!arg(0).isTrue());
    case "implies":
      return TraceValue.of(!arg(0).isTrue() || arg(1).isTrue());
    case "iff":
      return TraceValue.of(arg(0).isTrue() === arg(1).isTrue());
    case "eq":
      return TraceValue.of(arg(0).equals(arg(1)));
    case "ne":
      return TraceValue.of(!arg(0).equals(arg(1)));
    case "lt":
      return TraceValue.of(arg(0).asNumber() < arg(1).asNumber());
    case "le":
      return TraceValue.of(arg(0).asNumber() <= arg(1).asNumber());
    case "gt":
      return TraceValue.of(arg(0).asNumber() > arg(1).asNumber());
    case "ge":
      return TraceValue.of(arg(0).asNumber() >= arg(1).asNumber());
    case "add":
      return TraceValue.of(arg(0).asNumber() + arg(1).asNumber());
    case "sub":
      return TraceValue.of(arg(0).asNumber() - arg(1).asNumber());
    case "mul":
      return TraceValue.of(arg(0).asNumber() * arg(1).asNumber());
    case "ref":
      return state.valueAt(AttributePath.of(e.path ?? ""));
    case "bool":
    case "int":
    case "enum":
      return TraceValue.of(e.value ?? null);
    default:
      return TraceValue.absent();
  }
}

class QuintMachineComponent {
  #id;
  #expression;
  constructor(props) {
    this.#id = props.id;
    this.#expression = ExpressionTree.of(props.expression).asExpression();
  }
  static parse(props) {
    return parseConstruction(() => new QuintMachineComponent(props));
  }
  static of(props) {
    return new QuintMachineComponent(props);
  }
  id() {
    return this.#id;
  }
  equals(other) {
    return this.#id.equals(other.#id) && ExpressionTree.of(this.#expression).isCanonicallyEqual(ExpressionTree.of(other.#expression));
  }
  hashCode() {
    return combinedHash([this.#id.hashCode(), hashOfString(canonicalStringify(this.#expression))]);
  }
  isViolatedIn(state) {
    return !evaluate(this.#expression, state).isTrue();
  }
}
// src/requirements/domain/quint-machine-components.ts
class QuintMachineComponents extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-quint-machine-components");
  }
  rebuild(values) {
    return new QuintMachineComponents(values);
  }
  map(transform) {
    return this.mapTo(transform, QuintMachineComponents.of);
  }
  combine(other) {
    return this.combineTo(other, QuintMachineComponents.of);
  }
  static parse(values) {
    return parseConstruction(() => new QuintMachineComponents(values));
  }
  static of(values) {
    return new QuintMachineComponents(values);
  }
  add(value) {
    return new QuintMachineComponents([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  ids() {
    return ObligationIdentifiers.of(this.#values.map((c) => c.id()));
  }
  violatedBy(state) {
    return new QuintMachineComponents(this.#values.filter((c) => c.isViolatedIn(state)));
  }
  toArray() {
    return this.#values;
  }
}
// src/requirements/domain/quint-machine-plan.ts
class QuintMachinePlan {
  #invariantComponents;
  #eventIds;
  #scenariosWithInit;
  constructor(props) {
    this.#invariantComponents = props.invariantComponents;
    this.#eventIds = props.eventIds;
    this.#scenariosWithInit = props.scenariosWithInit;
  }
  static of(seed) {
    return new QuintMachinePlan({
      invariantComponents: seed.invariantComponents,
      eventIds: seed.eventIds,
      scenariosWithInit: KeySet.of(seed.scenariosWithInit)
    });
  }
  machineTargets() {
    return this.#invariantComponents.ids().toTargetIds().combine(this.#eventIds.toTargetIds()).sortedUniqueCanonically();
  }
  interpret(model, compileSkips, method, runs) {
    const machine = runs.machineRun().interpret(model, this.#invariantComponents, this.#eventIds, method);
    if (!machine.ok)
      return machine;
    const temporal = model.obligations().interpretQuintTemporal(method, runs, compileSkips.combine(machine.value.skipped));
    if (!temporal.ok)
      return temporal;
    const scenarios = model.scenarios().interpretQuint(model, runs, this.#scenariosWithInit, this.#invariantComponents);
    if (!scenarios.ok)
      return scenarios;
    return ok({
      findings: machine.value.findings.combine(temporal.value.findings).combine(scenarios.value.findings),
      skipped: temporal.value.skipped.combine(scenarios.value.skipped)
    });
  }
}
// src/requirements/domain/trace-state-entry.ts
class TraceStateEntry {
  #path;
  #value;
  constructor(path, value) {
    this.#path = path;
    this.#value = value;
  }
  static of(path, value) {
    return new TraceStateEntry(path, value);
  }
  path() {
    return this.#path;
  }
  value() {
    return this.#value;
  }
  equals(other) {
    return this.#path.equals(other.#path) && this.#value.equals(other.#value);
  }
  hashCode() {
    return combinedHash([this.#path.hashCode(), this.#value.hashCode()]);
  }
}

// src/requirements/domain/trace-state.ts
class TraceState extends FirstClassCollectionBase {
  #entries;
  constructor(entries) {
    super();
    const snapshot = boundedCollectionSnapshot(entries, 65536, "too-many-trace-state-entries");
    this.#entries = KeyedIndex.of(snapshot.map((entry) => [entry.path(), entry]));
  }
  rebuild(values) {
    return TraceState.of(values);
  }
  *[Symbol.iterator]() {
    yield* this.#entries.values();
  }
  static empty() {
    return new TraceState([]);
  }
  static fromBindings(bindings) {
    return TraceState.of(bindings.entriesCanonically().map((binding) => TraceStateEntry.of(binding.path(), TraceValue.of(binding.value().toDocument()))));
  }
  map(transform) {
    return this.mapTo(transform, TraceState.of);
  }
  combine(other) {
    return this.combineTo(other, TraceState.of);
  }
  static parse(entries) {
    return parseConstruction(() => new TraceState(entries));
  }
  static of(entries) {
    return new TraceState(entries);
  }
  valueAt(path) {
    return this.#entries.get(path)?.value() ?? TraceValue.absent();
  }
  toDocument() {
    return Object.fromEntries([...this.#entries].map(([path, entry]) => [path.asString(), entry.value().toDocument()]));
  }
  equals(other) {
    if (this.#entries.size() !== other.#entries.size())
      return false;
    for (const [path, entry] of this.#entries) {
      const otherEntry = other.#entries.get(path);
      if (otherEntry === undefined || !entry.value().equals(otherEntry.value()))
        return false;
    }
    return true;
  }
  hashCode() {
    let hash = 0;
    for (const [path, entry] of this.#entries) {
      hash = hash + combinedHash([path.hashCode(), entry.value().hashCode()]) | 0;
    }
    return hash;
  }
  toArray() {
    return [...this.#entries.values()];
  }
}

// src/requirements/domain/verification-witness.ts
class VerificationWitness {
  #document;
  constructor(raw) {
    this.#document = boundedValueSnapshot(raw, { string: 65536, nodes: 1e5, depth: 128, total: 16777216 });
  }
  static core(labels) {
    return VerificationWitness.of({ core: labels });
  }
  static model(values) {
    return VerificationWitness.of({ model: values });
  }
  static verdicts(byBackend) {
    return VerificationWitness.of({ verdicts: byBackend });
  }
  static trace(states) {
    return VerificationWitness.of({ trace: states.map((state) => state.toDocument()) });
  }
  static traceOf(states) {
    return VerificationWitness.of({ trace: states.toDocuments() });
  }
  static parse(value) {
    return parseConstruction(() => new VerificationWitness(value));
  }
  static of(document) {
    return new VerificationWitness(document);
  }
  toDocument() {
    return structuredClone(this.#document);
  }
  equals(other) {
    return canonicalStringify(this.#document) === canonicalStringify(other.#document);
  }
  hashCode() {
    return hashOfString(canonicalStringify(this.#document));
  }
}

// src/requirements/domain/quint-machine-run-verdict.ts
class QuintMachineRunVerdict {
  #kind;
  #trace;
  #outputTail;
  constructor(props) {
    this.#kind = props.kind;
    this.#trace = props.trace;
    this.#outputTail = props.outputTail;
  }
  static missing() {
    return new QuintMachineRunVerdict({ kind: "missing", trace: null, outputTail: "" });
  }
  static timeout() {
    return new QuintMachineRunVerdict({ kind: "timeout", trace: null, outputTail: "" });
  }
  static deadlock(trace) {
    return new QuintMachineRunVerdict({ kind: "deadlock", trace, outputTail: "" });
  }
  static violation(trace) {
    return new QuintMachineRunVerdict({ kind: "violation", trace, outputTail: "" });
  }
  static runFailed(outputTail) {
    return new QuintMachineRunVerdict({ kind: "run-failed", trace: null, outputTail });
  }
  static clean() {
    return new QuintMachineRunVerdict({ kind: "clean", trace: null, outputTail: "" });
  }
  abortsMachineTargets() {
    return this.#kind === "timeout" || this.#kind === "run-failed";
  }
  skipsFor(targets, bounded) {
    const kind = this.#kind;
    if (kind === "missing")
      return this.#skipEach(targets, SkipReason.unavailable(), "quint returned no machine run: the event machine was not decided");
    if (kind === "timeout")
      return this.#skipEach(targets, SkipReason.of("timeout"), "machine invariant check exceeded its budget");
    if (kind === "run-failed")
      return this.#skipEach(targets, SkipReason.of("unavailable"), `quint ${bounded ? "verify" : "run"} failed unexpectedly: ${this.#outputTail}`);
    return [];
  }
  #skipEach(targets, reason, detail) {
    return targets.foldLeft([], (skips, target) => {
      skips.push(VerificationSkipped.of({ target, reason, detail }));
      return skips;
    });
  }
  interpret(model, components, events, method) {
    const findings = [];
    const machineTargets = components.ids().toTargetIds().combine(events.toTargetIds()).sortedUniqueCanonically();
    const eventTargets = events.toTargetIds();
    if (this.isDeadlock()) {
      const [head, ...tail] = events.isEmpty() ? machineTargets : eventTargets.sortedCanonically();
      if (head === undefined)
        return err({ kind: "missing-finding-targets" });
      const parsedTargets = FindingTargets.parse(head, tail);
      if (!parsedTargets.ok)
        return parsedTargets;
      findings.push(VerificationFinding.of({
        kind: FindingKind.completenessGap(),
        functionalRequirementReferences: model.functionalRequirementReferencesOf(eventTargets),
        targets: parsedTargets.value,
        witness: this.witness(),
        detail: "The event machine reaches a legal state where no event rule applies (deadlock): the behavior of that state is unspecified."
      }));
    } else if (this.isViolation()) {
      const violatedComponents = components.violatedBy(this.finalState());
      const targets = violatedComponents.isEmpty() ? eventTargets.sortedCanonically() : violatedComponents.ids().toTargetIds().sortedUniqueCanonically();
      const [head, ...tail] = targets;
      if (head === undefined)
        return err({ kind: "missing-finding-targets" });
      const parsedTargets = FindingTargets.parse(head, tail);
      if (!parsedTargets.ok)
        return parsedTargets;
      findings.push(VerificationFinding.of({
        kind: FindingKind.conflict(),
        functionalRequirementReferences: model.functionalRequirementReferencesOf(targets.combine(eventTargets).sortedUniqueCanonically()),
        targets: parsedTargets.value,
        witness: this.witness(),
        detail: `The event machine can reach a state that violates ${targets.joined(", ")} (step trace attached): the event rules do not preserve the obligation.`
      }));
    }
    return ok({
      findings: VerificationFindings.of(findings),
      skipped: VerificationSkips.of(this.skipsFor(machineTargets, method.isBounded()))
    });
  }
  isDeadlock() {
    return this.#kind === "deadlock";
  }
  isViolation() {
    return this.#kind === "violation";
  }
  witness() {
    const trace = this.#trace;
    return trace !== null ? VerificationWitness.traceOf(trace) : VerificationWitness.model({});
  }
  finalState() {
    return this.#trace?.finalState() ?? TraceState.empty();
  }
}
// src/requirements/domain/quint-runs.ts
class QuintRuns {
  #machine;
  #temporals;
  #scenarios;
  constructor(seed) {
    this.#machine = seed.machine ?? QuintMachineRunVerdict.missing();
    this.#temporals = seed.temporals;
    this.#scenarios = seed.scenarios;
  }
  static of(seed) {
    return new QuintRuns({
      machine: seed.machine,
      temporals: seed.temporals,
      scenarios: seed.scenarios
    });
  }
  machineRun() {
    return this.#machine;
  }
  temporalOf(obligationId) {
    return this.#temporals.get(obligationId);
  }
  scenarioOf(scenarioId) {
    return this.#scenarios.get(scenarioId);
  }
}
// src/requirements/domain/quint-scenario-verdict.ts
class QuintScenarioVerdict {
  #kind;
  #violated;
  #outputTail;
  constructor(props) {
    this.#kind = props.kind;
    this.#violated = props.violated;
    this.#outputTail = props.outputTail;
  }
  static timeout() {
    return new QuintScenarioVerdict({ kind: "timeout", violated: false, outputTail: "" });
  }
  static runFailed(outputTail) {
    return new QuintScenarioVerdict({ kind: "run-failed", violated: false, outputTail });
  }
  static evaluated(violated) {
    return new QuintScenarioVerdict({ kind: "evaluated", violated, outputTail: "" });
  }
  skipFor(target) {
    const kind = this.#kind;
    if (kind === "timeout")
      return VerificationSkipped.of({
        target,
        reason: SkipReason.of("timeout"),
        detail: "scenario evaluation exceeded its budget"
      });
    if (kind === "run-failed")
      return VerificationSkipped.of({
        target,
        reason: SkipReason.of("unavailable"),
        detail: `quint run failed unexpectedly: ${this.#outputTail}`
      });
    return null;
  }
  isViolated() {
    return this.#kind === "evaluated" && this.#violated;
  }
}
// src/requirements/domain/quint-temporal-verdict.ts
class QuintTemporalVerdict {
  #kind;
  #trace;
  #outputTail;
  constructor(props) {
    this.#kind = props.kind;
    this.#trace = props.trace;
    this.#outputTail = props.outputTail;
  }
  static timeout() {
    return new QuintTemporalVerdict({ kind: "timeout", trace: null, outputTail: "" });
  }
  static runFailed(outputTail) {
    return new QuintTemporalVerdict({ kind: "run-failed", trace: null, outputTail });
  }
  static violation(trace) {
    return new QuintTemporalVerdict({ kind: "violation", trace, outputTail: "" });
  }
  static clean() {
    return new QuintTemporalVerdict({ kind: "clean", trace: null, outputTail: "" });
  }
  skipFor(target) {
    const kind = this.#kind;
    if (kind === "timeout")
      return VerificationSkipped.of({
        target,
        reason: SkipReason.of("timeout"),
        detail: "temporal check exceeded its budget"
      });
    if (kind === "run-failed")
      return VerificationSkipped.of({
        target,
        reason: SkipReason.of("unavailable"),
        detail: `quint verify failed unexpectedly: ${this.#outputTail}`
      });
    return null;
  }
  isViolation() {
    return this.#kind === "violation";
  }
  witness() {
    const trace = this.#trace;
    return trace !== null ? VerificationWitness.traceOf(trace) : VerificationWitness.model({});
  }
}
// src/requirements/domain/requirement-attribute-declaration.ts
class RequirementAttributeDeclaration {
  #path;
  #kind;
  #min;
  #max;
  #values;
  constructor(props) {
    this.#path = props.path;
    this.#kind = props.kind;
    this.#min = props.min;
    this.#max = props.max;
    this.#values = props.values;
  }
  static of(props) {
    return new RequirementAttributeDeclaration(props);
  }
  path() {
    return this.#path;
  }
  isAt(path) {
    return this.#path.asString() === path;
  }
  isBool() {
    return this.#kind === "bool";
  }
  isInt() {
    return this.#kind === "int";
  }
  isEnum() {
    return this.#kind === "enum";
  }
  declaredValues() {
    return this.#values;
  }
  minBound() {
    return this.#min;
  }
  maxBound() {
    return this.#max;
  }
  equals(other) {
    const valuesEqual = this.#values === undefined ? other.#values === undefined : other.#values !== undefined && this.#values.equals(other.#values);
    const boundsEqual = (left, right) => left === undefined ? right === undefined : right !== undefined && left.equals(right);
    return this.#path.equals(other.#path) && this.#kind === other.#kind && boundsEqual(this.#min, other.#min) && boundsEqual(this.#max, other.#max) && valuesEqual;
  }
  hashCode() {
    return combinedHash([
      this.#path.hashCode(),
      hashOfString(this.#kind),
      hashOfNullable(this.#min, (bound) => bound.hashCode()),
      hashOfNullable(this.#max, (bound) => bound.hashCode()),
      hashOfNullable(this.#values, (values) => values.hashCode())
    ]);
  }
  match(handlers) {
    if (this.#kind === "bool")
      return handlers.bool();
    if (this.#kind === "int")
      return handlers.int(this.#min, this.#max);
    return handlers.enum(this.#values);
  }
}
// src/requirements/domain/requirement-attribute-declarations.ts
class RequirementAttributeDeclarations extends FirstClassCollectionBase {
  #values;
  #byPath;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-requirement-attribute-declarations");
    this.#byPath = KeyedIndex.of(this.#values.map((a) => [a.path(), a]));
  }
  rebuild(values) {
    return new RequirementAttributeDeclarations(values);
  }
  map(transform) {
    return this.mapTo(transform, RequirementAttributeDeclarations.of);
  }
  combine(other) {
    return this.combineTo(other, RequirementAttributeDeclarations.of);
  }
  static parse(values) {
    return parseConstruction(() => new RequirementAttributeDeclarations(values));
  }
  static of(values) {
    return new RequirementAttributeDeclarations(values);
  }
  add(value) {
    return new RequirementAttributeDeclarations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  byPath(path) {
    return this.#byPath.get(path);
  }
  sortedByPath() {
    return new RequirementAttributeDeclarations([...this.#values].sort((a, b) => a.path().asString() < b.path().asString() ? -1 : 1));
  }
  toArray() {
    return this.#values;
  }
}
// src/requirements/domain/requirements-model.ts
class RequirementsModel {
  #id;
  #irHash;
  #sourceDocument;
  #irVersion;
  #attributes;
  #obligations;
  #scenarios;
  #background;
  constructor(seed) {
    this.#id = seed.id;
    this.#irHash = seed.irHash;
    this.#sourceDocument = new Uint8Array(seed.sourceDocument);
    this.#irVersion = seed.irVersion;
    this.#attributes = seed.attributes;
    this.#obligations = seed.obligations;
    this.#scenarios = seed.scenarios;
    this.#background = seed.background;
  }
  static of(seed) {
    return new RequirementsModel(seed);
  }
  prepareVerification(id, method) {
    return this.#irVersion.supportsMajor(SUPPORTED_IR_MAJOR) ? ok(this) : err(VerificationReport.versionMismatch(id, this, method.asString()));
  }
  id() {
    return this.#id;
  }
  irHash() {
    return this.#irHash;
  }
  sourceDocument() {
    return new Uint8Array(this.#sourceDocument);
  }
  irVersion() {
    return this.#irVersion;
  }
  supportsMajor(major) {
    return this.#irVersion.supportsMajor(major);
  }
  majorVersion() {
    return this.#irVersion.majorVersion();
  }
  attributes() {
    return this.#attributes;
  }
  attributeAt(path) {
    return this.#attributes.byPath(AttributePath.of(path));
  }
  obligations() {
    return this.#obligations;
  }
  scenarios() {
    return this.#scenarios;
  }
  background() {
    return this.#background;
  }
  allTargets() {
    return TargetIdentifiers.of(Array.from([...this.#obligations.ids(), ...this.#scenarios.ids()], (raw) => TargetIdentifier.of(raw))).sortedCanonically();
  }
  functionalRequirementReferencesOf(targets) {
    return targets.foldLeft(FunctionalRequirementReferences.of([]), (refs, target) => {
      const obligation = this.#obligations.byId(target.asString());
      const withObligation = obligation ? refs.combine(obligation.functionalRequirementReferences()) : refs;
      const scenario = this.#scenarios.byId(target.asString());
      return scenario ? withObligation.combine(scenario.functionalRequirementReferences()) : withObligation;
    }).sortedUnique();
  }
}
// src/requirements/domain/requirements-source.ts
class RequirementsSource {
  #id;
  #sourcePath;
  #knownIds;
  #digest;
  #sourceDocument;
  constructor(seed) {
    this.#id = seed.id;
    this.#sourcePath = seed.sourcePath;
    this.#knownIds = seed.knownIds;
    this.#digest = seed.digest;
    this.#sourceDocument = new Uint8Array(seed.sourceDocument);
  }
  static of(seed) {
    return new RequirementsSource(seed);
  }
  id() {
    return this.#id;
  }
  sourcePath() {
    return this.#sourcePath;
  }
  knownIds() {
    return this.#knownIds;
  }
  digest() {
    return this.#digest;
  }
  sourceDocument() {
    return new Uint8Array(this.#sourceDocument);
  }
}
// src/requirements/domain/requirements-source-identifier.ts
class RequirementsSourceIdentifier {
  #recordRoot;
  constructor(recordRoot) {
    this.#recordRoot = recordRoot;
  }
  static of(recordRoot) {
    return new RequirementsSourceIdentifier(recordRoot);
  }
  equals(other) {
    return this.#recordRoot.equals(other.#recordRoot);
  }
  hashCode() {
    return this.#recordRoot.hashCode();
  }
  recordRoot() {
    return this.#recordRoot;
  }
}
// src/requirements/domain/satisfiability-modulo-theories-check.ts
class SatisfiabilityModuloTheoriesCheck {
  #plan;
  #result;
  constructor(input) {
    this.#plan = input.plan;
    this.#result = { ...input.result };
  }
  static of(input) {
    return new SatisfiabilityModuloTheoriesCheck(input);
  }
  reportFor(model, id) {
    if (this.#result.kind === "unavailable") {
      return VerificationReport.solverUnavailable(id, model, this.#plan.planSkipped(), this.#result.reason.asString());
    }
    const interpreted = this.#plan.interpret(model, this.#result.verdicts);
    if (!interpreted.ok)
      return VerificationReport.interpretationUnavailable(id, model, VerificationMethod.of("exhaustive"), interpreted.error);
    return VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash: model.irHash(),
      method: "exhaustive",
      findings: interpreted.value.findings,
      skipped: interpreted.value.skipped
    });
  }
  match(cases) {
    return this.#result.kind === "unavailable" ? cases.unavailable() : cases.solved();
  }
}
// src/requirements/domain/satisfiability-modulo-theories-event-pair-probe.ts
class SatisfiabilityModuloTheoriesEventPairProbe {
  #qOverlap;
  #qJoint;
  #a;
  #b;
  #trigger;
  constructor(props) {
    this.#qOverlap = props.qOverlap;
    this.#qJoint = props.qJoint;
    this.#a = props.a;
    this.#b = props.b;
    this.#trigger = props.trigger;
  }
  static of(props) {
    return new SatisfiabilityModuloTheoriesEventPairProbe(props);
  }
  interpret(model, results) {
    const overlap = this.#overlapVerdictIn(results);
    const joint = this.#jointVerdictIn(results);
    if (overlap.isSat() && joint.isUnsat()) {
      const targets = FindingTargets.of(this.#a.asTargetId(), [this.#b.asTargetId()]).sortedUniqueCanonically();
      return ok({
        findings: VerificationFindings.of([
          VerificationFinding.of({
            kind: FindingKind.conflict(),
            functionalRequirementReferences: model.functionalRequirementReferencesOf(targets),
            targets,
            witness: VerificationWitness.core(joint.sortedCore()),
            detail: `Events ${this.#a.asString()} and ${this.#b.asString()} for trigger "${this.#trigger.asString()}" have overlapping guards but contradictory effects: some state matches both rules, and no post-state satisfies both.`
          })
        ]),
        skipped: VerificationSkips.of([])
      });
    }
    const pending = [overlap, joint].find((verdict) => verdict.isMissing()) ?? (overlap.isUndecided() ? overlap : joint);
    return ok({
      findings: VerificationFindings.of([]),
      skipped: overlap.isUndecided() || joint.isUndecided() ? pending.skipsFor(this.targets(), `event-pair check for trigger "${this.#trigger.asString()}"`) : VerificationSkips.of([])
    });
  }
  targets() {
    return TargetIdentifiers.of([this.#a.asTargetId(), this.#b.asTargetId()]);
  }
  equals(other) {
    return this.#qOverlap.equals(other.#qOverlap) && this.#qJoint.equals(other.#qJoint) && this.#a.equals(other.#a) && this.#b.equals(other.#b) && this.#trigger.equals(other.#trigger);
  }
  hashCode() {
    return combinedHash([
      this.#qOverlap.hashCode(),
      this.#qJoint.hashCode(),
      this.#a.hashCode(),
      this.#b.hashCode(),
      this.#trigger.hashCode()
    ]);
  }
  #overlapVerdictIn(results) {
    return results.verdictOf(this.#qOverlap);
  }
  #jointVerdictIn(results) {
    return results.verdictOf(this.#qJoint);
  }
}
// src/requirements/domain/satisfiability-modulo-theories-event-pair-probes.ts
class SatisfiabilityModuloTheoriesEventPairProbes extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-satisfiability-event-pair-probes");
  }
  rebuild(values) {
    return new SatisfiabilityModuloTheoriesEventPairProbes(values);
  }
  map(transform) {
    return this.mapTo(transform, SatisfiabilityModuloTheoriesEventPairProbes.of);
  }
  combine(other) {
    return this.combineTo(other, SatisfiabilityModuloTheoriesEventPairProbes.of);
  }
  static parse(values) {
    return parseConstruction(() => new SatisfiabilityModuloTheoriesEventPairProbes(values));
  }
  static of(values) {
    return new SatisfiabilityModuloTheoriesEventPairProbes(values);
  }
  add(value) {
    return new SatisfiabilityModuloTheoriesEventPairProbes([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  *interpretations(model, results) {
    for (const probe of this.#values)
      yield probe.interpret(model, results);
  }
  toArray() {
    return this.#values;
  }
}
// src/requirements/domain/satisfiability-modulo-theories-query-verdict.ts
class SatisfiabilityModuloTheoriesQueryVerdict {
  #status;
  #decodedModel;
  #core;
  constructor(props) {
    const snapshot = boundedValueSnapshot(props, { string: 65536, nodes: 65536, depth: 4, total: 16777216 });
    this.#status = snapshot.status;
    this.#decodedModel = snapshot.decodedModel;
    this.#core = snapshot.core === undefined ? undefined : snapshot.core.map((label) => QueryLabel.of(label));
  }
  static parse(props) {
    return parseConstruction(() => new SatisfiabilityModuloTheoriesQueryVerdict(props));
  }
  static of(props) {
    return new SatisfiabilityModuloTheoriesQueryVerdict(props);
  }
  static missing() {
    return new SatisfiabilityModuloTheoriesQueryVerdict({ status: "missing" });
  }
  isMissing() {
    return this.#status === "missing";
  }
  skipsFor(targets, what) {
    if (!this.isUndecided())
      return VerificationSkips.of([]);
    const reason = this.isMissing() ? SkipReason.unrecognizedFormat() : SkipReason.timeout();
    const detail = this.isMissing() ? `${what} returned no solver result` : `${what} exceeded the solver budget`;
    return VerificationSkips.coveringAll(targets, reason, detail);
  }
  isSat() {
    return this.#status === "sat";
  }
  isUnsat() {
    return this.#status === "unsat";
  }
  isUndecided() {
    return this.#status !== "sat" && this.#status !== "unsat";
  }
  coreLabels() {
    return [...this.#core ?? []];
  }
  sortedCore() {
    return (this.#core ?? []).map((label) => label.asString()).sort();
  }
  witnessModel() {
    return { ...this.#decodedModel ?? {} };
  }
  equals(other) {
    const leftModel = this.#decodedModel ?? {};
    const rightModel = other.#decodedModel ?? {};
    const leftKeys = Object.keys(leftModel).sort();
    const rightKeys = Object.keys(rightModel).sort();
    const modelsEqual = leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && leftModel[key] === rightModel[key]);
    const leftCore = this.#core ?? [];
    const rightCore = other.#core ?? [];
    return this.#status === other.#status && modelsEqual && leftCore.length === rightCore.length && leftCore.every((label, index) => label.equals(rightCore[index]));
  }
  hashCode() {
    return combinedHash([
      hashOfString(this.#status),
      hashOfString(canonicalStringify(this.#decodedModel ?? {})),
      combinedHash((this.#core ?? []).map((label) => label.hashCode()))
    ]);
  }
}
// src/requirements/domain/satisfiability-modulo-theories-query-verdict-entry.ts
class SatisfiabilityModuloTheoriesQueryVerdictEntry {
  #query;
  #verdict;
  constructor(query, verdict) {
    this.#query = query;
    this.#verdict = verdict;
  }
  static of(query, verdict) {
    return new SatisfiabilityModuloTheoriesQueryVerdictEntry(query, verdict);
  }
  query() {
    return this.#query;
  }
  verdict() {
    return this.#verdict;
  }
  equals(other) {
    return this.#query.equals(other.#query) && this.#verdict.equals(other.#verdict);
  }
  hashCode() {
    return combinedHash([this.#query.hashCode(), this.#verdict.hashCode()]);
  }
}
// src/requirements/domain/satisfiability-modulo-theories-query-verdicts.ts
class SatisfiabilityModuloTheoriesQueryVerdicts extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    const snapshot = boundedCollectionSnapshot(values, 65536, "too-many-satisfiability-query-verdicts");
    this.#values = KeyedIndex.of(snapshot.map((entry) => [entry.query(), entry]));
  }
  rebuild(values) {
    return new SatisfiabilityModuloTheoriesQueryVerdicts(values);
  }
  *[Symbol.iterator]() {
    yield* this.#values.values();
  }
  toArray() {
    return [...this];
  }
  map(transform) {
    return this.mapTo(transform, SatisfiabilityModuloTheoriesQueryVerdicts.of);
  }
  combine(other) {
    return this.combineTo(other, SatisfiabilityModuloTheoriesQueryVerdicts.of);
  }
  static parse(values) {
    return parseConstruction(() => new SatisfiabilityModuloTheoriesQueryVerdicts(values));
  }
  static of(values) {
    return new SatisfiabilityModuloTheoriesQueryVerdicts(values);
  }
  verdictOf(queryId) {
    return this.#values.get(queryId)?.verdict() ?? SatisfiabilityModuloTheoriesQueryVerdict.missing();
  }
}
// src/requirements/domain/satisfiability-modulo-theories-probe.ts
class SatisfiabilityModuloTheoriesProbe {
  #query;
  #subject;
  constructor(query, subject) {
    this.#query = query;
    this.#subject = { ...subject };
  }
  static consistency(fallback, labels) {
    return new SatisfiabilityModuloTheoriesProbe(QueryLabel.of("global"), { kind: "consistency", fallback, labels });
  }
  static vacuity(query, subject, labels) {
    return new SatisfiabilityModuloTheoriesProbe(query, { kind: "vacuity", subject, labels });
  }
  static completeness(trigger, targets) {
    return new SatisfiabilityModuloTheoriesProbe(QueryLabel.of(`gap:${trigger.asString()}`), {
      kind: "completeness",
      trigger,
      targets
    });
  }
  static scenario(query, subject, labels) {
    return new SatisfiabilityModuloTheoriesProbe(query, { kind: "scenario", subject, labels });
  }
  allowsVacuityChecks(results) {
    return this.#subject.kind === "consistency" && !results.verdictOf(this.#query).isUnsat();
  }
  #coreTargets(labels) {
    const state = this.#subject;
    if (state.kind === "completeness")
      return TargetIdentifiers.of([]);
    return TargetIdentifiers.of(labels.map((label) => state.labels.get(label)).filter((target) => target?.isRequirementObligation() ?? false)).sortedUniqueCanonically();
  }
  interpret(model, results) {
    const verdict = results.verdictOf(this.#query);
    const state = this.#subject;
    if (state.kind === "scenario")
      return state.subject.interpretSatisfiability(model, verdict, this.#coreTargets([...verdict.coreLabels()]));
    const targets = state.kind === "consistency" ? state.fallback : state.kind === "vacuity" ? TargetIdentifiers.of([state.subject.asTargetId()]) : state.targets;
    const context = state.kind === "consistency" ? "global consistency check" : state.kind === "vacuity" ? `vacuity check for ${state.subject.asString()}` : `completeness check for trigger "${state.trigger.asString()}"`;
    if (verdict.isUndecided())
      return ok({
        findings: VerificationFindings.of([]),
        skipped: verdict.skipsFor(targets, context)
      });
    let finding = null;
    if (state.kind === "completeness" && verdict.isSat()) {
      const [head, ...tail] = targets;
      if (head === undefined)
        return err({ kind: "missing-finding-targets" });
      const parsedTargets = FindingTargets.parse(head, tail);
      if (!parsedTargets.ok)
        return parsedTargets;
      finding = VerificationFinding.of({
        kind: FindingKind.completenessGap(),
        functionalRequirementReferences: model.functionalRequirementReferencesOf(targets),
        targets: parsedTargets.value,
        witness: VerificationWitness.model(verdict.witnessModel()),
        detail: `No rule for trigger "${state.trigger.asString()}" applies to the witness state: the behavior of this input region is unspecified.`
      });
    }
    if (state.kind !== "completeness" && verdict.isUnsat()) {
      const core = this.#coreTargets([...verdict.coreLabels()]);
      const effective = state.kind === "vacuity" ? core.add(state.subject.asTargetId()).sortedUniqueCanonically() : core.count() > 0 ? core : state.fallback;
      const [head, ...tail] = effective;
      if (head === undefined)
        return err({ kind: "missing-finding-targets" });
      const parsedTargets = FindingTargets.parse(head, tail);
      if (!parsedTargets.ok)
        return parsedTargets;
      finding = VerificationFinding.of({
        kind: FindingKind.conflict(),
        functionalRequirementReferences: model.functionalRequirementReferencesOf(effective),
        targets: parsedTargets.value,
        witness: VerificationWitness.core(verdict.sortedCore()),
        detail: state.kind === "consistency" ? "These obligations (with the background and type bounds in the witness core) are jointly unsatisfiable: no state can satisfy all of them." : `The condition of obligation ${state.subject.asString()} can never hold: the obligations in the witness core annihilate it. Rules that conflict on a shared condition, or a dead requirement branch.`
      });
    }
    return ok({
      findings: VerificationFindings.of(finding === null ? [] : [finding]),
      skipped: VerificationSkips.of([])
    });
  }
}

// src/requirements/domain/satisfiability-modulo-theories-verification-plan.ts
class SatisfiabilityModuloTheoriesVerificationPlan {
  #compiled;
  #vacuityQueries;
  #skipped;
  #labelToTarget;
  #eventPairs;
  #gapTriggers;
  #scenarioQueries;
  constructor(seed) {
    this.#compiled = seed.compiled;
    this.#vacuityQueries = seed.vacuityQueries;
    this.#skipped = seed.skipped;
    this.#labelToTarget = seed.labelToTarget;
    this.#eventPairs = seed.eventPairs;
    this.#gapTriggers = seed.gapTriggers;
    this.#scenarioQueries = seed.scenarioQueries;
  }
  static of(seed) {
    return new SatisfiabilityModuloTheoriesVerificationPlan(seed);
  }
  planSkipped() {
    return this.#skipped;
  }
  interpret(model, results) {
    let findings = VerificationFindings.of([]);
    let skipped = this.#skipped;
    for (const result of this.#interpretProbes(model, results)) {
      if (!result.ok)
        return result;
      findings = findings.combine(result.value.findings);
      skipped = skipped.combine(result.value.skipped);
    }
    return ok({ findings: findings.distinctConflicts(), skipped });
  }
  *#interpretProbes(model, results) {
    const consistency = SatisfiabilityModuloTheoriesProbe.consistency(model.obligations().compiledInvariantTargets(this.#compiled), this.#labelToTarget);
    yield consistency.interpret(model, results);
    if (consistency.allowsVacuityChecks(results))
      for (const [subject, query] of this.#vacuityQueries)
        yield SatisfiabilityModuloTheoriesProbe.vacuity(query, subject, this.#labelToTarget).interpret(model, results);
    yield* this.#eventPairs.interpretations(model, results);
    for (const [trigger, targets] of [...this.#gapTriggers].sort((a, b) => a[0].asString() < b[0].asString() ? -1 : a[0].asString() > b[0].asString() ? 1 : 0))
      yield SatisfiabilityModuloTheoriesProbe.completeness(trigger, targets).interpret(model, results);
    yield* model.scenarios().interpretSatisfiability(model, results, this.#scenarioQueries, this.#labelToTarget);
  }
}
// src/requirements/domain/scenario.ts
class Scenario {
  #id;
  #expectation;
  #functionalRequirementReferences;
  #bindings;
  #eventTrigger;
  #expect;
  constructor(props) {
    this.#id = props.id;
    this.#expectation = props.expectation;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#bindings = props.bindings;
    this.#eventTrigger = props.event?.trigger;
    this.#expect = props.expect === undefined ? undefined : ExpressionTree.of(props.expect).asExpression();
  }
  static parse(props) {
    return parseConstruction(() => new Scenario(props));
  }
  static of(props) {
    return new Scenario(props);
  }
  crossCheckFinding(comparison) {
    if (!comparison.isFor(this.#id.asTargetId(), null))
      throw new IllegalArgumentException({ kind: "different-cross-check-subject" });
    if (!comparison.disagrees())
      return null;
    return VerificationFinding.of({
      kind: FindingKind.crossCheckDisagreement(),
      functionalRequirementReferences: this.#functionalRequirementReferences.sortedUnique(),
      targets: FindingTargets.of(this.#id.asTargetId(), []),
      witness: VerificationWitness.verdicts(comparison.toVerdictTable()),
      detail: `${comparison.description()} disagree on scenario ${this.#id.asString()}. This signals a defect in the formalization or in a backend compiler, not in the requirements themselves.`
    });
  }
  id() {
    return this.#id;
  }
  equals(other) {
    const expressionEqual = (left, right) => left === undefined ? right === undefined : right !== undefined && ExpressionTree.of(left).isCanonicallyEqual(ExpressionTree.of(right));
    return this.#id.equals(other.#id) && this.#expectation.asString() === other.#expectation.asString() && this.#functionalRequirementReferences.equals(other.#functionalRequirementReferences) && this.#bindings.equals(other.#bindings) && (this.#eventTrigger === undefined ? other.#eventTrigger === undefined : other.#eventTrigger !== undefined && this.#eventTrigger.equals(other.#eventTrigger)) && expressionEqual(this.#expect, other.#expect);
  }
  hashCode() {
    return combinedHash([
      this.#id.hashCode(),
      hashOfString(this.#expectation.asString()),
      this.#functionalRequirementReferences.hashCode(),
      this.#bindings.hashCode(),
      hashOfNullable(this.#eventTrigger, (trigger) => trigger.hashCode()),
      hashOfNullable(this.#expect, (expr) => hashOfString(canonicalStringify(expr)))
    ]);
  }
  kind() {
    return this.#expectation.asString();
  }
  functionalRequirementReferences() {
    return this.#functionalRequirementReferences;
  }
  eventTrigger() {
    return this.#eventTrigger;
  }
  expectedExpression() {
    return this.#expect;
  }
  isAccept() {
    return this.#expectation.isAccept();
  }
  isReject() {
    return this.#expectation.isReject();
  }
  hasEventRule() {
    return this.#eventTrigger !== undefined;
  }
  isViolatedBySatisfiability(satisfiable) {
    return this.#expectation.isViolatedBySatisfiability(satisfiable);
  }
  interpretQuint(model, verdict, hasInitialState, components) {
    const target = this.#id.asTargetId();
    let skip = null;
    if (this.hasEventRule())
      skip = VerificationSkipped.of({
        target,
        reason: SkipReason.capability(),
        detail: "scenarios with a When-event are not checked by the quint backend in v1"
      });
    else if (!hasInitialState)
      skip = VerificationSkipped.of({
        target,
        reason: SkipReason.capability(),
        detail: "quint scenario evaluation requires bindings for every declared attribute"
      });
    else if (verdict === undefined)
      skip = VerificationSkipped.of({
        target,
        reason: SkipReason.unavailable(),
        detail: "quint returned no run for this scenario"
      });
    else
      skip = verdict.skipFor(target);
    if (skip !== null)
      return ok({ findings: VerificationFindings.of([]), skipped: VerificationSkips.of([skip]) });
    if (verdict === undefined || !this.isViolatedBySatisfiability(!verdict.isViolated()))
      return ok({ findings: VerificationFindings.of([]), skipped: VerificationSkips.of([]) });
    const accept = this.isAccept();
    const violated = accept ? components.violatedBy(TraceState.fromBindings(this.#bindings)).ids().toTargetIds() : TargetIdentifiers.of([]);
    const parsedTargets = FindingTargets.parseWithTail(target, violated);
    if (!parsedTargets.ok)
      return parsedTargets;
    const targets = parsedTargets.value.sortedUniqueCanonically();
    return ok({
      findings: VerificationFindings.of([
        VerificationFinding.of({
          kind: FindingKind.scenarioViolation(),
          functionalRequirementReferences: model.functionalRequirementReferencesOf(targets),
          targets,
          witness: VerificationWitness.model(this.#bindings.toDocument()),
          detail: accept ? `Accept scenario ${this.#id.asString()} describes a state the obligations rule out \u2014 the requirements reject an example that should be accepted.` : `Reject scenario ${this.#id.asString()} is accepted by every obligation \u2014 the requirements do not exclude an example that should be rejected.`
        })
      ]),
      skipped: VerificationSkips.of([])
    });
  }
  interpretSatisfiability(model, verdict, coreTargets) {
    const target = this.#id.asTargetId();
    if (verdict.isUndecided())
      return ok({
        findings: VerificationFindings.of([]),
        skipped: verdict.skipsFor(TargetIdentifiers.of([target]), `scenario check for ${this.#id.asString()}`)
      });
    if (!this.isViolatedBySatisfiability(verdict.isSat()))
      return ok({ findings: VerificationFindings.of([]), skipped: VerificationSkips.of([]) });
    const accept = this.isAccept();
    const parsedTargets = FindingTargets.parseWithTail(target, accept ? coreTargets : TargetIdentifiers.of([]));
    if (!parsedTargets.ok)
      return parsedTargets;
    const targets = accept ? parsedTargets.value.sortedUniqueCanonically() : parsedTargets.value;
    const finding = VerificationFinding.of({
      kind: FindingKind.scenarioViolation(),
      functionalRequirementReferences: model.functionalRequirementReferencesOf(targets),
      targets,
      witness: accept ? VerificationWitness.core(verdict.sortedCore()) : VerificationWitness.model(verdict.witnessModel()),
      detail: accept ? `Accept scenario ${this.#id.asString()} describes a state the obligations in the witness core rule out \u2014 the requirements reject an example that should be accepted.` : `Reject scenario ${this.#id.asString()} is still satisfiable \u2014 the requirements do not exclude an example that should be rejected (witness state attached).`
    });
    return ok({ findings: VerificationFindings.of([finding]), skipped: VerificationSkips.of([]) });
  }
  bindings() {
    return this.#bindings;
  }
}
// src/requirements/domain/scenario-identifier.ts
class ScenarioIdentifier {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "scenario-id-too-long", raw: raw.length });
    if (!/^SC-[0-9]+$/.test(raw))
      throw new IllegalArgumentException({ kind: "malformed-scenario-id", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new ScenarioIdentifier(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new ScenarioIdentifier(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  asString() {
    return this.#value;
  }
  asTargetId() {
    return TargetIdentifier.of(this.#value);
  }
}
// src/requirements/domain/scenarios.ts
class Scenarios extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-scenarios");
  }
  rebuild(values) {
    return new Scenarios(values);
  }
  map(transform) {
    return this.mapTo(transform, Scenarios.of);
  }
  combine(other) {
    return this.combineTo(other, Scenarios.of);
  }
  static parse(values) {
    return parseConstruction(() => new Scenarios(values));
  }
  static of(values) {
    return new Scenarios(values);
  }
  add(value) {
    return new Scenarios([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  interpretQuint(model, runs, scenariosWithInit, components) {
    let findings = VerificationFindings.of([]);
    let skipped = VerificationSkips.of([]);
    for (const scenario of this.#values) {
      const interpreted = scenario.interpretQuint(model, runs.scenarioOf(scenario.id()), scenariosWithInit.has(scenario.id()), components);
      if (!interpreted.ok)
        return interpreted;
      findings = findings.combine(interpreted.value.findings);
      skipped = skipped.combine(interpreted.value.skipped);
    }
    return ok({ findings, skipped });
  }
  *interpretSatisfiability(model, results, queries, labelToTarget) {
    for (const scenario of this.#values) {
      const query = queries.get(scenario.id());
      if (query !== undefined)
        yield SatisfiabilityModuloTheoriesProbe.scenario(query, scenario, labelToTarget).interpret(model, results);
    }
  }
  byId(id) {
    return this.#values.find((s) => s.id().asString() === id);
  }
  ids() {
    return this.#values.map((s) => s.id().asString());
  }
  toArray() {
    return this.#values;
  }
}
// src/requirements/domain/trace-states.ts
class TraceStates extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-trace-states");
  }
  rebuild(values) {
    return new TraceStates(values);
  }
  map(transform) {
    return this.mapTo(transform, TraceStates.of);
  }
  combine(other) {
    return this.combineTo(other, TraceStates.of);
  }
  static parse(values) {
    return parseConstruction(() => new TraceStates(values));
  }
  static of(values) {
    return new TraceStates(values);
  }
  add(value) {
    return new TraceStates([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toDocuments() {
    return this.#values.map((state) => state.toDocument());
  }
  finalState() {
    return this.#values[this.#values.length - 1] ?? TraceState.empty();
  }
  toArray() {
    return [...this.#values];
  }
}
// src/requirements/domain/verification-report-identifier.ts
class VerificationReportIdentifier {
  #directory;
  #backend;
  constructor(directory, backend) {
    this.#directory = directory;
    this.#backend = backend;
  }
  static of(directory, backend) {
    return new VerificationReportIdentifier(directory, BackendName.of(backend));
  }
  equals(other) {
    return this.#directory.equals(other.#directory) && this.#backend.equals(other.#backend);
  }
  hashCode() {
    return combinedHash([this.#directory.hashCode(), this.#backend.hashCode()]);
  }
  backendName() {
    return this.#backend;
  }
  directory() {
    return this.#directory;
  }
  fileName() {
    return `${this.#backend.asString()}.json`;
  }
}

// src/requirements/domain/verification-directory.ts
var CROSS_CHECK_BACKEND = "cross-check";

class VerificationDirectory {
  #directory;
  #reports;
  #candidate;
  #crossCheck;
  constructor(directory, reports, candidate, crossCheck) {
    this.#directory = directory;
    this.#reports = reports;
    this.#candidate = candidate;
    this.#crossCheck = crossCheck;
  }
  static of(directory, reports, crossCheck) {
    return new VerificationDirectory(directory, reports, null, crossCheck === null ? { kind: "absent" } : { kind: "present", report: crossCheck });
  }
  static unreadableCrossCheck(directory, reports, error) {
    return new VerificationDirectory(directory, reports, null, { kind: "unreadable", error });
  }
  finalizing(candidate) {
    if (!candidate.id().directory().equals(this.#directory)) {
      throw new IllegalArgumentException({ kind: "verification-report-directory-mismatch" });
    }
    return new VerificationDirectory(this.#directory, this.#reports.replacingByFileName(candidate), candidate, {
      kind: "absent"
    });
  }
  finalizedWith(candidate, model, schema) {
    const staged = this.finalizing(candidate.conformedTo(schema));
    if (model === null)
      return staged;
    const derived = staged.#reports.crossChecked(VerificationReportIdentifier.of(this.#directory, CROSS_CHECK_BACKEND), model, candidate.irHash());
    return new VerificationDirectory(this.#directory, staged.#reports, staged.#candidate, {
      kind: "present",
      report: derived.conformedTo(schema)
    });
  }
  crossChecked(model, irHash) {
    const derived = this.#reports.crossChecked(VerificationReportIdentifier.of(this.#directory, CROSS_CHECK_BACKEND), model, irHash);
    return new VerificationDirectory(this.#directory, this.#reports, this.#candidate, {
      kind: "present",
      report: derived
    });
  }
  withoutCrossCheck() {
    return new VerificationDirectory(this.#directory, this.#reports, this.#candidate, { kind: "absent" });
  }
  conformedTo(schema) {
    const candidate = this.#candidate;
    const crossCheck = this.#crossCheck;
    const conformedCandidate = candidate === null ? null : candidate.conformedTo(schema);
    const conformedCrossCheck = conformedCandidate !== candidate || crossCheck.kind === "absent" ? { kind: "absent" } : crossCheck.kind === "unreadable" ? crossCheck : { kind: "present", report: crossCheck.report.conformedTo(schema) };
    const reports = conformedCandidate === null ? this.#reports : this.#reports.map((report) => report.id().fileName() === conformedCandidate.id().fileName() ? conformedCandidate : report);
    return new VerificationDirectory(this.#directory, reports, conformedCandidate, conformedCrossCheck);
  }
  directory() {
    return this.#directory;
  }
  reports() {
    return this.#reports;
  }
  candidate() {
    return this.#candidate;
  }
  publishedReport() {
    if (this.#candidate === null) {
      throw new IllegalArgumentException({ kind: "verification-directory-not-finalized" });
    }
    return this.#candidate;
  }
  crossCheck() {
    if (this.#crossCheck.kind === "present")
      return ok(this.#crossCheck.report);
    if (this.#crossCheck.kind === "unreadable")
      return err(this.#crossCheck.error);
    return ok(null);
  }
}
// src/requirements/domain/verification-reports.ts
class VerificationReports extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-verification-reports");
  }
  rebuild(values) {
    return new VerificationReports(values);
  }
  map(transform) {
    return this.mapTo(transform, VerificationReports.of);
  }
  combine(other) {
    return this.combineTo(other, VerificationReports.of);
  }
  static parse(values) {
    return parseConstruction(() => new VerificationReports(values));
  }
  static of(values) {
    return new VerificationReports(values);
  }
  add(value) {
    return new VerificationReports([...this.#values, value]);
  }
  replacingByFileName(candidate) {
    const fileName = candidate.id().fileName();
    const merged = this.#values.map((sibling) => sibling.id().fileName() === fileName ? candidate : sibling);
    if (this.#values.some((sibling) => sibling.id().fileName() === fileName))
      return new VerificationReports(merged);
    const at = merged.findIndex((sibling) => sibling.id().fileName() > fileName);
    return new VerificationReports(at < 0 ? [...merged, candidate] : [...merged.slice(0, at), candidate, ...merged.slice(at)]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
  crossChecked(id, model, irHash) {
    const findings = [];
    let compared = KeyedIndex.empty();
    let failure = null;
    for (const scenario of model.scenarios()) {
      const target = scenario.id().asTargetId();
      const verdicts = ScenarioVerdicts.parse(this.#values.map((report2) => report2.scenarioVerdictFor(target, irHash)));
      if (!verdicts.ok) {
        failure = verdicts.error;
        break;
      }
      for (const comparison of verdicts.value.comparisons()) {
        for (const backend of comparison.backends()) {
          const targets = compared.get(backend);
          if (targets === undefined)
            compared = compared.with(backend, [target]);
          else
            targets.push(target);
        }
        const finding = scenario.crossCheckFinding(comparison);
        if (finding !== null)
          findings.push(finding);
      }
    }
    const crossChecked = [...compared].map(([backend, targets]) => CrossCheckedEntry.of({
      backend,
      targets: TargetIdentifiers.of(targets).sortedUniqueCanonically()
    })).sort((a, b) => a.compareByBackend(b));
    const report = VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method: "exhaustive",
      findings: VerificationFindings.of(findings),
      skipped: VerificationSkips.of([]),
      crossChecked: CrossCheckedEntries.of(crossChecked)
    });
    return failure === null ? report : report.degraded(`scenario cross-check could not be constructed: ${failure.kind}`);
  }
}
// src/design/domain/design-skipped.ts
class DesignSkipped {
  #target;
  #reason;
  #unit;
  #detail;
  constructor(props) {
    this.#target = props.target;
    this.#reason = props.reason;
    this.#unit = props.unit;
    this.#detail = props.detail;
  }
  static of(props) {
    return new DesignSkipped(props);
  }
  equals(other) {
    return this.#target.equals(other.#target) && this.#reason.asString() === other.#reason.asString() && this.#unit.equals(other.#unit) && this.#detail === other.#detail;
  }
  hashCode() {
    return combinedHash([
      this.#target.hashCode(),
      hashOfString(this.#reason.asString()),
      this.#unit.hashCode(),
      hashOfNullable(this.#detail, hashOfString)
    ]);
  }
  target() {
    return this.#target;
  }
  reason() {
    return this.#reason.asString();
  }
  unit() {
    return this.#unit.asString();
  }
  detail() {
    return this.#detail;
  }
  appliesTo(unit, target) {
    return this.#unit.equals(unit) && this.isFor(target);
  }
  isFor(target) {
    return this.#target.equals(target);
  }
  compareTo(other) {
    if (!this.#unit.equals(other.#unit))
      return this.#unit.asString() < other.#unit.asString() ? -1 : 1;
    const c = this.#target.compareTo(other.#target);
    if (c !== 0)
      return c;
    return this.#reason.compareTo(other.#reason);
  }
}

// src/design/domain/refinement-status.ts
class RefinementStatus {
  #kind;
  #text;
  constructor(props) {
    this.#kind = props.kind;
    this.#text = props.text;
  }
  static checkable() {
    return new RefinementStatus({ kind: "checkable", text: "" });
  }
  static waived(reason) {
    return new RefinementStatus({ kind: "waived", text: reason });
  }
  static gap(detail) {
    return new RefinementStatus({ kind: "gap", text: detail });
  }
  static capability(detail) {
    return new RefinementStatus({ kind: "capability", text: detail });
  }
  isCheckable() {
    return this.#kind === "checkable";
  }
  gapDetail() {
    return this.#kind === "gap" ? this.#text : null;
  }
  findingFor(target, references, map, artifact) {
    return this.#kind === "gap" ? map.gapFor(FindingTargets.of(target, []), `${target.asString()}: ${this.#text}`, artifact, references) : null;
  }
  skipFor(target, unit) {
    if (this.#kind === "waived")
      return DesignSkipped.of({ target, reason: SkipReason.waived(), unit: UnitName.of(unit), detail: this.#text });
    if (this.#kind === "capability")
      return DesignSkipped.of({ target, reason: SkipReason.capability(), unit: UnitName.of(unit), detail: this.#text });
    return null;
  }
}

// src/design/domain/attribute-coverage.ts
class AttributeCoverage {
  #required;
  #mapped;
  #waived;
  #missing;
  constructor(props) {
    const parts = [props.mapped, props.waived, props.missing];
    const partitions = (path) => parts.filter((part) => part.has(path)).length;
    if (props.required.exists((path) => partitions(path) !== 1))
      throw new IllegalArgumentException({ kind: "invalid-attribute-coverage-partition" });
    for (const part of parts)
      if (part.exists((path) => !props.required.has(path)))
        throw new IllegalArgumentException({ kind: "attribute-coverage-outside-subject" });
    this.#required = props.required;
    this.#mapped = props.mapped;
    this.#waived = props.waived;
    this.#missing = props.missing;
  }
  static of(props) {
    return new AttributeCoverage(props);
  }
  static parse(props) {
    return parseConstruction(() => new AttributeCoverage(props));
  }
  #unmapped() {
    return this.#waived.combine(this.#missing);
  }
  #status(waived, gap) {
    if (!this.#required.exists((path) => !this.#mapped.has(path)))
      return RefinementStatus.checkable();
    return this.#missing.isEmpty() ? RefinementStatus.waived(waived) : RefinementStatus.gap(gap);
  }
  forInvariant() {
    const names = this.#unmapped().sortedLexicographically().joined(", ");
    return this.#status(`depends on unmapped attribute(s) ${names}`, `depends on attribute(s) ${names} that are neither mapped nor in unmapped[]`);
  }
  forEvent() {
    const names = this.#unmapped().sortedCanonically().joined(", ");
    return this.#status(`depends on unmapped attribute(s) ${names}`, `depends on attribute(s) ${names} that are neither mapped nor in unmapped[]`);
  }
  forScenario() {
    const names = this.#unmapped().sortedLexicographically().joined(", ");
    return this.#status(`binds unmapped attribute(s) ${names}`, `binds attribute(s) ${names} that are neither mapped nor in unmapped[]`);
  }
}
// src/design/domain/value-equality.ts
function sameArray(left, right, equals) {
  return left.length === right.length && left.every((value, index) => equals(value, right[index]));
}
function sameIterable(left, right, equals) {
  return sameArray([...left], [...right], equals);
}
function sameOptional(left, right, equals) {
  if (left === undefined || right === undefined)
    return left === right;
  return equals(left, right);
}
function sameExpression(left, right) {
  return sameOptional(left, right, (a, b) => canonicalStringify(a) === canonicalStringify(b));
}
function sameRecord(left, right) {
  const keys = Object.keys(left).sort();
  const otherKeys = Object.keys(right).sort();
  return sameArray(keys, otherKeys, (a, b) => a === b) && keys.every((key) => Object.is(left[key], right[key]));
}

// src/design/domain/refinement-map-defect.ts
class RefinementMapDefect {
  #state;
  constructor(state) {
    this.#state = state.kind === "invalid-expression" ? { ...state, problem: { ...state.problem } } : { ...state };
  }
  static uncoveredAttribute(path) {
    return new RefinementMapDefect({ kind: "uncovered-attribute", path: AttributePath.of(path) });
  }
  static enumMappingOutsideEquality(path) {
    return new RefinementMapDefect({ kind: "enum-mapping-outside-equality", path: AttributePath.of(path) });
  }
  static unspecifiedMapping(path) {
    return new RefinementMapDefect({ kind: "unspecified-mapping", path: AttributePath.of(path) });
  }
  static effectNotAssignmentConjunction() {
    return new RefinementMapDefect({ kind: "effect-not-assignment-conjunction" });
  }
  static invalidExpression(problem) {
    return new RefinementMapDefect({ kind: "invalid-expression", problem });
  }
  message() {
    const state = this.#state;
    switch (state.kind) {
      case "uncovered-attribute":
        return `requirements attribute "${state.path.asString()}" is not covered by the attrMap`;
      case "enum-mapping-outside-equality":
        return `enum-mapped requirements attribute "${state.path.asString()}" is only legal inside eq/ne against an enum literal`;
      case "unspecified-mapping":
        return `attrMap entry for "${state.path.asString()}" declares neither an expression nor enum cases`;
      case "effect-not-assignment-conjunction":
        return "requirements effect is not a conjunction of primed assignments";
      case "invalid-expression":
        return `substituted expression could not be constructed: ${state.problem.kind}`;
    }
  }
  asCompileErrorSkip(target, unit) {
    return DesignSkipped.of({
      target,
      reason: SkipReason.compileError(),
      unit: UnitName.of(unit),
      detail: `alpha substitution failed: ${this.message()}`
    });
  }
}

// src/design/domain/attribute-mapping.ts
function primeAll(e) {
  if (e.op === "ref")
    return { ...e, prime: true };
  return { ...e, args: (e.args ?? []).map(primeAll) };
}

class AttributeMapping {
  #req;
  #variant;
  constructor(req, variant) {
    this.#req = req;
    this.#variant = variant.kind === "expression" ? { kind: "expression", expr: ExpressionTree.of(variant.expr).asExpression() } : variant.kind === "enum-cases" ? {
      kind: "enum-cases",
      from: variant.from,
      cases: boundedValueSnapshot(variant.cases, { string: 4096, nodes: 10001, depth: 1, total: 16777216 })
    } : { kind: "unspecified" };
  }
  static of(req, value) {
    return new AttributeMapping(req, value);
  }
  static parse(req, value) {
    return parseConstruction(() => new AttributeMapping(req, value));
  }
  equals(other) {
    const variant = this.#variant;
    const otherVariant = other.#variant;
    if (!this.#req.equals(other.#req) || variant.kind !== otherVariant.kind)
      return false;
    if (variant.kind === "unspecified")
      return true;
    if (variant.kind === "expression" && otherVariant.kind === "expression")
      return sameExpression(variant.expr, otherVariant.expr);
    if (variant.kind !== "enum-cases" || otherVariant.kind !== "enum-cases")
      return false;
    if (!variant.from.equals(otherVariant.from))
      return false;
    const left = Object.keys(variant.cases).sort();
    const right = Object.keys(otherVariant.cases).sort();
    return left.length === right.length && left.every((key, index) => key === right[index] && variant.cases[key] === otherVariant.cases[key]);
  }
  hashCode() {
    const variant = this.#variant;
    if (variant.kind === "expression") {
      return combinedHash([
        this.#req.hashCode(),
        hashOfString(variant.kind),
        hashOfString(canonicalStringify(variant.expr))
      ]);
    }
    if (variant.kind === "enum-cases") {
      return combinedHash([
        this.#req.hashCode(),
        hashOfString(variant.kind),
        variant.from.hashCode(),
        hashOfString(canonicalStringify(variant.cases))
      ]);
    }
    return combinedHash([this.#req.hashCode(), hashOfString(variant.kind)]);
  }
  diagnostics(unit, attributes) {
    const messages = [];
    const reqPath = this.#req.asString();
    const reqAttr = attributes.byPath(AttributePath.of(reqPath));
    if (!reqAttr) {
      messages.push(`attrMap entry "${reqPath}" names no attribute of the requirements IR`);
      return ErrorMessages.collect(messages.map(ErrorMessage.parse));
    }
    if (this.#variant.kind === "enum-cases") {
      const from = this.#variant.from.asString();
      if (!reqAttr.isEnum()) {
        messages.push(`attrMap entry "${reqPath}" uses enumMap but the requirements attribute is ${reqAttr.kind()}`);
      }
      if (!unit.attrPaths().has(AttributePath.of(from))) {
        messages.push(`enumMap.from "${from}" is not a design attribute of unit ${unit.name()}`);
        return ErrorMessages.collect(messages.map(ErrorMessage.parse));
      }
      const fromValues = unit.declaredEnumValuesOf(from);
      if (fromValues === null) {
        messages.push(`enumMap.from "${from}" is not an enum design attribute`);
        return ErrorMessages.collect(messages.map(ErrorMessage.parse));
      }
      const missing = this.missingCasesOver(fromValues);
      if (missing.length > 0) {
        messages.push(`enumMap for "${reqPath}" is not total over "${from}": missing case(s) ${missing.join(", ")}`);
      }
      const badResults = this.producedValuesOutside(reqAttr.declaredValues());
      if (badResults.length > 0) {
        messages.push(`enumMap for "${reqPath}" produces value(s) ${badResults.join(", ")} outside the requirements attribute's values`);
      }
    } else if (this.#variant.kind === "expression") {
      for (const r of this.referencedPaths()) {
        if (!unit.attrPaths().has(AttributePath.of(r))) {
          messages.push(`attrMap expression for "${reqPath}" references "${r}", which is not a design attribute of unit ${unit.name()}`);
        }
      }
    }
    return ErrorMessages.collect(messages.map(ErrorMessage.parse));
  }
  isFor(reqPath) {
    return this.#req.equals(reqPath);
  }
  req() {
    return this.#req;
  }
  expandComparison(op, reqValue, primed) {
    const variant = this.#variant;
    if (variant.kind !== "enum-cases")
      return null;
    const from = { op: "ref", path: variant.from.asString(), ...primed ? { prime: true } : {} };
    const matching = Object.entries(variant.cases).filter(([, rv]) => rv === reqValue).map(([designValue]) => designValue).sort();
    const disjunction = matching.length === 0 ? { op: "bool", value: false } : matching.length === 1 ? { op: "eq", args: [from, { op: "enum", value: matching[0] }] } : {
      op: "or",
      args: matching.map((d) => ({ op: "eq", args: [from, { op: "enum", value: d }] }))
    };
    return op === "eq" ? disjunction : { op: "not", args: [disjunction] };
  }
  substituteForReference(reqPath, primed) {
    const variant = this.#variant;
    if (variant.kind === "enum-cases") {
      return err(RefinementMapDefect.enumMappingOutsideEquality(reqPath));
    }
    if (variant.kind === "unspecified") {
      return err(RefinementMapDefect.unspecifiedMapping(reqPath));
    }
    const substituted = variant.expr;
    return ok(primed ? primeAll(substituted) : substituted);
  }
  abstractFrameEquality() {
    const variant = this.#variant;
    if (variant.kind === "enum-cases") {
      const classes = EnumerationMembers.of(Object.values(variant.cases).map((value) => EnumerationMember.of(value))).sortedUniqueCanonically().foldLeft([], (acc, reqValue) => {
        const members = Object.entries(variant.cases).filter(([, rv]) => reqValue.matchesLiteral(rv)).map(([d]) => d).sort();
        const inClass = (primed) => {
          const refNode = {
            op: "ref",
            path: variant.from.asString(),
            ...primed ? { prime: true } : {}
          };
          const eqs = members.map((d) => ({ op: "eq", args: [refNode, { op: "enum", value: d }] }));
          return eqs.length === 1 ? eqs[0] : { op: "or", args: eqs };
        };
        acc.push({ op: "iff", args: [inClass(false), inClass(true)] });
        return acc;
      });
      return classes.length === 1 ? classes[0] : { op: "and", args: classes };
    }
    if (variant.kind === "unspecified")
      return null;
    const preE = variant.expr;
    return { op: "eq", args: [preE, primeAll(preE)] };
  }
  missingCasesOver(fromValues) {
    const variant = this.#variant;
    if (variant.kind !== "enum-cases")
      return [];
    return fromValues.filter((v) => !Object.hasOwn(variant.cases, v)).sort();
  }
  producedValuesOutside(reqValues) {
    const variant = this.#variant;
    if (variant.kind !== "enum-cases")
      return [];
    return EnumerationMembers.of(Object.values(variant.cases).filter((rv) => !(reqValues?.exists((member) => member.matchesLiteral(rv)) ?? false)).map((value) => EnumerationMember.of(value))).sortedUniqueCanonically().foldLeft([], (acc, member) => {
      acc.push(member.asString());
      return acc;
    });
  }
  referencedPaths() {
    const variant = this.#variant;
    if (variant.kind !== "expression")
      return [];
    return ExpressionTree.of(variant.expr).referencedPaths();
  }
}
// src/design/domain/attribute-paths.ts
class AttributePaths extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = KeySet.of(boundedCollectionSnapshot(values, 65536, "too-many-attribute-paths"));
  }
  rebuild(values) {
    return new AttributePaths(values);
  }
  static of(values) {
    return new AttributePaths(values);
  }
  map(transform) {
    return this.mapTo(transform, AttributePaths.of);
  }
  combine(other) {
    return this.combineTo(other, AttributePaths.of);
  }
  static parse(values) {
    return parseConstruction(() => new AttributePaths(values));
  }
  add(value) {
    if (this.#values.has(value))
      return this;
    return new AttributePaths([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  has(value) {
    return this.#values.has(value);
  }
  sortedLexicographically() {
    return AttributePaths.of([...this.#values].sort((a, b) => a.asString() < b.asString() ? -1 : a.asString() > b.asString() ? 1 : 0));
  }
  sortedCanonically() {
    return AttributePaths.of([...this.#values].sort((a, b) => a.compareTo(b)));
  }
  joined(separator) {
    return [...this.#values].map((path) => path.asString()).join(separator);
  }
  toArray() {
    return [...this.#values];
  }
}

// src/design/domain/design-findings.ts
function sortDesignFindings(findings) {
  return [...findings].sort((a, b) => {
    const kr = a.compareKindTo(b);
    if (kr !== 0)
      return kr;
    if (a.unit() !== b.unit())
      return a.unit() < b.unit() ? -1 : 1;
    const ta = a.targets().joined(",");
    const tb = b.targets().joined(",");
    if (ta !== tb)
      return ta < tb ? -1 : 1;
    return a.detail() < b.detail() ? -1 : a.detail() > b.detail() ? 1 : 0;
  });
}

class DesignFindings extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-design-findings");
  }
  rebuild(values) {
    return new DesignFindings(values);
  }
  static of(values) {
    return new DesignFindings(values);
  }
  map(transform) {
    return this.mapTo(transform, DesignFindings.of);
  }
  combine(other) {
    return this.combineTo(other, DesignFindings.of);
  }
  static parse(values) {
    return parseConstruction(() => new DesignFindings(values));
  }
  add(value) {
    return new DesignFindings([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  sortedCanonically() {
    return new DesignFindings(sortDesignFindings(this.#values));
  }
  count() {
    return this.#values.length;
  }
  toDocuments() {
    return this.#values.map((finding) => {
      const out = {
        kind: finding.kind(),
        frRefs: finding.functionalRequirementReferences().toStrings(),
        targets: finding.targets().toStrings(),
        witness: finding.witness().toDocument(),
        unit: finding.unit(),
        detail: finding.detail()
      };
      return out;
    });
  }
  toArray() {
    return this.#values;
  }
}

// src/design/domain/attribute-mappings.ts
class AttributeMappings extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-attribute-mappings");
  }
  rebuild(values) {
    return new AttributeMappings(values);
  }
  static of(values) {
    return new AttributeMappings(values);
  }
  map(transform) {
    return this.mapTo(transform, AttributeMappings.of);
  }
  combine(other) {
    return this.combineTo(other, AttributeMappings.of);
  }
  static parse(values) {
    return parseConstruction(() => new AttributeMappings(values));
  }
  add(value) {
    return new AttributeMappings([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  coverageOf(required, unmapped) {
    const mapped = [], waived = [], missing = [];
    for (const path of required) {
      if (this.covers(path.asString()))
        mapped.push(path);
      else if (unmapped.covers(path))
        waived.push(path);
      else
        missing.push(path);
    }
    return AttributeCoverage.of({
      required,
      mapped: AttributePaths.of(mapped),
      waived: AttributePaths.of(waived),
      missing: AttributePaths.of(missing)
    });
  }
  diagnostics(unit, requirements, map, artifact) {
    const findings = [];
    const seen = new Set;
    for (const mapping of this.#values) {
      const path = mapping.req();
      if (seen.has(path.asString()))
        findings.push(map.attributeGap(path, `attrMap maps "${path.asString()}" more than once`, artifact));
      seen.add(path.asString());
      for (const message of mapping.diagnostics(unit, requirements.attributes()))
        findings.push(map.attributeGap(path, message.asString(), artifact));
    }
    for (const attribute of requirements.attributes().sortedByPath()) {
      const path = attribute.path();
      if (!this.covers(path.asString()) && !map.unmapped().covers(path))
        findings.push(map.attributeGap(path, `requirements attribute "${path.asString()}" is neither mapped by attrMap nor listed in unmapped[] \u2014 silence is a contract violation`, artifact));
    }
    return DesignFindings.of(findings);
  }
  #byRequirementPath(reqPath) {
    const path = AttributePath.parse(reqPath);
    if (!path.ok)
      return;
    let found;
    for (const m of this.#values) {
      if (m.isFor(path.value))
        found = m;
    }
    return found;
  }
  covers(reqPath) {
    return this.#byRequirementPath(reqPath) !== undefined;
  }
  substitute(e, post) {
    const substituted = this.#substitute(e, post);
    if (!substituted.ok)
      return substituted;
    const parsed = ExpressionTree.parse(substituted.value);
    return parsed.ok ? ok(parsed.value.asExpression()) : err(RefinementMapDefect.invalidExpression(parsed.error));
  }
  #substitute(e, post) {
    if (e.op === "eq" || e.op === "ne") {
      const [a, b] = e.args ?? [];
      const refArg = a?.op === "ref" ? a : b?.op === "ref" ? b : null;
      const enumArg = a?.op === "enum" ? a : b?.op === "enum" ? b : null;
      if (refArg && enumArg && typeof refArg.path === "string" && typeof enumArg.value === "string") {
        const expanded = this.#byRequirementPath(refArg.path)?.expandComparison(e.op, enumArg.value, post || refArg.prime === true);
        if (expanded !== null && expanded !== undefined)
          return ok(expanded);
      }
    }
    if (e.op === "ref" && typeof e.path === "string") {
      const mapping = this.#byRequirementPath(e.path);
      if (!mapping)
        return err(RefinementMapDefect.uncoveredAttribute(e.path));
      return mapping.substituteForReference(e.path, post || e.prime === true);
    }
    if (e.args) {
      const args = [];
      for (const a of e.args) {
        const sub = this.#substitute(a, post);
        if (!sub.ok)
          return sub;
        args.push(sub.value);
      }
      return ok({ ...e, args });
    }
    return ok(e);
  }
  equalityFor(reqPath) {
    const expression = this.#byRequirementPath(reqPath)?.abstractFrameEquality();
    if (expression == null)
      return ok(null);
    const parsed = ExpressionTree.parse(expression);
    return parsed.ok ? ok(parsed.value.asExpression()) : err(RefinementMapDefect.invalidExpression(parsed.error));
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/business-rule-reference.ts
class BusinessRuleReference {
  #value;
  constructor(value) {
    if (value.length > 128)
      throw new IllegalArgumentException({ kind: "br-ref-too-long", raw: value.length });
    if (!/^BR[0-9]+\.[0-9]+$/.test(value))
      throw new IllegalArgumentException({ kind: "malformed-business-rule-reference", raw: value });
    this.#value = value;
  }
  static of(raw) {
    return new BusinessRuleReference(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new BusinessRuleReference(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  compareTo(other) {
    return this.#value < other.#value ? -1 : this.#value > other.#value ? 1 : 0;
  }
  asString() {
    return this.#value;
  }
}
// src/design/domain/business-rule-reference-index.ts
class BusinessRuleReferenceIndex extends FirstClassCollectionBase {
  #ids;
  constructor(ids) {
    super();
    this.#ids = ids;
  }
  rebuild(values) {
    return new BusinessRuleReferenceIndex(KeySet.of(values));
  }
  map(transform) {
    return this.mapTo(transform, (values) => this.rebuild(values));
  }
  combine(other) {
    return this.combineTo(other, (values) => this.rebuild(values));
  }
  *[Symbol.iterator]() {
    yield* this.#ids;
  }
  static of(ids) {
    return new BusinessRuleReferenceIndex(KeySet.of(ids));
  }
  static parse(ids) {
    return parseConstruction(() => new BusinessRuleReferenceIndex(KeySet.of(ids)));
  }
  diagnostics(used, unformalized) {
    const errors = [];
    for (const reference of [...used].sort((a, b) => a.asString() < b.asString() ? -1 : a.asString() > b.asString() ? 1 : 0)) {
      if (!this.has(reference))
        errors.push(`brRef "${reference.asString()}" does not exist in rules.md`);
    }
    for (const reference of [...this.#ids].sort((a, b) => a.asString() < b.asString() ? -1 : a.asString() > b.asString() ? 1 : 0)) {
      if (!used.has(reference) && !unformalized.covers(TargetIdentifier.of(reference.asString())))
        errors.push(`BR coverage: rule ${reference.asString()} in rules.md is neither referenced by any obligation/transition/scenario nor listed in unformalized[] \u2014 silence is a contract violation`);
    }
    return ErrorMessages.collect(errors.map(ErrorMessage.parse));
  }
  has(br) {
    return this.#ids.has(br);
  }
  sortedIds() {
    return this.#ids.toArray().map((id) => id.asString()).sort();
  }
}
// src/design/domain/business-rule-references.ts
class BusinessRuleReferences extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 1e4, "too-many-business-rule-references");
  }
  rebuild(values) {
    return new BusinessRuleReferences(values);
  }
  static of(values) {
    return new BusinessRuleReferences(values);
  }
  map(transform) {
    return this.mapTo(transform, BusinessRuleReferences.of);
  }
  combine(other) {
    return this.combineTo(other, BusinessRuleReferences.of);
  }
  static parse(values) {
    return parseConstruction(() => new BusinessRuleReferences(values));
  }
  add(value) {
    return new BusinessRuleReferences([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
  toStrings() {
    return this.#values.map((v) => v.asString());
  }
}
// src/design/domain/checked-units.ts
class CheckedUnits extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-checked-units");
  }
  rebuild(values) {
    return new CheckedUnits(values);
  }
  static of(values) {
    return new CheckedUnits(values);
  }
  map(transform) {
    return this.mapTo(transform, CheckedUnits.of);
  }
  combine(other) {
    return this.combineTo(other, CheckedUnits.of);
  }
  static parse(values) {
    return parseConstruction(() => new CheckedUnits(values));
  }
  add(value) {
    return new CheckedUnits([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  sortedUniqueCanonically() {
    return CheckedUnits.of(Array.from(TargetIdentifiers.of(Array.from(this.toStrings(), (raw) => TargetIdentifier.of(raw))).sortedUniqueCanonically().toStrings(), (raw) => UnitName.of(raw)));
  }
  toArray() {
    return this.#values;
  }
  toStrings() {
    return this.#values.map((v) => v.asString());
  }
}
// src/design/domain/design-assignment.ts
class DesignAssignment {
  #target;
  #rightHandSide;
  constructor(target, rightHandSide) {
    this.#target = target;
    this.#rightHandSide = rightHandSide;
  }
  static of(target, rightHandSide) {
    return new DesignAssignment(target, rightHandSide);
  }
  equals(other) {
    return this.#target.equals(other.#target) && this.#rightHandSide.equals(other.#rightHandSide);
  }
  hashCode() {
    return combinedHash([this.#target.hashCode(), this.#rightHandSide.hashCode()]);
  }
  target() {
    return this.#target;
  }
  rightHandSide() {
    return this.#rightHandSide;
  }
}
// src/design/domain/design-assignments.ts
class DesignAssignments extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    if (values.length > 1e4)
      throw new IllegalArgumentException({ kind: "expression-too-large" });
    let nodes = 0;
    const entries = [];
    for (const assignment of values) {
      assignment.rightHandSide().walk(() => {
        if (++nodes > 1e4)
          throw new IllegalArgumentException({ kind: "expression-too-large" });
      });
      entries.push([assignment.target(), assignment]);
    }
    this.#values = KeyedIndex.of(entries);
  }
  rebuild(values) {
    return new DesignAssignments(values);
  }
  *[Symbol.iterator]() {
    yield* this.#values.values();
  }
  map(transform) {
    return this.mapTo(transform, DesignAssignments.of);
  }
  combine(other) {
    return this.combineTo(other, DesignAssignments.of);
  }
  static parse(values) {
    return parseConstruction(() => new DesignAssignments(values));
  }
  static of(values) {
    return new DesignAssignments(values);
  }
  rhsOf(path) {
    return this.#values.get(path)?.rightHandSide().asExpression();
  }
}
// src/design/domain/design-attribute-catalog-entry.ts
class DesignAttributeCatalogEntry {
  #path;
  #owner;
  #attribute;
  constructor(owner, attribute) {
    this.#path = AttributePath.of(`${owner.asString()}.${attribute.name().asString()}`);
    this.#owner = owner;
    this.#attribute = attribute;
  }
  static of(owner, attribute) {
    return new DesignAttributeCatalogEntry(owner, attribute);
  }
  static parse(owner, attribute) {
    return parseConstruction(() => new DesignAttributeCatalogEntry(owner, attribute));
  }
  path() {
    return this.#path;
  }
  owner() {
    return this.#owner;
  }
  attribute() {
    return this.#attribute;
  }
  equals(other) {
    return this.#path.equals(other.#path) && this.#owner.equals(other.#owner) && this.#attribute.equals(other.#attribute);
  }
  hashCode() {
    return combinedHash([this.#path.hashCode(), this.#owner.hashCode(), this.#attribute.hashCode()]);
  }
}

// src/design/domain/design-attribute-declarations.ts
class DesignAttributeDeclarations extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-design-attribute-declarations");
  }
  rebuild(values) {
    return new DesignAttributeDeclarations(values);
  }
  static of(values) {
    return new DesignAttributeDeclarations(values);
  }
  map(transform) {
    return this.mapTo(transform, DesignAttributeDeclarations.of);
  }
  combine(other) {
    return this.combineTo(other, DesignAttributeDeclarations.of);
  }
  static parse(values) {
    return parseConstruction(() => new DesignAttributeDeclarations(values));
  }
  add(value) {
    return new DesignAttributeDeclarations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}

// src/design/domain/design-entity-declaration.ts
class DesignEntityDeclaration {
  #name;
  #description;
  #attributes;
  constructor(props) {
    this.#name = props.name;
    this.#description = props.description;
    this.#attributes = props.attributes;
  }
  static of(props) {
    return new DesignEntityDeclaration(props);
  }
  equals(other) {
    return this.#name.equals(other.#name) && this.#description === other.#description && this.#attributes.equals(other.#attributes);
  }
  hashCode() {
    return combinedHash([
      this.#name.hashCode(),
      hashOfNullable(this.#description, hashOfString),
      this.#attributes.hashCode()
    ]);
  }
  name() {
    return this.#name;
  }
  description() {
    return this.#description;
  }
  attributes() {
    return this.#attributes;
  }
  inspectAttributes(visitor) {
    this.#attributes.foldLeft(new Set, (seen, attribute) => {
      const attributeName = attribute.name().asString();
      visitor(`${this.#name.asString()}.${attributeName}`, attribute, seen.has(attributeName));
      seen.add(attributeName);
      return seen;
    });
  }
}

// src/design/domain/design-entity-declarations.ts
class DesignEntityDeclarations extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-design-entity-declarations");
  }
  rebuild(values) {
    return new DesignEntityDeclarations(values);
  }
  static of(values) {
    return new DesignEntityDeclarations(values);
  }
  map(transform) {
    return this.mapTo(transform, DesignEntityDeclarations.of);
  }
  combine(other) {
    return this.combineTo(other, DesignEntityDeclarations.of);
  }
  static parse(values) {
    return parseConstruction(() => new DesignEntityDeclarations(values));
  }
  add(value) {
    return new DesignEntityDeclarations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  #inspect(entityFound, attributeFound) {
    const names = new Set;
    for (const entity of this.#values) {
      const name = entity.name().asString();
      entityFound(entity, names.has(name));
      names.add(name);
      entity.inspectAttributes(attributeFound);
    }
  }
  hasAmbiguousAttributes() {
    let ambiguous = false;
    this.#inspect((_entity, duplicate) => {
      ambiguous ||= duplicate;
    }, (_path, _attribute, duplicate) => {
      ambiguous ||= duplicate;
    });
    return ambiguous;
  }
  diagnostics() {
    const messages = [];
    this.#inspect((entity, duplicate) => {
      if (duplicate)
        messages.push(`duplicate entity "${entity.name().asString()}"`);
    }, (coordinate, attribute, duplicate) => {
      if (duplicate)
        messages.push(`duplicate attribute "${coordinate}"`);
      if (attribute.lacksIntBounds())
        messages.push(`${coordinate}: int attributes require min and max \u2014 the Quint backend needs bounded domains`);
      if (attribute.boundsInverted())
        messages.push(`${coordinate}: min > max`);
      if (attribute.boundsOutsideSafeRange())
        messages.push(`${coordinate}: bounds must be safe integers`);
    });
    return ErrorMessages.collect(messages.map(ErrorMessage.parse));
  }
  toArray() {
    return this.#values;
  }
}

// src/design/domain/design-attribute-catalog.ts
class DesignAttributeCatalog extends FirstClassCollectionBase {
  #declarations;
  #byPath;
  #entries;
  constructor(declarations, retained) {
    super();
    if (retained !== undefined && retained.length > 65536)
      throw new IllegalArgumentException({ kind: "attribute-catalog-too-large", raw: retained.length });
    let count = 0;
    for (const entity of declarations) {
      if (++count > 65536)
        throw new IllegalArgumentException({ kind: "attribute-catalog-too-large", raw: count });
      entity.inspectAttributes(() => {
        if (++count > 65536)
          throw new IllegalArgumentException({ kind: "attribute-catalog-too-large", raw: count });
      });
    }
    if (declarations.hasAmbiguousAttributes())
      throw new IllegalArgumentException({ kind: "ambiguous-design-attributes" });
    const attributes = new Map;
    const entries = [];
    if (retained === undefined) {
      for (const entity of declarations)
        entity.inspectAttributes((path, attribute) => {
          attributes.set(path, attribute);
          entries.push(DesignAttributeCatalogEntry.of(entity.name(), attribute));
        });
    } else {
      for (const entry of retained) {
        const path = entry.path().asString();
        if (attributes.has(path))
          throw new IllegalArgumentException({ kind: "ambiguous-design-attributes", raw: path });
        attributes.set(path, entry.attribute());
        entries.push(entry);
      }
    }
    this.#declarations = declarations;
    this.#entries = Object.freeze(entries);
    this.#byPath = KeyedIndex.of([...attributes].map(([path, attribute]) => [AttributePath.of(path), attribute]));
  }
  rebuild(values) {
    return this.#rebuildWithContexts(values, [this.#declarations]);
  }
  #rebuildWithContexts(values, contexts) {
    const grouped = new Map;
    for (const entry of values) {
      const key = entry.owner().asString();
      const group = grouped.get(key) ?? { owner: entry.owner(), attributes: [] };
      group.attributes.push(entry.attribute());
      grouped.set(key, group);
    }
    const metadata = new Map;
    for (const context of contexts)
      for (const entity of context) {
        const key = entity.name().asString();
        const prior = metadata.get(key);
        if (prior !== undefined && prior.description() !== entity.description())
          throw new IllegalArgumentException({ kind: "conflicting-design-entity-metadata", raw: key });
        if (prior === undefined)
          metadata.set(key, entity);
      }
    const declarations = [...metadata.values()].map((entity) => {
      const group = grouped.get(entity.name().asString());
      return DesignEntityDeclaration.of({
        name: entity.name(),
        ...entity.description() !== undefined ? { description: entity.description() } : {},
        attributes: DesignAttributeDeclarations.of(group?.attributes ?? [])
      });
    });
    for (const group of grouped.values()) {
      if (metadata.has(group.owner.asString()))
        continue;
      declarations.push(DesignEntityDeclaration.of({
        name: group.owner,
        attributes: DesignAttributeDeclarations.of(group.attributes)
      }));
    }
    return new DesignAttributeCatalog(DesignEntityDeclarations.of(declarations), values);
  }
  map(transform) {
    return this.mapTo(transform, (values) => this.rebuild(values));
  }
  combine(other) {
    return this.combineTo(other, (values) => this.#rebuildWithContexts(values, [this.#declarations, other.#declarations]));
  }
  *[Symbol.iterator]() {
    yield* this.#entries;
  }
  #attributeAt(path) {
    const parsed = AttributePath.parse(path);
    return parsed.ok ? this.#byPath.get(parsed.value) : undefined;
  }
  static of(declarations) {
    return new DesignAttributeCatalog(declarations);
  }
  static parse(declarations) {
    return parseConstruction(() => new DesignAttributeCatalog(declarations));
  }
  declarations() {
    return this.#declarations;
  }
  paths() {
    return AttributePaths.of([...this.#byPath.keys()]);
  }
  enumValuesAt(path) {
    return this.#attributeAt(path)?.enumStates() ?? null;
  }
  declares(path) {
    return this.#attributeAt(path) !== undefined;
  }
  encodingDiagnostics() {
    const errors = [];
    const encoded = new Map;
    for (const coordinate of this.#byPath.keys()) {
      const path = coordinate.asString();
      const key = path.replace(/\./g, "_");
      const prior = encoded.get(key);
      if (prior !== undefined) {
        errors.push(`attribute paths "${prior}" and "${path}" collide under the solver variable encoding (dots become underscores)`);
      } else {
        encoded.set(key, path);
      }
    }
    return ErrorMessages.collect(errors.map(ErrorMessage.parse));
  }
  expressionDiagnostics(e, ctx, primesAllowed) {
    const errors = [];
    ExpressionTree.of(e).inspectTerms({
      reference: (path, primed) => {
        if (!(this.#attributeAt(path) !== undefined))
          errors.push(`${ctx}: unresolvable reference "${path}"`);
        if (primed && !primesAllowed)
          errors.push(`${ctx}: primed reference "${path}" is only legal in effects and event-scenario expectations`);
      },
      enumLiteral: (value, sibling) => {
        const attribute = sibling === undefined ? undefined : this.#attributeAt(sibling);
        if (attribute !== undefined) {
          if (!attribute.isEnum())
            errors.push(`${ctx}: enum literal "${value}" is compared against non-enum attribute "${sibling}"`);
          else if (!attribute.admitsEnumLiteral(value))
            errors.push(`${ctx}: enum literal "${value}" is not a value of "${sibling}"`);
        } else if (sibling === undefined && ![...this.#byPath.values()].some((attribute2) => attribute2.admitsEnumLiteral(value))) {
          errors.push(`${ctx}: enum literal "${value}" is not a value of any declared enum attribute`);
        }
      }
    });
    return ErrorMessages.collect(errors.map(ErrorMessage.parse));
  }
  bindingDiagnostics(bindings, context) {
    const errors = [];
    for (const binding of bindings) {
      const path = binding.path().asString();
      const attribute = this.#attributeAt(path);
      if (!attribute)
        errors.push(`${context}: binding for unknown attribute "${path}"`);
      else if (!attribute.fitsBinding(binding.value()))
        errors.push(`${context}: binding value ${binding.value().describe()} does not fit ${attribute.kindLabel()} attribute "${path}"`);
    }
    return ErrorMessages.collect(errors.map(ErrorMessage.parse));
  }
}
// src/design/domain/design-attribute-declaration.ts
class DesignAttributeDeclaration {
  #name;
  #kind;
  #description;
  #values;
  #min;
  #max;
  constructor(props) {
    this.#name = props.name;
    this.#kind = props.kind;
    this.#description = props.description;
    this.#values = props.values;
    this.#min = props.min;
    this.#max = props.max;
  }
  static of(props) {
    return new DesignAttributeDeclaration(props);
  }
  equals(other) {
    const leftValues = this.#values;
    const rightValues = other.#values;
    const sameValues = leftValues === undefined || rightValues === undefined ? leftValues === rightValues : leftValues.equals(rightValues);
    return this.#name.equals(other.#name) && this.#kind.equals(other.#kind) && this.#description === other.#description && this.#min?.asNumber() === other.#min?.asNumber() && this.#max?.asNumber() === other.#max?.asNumber() && sameValues;
  }
  hashCode() {
    const values = this.#values;
    const valuesHash = values === undefined ? 0 : values.hashCode();
    return combinedHash([
      this.#name.hashCode(),
      this.#kind.hashCode(),
      hashOfNullable(this.#description, hashOfString),
      hashOfNullable(this.#min, (bound) => hashOfNumber(bound.asNumber())),
      hashOfNullable(this.#max, (bound) => hashOfNumber(bound.asNumber())),
      valuesHash
    ]);
  }
  name() {
    return this.#name;
  }
  lacksIntBounds() {
    return this.#kind.isInt() && (this.#min === undefined || this.#max === undefined);
  }
  boundsInverted() {
    return this.#kind.isInt() && this.#min !== undefined && this.#max !== undefined && this.#min.exceeds(this.#max);
  }
  boundsOutsideSafeRange() {
    return this.#min !== undefined && !this.#min.isSafeInteger() || this.#max !== undefined && !this.#max.isSafeInteger();
  }
  isEnum() {
    return this.#kind.isEnum();
  }
  admitsEnumLiteral(value) {
    return this.#kind.isEnum() && (this.#values?.exists((member) => member.matchesLiteral(value)) ?? false);
  }
  fitsBinding(value) {
    return value.fits(this.#kind, (literal) => this.admitsEnumLiteral(literal));
  }
  enumStates() {
    return this.#kind.isEnum() && this.#values !== undefined ? this.#values : null;
  }
  kindLabel() {
    return this.#kind.asString();
  }
  description() {
    return this.#description;
  }
  minBound() {
    return this.#min;
  }
  maxBound() {
    return this.#max;
  }
}
// src/design/domain/design-attribute-name.ts
class DesignAttributeName {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "design-attribute-name-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-machine-token", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new DesignAttributeName(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new DesignAttributeName(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/design/domain/lowered-background.ts
class LoweredBackground {
  #id;
  #assert;
  constructor(props) {
    this.#id = props.id;
    this.#assert = ExpressionTree.of(props.assert).asExpression();
  }
  static parse(props) {
    return parseConstruction(() => new LoweredBackground(props));
  }
  static of(props) {
    return new LoweredBackground(props);
  }
  equals(other) {
    return this.#id.equals(other.#id) && sameExpression(this.#assert, other.#assert);
  }
  hashCode() {
    return combinedHash([this.#id.hashCode(), hashOfString(canonicalStringify(this.#assert))]);
  }
  id() {
    return this.#id;
  }
  assertion() {
    return this.#assert;
  }
}

// src/design/domain/design-background-assumption.ts
class DesignBackgroundAssumption {
  #id;
  #assert;
  constructor(props) {
    this.#id = props.id;
    this.#assert = ExpressionTree.of(props.assert).asExpression();
  }
  static parse(props) {
    return parseConstruction(() => new DesignBackgroundAssumption(props));
  }
  static of(props) {
    return new DesignBackgroundAssumption(props);
  }
  equals(other) {
    return this.#id.equals(other.#id) && sameExpression(this.#assert, other.#assert);
  }
  hashCode() {
    return combinedHash([this.#id.hashCode(), hashOfString(canonicalStringify(this.#assert))]);
  }
  id() {
    return this.#id;
  }
  assertion() {
    return this.#assert;
  }
  compareTo(other) {
    return this.#id.compareTo(other.#id);
  }
  loweredAs(id) {
    return LoweredBackground.of({ id, assert: this.#assert });
  }
}
// src/design/domain/design-background-assumptions.ts
class DesignBackgroundAssumptions extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-design-background-assumptions");
  }
  rebuild(values) {
    return new DesignBackgroundAssumptions(values);
  }
  static of(values) {
    return new DesignBackgroundAssumptions(values);
  }
  map(transform) {
    return this.mapTo(transform, DesignBackgroundAssumptions.of);
  }
  combine(other) {
    return this.combineTo(other, DesignBackgroundAssumptions.of);
  }
  static parse(values) {
    return parseConstruction(() => new DesignBackgroundAssumptions(values));
  }
  add(value) {
    return new DesignBackgroundAssumptions([...this.#values, value]);
  }
  sortedCanonically() {
    return new DesignBackgroundAssumptions([...this.#values].sort((a, b) => a.compareTo(b)));
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/design-background-declaration.ts
class DesignBackgroundDeclaration {
  #id;
  #assert;
  constructor(props) {
    this.#id = props.id;
    this.#assert = props.assert === undefined ? undefined : ExpressionTree.of(props.assert).asExpression();
  }
  static parse(props) {
    return parseConstruction(() => new DesignBackgroundDeclaration(props));
  }
  static of(props) {
    return new DesignBackgroundDeclaration(props);
  }
  equals(other) {
    return this.#id.equals(other.#id) && sameExpression(this.#assert, other.#assert);
  }
  hashCode() {
    return combinedHash([
      this.#id.hashCode(),
      hashOfNullable(this.#assert, (expression) => hashOfString(canonicalStringify(expression)))
    ]);
  }
  diagnostics(catalog) {
    const context = `background ${this.#id.asString()}`;
    const errors = [];
    if (this.#assert !== undefined)
      catalog.expressionDiagnostics(this.#assert, context, false).foldLeft(errors, (acc, message) => {
        acc.push(message.asString());
        return acc;
      });
    return ErrorMessages.collect(errors.map(ErrorMessage.parse));
  }
  id() {
    return this.#id;
  }
}
// src/design/domain/design-background-declarations.ts
class DesignBackgroundDeclarations extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-design-background-declarations");
  }
  rebuild(values) {
    return new DesignBackgroundDeclarations(values);
  }
  static of(values) {
    return new DesignBackgroundDeclarations(values);
  }
  map(transform) {
    return this.mapTo(transform, DesignBackgroundDeclarations.of);
  }
  combine(other) {
    return this.combineTo(other, DesignBackgroundDeclarations.of);
  }
  static parse(values) {
    return parseConstruction(() => new DesignBackgroundDeclarations(values));
  }
  add(value) {
    return new DesignBackgroundDeclarations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/design-background-identifier.ts
class DesignBackgroundIdentifier {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "design-background-id-too-long", raw: raw.length });
    if (!/^DBG-[0-9]+$/.test(raw))
      throw new IllegalArgumentException({ kind: "malformed-design-background-id", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new DesignBackgroundIdentifier(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new DesignBackgroundIdentifier(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  compareTo(other) {
    return compareCanonically(this.#value, other.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/design/domain/design-cross-checked-entries.ts
class DesignCrossCheckedEntries extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-design-cross-checked-entries");
  }
  rebuild(values) {
    return new DesignCrossCheckedEntries(values);
  }
  static of(values) {
    return new DesignCrossCheckedEntries(values);
  }
  map(transform) {
    return this.mapTo(transform, DesignCrossCheckedEntries.of);
  }
  combine(other) {
    return this.combineTo(other, DesignCrossCheckedEntries.of);
  }
  static parse(values) {
    return parseConstruction(() => new DesignCrossCheckedEntries(values));
  }
  add(value) {
    return new DesignCrossCheckedEntries([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toDocuments() {
    return this.#values.map((entry) => ({
      backend: entry.backend().asString(),
      unit: entry.unit().asString(),
      targets: [...entry.targets().toStrings()]
    }));
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/design-cross-checked-entry.ts
class DesignCrossCheckedEntry {
  #backend;
  #unit;
  #targets;
  constructor(props) {
    this.#backend = props.backend;
    this.#unit = props.unit;
    const outside = props.targets.filter((target) => !target.asString().startsWith("DSC-"));
    if (!outside.isEmpty())
      throw new IllegalArgumentException({ kind: "invalid-cross-checked-target", raw: outside.head().asString() });
    this.#targets = props.targets;
  }
  static of(props) {
    return new DesignCrossCheckedEntry(props);
  }
  static parse(props) {
    return parseConstruction(() => new DesignCrossCheckedEntry(props));
  }
  equals(other) {
    return this.#backend.equals(other.#backend) && this.#unit.equals(other.#unit) && this.#targets.equals(other.#targets);
  }
  hashCode() {
    return combinedHash([this.#backend.hashCode(), this.#unit.hashCode(), this.#targets.hashCode()]);
  }
  unit() {
    return this.#unit;
  }
  backend() {
    return this.#backend;
  }
  targets() {
    return this.#targets;
  }
  compareTo(other) {
    const a = this.#backend.asString();
    const b = other.#backend.asString();
    if (a !== b)
      return a < b ? -1 : 1;
    const unit = this.#unit.asString();
    const otherUnit = other.#unit.asString();
    return unit < otherUnit ? -1 : unit > otherUnit ? 1 : 0;
  }
}
// src/design/domain/design-entity-name.ts
class DesignEntityName {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "design-entity-name-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-machine-token", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new DesignEntityName(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new DesignEntityName(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/design/domain/effect-assignment.ts
function assignmentTerms(equation) {
  if (equation.op !== "eq" || equation.args?.length !== 2)
    return null;
  const [left, right] = equation.args;
  if (left?.op === "ref" && left.prime === true)
    return left.path !== undefined && right !== undefined ? { path: left.path, rightHandSide: right } : null;
  if (right?.op === "ref" && right.prime === true && right.path !== undefined && left !== undefined)
    return { path: right.path, rightHandSide: left };
  return null;
}

class EffectAssignment {
  #target;
  #equation;
  #rightHandSide;
  constructor(target, equation) {
    const terms = assignmentTerms(equation.asExpression());
    if (terms === null || terms.path !== target.asString())
      throw new IllegalArgumentException({ kind: "effect-not-assignment-conjunction" });
    this.#target = target;
    this.#equation = equation;
    this.#rightHandSide = ExpressionTree.of(terms.rightHandSide);
  }
  static of(target, equation) {
    return new EffectAssignment(target, equation);
  }
  equals(other) {
    return this.#target.equals(other.#target) && this.#equation.equals(other.#equation);
  }
  hashCode() {
    return combinedHash([this.#target.hashCode(), this.#equation.hashCode()]);
  }
  static parse(target, equation) {
    return parseConstruction(() => new EffectAssignment(target, equation));
  }
  static fromEquation(equation) {
    const terms = assignmentTerms(equation.asExpression());
    if (terms === null)
      return { ok: false, error: { kind: "effect-not-assignment-conjunction" } };
    const target = AttributePath.parse(terms.path);
    return target.ok ? EffectAssignment.parse(target.value, equation) : target;
  }
  target() {
    return this.#target;
  }
  equation() {
    return this.#equation;
  }
  asDesignAssignment() {
    return DesignAssignment.of(this.#target, this.#rightHandSide);
  }
}

// src/design/domain/effect-assignments.ts
class EffectAssignments extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    if (values.length > 1e4)
      throw new IllegalArgumentException({ kind: "expression-too-large" });
    let nodes = 0;
    const entries = [];
    for (const assignment of values) {
      assignment.equation().walk(() => {
        if (++nodes > 1e4)
          throw new IllegalArgumentException({ kind: "expression-too-large" });
      });
      entries.push([assignment.target(), assignment]);
    }
    this.#values = KeyedIndex.of(entries);
  }
  rebuild(values) {
    return new EffectAssignments(values);
  }
  static of(values) {
    return new EffectAssignments(values);
  }
  map(transform) {
    return this.mapTo(transform, EffectAssignments.of);
  }
  combine(other) {
    return this.combineTo(other, EffectAssignments.of);
  }
  static parse(values) {
    return parseConstruction(() => new EffectAssignments(values));
  }
  static fromEffect(effect) {
    const terms = [];
    const flatten = (expression) => {
      if (expression.op === "and")
        for (const child of expression.args ?? [])
          flatten(child);
      else
        terms.push(expression);
    };
    flatten(effect.asExpression());
    const assignments = [];
    for (const term of terms) {
      const assignment = EffectAssignment.fromEquation(ExpressionTree.of(term));
      if (!assignment.ok)
        return assignment;
      assignments.push(assignment.value);
    }
    return EffectAssignments.parse(assignments);
  }
  covers(path) {
    return this.#values.has(path);
  }
  *[Symbol.iterator]() {
    yield* this.#values.values();
  }
}

// src/design/domain/lowered-obligation.ts
class LoweredObligation {
  #id;
  #origin;
  #nature;
  #functionalRequirementReferences;
  #assert;
  #trigger;
  #guard;
  #effect;
  #temporal;
  constructor(props) {
    this.#id = props.id;
    this.#origin = props.origin;
    this.#nature = props.nature;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#assert = props.assert === undefined ? undefined : ExpressionTree.of(props.assert).asExpression();
    this.#trigger = props.trigger;
    this.#guard = props.guard === undefined ? undefined : ExpressionTree.of(props.guard).asExpression();
    this.#effect = props.effect === undefined ? undefined : ExpressionTree.of(props.effect).asExpression();
    this.#temporal = props.temporal === undefined ? undefined : {
      ...props.temporal,
      ...props.temporal.assert !== undefined ? { assert: ExpressionTree.of(props.temporal.assert).asExpression() } : {},
      ...props.temporal.from !== undefined ? { from: ExpressionTree.of(props.temporal.from).asExpression() } : {},
      ...props.temporal.to !== undefined ? { to: ExpressionTree.of(props.temporal.to).asExpression() } : {}
    };
  }
  static parse(props) {
    return parseConstruction(() => new LoweredObligation(props));
  }
  static of(props) {
    return new LoweredObligation(props);
  }
  equals(other) {
    const kinds = ["passthrough", "ignore", "vac-dead", "vac-shadow", "transition"];
    return this.#id.equals(other.#id) && this.#origin.design().equals(other.#origin.design()) && kinds.every((kind) => this.#origin.isKind(kind) === other.#origin.isKind(kind)) && this.#nature.equals(other.#nature) && sameIterable(this.#functionalRequirementReferences, other.#functionalRequirementReferences, (left, right) => left.equals(right)) && sameExpression(this.#assert, other.#assert) && sameOptional(this.#trigger, other.#trigger, (left, right) => left.equals(right)) && sameExpression(this.#guard, other.#guard) && sameExpression(this.#effect, other.#effect) && sameOptional(this.#temporal, other.#temporal, (left, right) => left.pattern === right.pattern && sameExpression(left.assert, right.assert) && sameExpression(left.from, right.from) && sameExpression(left.to, right.to));
  }
  hashCode() {
    const kinds = ["passthrough", "ignore", "vac-dead", "vac-shadow", "transition"];
    const hashOfExpression = (value) => hashOfString(canonicalStringify(value));
    return combinedHash([
      this.#id.hashCode(),
      this.#origin.design().hashCode(),
      ...kinds.map((kind) => hashOfBoolean(this.#origin.isKind(kind))),
      this.#nature.hashCode(),
      this.#functionalRequirementReferences.hashCode(),
      hashOfNullable(this.#assert, hashOfExpression),
      hashOfNullable(this.#trigger, (value) => value.hashCode()),
      hashOfNullable(this.#guard, hashOfExpression),
      hashOfNullable(this.#effect, hashOfExpression),
      hashOfNullable(this.#temporal, (value) => combinedHash([
        hashOfString(value.pattern),
        hashOfNullable(value.assert, hashOfExpression),
        hashOfNullable(value.from, hashOfExpression),
        hashOfNullable(value.to, hashOfExpression)
      ]))
    ]);
  }
  origin() {
    return this.#origin;
  }
  id() {
    return this.#id;
  }
  nature() {
    return this.#nature.asString();
  }
  functionalRequirementReferences() {
    return this.#functionalRequirementReferences;
  }
  assertion() {
    return this.#assert;
  }
  trigger() {
    return this.#trigger?.asString();
  }
  guard() {
    return this.#guard;
  }
  effect() {
    return this.#effect;
  }
  temporal() {
    return this.#temporal === undefined ? undefined : { ...this.#temporal };
  }
  isEvent() {
    return this.#trigger !== undefined;
  }
}

// src/design/domain/lowered-origin.ts
class LoweredOrigin {
  #value;
  constructor(props) {
    if (props.kind === "transition" && (!props.machine.ownsTransition(props.design) || !props.machine.hasAttribute(props.attribute)))
      throw new IllegalArgumentException({ kind: "transition-origin-mismatch" });
    this.#value = { ...props };
  }
  static of(props) {
    return new LoweredOrigin(props);
  }
  static parse(props) {
    return parseConstruction(() => new LoweredOrigin(props));
  }
  design() {
    return this.#value.kind === "vac-shadow" ? this.#value.probe.labelReference() : this.#value.design;
  }
  isKind(kind) {
    return this.#value.kind === kind;
  }
  isSyntheticProbe() {
    return this.#value.kind === "vac-dead" || this.#value.kind === "vac-shadow";
  }
  subsumptionProbe() {
    return this.#value.kind === "vac-shadow" ? this.#value.probe : null;
  }
  machine() {
    return this.#value.kind === "transition" ? this.#value.machine : null;
  }
  attribute() {
    return this.#value.kind === "transition" ? this.#value.attribute : null;
  }
}

// src/design/domain/lowered-origin-reference.ts
class LoweredOriginReference {
  #value;
  constructor(raw) {
    if (raw.length > 1024)
      throw new IllegalArgumentException({ kind: "lowered-origin-ref-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-lowered-token", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new LoweredOriginReference(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new LoweredOriginReference(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  asString() {
    return this.#value;
  }
}

// src/design/domain/design-event-rule.ts
class DesignEventRule {
  #reference;
  #trigger;
  #guard;
  #effect;
  #assignments;
  constructor(props) {
    const effect = props.implicitEffect === undefined ? props.effect : props.effect === undefined ? props.implicitEffect : { op: "and", args: [props.implicitEffect, props.effect] };
    if (effect === undefined)
      throw new IllegalArgumentException({ kind: "event-effect-missing" });
    this.#reference = props.reference;
    this.#trigger = props.trigger;
    this.#guard = ExpressionTree.of(props.guard);
    this.#effect = ExpressionTree.of(effect);
    const assignments = [];
    let interpretable = false;
    for (const part of [props.implicitEffect, props.effect]) {
      if (part === undefined)
        continue;
      const parsed = EffectAssignments.fromEffect(ExpressionTree.of(part));
      if (!parsed.ok)
        continue;
      interpretable = true;
      parsed.value.foldLeft(assignments, (acc, assignment) => {
        acc.push(assignment.asDesignAssignment());
        return acc;
      });
    }
    this.#assignments = interpretable ? DesignAssignments.of(assignments) : null;
  }
  static of(props) {
    return new DesignEventRule(props);
  }
  static parse(props) {
    return parseConstruction(() => new DesignEventRule(props));
  }
  equals(other) {
    return this.#reference.asString() === other.#reference.asString() && this.#trigger.equals(other.#trigger) && this.#guard.equals(other.#guard) && this.#effect.equals(other.#effect);
  }
  hashCode() {
    return combinedHash([
      hashOfString(this.#reference.asString()),
      this.#trigger.hashCode(),
      this.#guard.hashCode(),
      this.#effect.hashCode()
    ]);
  }
  trigger() {
    return this.#trigger;
  }
  reference() {
    return LoweredOriginReference.of(this.#reference.asString());
  }
  guard() {
    return this.#guard.asExpression();
  }
  sameRuleAs(other) {
    return this.#reference.asString() === other.#reference.asString();
  }
  sameTriggerAs(other) {
    return this.#trigger.equals(other.#trigger);
  }
  sameEffectAs(other) {
    return this.#effect.isCanonicallyEqual(other.#effect);
  }
  hasAssignments() {
    return this.#assignments !== null;
  }
  assignedRhsOf(path) {
    return this.#assignments?.rhsOf(AttributePath.of(path));
  }
  deadGuardProbe(id) {
    return LoweredObligation.parse({
      id,
      origin: LoweredOrigin.of({ kind: "vac-dead", design: this.reference() }),
      nature: ObligationNature.of("invariant"),
      functionalRequirementReferences: FunctionalRequirementReferences.of([]),
      assert: { op: "implies", args: [this.guard(), { op: "bool", value: true }] }
    });
  }
}
// src/design/domain/design-machines.ts
class DesignMachines extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-design-machines");
  }
  rebuild(values) {
    return new DesignMachines(values);
  }
  static of(values) {
    return new DesignMachines(values);
  }
  map(transform) {
    return this.mapTo(transform, DesignMachines.of);
  }
  combine(other) {
    return this.combineTo(other, DesignMachines.of);
  }
  static parse(values) {
    return parseConstruction(() => new DesignMachines(values));
  }
  add(value) {
    return new DesignMachines([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  ids() {
    return this.#values.map((m) => m.id().asString());
  }
  transitionIds() {
    return this.#values.flatMap((m) => [...m.transitions().ids()]);
  }
  sortedById() {
    return new DesignMachines([...this.#values].sort((a, b) => a.id().asString() < b.id().asString() ? -1 : 1));
  }
  sortedCanonically() {
    return new DesignMachines([...this.#values].sort((a, b) => a.id().compareTo(b.id())));
  }
  static attrPathOf(sm) {
    return `${sm.entity().asString()}.${sm.attribute().asString()}`;
  }
  toArray() {
    return this.#values;
  }
}

// src/design/domain/rule-subsumption-probe.ts
class RuleSubsumptionProbe {
  #subsumer;
  #subsumed;
  constructor(props) {
    if (props.subsumer.sameRuleAs(props.subsumed))
      throw new IllegalArgumentException({ kind: "self-subsumption" });
    if (!props.subsumer.sameTriggerAs(props.subsumed))
      throw new IllegalArgumentException({ kind: "different-subsumption-triggers" });
    if (!props.subsumer.sameEffectAs(props.subsumed))
      throw new IllegalArgumentException({ kind: "different-subsumption-effects" });
    this.#subsumer = props.subsumer;
    this.#subsumed = props.subsumed;
  }
  static of(props) {
    return new RuleSubsumptionProbe(props);
  }
  static parse(props) {
    return parseConstruction(() => new RuleSubsumptionProbe(props));
  }
  references() {
    return [this.#subsumer.reference(), this.#subsumed.reference()];
  }
  targets() {
    const [subsumer, subsumed] = this.references();
    return FindingTargets.of(TargetIdentifier.of(subsumer.asString()), [
      TargetIdentifier.of(subsumed.asString())
    ]).sortedUniqueCanonically();
  }
  isReverseOf(other) {
    return this.#subsumer.sameRuleAs(other.#subsumed) && this.#subsumed.sameRuleAs(other.#subsumer);
  }
  mentionsAny(targets) {
    return this.references().some((reference) => targets.exists((target) => target.asString() === reference.asString()));
  }
  description() {
    const [a, b] = this.references();
    return `${b.asString()} is subsumed by ${a.asString()}: same trigger, a provably narrower guard, and an identical effect \u2014 it can never apply where ${a.asString()} does not.`;
  }
  labelReference() {
    return LoweredOriginReference.of(this.references().map((reference) => reference.asString()).join("|"));
  }
  loweredAs(id) {
    return LoweredObligation.parse({
      id,
      origin: LoweredOrigin.of({ kind: "vac-shadow", probe: this }),
      nature: ObligationNature.of("invariant"),
      functionalRequirementReferences: FunctionalRequirementReferences.of([]),
      assert: {
        op: "implies",
        args: [
          { op: "and", args: [this.#subsumed.guard(), { op: "not", args: [this.#subsumer.guard()] }] },
          { op: "bool", value: true }
        ]
      }
    });
  }
}

// src/design/domain/design-event-rule-catalog.ts
class DesignEventRuleCatalog extends FirstClassCollectionBase {
  #events;
  constructor(events) {
    super();
    const snapshot = [];
    const references = new Set;
    for (const event of events) {
      if (snapshot.length >= 65536)
        throw new IllegalArgumentException({ kind: "too-many-design-event-rules", raw: snapshot.length + 1 });
      const reference = event.reference().asString();
      if (references.has(reference))
        throw new IllegalArgumentException({ kind: "duplicate-design-event-rule", raw: reference });
      references.add(reference);
      snapshot.push(event);
    }
    this.#events = KeyedIndex.of(snapshot.map((event) => [TargetIdentifier.of(event.reference().asString()), event]));
  }
  rebuild(values) {
    return new DesignEventRuleCatalog(values);
  }
  map(transform) {
    return this.mapTo(transform, (values) => this.rebuild(values));
  }
  combine(other) {
    return this.combineTo(other, (values) => this.rebuild(values));
  }
  static of(unit) {
    return new DesignEventRuleCatalog(DesignEventRuleCatalog.eventsOf(unit));
  }
  static parse(unit) {
    return parseConstruction(() => new DesignEventRuleCatalog(DesignEventRuleCatalog.eventsOf(unit)));
  }
  static *eventsOf(unit) {
    for (const obligation of unit.obligations().sortedCanonically()) {
      const event = obligation.asEventRule();
      if (event !== null)
        yield event;
    }
    for (const machine of unit.machines().sortedCanonically())
      for (const transition of machine.transitions().sortedCanonically())
        yield transition.asEventRule(DesignMachines.attrPathOf(machine));
  }
  eventOf(id) {
    const event = this.#events.get(id);
    return event?.hasAssignments() ? event : null;
  }
  *[Symbol.iterator]() {
    yield* this.#events.values();
  }
  subsumptionProbes() {
    const probes = [];
    const events = [...this.#events.values()];
    const byTrigger = new Map;
    for (const event of events) {
      const key = event.trigger().asString();
      const list = byTrigger.get(key) ?? [];
      list.push(event);
      byTrigger.set(key, list);
    }
    for (const key of [...byTrigger.keys()].sort())
      for (const subsumer of byTrigger.get(key) ?? [])
        for (const subsumed of byTrigger.get(key) ?? []) {
          const parsed = RuleSubsumptionProbe.parse({ subsumer, subsumed });
          if (parsed.ok)
            probes.push(parsed.value);
        }
    return probes;
  }
}
// src/design/domain/design-finding.ts
class DesignFinding {
  #kind;
  #functionalRequirementReferences;
  #targets;
  #witness;
  #unit;
  #detail;
  constructor(props) {
    this.#kind = props.kind;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#targets = props.targets;
    this.#witness = props.witness;
    this.#unit = props.unit;
    this.#detail = props.detail;
  }
  static of(props) {
    return new DesignFinding(props);
  }
  equals(other) {
    return this.#kind.equals(other.#kind) && this.#unit.equals(other.#unit) && this.#detail === other.#detail && sameArray(this.#functionalRequirementReferences.toStrings(), other.#functionalRequirementReferences.toStrings(), (left, right) => left === right) && this.#targets.equals(other.#targets) && this.#witness.equals(other.#witness);
  }
  hashCode() {
    return combinedHash([
      this.#kind.hashCode(),
      this.#unit.hashCode(),
      hashOfString(this.#detail),
      combinedHash(this.#functionalRequirementReferences.toStrings().map((value) => hashOfString(value))),
      this.#targets.hashCode(),
      this.#witness.hashCode()
    ]);
  }
  kind() {
    return this.#kind.asString();
  }
  functionalRequirementReferences() {
    return this.#functionalRequirementReferences;
  }
  targets() {
    return this.#targets;
  }
  witness() {
    return this.#witness;
  }
  unit() {
    return this.#unit.asString();
  }
  detail() {
    return this.#detail;
  }
  violatesScenario(unit, target) {
    return this.#kind.equals(FindingKind.scenarioViolation()) && this.#unit.equals(unit) && this.#targets.include(target);
  }
  isConflict() {
    return this.#kind.isConflict();
  }
  asRefinementViolation(reqIds, unit) {
    if (!this.#kind.isConflict())
      return null;
    const reqHits = this.#targets.filter((t) => reqIds.has(t.asString()));
    if (reqHits.isEmpty())
      return null;
    const tail = reqHits.tail().foldLeft([], (acc, target) => {
      acc.push(target);
      return acc;
    });
    return new DesignFinding({
      kind: FindingKind.refinementViolation(),
      functionalRequirementReferences: this.#functionalRequirementReferences,
      targets: FindingTargets.of(reqHits.head(), tail),
      witness: this.#witness,
      unit,
      detail: `The design machine of unit ${unit.asString()} reaches a state that violates requirements obligation ${reqHits.joined(", ")} under the refinement map (step trace attached): the design can execute its way out of the verified requirements.`
    });
  }
  compareKindTo(other) {
    return this.#kind.compareTo(other.#kind);
  }
  withDetail(detail) {
    return new DesignFinding({
      kind: this.#kind,
      functionalRequirementReferences: this.#functionalRequirementReferences,
      targets: this.#targets,
      witness: this.#witness,
      unit: this.#unit,
      detail
    });
  }
}
// src/design/domain/design-ignore.ts
class DesignIgnore {
  #state;
  #trigger;
  constructor(props) {
    this.#state = props.state;
    this.#trigger = props.trigger;
  }
  static of(props) {
    return new DesignIgnore(props);
  }
  equals(other) {
    return this.#state === other.#state && this.#trigger.equals(other.#trigger);
  }
  hashCode() {
    return combinedHash([hashOfString(this.#state), this.#trigger.hashCode()]);
  }
  state() {
    return this.#state;
  }
  trigger() {
    return this.#trigger;
  }
  loweredGuard(attrPath) {
    return {
      op: "eq",
      args: [
        { op: "ref", path: attrPath },
        { op: "enum", value: this.#state }
      ]
    };
  }
  loweredEffect(attrPath) {
    return {
      op: "eq",
      args: [
        { op: "ref", path: attrPath, prime: true },
        { op: "ref", path: attrPath }
      ]
    };
  }
  loweredAs(id, attrPath, origin) {
    return LoweredObligation.of({
      id,
      origin,
      nature: ObligationNature.of("event"),
      functionalRequirementReferences: FunctionalRequirementReferences.of([]),
      trigger: this.#trigger,
      guard: this.loweredGuard(attrPath),
      effect: this.loweredEffect(attrPath)
    });
  }
}
// src/design/domain/design-ignore-declaration.ts
class DesignIgnoreDeclaration {
  #state;
  #trigger;
  constructor(props) {
    this.#state = props.state;
    this.#trigger = props.trigger;
  }
  static of(props) {
    return new DesignIgnoreDeclaration(props);
  }
  equals(other) {
    return this.#state === other.#state && this.#trigger.equals(other.#trigger);
  }
  hashCode() {
    return combinedHash([hashOfString(this.#state), this.#trigger.hashCode()]);
  }
  state() {
    return this.#state;
  }
  trigger() {
    return this.#trigger;
  }
  isStateAmong(states) {
    return states.exists((state) => state.matchesLiteral(this.#state));
  }
  cellKey() {
    return `${this.#state}|${this.#trigger.asString()}`;
  }
}
// src/design/domain/design-ignore-declarations.ts
class DesignIgnoreDeclarations extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-design-ignore-declarations");
  }
  rebuild(values) {
    return new DesignIgnoreDeclarations(values);
  }
  static of(values) {
    return new DesignIgnoreDeclarations(values);
  }
  map(transform) {
    return this.mapTo(transform, DesignIgnoreDeclarations.of);
  }
  combine(other) {
    return this.combineTo(other, DesignIgnoreDeclarations.of);
  }
  static parse(values) {
    return parseConstruction(() => new DesignIgnoreDeclarations(values));
  }
  add(value) {
    return new DesignIgnoreDeclarations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/design-ignores.ts
class DesignIgnores extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-design-ignores");
  }
  rebuild(values) {
    return new DesignIgnores(values);
  }
  static of(values) {
    return new DesignIgnores(values);
  }
  map(transform) {
    return this.mapTo(transform, DesignIgnores.of);
  }
  combine(other) {
    return this.combineTo(other, DesignIgnores.of);
  }
  static parse(values) {
    return parseConstruction(() => new DesignIgnores(values));
  }
  add(value) {
    return new DesignIgnores([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  sortedByStateTrigger() {
    return new DesignIgnores([...this.#values].sort((a, b) => `${a.state()}/${a.trigger().asString()}` < `${b.state()}/${b.trigger().asString()}` ? -1 : 1));
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/design-input-anchor.ts
class DesignInputAnchor {
  #artifact;
  #sha256;
  constructor(props) {
    this.#artifact = ArtifactPath.of(props.artifact);
    this.#sha256 = props.sha256;
  }
  static parse(props) {
    return parseConstruction(() => new DesignInputAnchor(props));
  }
  static of(props) {
    return new DesignInputAnchor(props);
  }
  equals(other) {
    return this.#artifact.equals(other.#artifact) && this.#sha256.equals(other.#sha256);
  }
  hashCode() {
    return combinedHash([this.#artifact.hashCode(), this.#sha256.hashCode()]);
  }
  artifact() {
    return this.#artifact.asString();
  }
  sha256() {
    return this.#sha256;
  }
  compareByArtifact(other) {
    const a = this.#artifact.asString();
    const b = other.#artifact.asString();
    return a < b ? -1 : a > b ? 1 : 0;
  }
}
// src/design/domain/design-input-anchors.ts
class DesignInputAnchors extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-design-input-anchors");
  }
  rebuild(values) {
    return new DesignInputAnchors(values);
  }
  static of(values) {
    return new DesignInputAnchors(values);
  }
  map(transform) {
    return this.mapTo(transform, DesignInputAnchors.of);
  }
  combine(other) {
    return this.combineTo(other, DesignInputAnchors.of);
  }
  static parse(values) {
    return parseConstruction(() => new DesignInputAnchors(values));
  }
  add(value) {
    return new DesignInputAnchors([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  sortedByArtifact() {
    return new DesignInputAnchors([...this.#values].sort((a, b) => a.compareByArtifact(b)));
  }
  toDocuments() {
    return this.#values.map((anchor) => ({ artifact: anchor.artifact(), sha256: anchor.sha256().asString() }));
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/design-skips.ts
function sortDesignSkipped(skipped) {
  return [...skipped].sort((a, b) => a.compareTo(b));
}

class DesignSkips extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-design-skips");
  }
  rebuild(values) {
    return new DesignSkips(values);
  }
  static of(values) {
    return new DesignSkips(values);
  }
  map(transform) {
    return this.mapTo(transform, DesignSkips.of);
  }
  combine(other) {
    return this.combineTo(other, DesignSkips.of);
  }
  static parse(values) {
    return parseConstruction(() => new DesignSkips(values));
  }
  static forTargets(targets, unit, reason, detail) {
    return DesignSkips.of([...targets].map((target) => DesignSkipped.of({ target, reason, detail, unit })));
  }
  add(value) {
    return new DesignSkips([...this.#values, value]);
  }
  concat(other) {
    return new DesignSkips([...this.#values, ...other.#values]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  sortedCanonically() {
    return new DesignSkips(sortDesignSkipped(this.#values));
  }
  count() {
    return this.#values.length;
  }
  toDocuments() {
    return this.#values.map((skipped) => {
      const out = {
        target: skipped.target().asString(),
        reason: skipped.reason(),
        unit: skipped.unit()
      };
      const detail = skipped.detail();
      if (detail !== undefined)
        out.detail = detail;
      return out;
    });
  }
  toArray() {
    return this.#values;
  }
}

// src/design/domain/machine-reachability.ts
var MAX_REACHABILITY_ENTRIES = 65536;
function boundedObservationSnapshot(observations) {
  if (observations.size > MAX_REACHABILITY_ENTRIES)
    throw new IllegalArgumentException({ kind: "too-many-reachability-probes" });
  const snapshot = new Map;
  let inspected = 0;
  for (const [probe, verdict] of observations) {
    if (inspected >= MAX_REACHABILITY_ENTRIES)
      throw new IllegalArgumentException({ kind: "too-many-reachability-probes", raw: inspected + 1 });
    inspected++;
    snapshot.set(probe, verdict);
  }
  return snapshot;
}

class MachineReachability {
  #unit;
  #machine;
  #probes;
  #bounded;
  #observations;
  constructor(input) {
    const probes = boundedCollectionSnapshot(input.probes, MAX_REACHABILITY_ENTRIES, "too-many-reachability-probes");
    const observations = boundedObservationSnapshot(input.observations);
    const included = new Set(probes);
    for (const probe of observations.keys()) {
      if (!included.has(probe))
        throw new IllegalArgumentException({ kind: "reachability-observation-outside-plan" });
    }
    this.#unit = input.unit;
    this.#machine = input.machine;
    this.#probes = probes;
    this.#bounded = input.bounded;
    this.#observations = observations;
  }
  static of(input) {
    return new MachineReachability(input);
  }
  equals(other) {
    if (!this.#unit.equals(other.#unit) || !this.#machine.equals(other.#machine) || this.#bounded !== other.#bounded || this.#probes.length !== other.#probes.length || this.#observations.size !== other.#observations.size)
      return false;
    const probesEqual = this.#probes.every((probe, index) => {
      const otherProbe = other.#probes[index];
      return otherProbe !== undefined && probe.unit().name() === otherProbe.unit().name() && probe.attributePath() === otherProbe.attributePath() && probe.state() === otherProbe.state();
    });
    if (!probesEqual)
      return false;
    return this.#probes.every((probe, index) => {
      const otherProbe = other.#probes[index];
      const left = this.#observations.get(probe);
      const right = otherProbe === undefined ? undefined : other.#observations.get(otherProbe);
      return left === undefined ? right === undefined : right !== undefined && left.equals(right);
    });
  }
  hashCode() {
    return combinedHash([
      this.#unit.hashCode(),
      this.#machine.hashCode(),
      hashOfBoolean(this.#bounded),
      ...this.#probes.map((probe) => combinedHash([
        hashOfString(probe.unit().name()),
        hashOfString(probe.attributePath()),
        hashOfString(probe.state()),
        hashOfNullable(this.#observations.get(probe), (verdict) => verdict.hashCode())
      ]))
    ]);
  }
  static parse(input) {
    return parseConstruction(() => new MachineReachability(input));
  }
  probeCount() {
    return this.#probes.length;
  }
  *[Symbol.iterator]() {
    if (this.#bounded)
      yield* this.#probes;
  }
  withVerdict(probe, verdict) {
    if (!this.#probes.includes(probe))
      throw new Error("defect: reachability observation belongs to another machine plan");
    return new MachineReachability({
      unit: this.#unit,
      machine: this.#machine,
      probes: this.#probes,
      bounded: this.#bounded,
      observations: new Map(this.#observations).set(probe, verdict)
    });
  }
  recordedIn(report, capReached, cap) {
    if (this.#probes.length === 0)
      return report;
    let findings = DesignFindings.of([]);
    let skips = DesignSkips.of([]);
    const machine = this.#machine.id().asString();
    const unit = UnitName.of(this.#unit.name());
    if (!this.#bounded) {
      skips = skips.add(DesignSkipped.of({
        target: this.#machine.id().asTargetId(),
        reason: SkipReason.capability(),
        unit,
        detail: `unreachable-state detection for ${machine} requires bounded mode (quint verify with Apalache); simulation cannot decide it (states: ${this.#probes.map((probe) => probe.state()).join(", ")})`
      }));
    } else {
      const leftover = [];
      for (const probe of this.#probes) {
        const observation = this.#observations.get(probe);
        if (observation === undefined) {
          leftover.push(probe);
          continue;
        }
        observation.match({
          reached: () => {},
          unverified: () => {
            leftover.push(probe);
          },
          notReachedWithinBound: () => {
            findings = findings.add(probe.unreachableFinding());
          }
        });
      }
      if (leftover.length > 0)
        skips = skips.add(DesignSkipped.of({
          target: this.#machine.id().asTargetId(),
          reason: capReached ? SkipReason.timeout() : SkipReason.unavailable(),
          unit,
          detail: `unreachable-state detection skipped for state(s) ${leftover.map((probe) => probe.state()).join(", ")} of ${machine} (per-run cap ${cap} / budget reached, or the probe run failed)`
        }));
    }
    return report.withEvidence(findings, skips);
  }
}

// src/design/domain/design-witness.ts
class DesignWitness {
  #document;
  constructor(document) {
    this.#document = boundedValueSnapshot(document, { string: 65536, nodes: 1e5, depth: 128, total: 16777216 });
  }
  static core(labels) {
    return new DesignWitness({ core: [...labels] });
  }
  static model(values) {
    return new DesignWitness({ model: values });
  }
  static verdicts(byBackend) {
    return new DesignWitness({ verdicts: byBackend });
  }
  static trace(states) {
    return new DesignWitness({ trace: states.map((state) => ({ ...state })) });
  }
  static refs(entries) {
    return new DesignWitness({ refs: entries.map((entry) => ({ ...entry })) });
  }
  static parse(value) {
    return parseConstruction(() => new DesignWitness(value));
  }
  static of(raw) {
    return new DesignWitness(raw);
  }
  equals(other) {
    return jsonEquals(this.#document, other.#document);
  }
  hashCode() {
    return hashOfString(canonicalStringify(this.#document));
  }
  remapCore(rewrite) {
    const document = this.#document;
    if (document !== null && typeof document === "object" && !Array.isArray(document) && "core" in document) {
      const core = document.core ?? null;
      const remapped = Array.isArray(core) ? core.map((label) => typeof label === "string" ? rewrite(label) : label) : core;
      return new DesignWitness({ core: remapped });
    }
    return this;
  }
  reachesState(attrPath, state) {
    const document = this.#document;
    if (document === null || typeof document !== "object" || !("trace" in document))
      return false;
    const trace = document.trace;
    if (!Array.isArray(trace))
      return false;
    const last = trace[trace.length - 1];
    return last !== null && typeof last === "object" && !Array.isArray(last) && last[attrPath] === state;
  }
  toDocument() {
    return structuredClone(this.#document);
  }
}

// src/design/domain/reachability-probe.ts
class ReachabilityProbe {
  #unit;
  #lowered;
  #machine;
  #path;
  #state;
  constructor(unit, lowered, machine, path, state) {
    this.#unit = unit;
    this.#lowered = lowered;
    this.#machine = machine;
    this.#path = path;
    this.#state = state;
  }
  static of(unit, lowered, machine, path, state) {
    return new ReachabilityProbe(unit, lowered, machine, path, state);
  }
  unit() {
    return this.#unit;
  }
  lowered() {
    return this.#lowered;
  }
  attributePath() {
    return this.#path.asString();
  }
  state() {
    return this.#state.asString();
  }
  unreachableFinding() {
    return DesignFinding.of({
      kind: FindingKind.unreachable(),
      functionalRequirementReferences: FunctionalRequirementReferences.of([]),
      targets: FindingTargets.of(this.#machine.id().asTargetId(), []),
      witness: DesignWitness.model({ [this.#path.asString()]: this.#state.asString() }),
      unit: UnitName.of(this.#unit.name()),
      detail: `State "${this.#state.asString()}" of ${this.#machine.id().asString()} (${this.#path.asString()}) is not reached by any execution within 8 steps from any legal state \u2014 it may be dead.`
    });
  }
}

// src/design/domain/reachability-plan.ts
class ReachabilityPlan extends FirstClassCollectionBase {
  #machines;
  constructor(machines) {
    super();
    const owned = boundedCollectionSnapshot(machines, 65536, "too-many-reachability-machines");
    let probes = 0;
    for (const machine of owned) {
      probes += machine.probeCount();
      if (probes > 65536)
        throw new IllegalArgumentException({ kind: "too-many-reachability-probes", raw: probes });
    }
    this.#machines = owned;
  }
  rebuild(values) {
    return new ReachabilityPlan(values);
  }
  static of(machines) {
    return new ReachabilityPlan(machines);
  }
  map(transform) {
    return this.mapTo(transform, ReachabilityPlan.of);
  }
  combine(other) {
    return this.combineTo(other, ReachabilityPlan.of);
  }
  static parse(machines) {
    return parseConstruction(() => new ReachabilityPlan(machines));
  }
  static forUnit(unit, lowered, method) {
    const machines = [];
    for (const machine of unit.machines().sortedById()) {
      const path = lowered.index().attrPathOfMachine(machine.id().asString()) ?? DesignMachines.attrPathOf(machine);
      const probes = machine.nonInitialCandidates(unit.enumValuesOf(path)).map((state) => ReachabilityProbe.of(unit, lowered, machine, AttributePath.of(path), EnumerationMember.of(state)));
      machines.push(MachineReachability.of({
        unit,
        machine,
        probes,
        bounded: method.asString() === "bounded",
        observations: new Map
      }));
    }
    return new ReachabilityPlan(machines);
  }
  *[Symbol.iterator]() {
    yield* this.#machines;
  }
}

// src/design/domain/design-report.ts
var SUPPORTED_DESIGN_IR_MAJOR = 1;

class DesignReport {
  #id;
  #irVersion;
  #irHash;
  #method;
  #findings;
  #skipped;
  #inputs;
  #checked;
  #crossChecked;
  #unavailableReason;
  constructor(seed) {
    this.#id = seed.id;
    this.#irVersion = seed.irVersion;
    this.#irHash = seed.irHash;
    this.#method = seed.method;
    this.#findings = seed.findings;
    this.#skipped = seed.skipped;
    this.#inputs = seed.inputs;
    this.#checked = seed.checked;
    this.#crossChecked = seed.crossChecked;
    this.#unavailableReason = seed.unavailableReason;
  }
  static started(id, model, method) {
    return DesignReport.of({
      id,
      irVersion: model.irVersion(),
      irHash: model.irHash(),
      method,
      findings: DesignFindings.of([]),
      skipped: DesignSkips.of([]),
      checked: CheckedUnits.of([]),
      inputs: null,
      crossChecked: null,
      unavailableReason: null
    });
  }
  equals(other) {
    return this.#id.equals(other.#id);
  }
  hashCode() {
    return this.#id.hashCode();
  }
  #revised(changes) {
    return new DesignReport({
      id: this.#id,
      irVersion: this.#irVersion,
      irHash: this.#irHash,
      method: this.#method,
      findings: this.#findings,
      skipped: this.#skipped,
      checked: this.#checked,
      inputs: this.#inputs,
      crossChecked: this.#crossChecked,
      unavailableReason: this.#unavailableReason,
      ...changes
    });
  }
  withEvidence(findings, skipped) {
    return this.#revised({
      findings: this.#findings.combine(findings).sortedCanonically(),
      skipped: this.#skipped.concat(skipped).sortedCanonically()
    });
  }
  withInputs(inputs) {
    return this.#revised({ inputs: inputs.sortedByArtifact() });
  }
  loweringFailed(unit, error) {
    return this.unitUnverified(unit, SkipReason.compileError(), `design lowering failed: ${error.kind}`);
  }
  unitTimedOut(unit) {
    const backend = this.#id.backendName().asString() === "smt" ? "solver" : "backend";
    return this.unitUnverified(unit, SkipReason.timeout(), `the per-run ${backend} budget was exhausted before this unit`);
  }
  unitUnverified(unit, reason, detail) {
    return this.withEvidence(DesignFindings.of([]), DesignSkips.forTargets(unit.allTargets(), UnitName.of(unit.name()), reason, detail));
  }
  unitVerified(unit, findings, skipped, method) {
    const checked = this.#checked ?? CheckedUnits.of([]);
    const firstQuintUnit = this.#id.backendName().asString() === "quint" && checked.isEmpty();
    return this.withEvidence(findings, skipped).#revised({
      method: firstQuintUnit ? VerificationMethod.of(method) : this.#method,
      checked: checked.add(UnitName.of(`unit:${unit.name()}`)).sortedUniqueCanonically()
    });
  }
  backendFailed(model, reason) {
    const detail = this.#id.backendName().asString() === "smt" ? "z3 could not be executed" : "quint CLI missing";
    return DesignReport.backendUnavailable(this.#id, model, this.#irHash, this.#method.asString(), reason, detail);
  }
  planReachability(unit, lowered) {
    return ReachabilityPlan.forUnit(unit, lowered, this.#method);
  }
  refinementUnavailable(path, kind) {
    return this.#revised({ unavailableReason: `refinement input could not be acquired: ${path} (${kind})` });
  }
  static irUnreadable(id, method, cause) {
    return DesignReport.compose({
      id,
      irVersion: IntermediateRepresentationVersion.of("0.0.0"),
      irHash: ContentHash.ofText(""),
      method: method.asString(),
      findings: DesignFindings.of([]),
      skipped: DesignSkips.of([]),
      unavailableReason: `design IR unreadable: ${cause} \u2014 see the deep-spec-design-ir-valid sensor for details`
    });
  }
  static versionMismatch(id, model, irHash, method) {
    return DesignReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method,
      findings: DesignFindings.of([]),
      skipped: model.units().allTargetsSkipped(SkipReason.irVersionMismatch(), `design IR major version ${model.majorVersion()} is not supported by this backend (supports ${SUPPORTED_DESIGN_IR_MAJOR}.x.x)`)
    });
  }
  static backendUnavailable(id, model, irHash, method, reason, skipDetail) {
    return DesignReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method,
      findings: DesignFindings.of([]),
      skipped: model.units().allTargetsSkipped(SkipReason.unavailable(), skipDetail),
      unavailableReason: reason
    });
  }
  static compose(input) {
    return DesignReport.of({
      id: input.id,
      irVersion: input.irVersion,
      irHash: input.irHash,
      method: VerificationMethod.of(input.method),
      findings: input.findings.sortedCanonically(),
      skipped: input.skipped.sortedCanonically(),
      inputs: input.inputs === undefined ? null : input.inputs.sortedByArtifact(),
      checked: input.checked === undefined ? null : input.checked.sortedUniqueCanonically(),
      crossChecked: input.crossChecked ?? null,
      unavailableReason: input.unavailableReason ?? null
    });
  }
  static of(seed) {
    return new DesignReport(seed);
  }
  degraded(reason) {
    return new DesignReport({
      id: this.#id,
      irVersion: this.#irVersion,
      irHash: this.#irHash,
      method: this.#method,
      findings: DesignFindings.of([]),
      skipped: DesignSkips.of([]),
      inputs: null,
      checked: null,
      crossChecked: null,
      unavailableReason: reason
    });
  }
  scenarioVerdictFor(unit, target, irHash) {
    const backend = this.#id.backendName();
    if (!this.#irHash.equals(irHash) || this.isUnavailable())
      return ScenarioVerdict.unavailable(backend, this.#irHash, target, unit);
    if (this.#skipped.exists((skip) => skip.appliesTo(unit, target)))
      return ScenarioVerdict.skipped(backend, this.#irHash, target, unit);
    if (this.#findings.exists((finding) => finding.violatesScenario(unit, target)))
      return ScenarioVerdict.violated(backend, this.#irHash, target, unit);
    return ScenarioVerdict.clean(backend, this.#irHash, target, unit);
  }
  id() {
    return this.#id;
  }
  irVersion() {
    return this.#irVersion;
  }
  irHash() {
    return this.#irHash;
  }
  method() {
    return this.#method.asString();
  }
  findings() {
    return this.#findings;
  }
  skipped() {
    return this.#skipped;
  }
  inputs() {
    return this.#inputs;
  }
  checked() {
    return this.#checked;
  }
  crossChecked() {
    return this.#crossChecked;
  }
  unavailableReason() {
    return this.#unavailableReason;
  }
  isUnavailable() {
    return this.#unavailableReason !== null;
  }
  passes() {
    return this.#unavailableReason === null && this.#findings.isEmpty();
  }
  findingsCount() {
    return this.#findings.count();
  }
  skippedCount() {
    return this.#skipped.count();
  }
  toDocument() {
    const ordered = {
      backend: this.#id.backendName().asString(),
      irVersion: this.#irVersion.asString(),
      irHash: this.#irHash.asString(),
      method: this.method()
    };
    const reason = this.#unavailableReason;
    if (reason !== null)
      ordered.unavailable = { reason };
    const inputs = this.#inputs;
    if (inputs !== null)
      ordered.inputs = inputs.toDocuments();
    const checked = this.#checked;
    if (checked !== null)
      ordered.checked = checked.toStrings();
    ordered.findings = this.#findings.toDocuments();
    ordered.skipped = this.#skipped.toDocuments();
    const crossChecked = this.#crossChecked;
    if (crossChecked !== null)
      ordered.crossChecked = crossChecked.toDocuments();
    return ordered;
  }
  conformedTo(schema) {
    const reason = schema.degradationReasonFor(this.toDocument());
    return reason === null ? this : this.degraded(reason);
  }
}

// src/design/domain/design-intermediate-representation-validation-materials.ts
class DesignIntermediateRepresentationValidationMaterials {
  #id;
  #irVersion;
  #schemaErrors;
  #units;
  #sourceDocument;
  constructor(seed) {
    this.#id = seed.id;
    this.#irVersion = seed.irVersion;
    this.#schemaErrors = seed.schemaErrors;
    this.#units = seed.units;
    this.#sourceDocument = new Uint8Array(seed.sourceDocument);
  }
  static of(seed) {
    return new DesignIntermediateRepresentationValidationMaterials(seed);
  }
  id() {
    return this.#id;
  }
  assess() {
    return ValidationAssessment.of(ErrorMessages.collect(this.#diagnostics()));
  }
  #diagnostics() {
    const supported = this.#irVersion.supportsMajor(SUPPORTED_DESIGN_IR_MAJOR);
    const diagnostics = [];
    if (!supported) {
      diagnostics.push(ErrorMessage.parse(`irVersion ${this.#irVersion.asString()}: unsupported major version (this validator supports ${SUPPORTED_DESIGN_IR_MAJOR}.x.x)`));
    }
    this.#schemaErrors.foldLeft(diagnostics, (acc, error) => {
      acc.push(ok(error));
      return acc;
    });
    if (supported && this.#schemaErrors.isEmpty()) {
      this.#units.diagnostics().foldLeft(diagnostics, (acc, error) => {
        acc.push(ok(error));
        return acc;
      });
    }
    return diagnostics;
  }
  sourceDocument() {
    return new Uint8Array(this.#sourceDocument);
  }
}
// src/design/domain/design-intermediate-representation-validation-materials-identifier.ts
class DesignIntermediateRepresentationValidationMaterialsIdentifier {
  #model;
  constructor(model) {
    this.#model = model;
  }
  static of(model) {
    return new DesignIntermediateRepresentationValidationMaterialsIdentifier(model);
  }
  equals(other) {
    return this.#model.equals(other.#model);
  }
  hashCode() {
    return this.#model.hashCode();
  }
  modelId() {
    return this.#model;
  }
}
// src/design/domain/design-machine.ts
class DesignMachine {
  #id;
  #entity;
  #attribute;
  #initial;
  #transitions;
  #ignores;
  #deterministic;
  constructor(props) {
    this.#id = props.id;
    this.#entity = props.entity;
    this.#attribute = props.attribute;
    this.#initial = props.initial;
    this.#transitions = props.transitions;
    this.#ignores = props.ignores;
    this.#deterministic = props.deterministic;
  }
  static of(props) {
    return new DesignMachine(props);
  }
  equals(other) {
    return this.#id.equals(other.#id) && this.#entity.equals(other.#entity) && this.#attribute.equals(other.#attribute) && this.#deterministic === other.#deterministic && this.#initial.equals(other.#initial) && this.#transitions.equals(other.#transitions) && this.#ignores.equals(other.#ignores);
  }
  hashCode() {
    return combinedHash([
      this.#id.hashCode(),
      this.#entity.hashCode(),
      this.#attribute.hashCode(),
      hashOfBoolean(this.#deterministic),
      this.#initial.hashCode(),
      this.#transitions.hashCode(),
      this.#ignores.hashCode()
    ]);
  }
  ownsTransition(reference) {
    return this.#transitions.exists((transition) => transition.id().asString() === reference.asString());
  }
  hasAttribute(path) {
    return path.asString() === `${this.#entity.asString()}.${this.#attribute.asString()}`;
  }
  id() {
    return this.#id;
  }
  entity() {
    return this.#entity;
  }
  attribute() {
    return this.#attribute;
  }
  transitions() {
    return this.#transitions;
  }
  ignores() {
    return this.#ignores;
  }
  loweredIgnoreOrigin() {
    return LoweredOrigin.of({ design: LoweredOriginReference.of(this.#id.asString()), kind: "ignore" });
  }
  nonInitialCandidates(values) {
    return values.filter((s) => !this.#initial.exists((state) => state.matchesName(s))).sort();
  }
  waivesOverlapOf(machines) {
    return machines.every((m) => m === this) && !this.#deterministic;
  }
}
// src/design/domain/design-machine-declaration.ts
class DesignMachineDeclaration {
  #id;
  #attrPath;
  #initial;
  #transitions;
  #ignores;
  constructor(props) {
    this.#id = props.id;
    this.#attrPath = props.attrPath;
    this.#initial = props.initial;
    this.#transitions = props.transitions;
    this.#ignores = props.ignores;
  }
  static of(props) {
    return new DesignMachineDeclaration(props);
  }
  equals(other) {
    return this.#id.equals(other.#id) && this.#attrPath === other.#attrPath && sameIterable(this.#initial, other.#initial, (left, right) => left.equals(right)) && sameIterable(this.#transitions, other.#transitions, (left, right) => left.equals(right)) && sameIterable(this.#ignores, other.#ignores, (left, right) => left.equals(right));
  }
  hashCode() {
    return combinedHash([
      this.#id.hashCode(),
      hashOfString(this.#attrPath),
      this.#initial.hashCode(),
      this.#transitions.hashCode(),
      this.#ignores.hashCode()
    ]);
  }
  id() {
    return this.#id;
  }
  attrPath() {
    return this.#attrPath;
  }
  initial() {
    return this.#initial;
  }
  transitions() {
    return this.#transitions;
  }
  ignores() {
    return this.#ignores;
  }
  diagnostics(catalog) {
    const errors = [];
    const ctx = `machine ${this.#id.asString()}`;
    const attrPath = this.attrPath();
    const attr = catalog.declares(attrPath);
    if (!attr) {
      errors.push(`${ctx}: lifecycle attribute "${attrPath}" is not declared`);
      return ErrorMessages.collect(errors.map(ErrorMessage.parse));
    }
    const states = catalog.enumValuesAt(attrPath);
    if (states === null) {
      errors.push(`${ctx}: lifecycle attribute "${attrPath}" is not an enum \u2014 its values are the state set`);
      return ErrorMessages.collect(errors.map(ErrorMessage.parse));
    }
    for (const s of this.initialStatesOutside(states)) {
      errors.push(`${ctx}: initial state "${s}" is not a value of ${attrPath}`);
    }
    const transitionCells = new Set;
    this.transitions().foldLeft(errors, (acc, tr) => {
      const tctx = `transition ${tr.id().asString()}`;
      for (const [k, v] of tr.stateEntries()) {
        if (v !== undefined && !states.exists((state) => state.matchesLiteral(v))) {
          acc.push(`${tctx}: ${k} state "${v}" is not a value of ${attrPath}`);
        }
      }
      const cellKey = tr.cellKey();
      if (cellKey !== null)
        transitionCells.add(cellKey);
      tr.inspectExpressions((expression, primesAllowed) => {
        catalog.expressionDiagnostics(expression, tctx, primesAllowed).foldLeft(acc, (messages, message) => {
          messages.push(message.asString());
          return messages;
        });
      });
      if (tr.assignsPrimedReferenceTo(attrPath)) {
        acc.push(`${tctx}: the effect assigns the machine's own attribute "${attrPath}" \u2014 state' = to is implicit`);
      }
      return acc;
    });
    this.ignores().foldLeft(errors, (acc, ig) => {
      if (!ig.isStateAmong(states)) {
        acc.push(`${ctx}: ignores state "${ig.state()}" is not a value of ${attrPath}`);
      }
      if (transitionCells.has(ig.cellKey())) {
        acc.push(`${ctx}: ignores (${ig.state()}, ${ig.trigger().asString()}) collides with a declared transition for the same (state, trigger)`);
      }
      return acc;
    });
    return ErrorMessages.collect(errors.map(ErrorMessage.parse));
  }
  initialStatesOutside(states) {
    return this.#initial.filter((state) => !states.exists((declared) => declared.matchesLiteral(state.asString()))).toStrings();
  }
}
// src/design/domain/design-machine-declarations.ts
class DesignMachineDeclarations extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-design-machine-declarations");
  }
  rebuild(values) {
    return new DesignMachineDeclarations(values);
  }
  static of(values) {
    return new DesignMachineDeclarations(values);
  }
  map(transform) {
    return this.mapTo(transform, DesignMachineDeclarations.of);
  }
  combine(other) {
    return this.combineTo(other, DesignMachineDeclarations.of);
  }
  static parse(values) {
    return parseConstruction(() => new DesignMachineDeclarations(values));
  }
  add(value) {
    return new DesignMachineDeclarations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/design-machine-identifier.ts
class DesignMachineIdentifier {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "design-machine-id-too-long", raw: raw.length });
    if (!/^SM-[0-9]+$/.test(raw))
      throw new IllegalArgumentException({ kind: "malformed-design-machine-id", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new DesignMachineIdentifier(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new DesignMachineIdentifier(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  compareTo(other) {
    return this.asTargetId().compareTo(other.asTargetId());
  }
  asString() {
    return this.#value;
  }
  asTargetId() {
    return TargetIdentifier.of(this.#value);
  }
}
// src/design/domain/design-model.ts
class DesignModel {
  #id;
  #irHash;
  #sourceDocument;
  #irVersion;
  #units;
  constructor(input, units) {
    this.#id = input.id;
    this.#irHash = input.irHash;
    this.#sourceDocument = new Uint8Array(input.sourceDocument);
    this.#irVersion = input.irVersion;
    this.#units = units;
  }
  static compose(input) {
    return new DesignModel(input, input.units.sortedByName());
  }
  id() {
    return this.#id;
  }
  irHash() {
    return this.#irHash;
  }
  sourceDocument() {
    return new Uint8Array(this.#sourceDocument);
  }
  irVersion() {
    return this.#irVersion;
  }
  majorVersion() {
    return this.#irVersion.majorVersion();
  }
  supportsMajor(major) {
    return this.#irVersion.supportsMajor(major);
  }
  units() {
    return this.#units;
  }
  *[Symbol.iterator]() {
    yield* this.#units;
  }
  prepareVerification(id, method) {
    return this.#irVersion.supportsMajor(SUPPORTED_DESIGN_IR_MAJOR) ? ok(this) : err(DesignReport.versionMismatch(id, this, this.#irHash, method.asString()));
  }
}
// src/design/domain/design-model-identifier.ts
class DesignModelIdentifier {
  #path;
  constructor(path) {
    this.#path = path;
  }
  static of(path) {
    return new DesignModelIdentifier(path);
  }
  equals(other) {
    return this.#path.equals(other.#path);
  }
  hashCode() {
    return this.#path.hashCode();
  }
  artifactPath() {
    return this.#path;
  }
}
// src/design/domain/design-obligation.ts
class DesignObligation {
  #id;
  #nature;
  #origin;
  #businessRuleReferences;
  #functionalRequirementReferences;
  #assert;
  #trigger;
  #guard;
  #effect;
  #temporal;
  constructor(props) {
    this.#id = props.id;
    this.#nature = props.nature;
    this.#origin = props.origin;
    this.#businessRuleReferences = props.businessRuleReferences;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#assert = props.assert === undefined ? undefined : ExpressionTree.of(props.assert).asExpression();
    this.#trigger = props.trigger;
    this.#guard = props.guard === undefined ? undefined : ExpressionTree.of(props.guard).asExpression();
    this.#effect = props.effect === undefined ? undefined : ExpressionTree.of(props.effect).asExpression();
    this.#temporal = props.temporal === undefined ? undefined : {
      ...props.temporal,
      ...props.temporal.assert !== undefined ? { assert: ExpressionTree.of(props.temporal.assert).asExpression() } : {},
      ...props.temporal.from !== undefined ? { from: ExpressionTree.of(props.temporal.from).asExpression() } : {},
      ...props.temporal.to !== undefined ? { to: ExpressionTree.of(props.temporal.to).asExpression() } : {}
    };
  }
  static parse(props) {
    return parseConstruction(() => new DesignObligation(props));
  }
  static of(props) {
    return new DesignObligation(props);
  }
  equals(other) {
    return this.#id.equals(other.#id) && this.#nature.equals(other.#nature) && this.#origin.equals(other.#origin) && sameIterable(this.#businessRuleReferences, other.#businessRuleReferences, (left, right) => left.equals(right)) && sameIterable(this.#functionalRequirementReferences, other.#functionalRequirementReferences, (left, right) => left.equals(right)) && sameOptional(this.#trigger, other.#trigger, (left, right) => left.equals(right)) && sameExpression(this.#assert, other.#assert) && sameExpression(this.#guard, other.#guard) && sameExpression(this.#effect, other.#effect) && sameOptional(this.#temporal, other.#temporal, (left, right) => left.pattern === right.pattern && sameExpression(left.assert, right.assert) && sameExpression(left.from, right.from) && sameExpression(left.to, right.to));
  }
  hashCode() {
    const hashExpression = (expression) => hashOfNullable(expression, (value) => hashOfString(canonicalStringify(value)));
    return combinedHash([
      this.#id.hashCode(),
      this.#nature.hashCode(),
      this.#origin.hashCode(),
      this.#businessRuleReferences.hashCode(),
      this.#functionalRequirementReferences.hashCode(),
      hashOfNullable(this.#trigger, (trigger) => trigger.hashCode()),
      hashExpression(this.#assert),
      hashExpression(this.#guard),
      hashExpression(this.#effect),
      hashOfNullable(this.#temporal, (temporal) => combinedHash([
        hashOfString(temporal.pattern),
        hashExpression(temporal.assert),
        hashExpression(temporal.from),
        hashExpression(temporal.to)
      ]))
    ]);
  }
  id() {
    return this.#id;
  }
  nature() {
    return this.#nature;
  }
  origin() {
    return this.#origin;
  }
  businessRuleReferences() {
    return this.#businessRuleReferences;
  }
  functionalRequirementReferences() {
    return this.#functionalRequirementReferences;
  }
  assertion() {
    return this.#assert;
  }
  trigger() {
    return this.#trigger;
  }
  guard() {
    return this.#guard;
  }
  effect() {
    return this.#effect;
  }
  temporal() {
    return this.#temporal === undefined ? undefined : { ...this.#temporal };
  }
  isInvariantLike() {
    return this.#nature.isInvariant() || this.#nature.isNumeric();
  }
  isEvent() {
    return this.#nature.isEvent();
  }
  guardedEffect() {
    if (!this.isEvent() || this.#guard === undefined || this.#effect === undefined)
      return null;
    return { guard: this.#guard, effect: this.#effect };
  }
  asEventRule() {
    const event = this.eventDefinition();
    return event === null ? null : DesignEventRule.of({ reference: this.#id, ...event });
  }
  eventDefinition() {
    const behavior = this.guardedEffect();
    if (behavior === null || this.#trigger === undefined)
      return null;
    return { trigger: this.#trigger, ...behavior };
  }
  loweredAs(id) {
    const lowered = {
      id,
      origin: this.loweredOrigin(),
      nature: this.#nature,
      functionalRequirementReferences: this.#functionalRequirementReferences
    };
    const temporal = this.temporal();
    if (this.#assert !== undefined)
      lowered.assert = this.#assert;
    if (this.#trigger !== undefined)
      lowered.trigger = this.#trigger;
    if (this.#guard !== undefined)
      lowered.guard = this.#guard;
    if (this.#effect !== undefined)
      lowered.effect = this.#effect;
    if (temporal !== undefined)
      lowered.temporal = temporal;
    return LoweredObligation.of(lowered);
  }
  loweredOrigin() {
    return LoweredOrigin.of({ design: LoweredOriginReference.of(this.#id.asString()), kind: "passthrough" });
  }
  inspectExpressions(visitor) {
    if (this.#assert !== undefined)
      visitor(this.#assert, false);
    if (this.#guard !== undefined)
      visitor(this.#guard, false);
    if (this.#effect !== undefined)
      visitor(this.#effect, true);
    if (this.#temporal?.assert !== undefined)
      visitor(this.#temporal.assert, false);
    if (this.#temporal?.from !== undefined)
      visitor(this.#temporal.from, false);
    if (this.#temporal?.to !== undefined)
      visitor(this.#temporal.to, false);
  }
}
// src/design/domain/design-obligation-declaration.ts
class DesignObligationDeclaration {
  #id;
  #origin;
  #businessRuleReferences;
  #assert;
  #guard;
  #effect;
  #temporal;
  constructor(props) {
    this.#id = props.id;
    this.#origin = props.origin;
    this.#businessRuleReferences = props.businessRuleReferences;
    this.#assert = props.assert === undefined ? undefined : ExpressionTree.of(props.assert).asExpression();
    this.#guard = props.guard === undefined ? undefined : ExpressionTree.of(props.guard).asExpression();
    this.#effect = props.effect === undefined ? undefined : ExpressionTree.of(props.effect).asExpression();
    this.#temporal = props.temporal === undefined ? undefined : {
      ...props.temporal,
      ...props.temporal.assert !== undefined ? { assert: ExpressionTree.of(props.temporal.assert).asExpression() } : {},
      ...props.temporal.from !== undefined ? { from: ExpressionTree.of(props.temporal.from).asExpression() } : {},
      ...props.temporal.to !== undefined ? { to: ExpressionTree.of(props.temporal.to).asExpression() } : {}
    };
  }
  static parse(props) {
    return parseConstruction(() => new DesignObligationDeclaration(props));
  }
  static of(props) {
    return new DesignObligationDeclaration(props);
  }
  equals(other) {
    return this.#id.equals(other.#id) && sameOptional(this.#origin, other.#origin, (left, right) => left.equals(right)) && sameOptional(this.#businessRuleReferences, other.#businessRuleReferences, (left, right) => sameIterable(left, right, (a, b) => a.equals(b))) && sameExpression(this.#assert, other.#assert) && sameExpression(this.#guard, other.#guard) && sameExpression(this.#effect, other.#effect) && sameOptional(this.#temporal, other.#temporal, (left, right) => sameExpression(left.assert, right.assert) && sameExpression(left.from, right.from) && sameExpression(left.to, right.to));
  }
  hashCode() {
    const hashExpression = (expression) => hashOfNullable(expression, (value) => hashOfString(canonicalStringify(value)));
    return combinedHash([
      this.#id.hashCode(),
      hashOfNullable(this.#origin, (origin) => origin.hashCode()),
      hashOfNullable(this.#businessRuleReferences, (references) => references.hashCode()),
      hashExpression(this.#assert),
      hashExpression(this.#guard),
      hashExpression(this.#effect),
      hashOfNullable(this.#temporal, (temporal) => combinedHash([hashExpression(temporal.assert), hashExpression(temporal.from), hashExpression(temporal.to)]))
    ]);
  }
  diagnostics(catalog) {
    const context = `obligation ${this.#id.asString()}`;
    const errors = [];
    if (this.#origin?.isRules() === true && this.#businessRuleReferences === undefined)
      errors.push(`${context}: origin "rules" requires brRefs`);
    if (catalog !== null)
      this.#inspectExpressions((expression, primesAllowed) => {
        catalog.expressionDiagnostics(expression, context, primesAllowed).foldLeft(errors, (acc, message) => {
          acc.push(message.asString());
          return acc;
        });
      });
    return ErrorMessages.collect(errors.map(ErrorMessage.parse));
  }
  id() {
    return this.#id;
  }
  businessRuleReferences() {
    return this.#businessRuleReferences;
  }
  #inspectExpressions(visitor) {
    if (this.#assert !== undefined)
      visitor(this.#assert, false);
    if (this.#guard !== undefined)
      visitor(this.#guard, false);
    if (this.#effect !== undefined)
      visitor(this.#effect, true);
    if (this.#temporal?.assert !== undefined)
      visitor(this.#temporal.assert, false);
    if (this.#temporal?.from !== undefined)
      visitor(this.#temporal.from, false);
    if (this.#temporal?.to !== undefined)
      visitor(this.#temporal.to, false);
  }
}
// src/design/domain/design-obligation-declarations.ts
class DesignObligationDeclarations extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-design-obligation-declarations");
  }
  rebuild(values) {
    return new DesignObligationDeclarations(values);
  }
  static of(values) {
    return new DesignObligationDeclarations(values);
  }
  map(transform) {
    return this.mapTo(transform, DesignObligationDeclarations.of);
  }
  combine(other) {
    return this.combineTo(other, DesignObligationDeclarations.of);
  }
  static parse(values) {
    return parseConstruction(() => new DesignObligationDeclarations(values));
  }
  add(value) {
    return new DesignObligationDeclarations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/design-obligation-identifier.ts
class DesignObligationIdentifier {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "design-obligation-id-too-long", raw: raw.length });
    if (!/^DOB-[0-9]+$/.test(raw))
      throw new IllegalArgumentException({ kind: "malformed-design-obligation-id", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new DesignObligationIdentifier(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new DesignObligationIdentifier(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  compareTo(other) {
    return compareCanonically(this.#value, other.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/design/domain/design-obligation-origin.ts
class DesignObligationOrigin {
  #value;
  constructor(value) {
    if (value.length > 128)
      throw new IllegalArgumentException({ kind: "design-obligation-origin-too-long", raw: value.length });
    this.#value = value;
  }
  static parse(value) {
    return parseConstruction(() => new DesignObligationOrigin(value));
  }
  static of(raw) {
    return new DesignObligationOrigin(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  asString() {
    return this.#value;
  }
  isRules() {
    return this.#value === "rules";
  }
}
// src/design/domain/design-obligations.ts
class DesignObligations extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-design-obligations");
  }
  rebuild(values) {
    return new DesignObligations(values);
  }
  static of(values) {
    return new DesignObligations(values);
  }
  map(transform) {
    return this.mapTo(transform, DesignObligations.of);
  }
  combine(other) {
    return this.combineTo(other, DesignObligations.of);
  }
  static parse(values) {
    return parseConstruction(() => new DesignObligations(values));
  }
  add(value) {
    return new DesignObligations([...this.#values, value]);
  }
  sortedCanonically() {
    return new DesignObligations([...this.#values].sort((a, b) => a.id().compareTo(b.id())));
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  ids() {
    return this.#values.map((o) => o.id().asString());
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/design-report-identifier.ts
class DesignReportIdentifier {
  #directory;
  #backend;
  constructor(directory, backend) {
    this.#directory = directory;
    this.#backend = backend;
  }
  static of(directory, backend) {
    return new DesignReportIdentifier(directory, BackendName.of(backend));
  }
  equals(other) {
    return this.#directory.equals(other.#directory) && this.#backend.equals(other.#backend);
  }
  hashCode() {
    return combinedHash([this.#directory.hashCode(), this.#backend.hashCode()]);
  }
  backendName() {
    return this.#backend;
  }
  directory() {
    return this.#directory;
  }
  fileName() {
    return `${this.#backend.asString()}.json`;
  }
}
// src/design/domain/design-reports.ts
class DesignReports extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-design-reports");
  }
  rebuild(values) {
    return new DesignReports(values);
  }
  static of(values) {
    return new DesignReports(values);
  }
  map(transform) {
    return this.mapTo(transform, DesignReports.of);
  }
  combine(other) {
    return this.combineTo(other, DesignReports.of);
  }
  static parse(values) {
    return parseConstruction(() => new DesignReports(values));
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
  crossChecked(id, model, irHash) {
    const findings = [];
    const crossChecked = [];
    let failure = null;
    scenarios:
      for (const unit of model.units()) {
        const unitName = UnitName.of(unit.name());
        let compared = KeyedIndex.empty();
        for (const scenario of unit.scenarios()) {
          const target = TargetIdentifier.of(scenario.id().asString());
          const verdicts = ScenarioVerdicts.parse(this.#values.map((report2) => report2.scenarioVerdictFor(unitName, target, irHash)));
          if (!verdicts.ok) {
            failure = verdicts.error;
            break scenarios;
          }
          for (const comparison of verdicts.value.comparisons()) {
            for (const backend of comparison.backends()) {
              const targets = compared.get(backend);
              if (targets === undefined)
                compared = compared.with(backend, [target]);
              else
                targets.push(target);
            }
            const finding = scenario.crossCheckFinding(unitName, comparison);
            if (finding !== null)
              findings.push(finding);
          }
        }
        for (const [backend, targets] of compared) {
          crossChecked.push(DesignCrossCheckedEntry.of({
            backend,
            unit: unitName,
            targets: TargetIdentifiers.of(targets).sortedUniqueCanonically()
          }));
        }
      }
    crossChecked.sort((a, b) => a.compareTo(b));
    const report = DesignReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method: "exhaustive",
      findings: DesignFindings.of(findings),
      skipped: DesignSkips.of([]),
      crossChecked: DesignCrossCheckedEntries.of(crossChecked)
    });
    return failure === null ? report : report.degraded(`scenario cross-check could not be constructed: ${failure.kind}`);
  }
}
// src/design/domain/lowered-scenario.ts
class LoweredScenario {
  #id;
  #origin;
  #expectation;
  #functionalRequirementReferences;
  #bindings;
  #eventTrigger;
  #expect;
  constructor(props) {
    this.#id = props.id;
    this.#origin = props.origin;
    this.#expectation = props.expectation;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#bindings = props.bindings;
    this.#eventTrigger = props.event?.trigger;
    this.#expect = props.expect === undefined ? undefined : ExpressionTree.of(props.expect).asExpression();
  }
  static parse(props) {
    return parseConstruction(() => new LoweredScenario(props));
  }
  static of(props) {
    return new LoweredScenario(props);
  }
  equals(other) {
    return this.#id.equals(other.#id) && this.#origin.equals(other.#origin) && this.#expectation.asString() === other.#expectation.asString() && sameIterable(this.#functionalRequirementReferences, other.#functionalRequirementReferences, (left, right) => left.equals(right)) && sameIterable(this.#bindings, other.#bindings, (left, right) => left.equals(right)) && sameOptional(this.#eventTrigger, other.#eventTrigger, (left, right) => left.equals(right)) && sameExpression(this.#expect, other.#expect);
  }
  hashCode() {
    return combinedHash([
      this.#id.hashCode(),
      this.#origin.hashCode(),
      hashOfString(this.#expectation.asString()),
      this.#functionalRequirementReferences.hashCode(),
      this.#bindings.hashCode(),
      hashOfNullable(this.#eventTrigger, (value) => value.hashCode()),
      hashOfNullable(this.#expect, (value) => hashOfString(canonicalStringify(value)))
    ]);
  }
  origin() {
    return this.#origin;
  }
  id() {
    return this.#id;
  }
  kind() {
    return this.#expectation.asString();
  }
  functionalRequirementReferences() {
    return this.#functionalRequirementReferences;
  }
  bindings() {
    return this.#bindings;
  }
  event() {
    return this.#eventTrigger === undefined ? undefined : { trigger: this.#eventTrigger.asString() };
  }
  expectedExpression() {
    return this.#expect;
  }
  isAccept() {
    return this.#expectation.isAccept();
  }
}

// src/design/domain/design-scenario.ts
class DesignScenario {
  #id;
  #expectation;
  #businessRuleReferences;
  #functionalRequirementReferences;
  #bindings;
  #eventTrigger;
  #expect;
  constructor(props) {
    this.#id = props.id;
    this.#expectation = props.expectation;
    this.#businessRuleReferences = props.businessRuleReferences;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#bindings = props.bindings;
    this.#eventTrigger = props.event?.trigger;
    this.#expect = props.expect === undefined ? undefined : ExpressionTree.of(props.expect).asExpression();
  }
  static parse(props) {
    return parseConstruction(() => new DesignScenario(props));
  }
  static of(props) {
    return new DesignScenario(props);
  }
  equals(other) {
    return this.#id.equals(other.#id) && this.#expectation.asString() === other.#expectation.asString() && sameIterable(this.#businessRuleReferences, other.#businessRuleReferences, (left, right) => left.equals(right)) && sameIterable(this.#functionalRequirementReferences, other.#functionalRequirementReferences, (left, right) => left.equals(right)) && sameIterable(this.#bindings, other.#bindings, (left, right) => left.equals(right)) && (this.#eventTrigger === undefined || other.#eventTrigger === undefined ? this.#eventTrigger === other.#eventTrigger : this.#eventTrigger.equals(other.#eventTrigger)) && sameExpression(this.#expect, other.#expect);
  }
  hashCode() {
    return combinedHash([
      this.#id.hashCode(),
      hashOfString(this.#expectation.asString()),
      this.#businessRuleReferences.hashCode(),
      this.#functionalRequirementReferences.hashCode(),
      this.#bindings.hashCode(),
      hashOfNullable(this.#eventTrigger, (trigger) => trigger.hashCode()),
      hashOfNullable(this.#expect, (expression) => hashOfString(canonicalStringify(expression)))
    ]);
  }
  crossCheckFinding(unit, comparison) {
    if (!comparison.isFor(TargetIdentifier.of(this.#id.asString()), unit))
      throw new IllegalArgumentException({ kind: "different-cross-check-subject" });
    if (!comparison.disagrees())
      return null;
    return DesignFinding.of({
      kind: FindingKind.crossCheckDisagreement(),
      functionalRequirementReferences: this.#functionalRequirementReferences.sortedUnique(),
      targets: FindingTargets.of(TargetIdentifier.of(this.#id.asString()), []),
      witness: DesignWitness.verdicts(comparison.toVerdictTable()),
      unit,
      detail: `${comparison.description()} disagree on scenario ${this.#id.asString()} of unit ${unit.asString()}. This signals a defect in the formalization or in a backend compiler, not in the design itself.`
    });
  }
  id() {
    return this.#id;
  }
  kind() {
    return this.#expectation.asString();
  }
  businessRuleReferences() {
    return this.#businessRuleReferences;
  }
  functionalRequirementReferences() {
    return this.#functionalRequirementReferences;
  }
  eventTrigger() {
    return this.#eventTrigger;
  }
  expectedExpression() {
    return this.#expect;
  }
  isAccept() {
    return this.#expectation.isAccept();
  }
  isReject() {
    return this.#expectation.isReject();
  }
  hasEventRule() {
    return this.#eventTrigger !== undefined;
  }
  isViolatedBySatisfiability(satisfiable) {
    return this.#expectation.isViolatedBySatisfiability(satisfiable);
  }
  bindings() {
    return this.#bindings;
  }
  loweredAs(id) {
    return LoweredScenario.of({
      id,
      origin: this.#id,
      expectation: this.#expectation,
      functionalRequirementReferences: this.#functionalRequirementReferences,
      bindings: this.#bindings,
      ...this.#eventTrigger !== undefined ? { event: { trigger: this.#eventTrigger } } : {},
      ...this.#expect !== undefined ? { expect: this.#expect } : {}
    });
  }
}
// src/design/domain/design-scenario-declaration.ts
class DesignScenarioDeclaration {
  #id;
  #bindings;
  #hasEvent;
  #expect;
  #businessRuleReferences;
  constructor(props) {
    this.#id = props.id;
    this.#bindings = props.bindings;
    this.#hasEvent = props.hasEvent;
    this.#expect = props.expect === undefined ? undefined : ExpressionTree.of(props.expect).asExpression();
    this.#businessRuleReferences = props.businessRuleReferences;
  }
  static parse(props) {
    return parseConstruction(() => new DesignScenarioDeclaration(props));
  }
  static of(props) {
    return new DesignScenarioDeclaration(props);
  }
  equals(other) {
    return this.#id.equals(other.#id) && this.#hasEvent === other.#hasEvent && sameExpression(this.#expect, other.#expect) && sameIterable(this.#bindings, other.#bindings, (left, right) => left.equals(right)) && sameOptional(this.#businessRuleReferences, other.#businessRuleReferences, (left, right) => sameIterable(left, right, (a, b) => a.equals(b)));
  }
  hashCode() {
    return combinedHash([
      this.#id.hashCode(),
      hashOfBoolean(this.#hasEvent),
      hashOfNullable(this.#expect, (expression) => hashOfString(canonicalStringify(expression))),
      this.#bindings.hashCode(),
      hashOfNullable(this.#businessRuleReferences, (references) => references.hashCode())
    ]);
  }
  diagnostics(catalog) {
    const context = `scenario ${this.#id.asString()}`;
    const errors = [];
    const collect = (messages) => {
      messages.foldLeft(errors, (acc, message) => {
        acc.push(message.asString());
        return acc;
      });
    };
    collect(catalog.bindingDiagnostics(this.#bindings, context));
    if (this.#expect !== undefined)
      collect(catalog.expressionDiagnostics(this.#expect, context, this.#hasEvent));
    return ErrorMessages.collect(errors.map(ErrorMessage.parse));
  }
  id() {
    return this.#id;
  }
  businessRuleReferences() {
    return this.#businessRuleReferences;
  }
}
// src/design/domain/design-scenario-declarations.ts
class DesignScenarioDeclarations extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-design-scenario-declarations");
  }
  rebuild(values) {
    return new DesignScenarioDeclarations(values);
  }
  static of(values) {
    return new DesignScenarioDeclarations(values);
  }
  map(transform) {
    return this.mapTo(transform, DesignScenarioDeclarations.of);
  }
  combine(other) {
    return this.combineTo(other, DesignScenarioDeclarations.of);
  }
  static parse(values) {
    return parseConstruction(() => new DesignScenarioDeclarations(values));
  }
  add(value) {
    return new DesignScenarioDeclarations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/design-scenario-identifier.ts
class DesignScenarioIdentifier {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "design-scenario-id-too-long", raw: raw.length });
    if (!/^DSC-[0-9]+$/.test(raw))
      throw new IllegalArgumentException({ kind: "malformed-design-scenario-id", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new DesignScenarioIdentifier(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new DesignScenarioIdentifier(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  compareTo(other) {
    return compareCanonically(this.#value, other.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/design/domain/design-scenarios.ts
class DesignScenarios extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-design-scenarios");
  }
  rebuild(values) {
    return new DesignScenarios(values);
  }
  static of(values) {
    return new DesignScenarios(values);
  }
  map(transform) {
    return this.mapTo(transform, DesignScenarios.of);
  }
  combine(other) {
    return this.combineTo(other, DesignScenarios.of);
  }
  static parse(values) {
    return parseConstruction(() => new DesignScenarios(values));
  }
  add(value) {
    return new DesignScenarios([...this.#values, value]);
  }
  sortedCanonically() {
    return new DesignScenarios([...this.#values].sort((a, b) => a.id().compareTo(b.id())));
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  ids() {
    return this.#values.map((s) => s.id().asString());
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/design-transition.ts
class DesignTransition {
  #id;
  #from;
  #to;
  #trigger;
  #guard;
  #effect;
  #businessRuleReferences;
  constructor(props) {
    this.#id = props.id;
    this.#from = props.from;
    this.#to = props.to;
    this.#trigger = props.trigger;
    this.#guard = props.guard === undefined ? undefined : ExpressionTree.of(props.guard).asExpression();
    this.#effect = props.effect === undefined ? undefined : ExpressionTree.of(props.effect).asExpression();
    this.#businessRuleReferences = props.businessRuleReferences;
  }
  static parse(props) {
    return parseConstruction(() => new DesignTransition(props));
  }
  static of(props) {
    return new DesignTransition(props);
  }
  equals(other) {
    return this.#id.equals(other.#id) && this.#from === other.#from && this.#to === other.#to && this.#trigger.equals(other.#trigger) && sameExpression(this.#guard, other.#guard) && sameExpression(this.#effect, other.#effect);
  }
  hashCode() {
    return combinedHash([
      this.#id.hashCode(),
      hashOfString(this.#from),
      hashOfString(this.#to),
      this.#trigger.hashCode(),
      hashOfNullable(this.#guard, (value) => hashOfString(canonicalStringify(value))),
      hashOfNullable(this.#effect, (value) => hashOfString(canonicalStringify(value)))
    ]);
  }
  id() {
    return this.#id;
  }
  fromState() {
    return this.#from;
  }
  toState() {
    return this.#to;
  }
  trigger() {
    return this.#trigger;
  }
  guard() {
    return this.#guard;
  }
  effect() {
    return this.#effect;
  }
  businessRuleReferences() {
    return this.#businessRuleReferences;
  }
  #stateEquality(attrPath, state, prime) {
    return {
      op: "eq",
      args: [
        prime ? { op: "ref", path: attrPath, prime: true } : { op: "ref", path: attrPath },
        { op: "enum", value: state }
      ]
    };
  }
  loweredGuard(attrPath) {
    const base = this.#stateEquality(attrPath, this.#from, false);
    return this.#guard === undefined ? base : { op: "and", args: [base, this.#guard] };
  }
  loweredEffect(attrPath) {
    const base = this.#stateEquality(attrPath, this.#to, true);
    return this.#effect === undefined ? base : { op: "and", args: [base, this.#effect] };
  }
  loweredAs(id, attrPath, machine) {
    return LoweredObligation.parse({
      id,
      origin: this.loweredOrigin(machine, AttributePath.of(attrPath)),
      nature: ObligationNature.of("event"),
      functionalRequirementReferences: FunctionalRequirementReferences.of([]),
      trigger: this.#trigger,
      guard: this.loweredGuard(attrPath),
      effect: this.loweredEffect(attrPath)
    });
  }
  loweredOrigin(machine, attribute) {
    return LoweredOrigin.of({
      design: LoweredOriginReference.of(this.#id.asString()),
      kind: "transition",
      machine,
      attribute
    });
  }
  asEventRule(attrPath) {
    return DesignEventRule.of({
      reference: this.#id,
      trigger: this.#trigger,
      guard: this.loweredGuard(attrPath),
      implicitEffect: this.#stateEquality(attrPath, this.#to, true),
      ...this.#effect !== undefined ? { effect: this.#effect } : {}
    });
  }
}
// src/design/domain/design-transition-declaration.ts
class DesignTransitionDeclaration {
  #id;
  #from;
  #to;
  #trigger;
  #businessRuleReferences;
  #guard;
  #effect;
  constructor(props) {
    this.#id = props.id;
    this.#from = props.from;
    this.#to = props.to;
    this.#trigger = props.trigger;
    this.#businessRuleReferences = props.businessRuleReferences;
    this.#guard = props.guard === undefined ? undefined : ExpressionTree.of(props.guard).asExpression();
    this.#effect = props.effect === undefined ? undefined : ExpressionTree.of(props.effect).asExpression();
  }
  static parse(props) {
    return parseConstruction(() => new DesignTransitionDeclaration(props));
  }
  static of(props) {
    return new DesignTransitionDeclaration(props);
  }
  equals(other) {
    return this.#id.equals(other.#id) && this.#from === other.#from && this.#to === other.#to && sameOptional(this.#trigger, other.#trigger, (left, right) => left.equals(right)) && sameOptional(this.#businessRuleReferences, other.#businessRuleReferences, (left, right) => sameIterable(left, right, (a, b) => a.equals(b))) && sameExpression(this.#guard, other.#guard) && sameExpression(this.#effect, other.#effect);
  }
  hashCode() {
    return combinedHash([
      this.#id.hashCode(),
      hashOfNullable(this.#from, hashOfString),
      hashOfNullable(this.#to, hashOfString),
      hashOfNullable(this.#trigger, (value) => value.hashCode()),
      hashOfNullable(this.#businessRuleReferences, (value) => value.hashCode()),
      hashOfNullable(this.#guard, (value) => hashOfString(canonicalStringify(value))),
      hashOfNullable(this.#effect, (value) => hashOfString(canonicalStringify(value)))
    ]);
  }
  id() {
    return this.#id;
  }
  fromState() {
    return this.#from;
  }
  toState() {
    return this.#to;
  }
  trigger() {
    return this.#trigger;
  }
  businessRuleReferences() {
    return this.#businessRuleReferences;
  }
  guard() {
    return this.#guard;
  }
  effect() {
    return this.#effect;
  }
  stateEntries() {
    return [
      ["from", this.#from],
      ["to", this.#to]
    ];
  }
  cellKey() {
    return this.#from !== undefined && this.#trigger !== undefined ? `${this.#from}|${this.#trigger.asString()}` : null;
  }
  assignsPrimedReferenceTo(path) {
    return this.#effect !== undefined && ExpressionTree.of(this.#effect).assignsPrimed(path);
  }
  inspectExpressions(visitor) {
    if (this.#guard !== undefined)
      visitor(this.#guard, false);
    if (this.#effect !== undefined)
      visitor(this.#effect, true);
  }
}
// src/design/domain/design-transition-declarations.ts
class DesignTransitionDeclarations extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-design-transition-declarations");
  }
  rebuild(values) {
    return new DesignTransitionDeclarations(values);
  }
  static of(values) {
    return new DesignTransitionDeclarations(values);
  }
  map(transform) {
    return this.mapTo(transform, DesignTransitionDeclarations.of);
  }
  combine(other) {
    return this.combineTo(other, DesignTransitionDeclarations.of);
  }
  static parse(values) {
    return parseConstruction(() => new DesignTransitionDeclarations(values));
  }
  add(value) {
    return new DesignTransitionDeclarations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/design-transition-identifier.ts
class DesignTransitionIdentifier {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "design-transition-id-too-long", raw: raw.length });
    if (!/^TR-[0-9]+$/.test(raw))
      throw new IllegalArgumentException({ kind: "malformed-design-transition-id", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new DesignTransitionIdentifier(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new DesignTransitionIdentifier(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  compareTo(other) {
    return compareCanonically(this.#value, other.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/design/domain/design-transitions.ts
class DesignTransitions extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-design-transitions");
  }
  rebuild(values) {
    return new DesignTransitions(values);
  }
  static of(values) {
    return new DesignTransitions(values);
  }
  map(transform) {
    return this.mapTo(transform, DesignTransitions.of);
  }
  combine(other) {
    return this.combineTo(other, DesignTransitions.of);
  }
  static parse(values) {
    return parseConstruction(() => new DesignTransitions(values));
  }
  add(value) {
    return new DesignTransitions([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  ids() {
    return this.#values.map((t) => t.id().asString());
  }
  sortedCanonically() {
    return new DesignTransitions([...this.#values].sort((a, b) => a.id().compareTo(b.id())));
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/design-unit-identifier.ts
class DesignUnitIdentifier {
  #value;
  constructor(value) {
    if (value.length > 128)
      throw new IllegalArgumentException({ kind: "design-unit-id-too-long", raw: value.length });
    if (value === "")
      throw new IllegalArgumentException({ kind: "empty-design-unit-id", raw: value });
    this.#value = value;
  }
  static of(value) {
    return new DesignUnitIdentifier(value);
  }
  static parse(raw) {
    return parseConstruction(() => new DesignUnitIdentifier(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  asString() {
    return this.#value;
  }
}

// src/design/domain/lowered-backgrounds.ts
class LoweredBackgrounds extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-lowered-backgrounds");
  }
  rebuild(values) {
    return new LoweredBackgrounds(values);
  }
  static of(values) {
    return new LoweredBackgrounds(values);
  }
  map(transform) {
    return this.mapTo(transform, LoweredBackgrounds.of);
  }
  combine(other) {
    return this.combineTo(other, LoweredBackgrounds.of);
  }
  static parse(values) {
    return parseConstruction(() => new LoweredBackgrounds(values));
  }
  add(value) {
    return new LoweredBackgrounds([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  count() {
    return this.#values.length;
  }
  toArray() {
    return this.#values;
  }
}

// src/design/domain/lowered-identifier.ts
class LoweredIdentifier {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "lowered-id-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-lowered-token", raw });
    if (!/^(OB|SC|BG)-[0-9]+$/.test(raw))
      throw new IllegalArgumentException({ kind: "invalid-lowered-identifier", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new LoweredIdentifier(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new LoweredIdentifier(raw));
  }
  belongsTo(namespace) {
    return this.#value.startsWith(`${namespace}-`);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  asString() {
    return this.#value;
  }
}

// src/design/domain/lowered-obligations.ts
class LoweredObligations extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-lowered-obligations");
  }
  rebuild(values) {
    return new LoweredObligations(values);
  }
  static of(values) {
    return new LoweredObligations(values);
  }
  map(transform) {
    return this.mapTo(transform, LoweredObligations.of);
  }
  combine(other) {
    return this.combineTo(other, LoweredObligations.of);
  }
  static parse(values) {
    return parseConstruction(() => new LoweredObligations(values));
  }
  add(value) {
    return new LoweredObligations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  count() {
    return this.#values.length;
  }
  toArray() {
    return this.#values;
  }
}

// src/design/domain/lowered-scenarios.ts
class LoweredScenarios extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-lowered-scenarios");
  }
  rebuild(values) {
    return new LoweredScenarios(values);
  }
  static of(values) {
    return new LoweredScenarios(values);
  }
  map(transform) {
    return this.mapTo(transform, LoweredScenarios.of);
  }
  combine(other) {
    return this.combineTo(other, LoweredScenarios.of);
  }
  static parse(values) {
    return parseConstruction(() => new LoweredScenarios(values));
  }
  add(value) {
    return new LoweredScenarios([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  count() {
    return this.#values.length;
  }
  toArray() {
    return this.#values;
  }
}

// src/design/domain/issued-lowered-identifiers.ts
class IssuedLoweredIdentifiers extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    const snapshot = boundedCollectionSnapshot(values, 65536, "too-many-lowered-identifiers");
    this.#values = KeySet.of(snapshot);
    if (this.#values.size() !== snapshot.length)
      throw new IllegalArgumentException({ kind: "duplicate-lowered-identifier" });
  }
  rebuild(values) {
    return new IssuedLoweredIdentifiers(values);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  static of(values) {
    return new IssuedLoweredIdentifiers(values);
  }
  map(transform) {
    return this.mapTo(transform, IssuedLoweredIdentifiers.of);
  }
  combine(other) {
    return this.combineTo(other, IssuedLoweredIdentifiers.of);
  }
  static parse(values) {
    return parseConstruction(() => new IssuedLoweredIdentifiers(values));
  }
  *availableObligations() {
    let remaining = 65536 - this.#values.size();
    for (let sequence = 1;sequence <= 65536 && remaining > 0; sequence++) {
      const id = LoweredIdentifier.of(`OB-${sequence}`);
      if (this.#values.has(id))
        continue;
      remaining--;
      yield id;
    }
  }
}

// src/design/domain/lowering-index.ts
function designToken(id) {
  return id.replace(/[^A-Za-z0-9_]/g, "_");
}

class LoweringIndex {
  #origins;
  #scenarioDesignIds;
  #machinesByTransition;
  #attrPathsByMachine;
  #issued;
  constructor(obligations, scenarios, sourceMachines, background) {
    const ids = [];
    for (const [namespace, entries] of [
      ["OB", obligations],
      ["SC", scenarios],
      ["BG", background]
    ])
      for (const entry of entries) {
        const id = entry.id();
        if (!id.belongsTo(namespace))
          throw new IllegalArgumentException({ kind: "lowered-identifier-namespace-mismatch", raw: id.asString() });
        ids.push(id);
      }
    this.#issued = IssuedLoweredIdentifiers.of(ids);
    const machines = obligations.foldLeft([], (acc, obligation) => {
      const origin = obligation.origin();
      const machine = origin.machine();
      if (machine !== null && origin.attribute() !== null)
        acc.push([DesignTransitionIdentifier.of(origin.design().asString()), machine]);
      return acc;
    });
    const attributesFromDeclarations = sourceMachines.foldLeft([], (acc, machine) => {
      acc.push([machine.id(), AttributePath.of(DesignMachines.attrPathOf(machine))]);
      return acc;
    });
    const attributes = obligations.foldLeft(attributesFromDeclarations, (acc, obligation) => {
      const origin = obligation.origin();
      const machine = origin.machine();
      const attribute = origin.attribute();
      if (machine !== null && attribute !== null)
        acc.push([machine.id(), attribute]);
      return acc;
    });
    for (const obligation of obligations)
      if (!obligation.origin().isSyntheticProbe())
        TargetIdentifier.of(obligation.origin().design().asString());
    this.#origins = KeyedIndex.of(obligations.foldLeft([], (acc, obligation) => {
      acc.push([obligation.id(), obligation.origin()]);
      return acc;
    }));
    this.#scenarioDesignIds = KeyedIndex.of(scenarios.foldLeft([], (acc, scenario) => {
      acc.push([scenario.id(), scenario.origin()]);
      return acc;
    }));
    this.#machinesByTransition = KeyedIndex.of(machines);
    this.#attrPathsByMachine = KeyedIndex.of(attributes);
  }
  static of(obligations, scenarios, machines, background) {
    return new LoweringIndex(obligations, scenarios, machines, background);
  }
  static parse(obligations, scenarios, machines, background) {
    return parseConstruction(() => new LoweringIndex(obligations, scenarios, machines, background));
  }
  availableObligationIdentifiers() {
    return this.#issued.availableObligations();
  }
  originOf(loweredId) {
    const id = LoweredIdentifier.parse(loweredId);
    return id.ok ? this.#origins.get(id.value) ?? null : null;
  }
  resolveDesignTarget(id) {
    const entry = this.#origins.get(id);
    if (entry !== undefined)
      return ok({ design: entry.design(), entry });
    const scenario = this.#scenarioDesignIds.get(id);
    if (scenario !== undefined)
      return ok({ design: LoweredOriginReference.of(scenario.asString()), entry: null });
    return err({ kind: "unknown-lowered-target", raw: id.asString() });
  }
  rewriteLoweredIds(text) {
    return text.replace(/\bOB-([0-9]+)\b/g, (m) => this.originOf(m)?.design().asString() ?? m);
  }
  rewriteLoweredIdTokens(label) {
    return label.replace(/OB_([0-9]+)/g, (m, num) => {
      const entry = this.originOf(`OB-${num}`);
      return entry ? designToken(entry.design().asString()) : m;
    });
  }
  isTransition(designId) {
    const parsed = DesignTransitionIdentifier.parse(designId);
    return parsed.ok && this.#machinesByTransition.has(parsed.value);
  }
  machineOfTransition(designId) {
    const parsed = DesignTransitionIdentifier.parse(designId);
    return parsed.ok ? this.#machinesByTransition.get(parsed.value) ?? null : null;
  }
  attrPathOfMachine(machineId) {
    const parsed = DesignMachineIdentifier.parse(machineId);
    return parsed.ok ? this.#attrPathsByMachine.get(parsed.value)?.asString() ?? null : null;
  }
  toOriginEntries() {
    return [...this.#origins].map(([id, origin]) => [id.asString(), origin]);
  }
}

// src/design/domain/lowered-unit.ts
class LoweredUnit {
  #obligations;
  #machines;
  #scenarios;
  #background;
  #index;
  constructor(props) {
    this.#obligations = props.obligations;
    this.#machines = props.machines;
    this.#scenarios = props.scenarios;
    this.#background = props.background;
    this.#index = LoweringIndex.of(props.obligations, props.scenarios, props.machines, props.background);
  }
  static of(props) {
    return new LoweredUnit(props);
  }
  static parse(props) {
    return parseConstruction(() => new LoweredUnit(props));
  }
  obligations() {
    return this.#obligations;
  }
  scenarios() {
    return this.#scenarios;
  }
  background() {
    return this.#background;
  }
  index() {
    return this.#index;
  }
  extendedWith(invariants) {
    let obligations = this.#obligations;
    const available = this.#index.availableObligationIdentifiers();
    for (const invariant of invariants) {
      const next = available.next();
      if (next.done)
        return err({ kind: "too-many-lowered-identifiers" });
      obligations = obligations.add(invariant.loweredAs(next.value));
    }
    return LoweredUnit.parse({
      obligations,
      machines: this.#machines,
      scenarios: this.#scenarios,
      background: this.#background
    });
  }
}

// src/design/domain/design-unit.ts
class DesignUnit {
  #unit;
  #catalog;
  #obligations;
  #machines;
  #scenarios;
  #background;
  constructor(seed) {
    const identifiers = [
      ...seed.obligations.ids(),
      ...seed.scenarios.ids(),
      ...seed.machines.transitionIds(),
      ...seed.machines.ids()
    ];
    if (new Set(identifiers).size !== identifiers.length)
      throw new IllegalArgumentException({ kind: "duplicate-design-target" });
    this.#unit = seed.unit;
    this.#catalog = seed.catalog;
    this.#obligations = seed.obligations;
    this.#machines = seed.machines;
    this.#scenarios = seed.scenarios;
    this.#background = seed.background;
  }
  static parse(seed) {
    return parseConstruction(() => new DesignUnit(seed));
  }
  static of(seed) {
    return new DesignUnit(seed);
  }
  equals(other) {
    return this.#unit.equals(other.#unit) && sameIterable(this.#catalog, other.#catalog, (left, right) => left.equals(right)) && sameIterable(this.#obligations, other.#obligations, (left, right) => left.equals(right)) && sameIterable(this.#machines, other.#machines, (left, right) => left.equals(right)) && sameIterable(this.#scenarios, other.#scenarios, (left, right) => left.equals(right)) && sameIterable(this.#background, other.#background, (left, right) => left.equals(right));
  }
  hashCode() {
    return combinedHash([
      this.#unit.hashCode(),
      this.#catalog.hashCode(),
      this.#obligations.hashCode(),
      this.#machines.hashCode(),
      this.#scenarios.hashCode(),
      this.#background.hashCode()
    ]);
  }
  id() {
    return DesignUnitIdentifier.of(this.#unit.asString());
  }
  name() {
    return this.#unit.asString();
  }
  entities() {
    return this.#catalog.declarations();
  }
  attrPaths() {
    return this.#catalog.paths();
  }
  obligations() {
    return this.#obligations;
  }
  machines() {
    return this.#machines;
  }
  scenarios() {
    return this.#scenarios;
  }
  background() {
    return this.#background;
  }
  allTargets() {
    return TargetIdentifiers.of(Array.from([...this.#obligations.ids(), ...this.#machines.transitionIds(), ...this.#scenarios.ids()], (raw) => TargetIdentifier.of(raw))).sortedUniqueCanonically();
  }
  withLowering(options, actions) {
    const result = this.lowered(options);
    return result.ok ? actions.ready(result.value) : actions.failed(result.error);
  }
  lowered(opts) {
    const obligations = [];
    let n = 0;
    const nextId = () => {
      n += 1;
      return LoweredIdentifier.of(`OB-${n}`);
    };
    this.#obligations.sortedCanonically().foldLeft(obligations, (acc, ob) => {
      acc.push(ob.loweredAs(nextId()));
      return acc;
    });
    for (const sm of this.#machines.sortedCanonically()) {
      const attrPath = DesignMachines.attrPathOf(sm);
      for (const tr of sm.transitions().sortedCanonically()) {
        const id = nextId();
        const lowered = tr.loweredAs(id, attrPath, sm);
        if (!lowered.ok)
          return lowered;
        obligations.push(lowered.value);
      }
      for (const ig of sm.ignores().sortedByStateTrigger()) {
        const id = nextId();
        obligations.push(ig.loweredAs(id, attrPath, sm.loweredIgnoreOrigin()));
      }
    }
    if (opts.synthetics) {
      const events = DesignEventRuleCatalog.parse(this);
      if (!events.ok)
        return events;
      for (const event of events.value) {
        const lowered = event.deadGuardProbe(nextId());
        if (!lowered.ok)
          return lowered;
        obligations.push(lowered.value);
      }
      for (const probe of events.value.subsumptionProbes()) {
        const lowered = probe.loweredAs(nextId());
        if (!lowered.ok)
          return lowered;
        obligations.push(lowered.value);
      }
    }
    const scenarios = this.#scenarios.sortedCanonically().foldLeft([], (acc, sc) => {
      acc.push(sc.loweredAs(LoweredIdentifier.of(`SC-${acc.length + 1}`)));
      return acc;
    });
    const background = this.#background.sortedCanonically().foldLeft([], (acc, bg) => {
      acc.push(bg.loweredAs(LoweredIdentifier.of(`BG-${acc.length + 1}`)));
      return acc;
    });
    return LoweredUnit.parse({
      machines: this.#machines,
      obligations: LoweredObligations.of(obligations),
      scenarios: LoweredScenarios.of(scenarios),
      background: LoweredBackgrounds.of(background)
    });
  }
  declaredEnumValuesOf(attrPath) {
    const values = this.#catalog.enumValuesAt(attrPath);
    return values === null ? null : values.foldLeft([], (acc, member) => {
      acc.push(member.asString());
      return acc;
    });
  }
  enumValuesOf(attrPath) {
    return this.declaredEnumValuesOf(attrPath) ?? [];
  }
}
// src/design/domain/design-unit-declaration.ts
class DesignUnitDeclaration {
  #unit;
  #entities;
  #obligations;
  #stateMachines;
  #scenarios;
  #background;
  #unformalizedTargets;
  #directoryExists;
  #rules;
  constructor(props) {
    this.#unit = props.unit;
    this.#entities = props.entities;
    this.#obligations = props.obligations;
    this.#stateMachines = props.stateMachines;
    this.#scenarios = props.scenarios;
    this.#background = props.background;
    this.#unformalizedTargets = props.unformalizedTargets;
    this.#directoryExists = props.directoryExists;
    this.#rules = props.rules;
  }
  static of(props) {
    return new DesignUnitDeclaration(props);
  }
  equals(other) {
    return this.#unit.equals(other.#unit) && sameIterable(this.#entities, other.#entities, (left, right) => left.equals(right)) && sameIterable(this.#obligations, other.#obligations, (left, right) => left.equals(right)) && sameIterable(this.#stateMachines, other.#stateMachines, (left, right) => left.equals(right)) && sameIterable(this.#scenarios, other.#scenarios, (left, right) => left.equals(right)) && sameIterable(this.#background, other.#background, (left, right) => left.equals(right)) && sameIterable(this.#unformalizedTargets, other.#unformalizedTargets, (left, right) => left.equals(right)) && this.#directoryExists === other.#directoryExists && (this.#rules === null || other.#rules === null ? this.#rules === other.#rules : sameIterable(this.#rules, other.#rules, (left, right) => left.equals(right)));
  }
  hashCode() {
    return combinedHash([
      this.#unit.hashCode(),
      this.#entities.hashCode(),
      this.#obligations.hashCode(),
      this.#stateMachines.hashCode(),
      this.#scenarios.hashCode(),
      this.#background.hashCode(),
      this.#unformalizedTargets.hashCode(),
      hashOfBoolean(this.#directoryExists),
      hashOfNullable(this.#rules, (value) => value.hashCode())
    ]);
  }
  unit() {
    return this.#unit;
  }
  entities() {
    return this.#entities;
  }
  obligations() {
    return this.#obligations;
  }
  stateMachines() {
    return this.#stateMachines;
  }
  scenarios() {
    return this.#scenarios;
  }
  background() {
    return this.#background;
  }
  unformalizedTargets() {
    return this.#unformalizedTargets;
  }
  lacksConstructionDirectory() {
    return !this.#directoryExists;
  }
  diagnostics() {
    const errors = [];
    const unitName = this.#unit.asString();
    const where = (s) => `unit ${unitName}: ${s}`;
    const locate = (messages) => {
      messages.foldLeft(errors, (acc, message) => {
        acc.push(where(message.asString()));
        return acc;
      });
    };
    locate(this.#entities.diagnostics());
    const parsedCatalog = DesignAttributeCatalog.parse(this.#entities);
    const catalog = parsedCatalog.ok ? parsedCatalog.value : null;
    if (!parsedCatalog.ok && parsedCatalog.error.kind !== "ambiguous-design-attributes")
      errors.push(where(`attribute catalog: ${parsedCatalog.error.kind}`));
    if (catalog !== null)
      locate(catalog.encodingDiagnostics());
    const seenIds = new Set;
    const dup = (id, ctx) => {
      if (seenIds.has(id))
        errors.push(where(`${ctx}: duplicate id "${id}"`));
      seenIds.add(id);
    };
    const businessRuleReferencesUsed = [];
    const collectBr = (refs) => {
      if (refs === undefined)
        return;
      refs.foldLeft(businessRuleReferencesUsed, (acc, reference) => {
        acc.push(reference);
        return acc;
      });
    };
    for (const ob of this.#obligations) {
      const ctx = `obligation ${ob.id().asString()}`;
      dup(ob.id().asString(), ctx);
      collectBr(ob.businessRuleReferences());
      locate(ob.diagnostics(catalog));
    }
    for (const sm of this.#stateMachines) {
      const ctx = `machine ${sm.id().asString()}`;
      dup(sm.id().asString(), ctx);
      for (const tr of sm.transitions()) {
        dup(tr.id().asString(), `transition ${tr.id().asString()}`);
        collectBr(tr.businessRuleReferences());
      }
      if (catalog !== null)
        locate(sm.diagnostics(catalog));
    }
    for (const sc of this.#scenarios) {
      const ctx = `scenario ${sc.id().asString()}`;
      dup(sc.id().asString(), ctx);
      collectBr(sc.businessRuleReferences());
      if (catalog !== null)
        locate(sc.diagnostics(catalog));
    }
    for (const bg of this.#background) {
      const ctx = `background ${bg.id().asString()}`;
      dup(bg.id().asString(), ctx);
      if (catalog !== null)
        locate(bg.diagnostics(catalog));
    }
    if (this.lacksConstructionDirectory()) {
      errors.push(where(`no construction/${unitName}/ directory exists under this record \u2014 the unit name matches no unit-of-work, so BR coverage cannot be verified`));
    }
    const known = this.#rules;
    if (known === null) {
      if (businessRuleReferencesUsed.length > 0) {
        errors.push(where(`brRefs are used but construction/${unitName}/functional-design/rules.md was not found \u2014 they cannot be reverse-verified`));
      }
    } else {
      locate(known.diagnostics(KeySet.of(businessRuleReferencesUsed), this.#unformalizedTargets));
    }
    return ErrorMessages.collect(errors.map(ErrorMessage.parse));
  }
}
// src/design/domain/design-unit-declarations.ts
class DesignUnitDeclarations extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-design-unit-declarations");
  }
  rebuild(values) {
    return new DesignUnitDeclarations(values);
  }
  static of(values) {
    return new DesignUnitDeclarations(values);
  }
  map(transform) {
    return this.mapTo(transform, DesignUnitDeclarations.of);
  }
  combine(other) {
    return this.combineTo(other, DesignUnitDeclarations.of);
  }
  static parse(values) {
    return parseConstruction(() => new DesignUnitDeclarations(values));
  }
  add(value) {
    return new DesignUnitDeclarations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  diagnostics() {
    const errors = [];
    const unitNames = new Set;
    for (const unit of this.#values) {
      const unitName = unit.unit().asString();
      if (unitNames.has(unitName))
        errors.push(`duplicate unit "${unitName}"`);
      unitNames.add(unitName);
      for (const message of unit.diagnostics())
        errors.push(message.asString());
    }
    return ErrorMessages.collect(errors.map(ErrorMessage.parse));
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/design-units.ts
class DesignUnits extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-design-units");
  }
  rebuild(values) {
    return new DesignUnits(values);
  }
  static of(values) {
    return new DesignUnits(values);
  }
  map(transform) {
    return this.mapTo(transform, DesignUnits.of);
  }
  combine(other) {
    return this.combineTo(other, DesignUnits.of);
  }
  static parse(values) {
    return parseConstruction(() => new DesignUnits(values));
  }
  add(value) {
    return new DesignUnits([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  allTargetsSkipped(reason, detail) {
    return this.#values.reduce((skips, unit) => skips.combine(DesignSkips.forTargets(unit.allTargets(), UnitName.of(unit.name()), reason, detail)), DesignSkips.of([]));
  }
  sortedByName() {
    return new DesignUnits([...this.#values].sort((a, b) => a.name() < b.name() ? -1 : a.name() > b.name() ? 1 : 0));
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/design-verify-directory.ts
var CROSS_CHECK_BACKEND2 = "cross-check";

class DesignVerifyDirectory {
  #directory;
  #reports;
  #candidate;
  #crossCheck;
  constructor(directory, reports, candidate, crossCheck) {
    this.#directory = directory;
    this.#reports = reports;
    this.#candidate = candidate;
    this.#crossCheck = crossCheck;
  }
  static of(directory, reports, crossCheck) {
    return new DesignVerifyDirectory(directory, reports, null, crossCheck === null ? { kind: "absent" } : { kind: "present", report: crossCheck });
  }
  static unreadableCrossCheck(directory, reports, error) {
    return new DesignVerifyDirectory(directory, reports, null, { kind: "unreadable", error });
  }
  finalizing(candidate) {
    if (!candidate.id().directory().equals(this.#directory)) {
      throw new IllegalArgumentException({ kind: "design-report-directory-mismatch" });
    }
    const fileName = candidate.id().fileName();
    const replaced = this.#reports.exists((sibling) => sibling.id().fileName() === fileName);
    const merged = this.#reports.foldLeft([], (acc, sibling) => {
      acc.push(sibling.id().fileName() === fileName ? candidate : sibling);
      return acc;
    });
    if (!replaced) {
      const at = merged.findIndex((s) => s.id().fileName() > fileName);
      if (at < 0)
        merged.push(candidate);
      else
        merged.splice(at, 0, candidate);
    }
    return new DesignVerifyDirectory(this.#directory, DesignReports.of(merged), candidate, { kind: "absent" });
  }
  finalizedWith(candidate, model, schema) {
    const staged = this.finalizing(candidate.conformedTo(schema));
    if (model === null)
      return staged;
    const derived = staged.#reports.crossChecked(DesignReportIdentifier.of(this.#directory, CROSS_CHECK_BACKEND2), model, candidate.irHash());
    return new DesignVerifyDirectory(this.#directory, staged.#reports, staged.#candidate, {
      kind: "present",
      report: derived.conformedTo(schema)
    });
  }
  crossChecked(model, irHash) {
    const derived = this.#reports.crossChecked(DesignReportIdentifier.of(this.#directory, CROSS_CHECK_BACKEND2), model, irHash);
    return new DesignVerifyDirectory(this.#directory, this.#reports, this.#candidate, {
      kind: "present",
      report: derived
    });
  }
  withoutCrossCheck() {
    return new DesignVerifyDirectory(this.#directory, this.#reports, this.#candidate, { kind: "absent" });
  }
  conformedTo(schema) {
    const candidate = this.#candidate;
    const crossCheck = this.#crossCheck;
    const conformedCandidate = candidate === null ? null : candidate.conformedTo(schema);
    const conformedCrossCheck = conformedCandidate !== candidate || crossCheck.kind === "absent" ? { kind: "absent" } : crossCheck.kind === "unreadable" ? crossCheck : { kind: "present", report: crossCheck.report.conformedTo(schema) };
    const reports = conformedCandidate === null ? this.#reports : this.#reports.map((r) => r.id().fileName() === conformedCandidate.id().fileName() ? conformedCandidate : r);
    return new DesignVerifyDirectory(this.#directory, reports, conformedCandidate, conformedCrossCheck);
  }
  directory() {
    return this.#directory;
  }
  reports() {
    return this.#reports;
  }
  publishedReport() {
    if (this.#candidate === null)
      throw new Error("defect: no finalized design report candidate");
    return this.#candidate;
  }
  candidate() {
    return this.#candidate;
  }
  crossCheck() {
    if (this.#crossCheck.kind === "present")
      return ok(this.#crossCheck.report);
    if (this.#crossCheck.kind === "unreadable")
      return err(this.#crossCheck.error);
    return ok(null);
  }
}
// src/design/domain/event-mapping.ts
class EventMapping {
  #reqTrigger;
  #transitions;
  #reason;
  constructor(props) {
    this.#reqTrigger = props.reqTrigger;
    this.#transitions = props.transitions;
    this.#reason = props.reason;
  }
  static of(props) {
    return new EventMapping({
      reqTrigger: props.reqTrigger,
      transitions: props.transitions,
      reason: props.waived?.reason ?? null
    });
  }
  equals(other) {
    return this.#reqTrigger.equals(other.#reqTrigger) && this.#reason === other.#reason && this.#transitions.equals(other.#transitions);
  }
  hashCode() {
    return combinedHash([
      this.#reqTrigger.hashCode(),
      hashOfNullable(this.#reason, hashOfString),
      this.#transitions.hashCode()
    ]);
  }
  statusIn(unit) {
    if (this.#reason !== null)
      return RefinementStatus.waived(this.#reason);
    if (this.#transitions.isEmpty())
      return RefinementStatus.gap(`requirements event trigger "${this.#reqTrigger.asString()}" has no eventMap entry (map it to design transitions or waive it)`);
    const unknown = this.#transitions.unknownAmong(new Set([...unit.obligations().ids(), ...unit.machines().transitionIds()]));
    return unknown.length > 0 ? RefinementStatus.gap(`eventMap for "${this.#reqTrigger.asString()}" names unknown design id(s) ${unknown.join(", ")}`) : RefinementStatus.checkable();
  }
  isForTrigger(reqTrigger) {
    return this.#reqTrigger.equals(reqTrigger);
  }
  waiverReason() {
    return this.#reason;
  }
  transitions() {
    return this.#transitions;
  }
}
// src/design/domain/event-mappings.ts
class EventMappings extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-event-mappings");
  }
  rebuild(values) {
    return new EventMappings(values);
  }
  static of(values) {
    return new EventMappings(values);
  }
  map(transform) {
    return this.mapTo(transform, EventMappings.of);
  }
  combine(other) {
    return this.combineTo(other, EventMappings.of);
  }
  static parse(values) {
    return parseConstruction(() => new EventMappings(values));
  }
  add(value) {
    return new EventMappings([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  ofTrigger(reqTrigger) {
    let found;
    for (const e of this.#values) {
      if (e.isForTrigger(reqTrigger))
        found = e;
    }
    return found;
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/initial-state.ts
class InitialState {
  #value;
  constructor(value) {
    if (value.length > 4096)
      throw new IllegalArgumentException({ kind: "initial-state-too-long", raw: value.length });
    this.#value = value;
  }
  static of(value) {
    return new InitialState(value);
  }
  static parse(value) {
    return parseConstruction(() => new InitialState(value));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  matchesName(value) {
    return this.#value === value;
  }
  asString() {
    return this.#value;
  }
}
// src/design/domain/initial-states.ts
class InitialStates extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 1e4, "too-many-initial-states");
  }
  rebuild(values) {
    return new InitialStates(values);
  }
  map(transform) {
    return this.mapTo(transform, InitialStates.of);
  }
  combine(other) {
    return this.combineTo(other, InitialStates.of);
  }
  static parse(values) {
    return parseConstruction(() => new InitialStates(values));
  }
  static of(values) {
    return new InitialStates(values);
  }
  add(value) {
    return new InitialStates([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toStrings() {
    return this.#values.map((state) => state.asString());
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/reachability-verdict.ts
class ReachabilityVerdict {
  #kind;
  constructor(kind) {
    this.#kind = kind;
  }
  static reached() {
    return new ReachabilityVerdict("reached");
  }
  static notReachedWithinBound() {
    return new ReachabilityVerdict("not-reached-within-bound");
  }
  static unverified() {
    return new ReachabilityVerdict("unverified");
  }
  equals(other) {
    return this.#kind === other.#kind;
  }
  hashCode() {
    return hashOfString(this.#kind);
  }
  match(handlers) {
    switch (this.#kind) {
      case "reached":
        return handlers.reached();
      case "not-reached-within-bound":
        return handlers.notReachedWithinBound();
      case "unverified":
        return handlers.unverified();
    }
  }
}
// src/design/domain/refinement-attribute.ts
class RefinementAttribute {
  #path;
  #kind;
  #values;
  constructor(props) {
    this.#path = props.path;
    this.#kind = props.kind;
    this.#values = props.values;
  }
  static of(props) {
    return new RefinementAttribute(props);
  }
  equals(other) {
    const left = this.#values;
    const right = other.#values;
    return this.#path.asString() === other.#path.asString() && this.#kind === other.#kind && (left === undefined || right === undefined ? left === right : left.equals(right));
  }
  hashCode() {
    return combinedHash([
      hashOfString(this.#path.asString()),
      hashOfString(this.#kind),
      hashOfNullable(this.#values, (values) => values.hashCode())
    ]);
  }
  path() {
    return this.#path;
  }
  isAt(path) {
    return this.#path.asString() === (typeof path === "string" ? path : path.asString());
  }
  kind() {
    return this.#kind;
  }
  isEnum() {
    return this.#kind === "enum";
  }
  declaredValues() {
    return this.#values;
  }
}
// src/design/domain/refinement-attributes.ts
class RefinementAttributes extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-refinement-attributes");
  }
  rebuild(values) {
    return new RefinementAttributes(values);
  }
  static of(values) {
    return new RefinementAttributes(values);
  }
  map(transform) {
    return this.mapTo(transform, RefinementAttributes.of);
  }
  combine(other) {
    return this.combineTo(other, RefinementAttributes.of);
  }
  static parse(values) {
    return parseConstruction(() => new RefinementAttributes(values));
  }
  add(value) {
    return new RefinementAttributes([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  byPath(path) {
    const key = typeof path === "string" ? path : path.asString();
    let found;
    for (const a of this.#values) {
      if (a.isAt(key))
        found = a;
    }
    return found;
  }
  covers(path) {
    const key = typeof path === "string" ? path : path.asString();
    return this.#values.some((a) => a.isAt(key));
  }
  sortedByPath() {
    return new RefinementAttributes([...this.#values].sort((x, y) => x.path().asString() < y.path().asString() ? -1 : 1));
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/refinement-check.ts
class RefinementCheck {
  #plan;
  #preparation;
  #state;
  constructor(plan, state) {
    this.#plan = plan;
    this.#preparation = plan.preparation();
    this.#state = state;
  }
  static noQueries(plan) {
    return new RefinementCheck(plan, { kind: "no-queries" });
  }
  static unavailable(plan, reason) {
    return new RefinementCheck(plan, { kind: "unavailable", reason });
  }
  static solved(plan, verdicts) {
    return new RefinementCheck(plan, { kind: "solved", verdicts });
  }
  recordedIn(report) {
    const preparation = this.#preparation;
    if (this.#state.kind === "unavailable")
      return preparation.unverifiedIn(report, SkipReason.unavailable(), this.#state.reason.asString());
    const unit = preparation.unit();
    let result = report.withEvidence(preparation.gaps(), preparation.smtStatusSkips(unit.name()).concat(this.#plan.compileSkips()));
    if (this.#state.kind === "solved") {
      const interpreted = this.#plan.interpret(this.#state.verdicts);
      result = result.withEvidence(interpreted.findings, interpreted.skipped);
    }
    return result;
  }
}
// src/design/domain/refinement-map.ts
class RefinementMap {
  #id;
  #requirementsIrHash;
  #designIrHash;
  #units;
  #sourceDocument;
  constructor(seed) {
    this.#id = seed.id;
    this.#requirementsIrHash = seed.requirementsIrHash;
    this.#designIrHash = seed.designIrHash;
    this.#units = seed.units;
    this.#sourceDocument = new Uint8Array(seed.sourceDocument);
  }
  static of(seed) {
    return new RefinementMap(seed);
  }
  id() {
    return this.#id;
  }
  requirementsIrHash() {
    return this.#requirementsIrHash;
  }
  designIrHash() {
    return this.#designIrHash;
  }
  units() {
    return this.#units;
  }
  unitMapOf(unit) {
    return this.#units.mapOf(unit);
  }
  sourceDocument() {
    return new Uint8Array(this.#sourceDocument);
  }
}
// src/design/domain/refinement-map-acquisition.ts
class RefinementMapAcquisition {
  #state;
  constructor(state) {
    this.#state = { ...state };
  }
  static absent(error) {
    return new RefinementMapAcquisition({ kind: "absent", error });
  }
  static loaded(map, artifact, inputs) {
    return new RefinementMapAcquisition({ kind: "loaded", map, artifact, inputs });
  }
  match(handlers) {
    const state = this.#state;
    return state.kind === "absent" ? handlers.absent(state.error) : handlers.loaded(state.map, state.artifact, state.inputs);
  }
}
// src/design/domain/refinement-map-identifier.ts
class RefinementMapIdentifier {
  #path;
  constructor(path) {
    this.#path = path;
  }
  static of(path) {
    return new RefinementMapIdentifier(path);
  }
  equals(other) {
    return this.#path.equals(other.#path);
  }
  hashCode() {
    return this.#path.hashCode();
  }
  artifactPath() {
    return this.#path;
  }
}
// src/design/domain/refinement-preparation.ts
class RefinementPreparation {
  #plans;
  #skipped;
  #inputs;
  constructor(plans, skipped, inputs) {
    this.#plans = boundedCollectionSnapshot(plans, 65536, "too-many-refinement-plans");
    this.#skipped = skipped;
    this.#inputs = inputs;
  }
  static of(plans, skipped, inputs) {
    return new RefinementPreparation(plans, skipped, inputs);
  }
  static parse(plans, skipped, inputs) {
    return parseConstruction(() => new RefinementPreparation(plans, skipped, inputs));
  }
  *[Symbol.iterator]() {
    yield* this.#plans;
  }
  recordedIn(report) {
    const withSkips = report.withEvidence(DesignFindings.of([]), this.#skipped);
    return this.#inputs === null ? withSkips : withSkips.withInputs(this.#inputs);
  }
}

// src/design/domain/refinement-quint-invariant.ts
class RefinementQuintInvariant {
  #reqId;
  #functionalRequirementReferences;
  #expr;
  constructor(reqId, functionalRequirementReferences, expr) {
    this.#reqId = reqId;
    this.#functionalRequirementReferences = functionalRequirementReferences;
    this.#expr = ExpressionTree.of(expr).asExpression();
  }
  static parse(reqId, functionalRequirementReferences, expr) {
    return parseConstruction(() => new RefinementQuintInvariant(reqId, functionalRequirementReferences, expr));
  }
  static of(reqId, functionalRequirementReferences, expr) {
    return new RefinementQuintInvariant(reqId, functionalRequirementReferences, expr);
  }
  equals(other) {
    return this.#reqId.equals(other.#reqId) && sameExpression(this.#expr, other.#expr);
  }
  hashCode() {
    return combinedHash([this.#reqId.hashCode(), hashOfString(canonicalStringify(this.#expr))]);
  }
  reqId() {
    return this.#reqId;
  }
  reqTarget() {
    return this.#reqId.asTargetId();
  }
  loweredAs(id) {
    return LoweredObligation.of({
      id,
      origin: LoweredOrigin.of({ kind: "passthrough", design: LoweredOriginReference.of(this.#reqId.asString()) }),
      nature: ObligationNature.of("invariant"),
      functionalRequirementReferences: this.#functionalRequirementReferences,
      assert: this.#expr
    });
  }
}

// src/design/domain/refinement-quint-invariants.ts
class RefinementQuintInvariants extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-refinement-quint-invariants");
  }
  rebuild(values) {
    return new RefinementQuintInvariants(values);
  }
  static of(values) {
    return new RefinementQuintInvariants(values);
  }
  map(transform) {
    return this.mapTo(transform, RefinementQuintInvariants.of);
  }
  combine(other) {
    return this.combineTo(other, RefinementQuintInvariants.of);
  }
  static parse(values) {
    return parseConstruction(() => new RefinementQuintInvariants(values));
  }
  add(value) {
    return new RefinementQuintInvariants([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  reqTargets() {
    return TargetIdentifiers.of(this.#values.map((invariant) => invariant.reqTarget()));
  }
  reqIds() {
    return new Set(this.#values.map((e) => e.reqId().asString()));
  }
  interpret(findings, skipped, unit) {
    const reqIds = this.reqIds();
    let violations = DesignFindings.of([]);
    let pending = DesignSkips.of([...skipped].filter((s) => reqIds.has(s.target().asString())));
    let designConflict = false;
    for (const finding of findings) {
      if (!finding.isConflict())
        continue;
      const violation = finding.asRefinementViolation(reqIds, UnitName.of(unit));
      if (violation !== null)
        violations = violations.add(violation);
      else
        designConflict = true;
    }
    if (violations.isEmpty() && designConflict) {
      for (const invariant of this.#values) {
        if ([...pending].some((s) => s.isFor(invariant.reqTarget())))
          continue;
        pending = pending.add(DesignSkipped.of({
          target: invariant.reqTarget(),
          reason: SkipReason.capability(),
          unit: UnitName.of(unit),
          detail: "the machine reachably violates its own design invariants first (see the design conflict findings) \u2014 refinement reachability is masked until those are resolved"
        }));
      }
    }
    return { findings: violations, skipped: pending };
  }
  toArray() {
    return this.#values;
  }
}

// src/design/domain/unit-refinement-plan.ts
class UnitRefinementPlan {
  #unit;
  #requirements;
  #mappings;
  #obligationStatus;
  #scenarioStatus;
  #eventTransitions;
  #gaps;
  constructor(unit, map, requirements, artifact) {
    if (!map.isForUnit(unit.id()))
      throw new IllegalArgumentException({ kind: "refinement-unit-mismatch" });
    const obligations = [];
    const transitions = [];
    const scenarios = [];
    let gaps = map.attrMap().diagnostics(unit, requirements, map, artifact);
    for (const obligation of requirements.obligations().sortedCanonically()) {
      const status = obligation.coverageIn(map, unit);
      obligations.push([obligation.id(), status]);
      if (status.isCheckable() && obligation.isEvent())
        transitions.push([obligation.id(), obligation.mappedTransitionsIn(map).sortedCanonically()]);
      const finding = status.findingFor(obligation.id().asTargetId(), obligation.functionalRequirementReferences(), map, artifact);
      if (finding !== null)
        gaps = gaps.add(finding);
    }
    for (const scenario of requirements.scenarios().sortedCanonically()) {
      const status = scenario.coverageIn(map);
      scenarios.push([scenario.id(), status]);
      const finding = status.findingFor(scenario.id().asTargetId(), scenario.functionalRequirementReferences(), map, artifact);
      if (finding !== null)
        gaps = gaps.add(finding);
    }
    this.#unit = unit;
    this.#requirements = requirements;
    this.#mappings = map.attrMap();
    this.#obligationStatus = KeyedIndex.of(obligations);
    this.#scenarioStatus = KeyedIndex.of(scenarios);
    this.#eventTransitions = KeyedIndex.of(transitions);
    this.#gaps = gaps;
  }
  static of(unit, map, requirements, artifact) {
    return new UnitRefinementPlan(unit, map, requirements, artifact);
  }
  static parse(unit, map, requirements, artifact) {
    return parseConstruction(() => new UnitRefinementPlan(unit, map, requirements, artifact));
  }
  unit() {
    return this.#unit;
  }
  requirements() {
    return this.#requirements;
  }
  hasQuintInvariants() {
    return !this.quintInvariants(this.#requirements).isEmpty();
  }
  loweredForQuint() {
    const lowered = this.#unit.lowered({ synthetics: false });
    return lowered.ok ? lowered.value.extendedWith(this.quintInvariants(this.#requirements)) : lowered;
  }
  quintPreparedIn(report) {
    return report.withEvidence(this.#gaps, this.quintStatusSkips(this.#requirements, this.#unit.name()));
  }
  quintRecordedIn(report, result) {
    const lowered = this.loweredForQuint();
    if (!lowered.ok)
      return this.loweringFailedIn(report, lowered.error);
    const interpreted = result.interpretRefinement(this.#unit, lowered.value, this.quintInvariants(this.#requirements));
    return report.withEvidence(interpreted.findings, interpreted.skipped);
  }
  loweringFailedIn(report, problem) {
    return this.unverifiedIn(report, SkipReason.compileError(), `refinement lowering failed: ${problem.kind}`);
  }
  quintTimedOut(report) {
    const skipped = DesignSkips.forTargets(this.quintInvariants(this.#requirements).reqTargets(), UnitName.of(this.#unit.name()), SkipReason.timeout(), "the per-run backend budget was exhausted before the refinement pass");
    return report.withEvidence(DesignFindings.of([]), skipped);
  }
  smtTimedOut(report) {
    return this.unverifiedIn(report, SkipReason.timeout(), "the per-run solver budget was exhausted before the refinement pass");
  }
  unverifiedIn(report, reason, detail) {
    return report.withEvidence(DesignFindings.of([]), DesignSkips.forTargets(this.#requirements.allTargetIds(), UnitName.of(this.#unit.name()), reason, detail));
  }
  attributeMappings() {
    return this.#mappings;
  }
  gaps() {
    return this.#gaps;
  }
  sortedObligationStatuses() {
    return [...this.#obligationStatus].map(([id, st]) => [id.asString(), st]).sort((a, b) => TargetIdentifier.of(a[0]).compareTo(TargetIdentifier.of(b[0])));
  }
  sortedScenarioStatuses() {
    return [...this.#scenarioStatus].map(([id, st]) => [id.asString(), st]).sort((a, b) => TargetIdentifier.of(a[0]).compareTo(TargetIdentifier.of(b[0])));
  }
  statusOfObligation(id) {
    return this.#obligationStatus.get(ObligationIdentifier.of(id));
  }
  statusOfScenario(id) {
    return this.#scenarioStatus.get(ScenarioIdentifier.of(id));
  }
  mappedTransitionsOf(reqId) {
    return this.#eventTransitions.get(ObligationIdentifier.of(reqId)) ?? [];
  }
  smtStatusSkips(unitName) {
    const skipped = [];
    for (const [id, st] of this.sortedObligationStatuses()) {
      const s = st.skipFor(TargetIdentifier.of(id), unitName);
      if (s !== null)
        skipped.push(s);
    }
    for (const [id, st] of this.sortedScenarioStatuses()) {
      const s = st.skipFor(TargetIdentifier.of(id), unitName);
      if (s !== null)
        skipped.push(s);
    }
    return DesignSkips.of(skipped);
  }
  quintStatusSkips(req, unitName) {
    const skipped = [];
    for (const [rid, st] of [...this.#obligationStatus].map(([id, status]) => [id.asString(), status]).sort((a, b) => a[0] < b[0] ? -1 : 1)) {
      const s = st.skipFor(TargetIdentifier.of(rid), unitName);
      if (s !== null)
        skipped.push(s);
      else if (st.isCheckable()) {
        const ob = req.obligationById(rid);
        if (ob?.isEvent()) {
          skipped.push(DesignSkipped.of({
            target: TargetIdentifier.of(rid),
            reason: SkipReason.capability(),
            unit: UnitName.of(unitName),
            detail: "event simulation and enabledness are checked by the SMT refinement pass only in v1"
          }));
        } else if (ob?.isInvariantLike()) {
          const assertion = ob.assertion();
          if (assertion === undefined)
            continue;
          const substituted = this.#mappings.substitute(assertion, false);
          if (!substituted.ok)
            skipped.push(substituted.error.asCompileErrorSkip(TargetIdentifier.of(rid), unitName));
        }
      }
    }
    for (const [rid, st] of [...this.#scenarioStatus].map(([id, status]) => [id.asString(), status]).sort((a, b) => a[0] < b[0] ? -1 : 1)) {
      const s = st.skipFor(TargetIdentifier.of(rid), unitName);
      if (s !== null)
        skipped.push(s);
      else if (st.isCheckable()) {
        skipped.push(DesignSkipped.of({
          target: TargetIdentifier.of(rid),
          reason: SkipReason.capability(),
          unit: UnitName.of(unitName),
          detail: "scenario replay is checked by the SMT refinement pass only in v1 (abstract constraints do not determine a concrete init)"
        }));
      }
    }
    return DesignSkips.of(skipped);
  }
  quintInvariants(req) {
    const out = req.obligations().sortedCanonically().foldLeft([], (acc, ob) => {
      if (!this.#obligationStatus.get(ob.id())?.isCheckable())
        return acc;
      const assertion = ob.assertion();
      if (!ob.isInvariantLike() || assertion === undefined)
        return acc;
      const substituted = this.#mappings.substitute(assertion, false);
      if (substituted.ok)
        acc.push(RefinementQuintInvariant.of(ob.id(), ob.functionalRequirementReferences(), substituted.value));
      return acc;
    });
    return RefinementQuintInvariants.of(out);
  }
}

// src/design/domain/refinement-materials.ts
class RefinementMaterials {
  #id;
  #state;
  constructor(id, state) {
    this.#id = id;
    this.#state = state;
  }
  static inactive(id) {
    return new RefinementMaterials(id, { kind: "inactive" });
  }
  static active(id, requirements, map) {
    return new RefinementMaterials(id, { kind: "active", requirements, map });
  }
  prepare(model) {
    if (!this.#id.isFor(model.id()))
      throw new IllegalArgumentException({ kind: "refinement-model-mismatch" });
    if (this.#state.kind === "inactive")
      return RefinementPreparation.of([], DesignSkips.of([]), null);
    const requirements = this.#state.requirements;
    const skipAll = (reason, detail) => RefinementPreparation.of([], model.units().foldLeft(DesignSkips.of([]), (skips, unit) => skips.combine(DesignSkips.forTargets(requirements.allTargetIds(), UnitName.of(unit.name()), reason, detail))), null);
    return this.#state.map.match({
      absent: (error) => skipAll(SkipReason.absentInput(), error ?? "no refinement map (deep-spec-analysis-refinement-map.md) was authored for this record"),
      loaded: (map, artifact, inputs) => {
        if (!map.requirementsIrHash().equals(requirements.hash()))
          return skipAll(SkipReason.staleInput(), "the refinement map's requirementsIrHash no longer matches the requirements formal model \u2014 re-author the map");
        if (!map.designIrHash().equals(model.irHash()))
          return skipAll(SkipReason.staleInput(), "the refinement map's designIrHash no longer matches this design IR \u2014 re-author the map");
        const plans = [];
        let skipped = DesignSkips.of([]);
        for (const unit of model) {
          const unitMap = map.unitMapOf(unit.id());
          if (unitMap !== undefined && unitMap !== null) {
            const plan = UnitRefinementPlan.parse(unit, unitMap, requirements, artifact);
            if (plan.ok)
              plans.push(plan.value);
            else
              skipped = skipped.combine(DesignSkips.forTargets(requirements.allTargetIds(), UnitName.of(unit.name()), SkipReason.compileError(), `refinement plan could not be constructed: ${plan.error.kind}`));
            continue;
          }
          skipped = skipped.combine(DesignSkips.forTargets(requirements.allTargetIds(), UnitName.of(unit.name()), SkipReason.absentInput(), `the refinement map has no entry for unit ${unit.name()}`));
        }
        return RefinementPreparation.of(plans, skipped, inputs);
      }
    });
  }
  id() {
    return this.#id;
  }
  isActive() {
    return this.#state.kind === "active";
  }
  requirements() {
    if (this.#state.kind !== "active")
      throw new Error("defect: RefinementMaterials.requirements() on inactive materials");
    return this.#state.requirements;
  }
  mapAcquisition() {
    if (this.#state.kind !== "active")
      throw new Error("defect: RefinementMaterials.mapAcquisition() on inactive materials");
    return this.#state.map;
  }
}
// src/design/domain/refinement-materials-identifier.ts
class RefinementMaterialsIdentifier {
  #model;
  constructor(model) {
    this.#model = model;
  }
  static of(model) {
    return new RefinementMaterialsIdentifier(model);
  }
  isFor(model) {
    return this.#model.equals(model);
  }
  equals(other) {
    return this.#model.equals(other.#model);
  }
  hashCode() {
    return this.#model.hashCode();
  }
  modelArtifactPath() {
    return this.#model.artifactPath();
  }
}
// src/design/domain/transition-references.ts
class TransitionReferences extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-transition-references");
  }
  rebuild(values) {
    return new TransitionReferences(values);
  }
  static of(values) {
    return new TransitionReferences(values);
  }
  map(transform) {
    return this.mapTo(transform, TransitionReferences.of);
  }
  combine(other) {
    return this.combineTo(other, TransitionReferences.of);
  }
  static parse(values) {
    return parseConstruction(() => new TransitionReferences(values));
  }
  add(value) {
    return new TransitionReferences([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  asTargetIds() {
    return this.#values.map((reference) => reference.asTargetId());
  }
  unknownAmong(declared) {
    return this.#values.map((t) => t.asString()).filter((t) => !declared.has(t)).sort();
  }
  sortedCanonically() {
    return [...this.#values].sort((a, b) => a.compareTo(b));
  }
  toArray() {
    return this.#values;
  }
}

// src/design/domain/refinement-obligation.ts
class RefinementObligation {
  #id;
  #nature;
  #functionalRequirementReferences;
  #assert;
  #trigger;
  #guard;
  #effect;
  constructor(props) {
    this.#id = props.id;
    this.#nature = props.nature;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#assert = props.assert === undefined ? undefined : ExpressionTree.of(props.assert).asExpression();
    this.#trigger = props.trigger;
    this.#guard = props.guard === undefined ? undefined : ExpressionTree.of(props.guard).asExpression();
    this.#effect = props.effect === undefined ? undefined : ExpressionTree.of(props.effect).asExpression();
  }
  static parse(props) {
    return parseConstruction(() => new RefinementObligation(props));
  }
  static of(props) {
    return new RefinementObligation(props);
  }
  equals(other) {
    return this.#id.equals(other.#id) && this.#nature.equals(other.#nature) && sameIterable(this.#functionalRequirementReferences, other.#functionalRequirementReferences, (left, right) => left.equals(right)) && sameExpression(this.#assert, other.#assert) && sameOptional(this.#trigger, other.#trigger, (left, right) => left.equals(right)) && sameExpression(this.#guard, other.#guard) && sameExpression(this.#effect, other.#effect);
  }
  hashCode() {
    const hashOfExpression = (value) => hashOfString(canonicalStringify(value));
    return combinedHash([
      this.#id.hashCode(),
      this.#nature.hashCode(),
      this.#functionalRequirementReferences.hashCode(),
      hashOfNullable(this.#assert, hashOfExpression),
      hashOfNullable(this.#trigger, (value) => value.hashCode()),
      hashOfNullable(this.#guard, hashOfExpression),
      hashOfNullable(this.#effect, hashOfExpression)
    ]);
  }
  #coverage(expressions, map) {
    const paths = [];
    for (const expression of expressions) {
      if (expression === undefined)
        continue;
      const parsed = traverseResult(ExpressionTree.of(expression).referencedPaths(), AttributePath.parse);
      if (!parsed.ok)
        return parsed;
      paths.push(...parsed.value);
    }
    return ok(map.attrMap().coverageOf(AttributePaths.of(paths), map.unmapped()));
  }
  coverageIn(map, unit) {
    if (map.unmapped().covers(this.#id))
      return RefinementStatus.waived(map.unmapped().reasonOf(this.#id) ?? "listed in unmapped[]");
    if (this.isStateTemporal())
      return RefinementStatus.capability("temporal refinement is outside v1 scope");
    if (this.isInvariantLike()) {
      const coverage = this.#coverage([this.#assert], map);
      return coverage.ok ? coverage.value.forInvariant() : RefinementStatus.gap(`invalid attribute reference: ${coverage.error.kind}`);
    }
    if (this.isEvent()) {
      const entry = this.#trigger === undefined ? undefined : map.eventMappingOf(this.#trigger);
      if (entry === undefined)
        return RefinementStatus.gap(`requirements event trigger "${this.#trigger?.asString() ?? "?"}" has no eventMap entry (map it to design transitions or waive it)`);
      const eligibility = entry.statusIn(unit);
      if (!eligibility.isCheckable())
        return eligibility;
      const coverage = this.#coverage([this.#guard, this.#effect], map);
      return coverage.ok ? coverage.value.forEvent() : RefinementStatus.gap(`invalid attribute reference: ${coverage.error.kind}`);
    }
    return RefinementStatus.capability(`nature "${this.#nature.asString()}" has no refinement check`);
  }
  mappedTransitionsIn(map) {
    return this.#trigger === undefined ? TransitionReferences.of([]) : map.eventMappingOf(this.#trigger)?.transitions() ?? TransitionReferences.of([]);
  }
  id() {
    return this.#id;
  }
  functionalRequirementReferences() {
    return this.#functionalRequirementReferences;
  }
  assertion() {
    return this.#assert;
  }
  isInvariantLike() {
    return this.#nature.isInvariant() || this.#nature.isNumeric();
  }
  isEvent() {
    return this.#nature.isEvent();
  }
  isStateTemporal() {
    return this.#nature.isStateTemporal();
  }
  eventDefinition() {
    if (!this.#nature.isEvent() || this.#trigger === undefined || this.#guard === undefined || this.#effect === undefined)
      return null;
    return { trigger: this.#trigger, guard: this.#guard, effect: this.#effect };
  }
}
// src/design/domain/refinement-obligations.ts
class RefinementObligations extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-refinement-obligations");
  }
  rebuild(values) {
    return new RefinementObligations(values);
  }
  static of(values) {
    return new RefinementObligations(values);
  }
  map(transform) {
    return this.mapTo(transform, RefinementObligations.of);
  }
  combine(other) {
    return this.combineTo(other, RefinementObligations.of);
  }
  static parse(values) {
    return parseConstruction(() => new RefinementObligations(values));
  }
  add(value) {
    return new RefinementObligations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  byId(id) {
    let found;
    for (const o of this.#values) {
      if (o.id().asString() === id)
        found = o;
    }
    return found;
  }
  sortedCanonically() {
    return new RefinementObligations([...this.#values].sort((a, b) => a.id().compareTo(b.id())));
  }
  targetIds() {
    return TargetIdentifiers.of(this.#values.map((obligation) => obligation.id().asTargetId()));
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/refinement-probe.ts
class RefinementProbe {
  #state;
  constructor(state) {
    this.#state = { ...state };
  }
  static invariant(subject, unit) {
    return new RefinementProbe({ kind: "invariant", subject, unit });
  }
  static enabledness(subject, unit, transitions) {
    return new RefinementProbe({ kind: "enabledness", subject, unit, transitions });
  }
  static simulation(subject, unit, designId) {
    return new RefinementProbe({ kind: "simulation", subject, unit, designId });
  }
  static scenario(subject, unit) {
    return new RefinementProbe({ kind: "scenario", subject, unit });
  }
  reqTarget() {
    return this.#state.subject.id().asTargetId();
  }
  belongsToRequirements(requirements) {
    const subject = this.#state.subject;
    return this.#state.kind === "scenario" ? requirements.scenarioById(subject.id().asString()) === subject : requirements.obligationById(subject.id().asString()) === subject;
  }
  belongsTo(unit) {
    return this.#state.unit.equals(unit);
  }
  #finding(kind, targets, witness, detail) {
    return DesignFinding.of({
      kind,
      targets,
      witness,
      detail,
      unit: this.#state.unit,
      functionalRequirementReferences: this.#state.subject.functionalRequirementReferences().sortedUnique()
    });
  }
  interpret(query, verdict) {
    if (verdict === undefined || verdict.isUndecided())
      return {
        findings: DesignFindings.of([]),
        skipped: DesignSkips.of([
          DesignSkipped.of({
            target: this.reqTarget(),
            reason: SkipReason.timeout(),
            unit: this.#state.unit,
            detail: `refinement query ${query.asString()} exceeded the solver budget or errored`
          })
        ])
      };
    const finding = this.#decidedFinding(verdict);
    return { findings: DesignFindings.of(finding === null ? [] : [finding]), skipped: DesignSkips.of([]) };
  }
  #decidedFinding(verdict) {
    const state = this.#state;
    const unit = state.unit.asString();
    const target = this.reqTarget();
    const id = target.asString();
    const targets = FindingTargets.of(target, []);
    if (state.kind === "scenario") {
      if (!state.subject.isViolatedBySatisfiability(verdict.isSat()))
        return null;
      return state.subject.isAccept() ? this.#finding(FindingKind.refinementViolation(), targets, DesignWitness.core(verdict.sortedCore()), `Accept scenario ${id} has no design-legal counterpart in unit ${unit} under the refinement map: the design excludes an example the requirements accept (witness core attached).`) : this.#finding(FindingKind.refinementViolation(), targets, DesignWitness.model(verdict.witnessModel()), `Reject scenario ${id} is still admitted by unit ${unit} under the refinement map: the design does not exclude an example the requirements reject (witness design state attached).`);
    }
    if (!verdict.isSat())
      return null;
    switch (state.kind) {
      case "invariant":
        return this.#finding(FindingKind.refinementViolation(), targets, DesignWitness.model(verdict.witnessModel()), `A design-legal state of unit ${unit} violates requirements obligation ${id} under the refinement map (witness design state attached). The design admits what the verified requirements forbid.`);
      case "enabledness":
        return this.#finding(FindingKind.completenessGap(), FindingTargets.of(target, state.transitions.asTargetIds()).sortedUniqueCanonically(), DesignWitness.model(verdict.witnessModel()), `The requirements event ${id} applies in the witness design state, but none of its mapped design transitions is enabled there: the design has no answer in a region the requirement covers.`);
      case "simulation":
        return this.#finding(FindingKind.refinementViolation(), FindingTargets.of(target, [state.designId.asTargetId()]).sortedUniqueCanonically(), DesignWitness.trace(verdict.witnessTrace()), `Design step ${state.designId.asString()} of unit ${unit}, taken where requirements event ${id} applies, produces an abstract post-state that violates the requirements effect or the abstract frame (pre/post design states attached).`);
    }
  }
}
// src/design/domain/refinement-query-verdict.ts
class RefinementQueryVerdict {
  #status;
  #decodedModel;
  #decodedPostModel;
  #core;
  constructor(props) {
    const snapshot = boundedValueSnapshot(props, { string: 65536, nodes: 65536, depth: 4, total: 16777216 });
    this.#status = snapshot.status;
    this.#decodedModel = snapshot.decodedModel;
    this.#decodedPostModel = snapshot.decodedPostModel;
    this.#core = snapshot.core === undefined ? undefined : snapshot.core.map((label) => QueryLabel.of(label));
  }
  static parse(props) {
    return parseConstruction(() => new RefinementQueryVerdict(props));
  }
  static of(props) {
    return new RefinementQueryVerdict(props);
  }
  equals(other) {
    return this.#status === other.#status && sameArray(this.#core ?? [], other.#core ?? [], (left, right) => left.equals(right)) && sameRecord(this.#decodedModel ?? {}, other.#decodedModel ?? {}) && sameRecord(this.#decodedPostModel ?? {}, other.#decodedPostModel ?? {});
  }
  hashCode() {
    return combinedHash([
      hashOfString(this.#status),
      combinedHash((this.#core ?? []).map((label) => label.hashCode())),
      hashOfString(canonicalStringify(this.#decodedModel ?? {})),
      hashOfString(canonicalStringify(this.#decodedPostModel ?? {}))
    ]);
  }
  isSat() {
    return this.#status === "sat";
  }
  isUnsat() {
    return this.#status === "unsat";
  }
  isUndecided() {
    return this.#status !== "sat" && this.#status !== "unsat";
  }
  sortedCore() {
    return (this.#core ?? []).map((label) => label.asString()).sort();
  }
  witnessModel() {
    return { ...this.#decodedModel ?? {} };
  }
  witnessTrace() {
    return [{ ...this.#decodedModel ?? {} }, { ...this.#decodedPostModel ?? {} }];
  }
}
// src/design/domain/refinement-query-verdict-entry.ts
class RefinementQueryVerdictEntry {
  #query;
  #verdict;
  constructor(query, verdict) {
    this.#query = query;
    this.#verdict = verdict;
  }
  static of(query, verdict) {
    return new RefinementQueryVerdictEntry(query, verdict);
  }
  query() {
    return this.#query;
  }
  verdict() {
    return this.#verdict;
  }
  equals(other) {
    return this.#query.equals(other.#query) && this.#verdict.equals(other.#verdict);
  }
  hashCode() {
    return combinedHash([this.#query.hashCode(), this.#verdict.hashCode()]);
  }
}
// src/design/domain/refinement-query-verdicts.ts
class RefinementQueryVerdicts extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    const snapshot = boundedCollectionSnapshot(values, 65536, "too-many-refinement-query-verdicts");
    this.#values = KeyedIndex.of(snapshot.map((entry) => [entry.query(), entry]));
  }
  static of(values) {
    return new RefinementQueryVerdicts(values);
  }
  map(transform) {
    return this.mapTo(transform, RefinementQueryVerdicts.of);
  }
  combine(other) {
    return this.combineTo(other, RefinementQueryVerdicts.of);
  }
  static parse(values) {
    return parseConstruction(() => new RefinementQueryVerdicts(values));
  }
  rebuild(values) {
    return new RefinementQueryVerdicts(values);
  }
  *[Symbol.iterator]() {
    yield* this.#values.values();
  }
  verdictOf(queryId) {
    return this.#values.get(queryId)?.verdict();
  }
}
// src/design/domain/refinement-requirements.ts
class RefinementRequirements {
  #id;
  #hash;
  #attributes;
  #obligations;
  #scenarios;
  constructor(seed) {
    this.#id = seed.id;
    this.#hash = seed.hash;
    this.#attributes = seed.attributes;
    this.#obligations = seed.obligations;
    this.#scenarios = seed.scenarios;
  }
  static of(seed) {
    return new RefinementRequirements(seed);
  }
  id() {
    return this.#id;
  }
  hash() {
    return this.#hash;
  }
  attributes() {
    return this.#attributes;
  }
  obligations() {
    return this.#obligations;
  }
  scenarios() {
    return this.#scenarios;
  }
  obligationById(id) {
    return this.#obligations.byId(id);
  }
  scenarioById(id) {
    return this.#scenarios.byId(id);
  }
  allTargetIds() {
    return this.#obligations.targetIds().combine(this.#scenarios.targetIds());
  }
}
// src/design/domain/refinement-scenario.ts
class RefinementScenario {
  #id;
  #expectation;
  #functionalRequirementReferences;
  #bindings;
  #eventTrigger;
  constructor(props) {
    this.#id = props.id;
    this.#expectation = props.expectation;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#bindings = props.bindings;
    this.#eventTrigger = props.event?.trigger;
  }
  static of(props) {
    return new RefinementScenario(props);
  }
  equals(other) {
    return this.#id.equals(other.#id) && this.#expectation.asString() === other.#expectation.asString() && sameIterable(this.#functionalRequirementReferences, other.#functionalRequirementReferences, (left, right) => left.equals(right)) && sameIterable(this.#bindings, other.#bindings, (left, right) => left.equals(right)) && sameOptional(this.#eventTrigger, other.#eventTrigger, (left, right) => left.equals(right));
  }
  hashCode() {
    return combinedHash([
      this.#id.hashCode(),
      hashOfString(this.#expectation.asString()),
      this.#functionalRequirementReferences.hashCode(),
      this.#bindings.hashCode(),
      hashOfNullable(this.#eventTrigger, (value) => value.hashCode())
    ]);
  }
  coverageIn(map) {
    if (map.unmapped().covers(this.#id))
      return RefinementStatus.waived(map.unmapped().reasonOf(this.#id) ?? "listed in unmapped[]");
    if (this.hasEventRule())
      return RefinementStatus.capability("event scenarios are not replayed in v1");
    return map.attrMap().coverageOf(AttributePaths.of(this.#bindings.entriesCanonically().map((binding) => binding.path())), map.unmapped()).forScenario();
  }
  id() {
    return this.#id;
  }
  kind() {
    return this.#expectation.asString();
  }
  functionalRequirementReferences() {
    return this.#functionalRequirementReferences;
  }
  isViolatedBySatisfiability(satisfiable) {
    return this.#expectation.isViolatedBySatisfiability(satisfiable);
  }
  isAccept() {
    return this.#expectation.isAccept();
  }
  hasEventRule() {
    return this.#eventTrigger !== undefined;
  }
  bindings() {
    return this.#bindings;
  }
}
// src/design/domain/refinement-scenarios.ts
class RefinementScenarios extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-refinement-scenarios");
  }
  rebuild(values) {
    return new RefinementScenarios(values);
  }
  static of(values) {
    return new RefinementScenarios(values);
  }
  map(transform) {
    return this.mapTo(transform, RefinementScenarios.of);
  }
  combine(other) {
    return this.combineTo(other, RefinementScenarios.of);
  }
  static parse(values) {
    return parseConstruction(() => new RefinementScenarios(values));
  }
  add(value) {
    return new RefinementScenarios([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  byId(id) {
    let found;
    for (const s of this.#values) {
      if (s.id().asString() === id)
        found = s;
    }
    return found;
  }
  sortedCanonically() {
    return new RefinementScenarios([...this.#values].sort((a, b) => a.id().asTargetId().compareTo(b.id().asTargetId())));
  }
  targetIds() {
    return TargetIdentifiers.of(this.#values.map((scenario) => scenario.id().asTargetId()));
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/refinement-solver-plan.ts
class RefinementSolverPlan {
  #preparation;
  #pending;
  #compileSkips;
  constructor(props) {
    if (props.pending.size() > 65536 || props.compileSkips.count() > 65536) {
      throw new IllegalArgumentException({ kind: "refinement-solver-plan-too-large" });
    }
    const unit = props.preparation.unit().name();
    for (const [, probe] of props.pending) {
      if (!probe.belongsToRequirements(props.preparation.requirements()))
        throw new IllegalArgumentException({ kind: "refinement-probe-outside-preparation" });
      if (!probe.belongsTo(UnitName.of(unit)))
        throw new IllegalArgumentException({ kind: "refinement-probe-unit-mismatch" });
    }
    if (props.compileSkips.exists((skipped) => skipped.unit() !== unit))
      throw new IllegalArgumentException({ kind: "refinement-solver-unit-mismatch" });
    this.#preparation = props.preparation;
    this.#pending = props.pending;
    this.#compileSkips = props.compileSkips;
  }
  static of(props) {
    return new RefinementSolverPlan(props);
  }
  static parse(props) {
    return parseConstruction(() => new RefinementSolverPlan(props));
  }
  preparation() {
    return this.#preparation;
  }
  compileSkips() {
    return this.#compileSkips;
  }
  *[Symbol.iterator]() {
    yield* this.#pending;
  }
  interpret(results) {
    let findings = DesignFindings.of([]);
    let skipped = DesignSkips.of([]);
    for (const [query, probe] of this.#pending) {
      const interpreted = probe.interpret(query, results.verdictOf(query));
      findings = findings.combine(interpreted.findings);
      skipped = skipped.combine(interpreted.skipped);
    }
    return { findings, skipped };
  }
}
// src/design/domain/refinement-unit-map.ts
class RefinementUnitMap {
  #unit;
  #attrMap;
  #eventMap;
  #unmapped;
  constructor(props) {
    this.#unit = props.unit;
    this.#attrMap = props.attrMap;
    this.#eventMap = props.eventMap;
    this.#unmapped = props.unmapped;
  }
  static of(props) {
    return new RefinementUnitMap(props);
  }
  equals(other) {
    return this.#unit.equals(other.#unit) && sameIterable(this.#attrMap, other.#attrMap, (left, right) => left.equals(right)) && sameIterable(this.#eventMap, other.#eventMap, (left, right) => left.equals(right)) && sameIterable(this.#unmapped, other.#unmapped, (left, right) => left.equals(right));
  }
  hashCode() {
    return combinedHash([
      this.#unit.hashCode(),
      this.#attrMap.hashCode(),
      this.#eventMap.hashCode(),
      this.#unmapped.hashCode()
    ]);
  }
  gapFor(targets, detail, artifact, references = FunctionalRequirementReferences.of([])) {
    return DesignFinding.of({
      kind: FindingKind.mappingGap(),
      functionalRequirementReferences: references.sortedUnique(),
      targets: targets.sortedUniqueCanonically(),
      witness: DesignWitness.refs([{ artifact: artifact.asString(), element: `units[${this.#unit.asString()}]` }]),
      unit: UnitName.of(this.#unit.asString()),
      detail
    });
  }
  attributeGap(path, detail, artifact) {
    return this.gapFor(FindingTargets.of(TargetIdentifier.of(`attr:${path.asString().replace(/[^A-Za-z0-9_./-]/g, "-")}`), []), detail, artifact);
  }
  isForUnit(unit) {
    return this.#unit.equals(unit);
  }
  attrMap() {
    return this.#attrMap;
  }
  eventMappingOf(trigger) {
    return this.#eventMap.ofTrigger(trigger);
  }
  unmapped() {
    return this.#unmapped;
  }
}
// src/design/domain/refinement-unit-maps.ts
class RefinementUnitMaps extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-refinement-unit-maps");
  }
  rebuild(values) {
    return new RefinementUnitMaps(values);
  }
  static of(values) {
    return new RefinementUnitMaps(values);
  }
  map(transform) {
    return this.mapTo(transform, RefinementUnitMaps.of);
  }
  combine(other) {
    return this.combineTo(other, RefinementUnitMaps.of);
  }
  static parse(values) {
    return parseConstruction(() => new RefinementUnitMaps(values));
  }
  add(value) {
    return new RefinementUnitMaps([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  mapOf(unit) {
    return this.#values.find((m) => m.isForUnit(unit));
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/rule-subsumption.ts
class RuleSubsumption {
  #probe;
  #finding;
  constructor(verdict) {
    const finding = verdict.finding();
    if (finding === null)
      throw new IllegalArgumentException({ kind: "unproved-subsumption" });
    this.#probe = verdict.probe();
    this.#finding = finding;
  }
  static of(verdict) {
    return new RuleSubsumption(verdict);
  }
  static parse(verdict) {
    return parseConstruction(() => new RuleSubsumption(verdict));
  }
  equals(other) {
    const left = this.#probe.targets().toStrings();
    const right = other.#probe.targets().toStrings();
    return left.length === right.length && left.every((target, index) => target === right[index]) && this.#finding.equals(other.#finding);
  }
  hashCode() {
    return combinedHash([
      ...this.#probe.targets().toStrings().map((target) => hashOfString(target)),
      this.#finding.hashCode()
    ]);
  }
  isReverseOf(other) {
    return this.#probe.isReverseOf(other.#probe);
  }
  mentionsAny(dead) {
    return this.#probe.mentionsAny(dead);
  }
  targets() {
    return this.#probe.targets();
  }
  finding() {
    return this.#finding;
  }
  equivalenceFinding() {
    const [a, b] = this.targets().toStrings();
    return this.#finding.withDetail(`${a} and ${b} are mutually redundant: same trigger, provably equivalent guards (under the entity constraints), and an identical effect \u2014 one of them can be removed.`);
  }
}
// src/design/domain/rule-subsumption-verdict.ts
class RuleSubsumptionVerdict {
  #state;
  constructor(state) {
    this.#state = { ...state };
  }
  static fromFinding(probe, source, witness, unit) {
    const finding = source.isKind("conflict") ? DesignFinding.of({
      kind: FindingKind.redundancy(),
      functionalRequirementReferences: source.functionalRequirementReferences(),
      targets: probe.targets(),
      witness,
      unit,
      detail: probe.description()
    }) : null;
    return new RuleSubsumptionVerdict({ kind: "observed", probe, finding });
  }
  static undecided(probe) {
    return new RuleSubsumptionVerdict({ kind: "unobserved", probe });
  }
  isProved() {
    return this.#state.kind === "observed" && this.#state.finding !== null;
  }
  hasObservation() {
    return this.#state.kind === "observed";
  }
  probe() {
    return this.#state.probe;
  }
  finding() {
    return this.#state.kind === "observed" ? this.#state.finding : null;
  }
}
// src/design/domain/rule-subsumptions.ts
class RuleSubsumptions extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-subsumptions");
  }
  rebuild(values) {
    return new RuleSubsumptions(values);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  static of(values) {
    return new RuleSubsumptions(values);
  }
  map(transform) {
    return this.mapTo(transform, RuleSubsumptions.of);
  }
  combine(other) {
    return this.combineTo(other, RuleSubsumptions.of);
  }
  static parse(values) {
    return parseConstruction(() => new RuleSubsumptions(values));
  }
  findingsExcept(dead) {
    const groups = new Map;
    for (const relation of this.#values) {
      if (relation.mentionsAny(dead))
        continue;
      const key = relation.targets().joined(",");
      const group = groups.get(key) ?? [];
      group.push(relation);
      groups.set(key, group);
    }
    const findings = [];
    for (const key of [...groups.keys()].sort()) {
      const group = groups.get(key) ?? [];
      const first = group[0];
      if (first !== undefined)
        findings.push(group.some((other) => first.isReverseOf(other)) ? first.equivalenceFinding() : first.finding());
    }
    return DesignFindings.of(findings);
  }
}
// src/design/domain/sibling-verdict-document.ts
class SiblingVerdictDocument {
  #state;
  constructor(state) {
    this.#state = state;
  }
  static unreadable(reason = "sibling backend produced no findings document") {
    return new SiblingVerdictDocument({ kind: "unreadable", reason });
  }
  static unavailable(reason, method) {
    return new SiblingVerdictDocument({ kind: "unavailable", reason, method });
  }
  static readable(method, findings, skipped) {
    return new SiblingVerdictDocument({ kind: "readable", method, findings, skipped });
  }
  isReadable() {
    return this.#state.kind === "readable";
  }
  unavailableReason() {
    return this.#state.kind === "unavailable" ? this.#state.reason : null;
  }
  reachabilityOf(attrPath, state) {
    return this.match({
      unreadable: () => ReachabilityVerdict.unverified(),
      unavailable: () => ReachabilityVerdict.unverified(),
      readable: (method, findings, skipped) => {
        if (findings.exists((finding) => finding.provesReachabilityOf(attrPath, state)))
          return ReachabilityVerdict.reached();
        if (method !== "bounded" || !skipped.isEmpty() || !findings.isEmpty())
          return ReachabilityVerdict.unverified();
        return ReachabilityVerdict.notReachedWithinBound();
      }
    });
  }
  match(handlers) {
    const state = this.#state;
    switch (state.kind) {
      case "unreadable":
        return handlers.unreadable(state.reason);
      case "unavailable":
        return handlers.unavailable(state.reason, state.method.asString());
      case "readable":
        return handlers.readable(state.method.asString(), state.findings, state.skipped);
    }
  }
  remapVerdicts(unit, index) {
    return this.match({
      unreadable: (reason) => ({
        findings: DesignFindings.of([]),
        skipped: DesignSkips.of([]),
        unavailable: reason,
        method: null
      }),
      unavailable: (reason, method) => ({
        findings: DesignFindings.of([]),
        skipped: DesignSkips.of([]),
        unavailable: reason,
        method
      }),
      readable: (method, findings, skipped) => this.#remapReadable(unit, index, method, findings, skipped)
    });
  }
  #remapReadable(u, index, method, docFindings, docSkipped) {
    const unit = UnitName.of(u.name());
    const findings = [];
    const skipped = [];
    const waived = new Set;
    const deadDesignIds = new Set;
    const relations = [];
    for (const source of docFindings) {
      const result = source.remap(unit, index);
      switch (result.kind) {
        case "invalid":
          return {
            findings: DesignFindings.of([]),
            skipped: DesignSkips.of([]),
            method,
            unavailable: `sibling finding target cannot be resolved: ${result.error.kind} (${result.error.raw})`
          };
        case "finding":
          findings.push(result.finding);
          break;
        case "unreachable":
          deadDesignIds.add(result.target.asString());
          findings.push(result.finding);
          break;
        case "subsumption":
          relations.push(result.relation);
          break;
        case "waived":
          result.skipped.foldLeft(skipped, (acc, skip) => {
            const target = skip.target().asString();
            if (!waived.has(target)) {
              waived.add(target);
              acc.push(skip);
            }
            return acc;
          });
          break;
        case "ignored":
          break;
      }
    }
    const subsumptions = RuleSubsumptions.parse(relations);
    if (!subsumptions.ok)
      return {
        findings: DesignFindings.of([]),
        skipped: DesignSkips.of([]),
        unavailable: `subsumption analysis failed: ${subsumptions.error.kind}`,
        method
      };
    subsumptions.value.findingsExcept(TargetIdentifiers.of([...deadDesignIds].map(TargetIdentifier.of))).foldLeft(findings, (acc, finding) => {
      acc.push(finding);
      return acc;
    });
    const seenSkip = new Set;
    for (const source of docSkipped) {
      const resolved = source.remap(unit, index);
      if (!resolved.ok)
        return {
          findings: DesignFindings.of([]),
          skipped: DesignSkips.of([]),
          method,
          unavailable: `sibling skip target cannot be resolved: ${resolved.error.kind} (${resolved.error.raw})`
        };
      const mapped = resolved.value;
      if (mapped === null)
        continue;
      const key = `${mapped.target().asString()}|${mapped.reason()}`;
      if (!seenSkip.has(key)) {
        seenSkip.add(key);
        skipped.push(mapped);
      }
    }
    return { findings: DesignFindings.of(findings), skipped: DesignSkips.of(skipped), unavailable: null, method };
  }
}
// src/design/domain/sibling-verdict-finding.ts
class SiblingVerdictFinding {
  #kind;
  #functionalRequirementReferences;
  #targets;
  #witness;
  #detail;
  constructor(props) {
    this.#kind = props.kind;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#targets = Object.freeze([...props.targets]);
    this.#witness = props.witness;
    this.#detail = props.detail;
  }
  static of(props) {
    return new SiblingVerdictFinding(props);
  }
  equals(other) {
    const left = this.#targets.map((target) => target.asString());
    const right = other.#targets.map((target) => target.asString());
    return this.#kind.equals(other.#kind) && this.#detail === other.#detail && sameArray(left, right, (target, otherTarget) => target === otherTarget) && sameArray(this.#functionalRequirementReferences.toStrings(), other.#functionalRequirementReferences.toStrings(), (reference, otherReference) => reference === otherReference) && this.#witness.equals(other.#witness);
  }
  hashCode() {
    return combinedHash([
      this.#kind.hashCode(),
      hashOfString(this.#detail),
      ...this.#targets.map((target) => hashOfString(target.asString())),
      ...this.#functionalRequirementReferences.toStrings().map((reference) => hashOfString(reference)),
      this.#witness.hashCode()
    ]);
  }
  remap(unit, index) {
    const resolved = traverseResult(this.#targets, (target) => index.resolveDesignTarget(target));
    if (!resolved.ok)
      return { kind: "invalid", error: resolved.error };
    const mapped = resolved.value;
    const witness = this.witnessRemappedBy((label) => index.rewriteLoweredIdTokens(label));
    const synthetic = mapped.find((target) => target.entry?.isSyntheticProbe());
    if (synthetic?.entry?.isKind("vac-dead") && this.isKind("conflict")) {
      const design = synthetic.entry.design().asString();
      const target = TargetIdentifier.of(design);
      return {
        kind: "unreachable",
        target,
        finding: DesignFinding.of({
          kind: FindingKind.unreachable(),
          functionalRequirementReferences: this.#functionalRequirementReferences,
          targets: FindingTargets.of(target, []),
          witness,
          unit,
          detail: `The guard of ${design} can never hold under the entity constraints and invariants (witness core attached): the ${index.isTransition(design) ? "transition" : "rule"} is dead.`
        })
      };
    }
    const probe = synthetic?.entry?.subsumptionProbe();
    if (probe != null) {
      const relation = RuleSubsumption.parse(RuleSubsumptionVerdict.fromFinding(probe, this, witness, unit));
      return relation.ok ? { kind: "subsumption", relation: relation.value } : { kind: "ignored" };
    }
    if (synthetic !== undefined)
      return { kind: "ignored" };
    const [head, ...tail] = mapped.map((target) => TargetIdentifier.of(target.design.asString()));
    if (head === undefined)
      return { kind: "invalid", error: { kind: "empty-finding-targets" } };
    const parsedTargets = FindingTargets.parse(head, tail);
    if (!parsedTargets.ok)
      return { kind: "invalid", error: parsedTargets.error };
    const targets = parsedTargets.value.sortedUniqueCanonically();
    if (this.isKind("conflict")) {
      const machines = targets.foldLeft([], (acc, target) => {
        acc.push(index.machineOfTransition(target.asString()));
        return acc;
      });
      const machine = machines[0];
      if (machine?.waivesOverlapOf(machines))
        return {
          kind: "waived",
          skipped: DesignSkips.forTargets(targets, unit, SkipReason.waived(), `machine ${machine.id().asString()} declares deterministic: false \u2014 the same-(state,trigger) overlap check is waived by the model`)
        };
    }
    return {
      kind: "finding",
      finding: DesignFinding.of({
        kind: this.#kind,
        functionalRequirementReferences: this.#functionalRequirementReferences,
        targets,
        witness,
        unit,
        detail: index.rewriteLoweredIds(this.#detail)
      })
    };
  }
  kind() {
    return this.#kind.asString();
  }
  isKind(kind) {
    const parsed = FindingKind.parse(kind);
    return parsed.ok && this.#kind.equals(parsed.value);
  }
  functionalRequirementReferences() {
    return this.#functionalRequirementReferences;
  }
  targets() {
    return this.#targets;
  }
  detail() {
    return this.#detail;
  }
  provesReachabilityOf(attrPath, state) {
    return this.isKind("conflict") && this.#witness.reachesState(attrPath, state);
  }
  witnessRemappedBy(rewrite) {
    return this.#witness.remapCore(rewrite);
  }
}
// src/design/domain/sibling-verdict-findings.ts
class SiblingVerdictFindings extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-sibling-verdict-findings");
  }
  rebuild(values) {
    return new SiblingVerdictFindings(values);
  }
  static of(values) {
    return new SiblingVerdictFindings(values);
  }
  map(transform) {
    return this.mapTo(transform, SiblingVerdictFindings.of);
  }
  combine(other) {
    return this.combineTo(other, SiblingVerdictFindings.of);
  }
  static parse(values) {
    return parseConstruction(() => new SiblingVerdictFindings(values));
  }
  add(value) {
    return new SiblingVerdictFindings([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/sibling-verdict-skip.ts
class SiblingVerdictSkip {
  #target;
  #reason;
  #detail;
  constructor(props) {
    this.#target = props.target;
    this.#reason = props.reason;
    this.#detail = props.detail;
  }
  static of(props) {
    return new SiblingVerdictSkip(props);
  }
  equals(other) {
    return this.#target.equals(other.#target) && this.#reason.asString() === other.#reason.asString() && this.#detail === other.#detail;
  }
  hashCode() {
    return combinedHash([
      this.#target.hashCode(),
      hashOfString(this.#reason.asString()),
      hashOfNullable(this.#detail, hashOfString)
    ]);
  }
  remap(unit, index) {
    const resolved = index.resolveDesignTarget(this.#target);
    if (!resolved.ok)
      return resolved;
    const mapped = resolved.value;
    if (mapped.entry?.isSyntheticProbe())
      return ok(null);
    return ok(DesignSkipped.of({
      target: TargetIdentifier.of(mapped.design.asString()),
      reason: this.#reason,
      unit,
      ...this.#detail !== undefined ? { detail: index.rewriteLoweredIds(this.#detail) } : {}
    }));
  }
}
// src/design/domain/sibling-verdict-skips.ts
class SiblingVerdictSkips extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-sibling-verdict-skips");
  }
  rebuild(values) {
    return new SiblingVerdictSkips(values);
  }
  static of(values) {
    return new SiblingVerdictSkips(values);
  }
  map(transform) {
    return this.mapTo(transform, SiblingVerdictSkips.of);
  }
  combine(other) {
    return this.combineTo(other, SiblingVerdictSkips.of);
  }
  static parse(values) {
    return parseConstruction(() => new SiblingVerdictSkips(values));
  }
  add(value) {
    return new SiblingVerdictSkips([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/sibling-verification-result.ts
class SiblingVerificationResult {
  #state;
  constructor(state) {
    this.#state = state;
  }
  static backendUnavailable(reason, refinementFailure) {
    return new SiblingVerificationResult({ kind: "backend-unavailable", reason, refinementFailure });
  }
  static incomplete(reason, refinementFailure) {
    return new SiblingVerificationResult({ kind: "incomplete", reason, refinementFailure });
  }
  static completed(document, refinementFailure) {
    return new SiblingVerificationResult({ kind: "completed", document, refinementFailure });
  }
  isBackendUnavailable() {
    return this.#state.kind === "backend-unavailable";
  }
  canInspectReachability() {
    return this.#state.kind === "completed" && this.#state.document.isReadable();
  }
  recordedIn(report, model, unit, lowered) {
    const state = this.#state;
    if (state.kind === "backend-unavailable")
      return report.backendFailed(model, state.reason.asString());
    if (state.kind === "incomplete")
      return report.unitUnverified(unit, SkipReason.unavailable(), state.reason.asString());
    const mapped = state.document.remapVerdicts(unit, lowered.index());
    return mapped.unavailable === null ? report.unitVerified(unit, mapped.findings, mapped.skipped, mapped.method) : report.unitUnverified(unit, SkipReason.unavailable(), mapped.unavailable);
  }
  interpretRefinement(unit, lowered, invariants) {
    const state = this.#state;
    let failure = state.refinementFailure?.asString() ?? null;
    if (state.kind === "completed" && failure === null) {
      const mapped = state.document.remapVerdicts(unit, lowered.index());
      if (mapped.unavailable === null)
        return invariants.interpret(mapped.findings, mapped.skipped, unit.name());
      failure = `refinement pass degraded: ${mapped.unavailable}`;
    }
    return {
      findings: DesignFindings.of([]),
      skipped: DesignSkips.forTargets(invariants.reqTargets(), UnitName.of(unit.name()), SkipReason.unavailable(), failure ?? undefined)
    };
  }
}
// src/design/domain/transition-reference.ts
class TransitionReference {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "transition-ref-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-refinement-map-token", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new TransitionReference(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new TransitionReference(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  compareTo(other) {
    return compareCanonically(this.#value, other.#value);
  }
  asTargetId() {
    return TargetIdentifier.of(this.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/design/domain/unformalized-targets.ts
class UnformalizedTargets extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = KeySet.of(boundedCollectionSnapshot(values, 65536, "too-many-unformalized-targets"));
  }
  rebuild(values) {
    return new UnformalizedTargets(values);
  }
  static of(values) {
    return new UnformalizedTargets(values);
  }
  map(transform) {
    return this.mapTo(transform, UnformalizedTargets.of);
  }
  combine(other) {
    return this.combineTo(other, UnformalizedTargets.of);
  }
  static parse(values) {
    return parseConstruction(() => new UnformalizedTargets(values));
  }
  add(value) {
    if (this.#values.has(value))
      return this;
    return new UnformalizedTargets([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  covers(target) {
    return this.#values.has(target);
  }
  toArray() {
    return this.#values.toArray();
  }
  toStrings() {
    return this.#values.toArray().map((v) => v.asString());
  }
}
// src/design/domain/unmapped-declarations.ts
class UnmappedDeclarations extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-unmapped-declarations");
  }
  rebuild(values) {
    return new UnmappedDeclarations(values);
  }
  static of(values) {
    return new UnmappedDeclarations(values);
  }
  map(transform) {
    return this.mapTo(transform, UnmappedDeclarations.of);
  }
  combine(other) {
    return this.combineTo(other, UnmappedDeclarations.of);
  }
  static parse(values) {
    return parseConstruction(() => new UnmappedDeclarations(values));
  }
  add(value) {
    return new UnmappedDeclarations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  covers(target) {
    const t = target.asString();
    return this.#values.some((x) => x.isFor(t));
  }
  reasonOf(target) {
    const t = target.asString();
    let found;
    for (const x of this.#values) {
      if (x.isFor(t))
        found = x.reason();
    }
    return found;
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/unmapped-target.ts
class UnmappedTarget {
  #target;
  #reason;
  constructor(target, reason) {
    this.#target = target;
    this.#reason = reason;
  }
  static of(props) {
    return new UnmappedTarget(props.target, props.reason);
  }
  equals(other) {
    return this.#target.equals(other.#target) && this.#reason === other.#reason;
  }
  hashCode() {
    return combinedHash([this.#target.hashCode(), hashOfString(this.#reason)]);
  }
  isFor(token) {
    return this.#target.asString() === token;
  }
  reason() {
    return this.#reason;
  }
}
// src/design/domain/unmapped-target-reference.ts
class UnmappedTargetReference {
  #value;
  constructor(raw) {
    if (raw.length > 1024)
      throw new IllegalArgumentException({ kind: "unmapped-target-ref-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-refinement-map-token", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new UnmappedTargetReference(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new UnmappedTargetReference(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  hashCode() {
    return hashOfString(this.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/design/adapter/design-entities-parser.ts
function parseDesignEntities(schema) {
  const entities = [];
  for (const ent of Array.isArray(schema.entities) ? schema.entities : []) {
    if (!isObject(ent) || typeof ent.name !== "string")
      continue;
    const name = DesignEntityName.parse(ent.name);
    if (!name.ok)
      return name;
    const attributes = [];
    for (const attr of Array.isArray(ent.attributes) ? ent.attributes : []) {
      if (!isObject(attr) || typeof attr.name !== "string")
        continue;
      const t = isObject(attr.type) ? attr.type : {};
      const kind = AttributeKind.parse(typeof t.kind === "string" ? t.kind : "");
      if (!kind.ok)
        return kind;
      const name2 = DesignAttributeName.parse(attr.name);
      if (!name2.ok)
        return name2;
      const members = flatMapResult(traverseResult(Array.isArray(t.values) ? t.values.filter((v) => typeof v === "string") : [], EnumerationMember.parse), EnumerationMembers.parse);
      if (!members.ok)
        return members;
      attributes.push(DesignAttributeDeclaration.of({
        name: name2.value,
        kind: kind.value,
        ...typeof attr.description === "string" ? { description: attr.description } : {},
        ...Array.isArray(t.values) ? { values: members.value } : {},
        ...typeof t.min === "number" ? { min: DeclaredBound.of(t.min) } : {},
        ...typeof t.max === "number" ? { max: DeclaredBound.of(t.max) } : {}
      }));
    }
    const declarations = DesignAttributeDeclarations.parse(attributes);
    if (!declarations.ok)
      return declarations;
    entities.push(DesignEntityDeclaration.of({
      name: name.value,
      ...typeof ent.description === "string" ? { description: ent.description } : {},
      attributes: declarations.value
    }));
  }
  return DesignEntityDeclarations.parse(entities);
}
function renderDesignEntities(entities) {
  return entities.toArray().map((ent) => {
    const out = { name: ent.name().asString() };
    const description = ent.description();
    if (description !== undefined)
      out.description = description;
    out.attributes = ent.attributes().toArray().map((attr) => {
      const a = { name: attr.name().asString() };
      const attrDescription = attr.description();
      if (attrDescription !== undefined)
        a.description = attrDescription;
      const type = { kind: attr.kindLabel() };
      const min = attr.minBound();
      if (min !== undefined)
        type.min = min.asNumber();
      const max = attr.maxBound();
      if (max !== undefined)
        type.max = max.asNumber();
      const values = attr.enumStates();
      if (values !== null)
        type.values = values.toArray().map((member) => member.asString());
      a.type = type;
      return a;
    });
    return out;
  });
}
// src/kernel/adapter/artifact-io.ts
import { readdirSync, readFileSync, statSync } from "fs";
function readFailure(path, error) {
  const code = error.code;
  if (code === "ENOENT")
    return { kind: "not-found", path };
  return {
    kind: "io-failed",
    operation: "read",
    path,
    cause: error instanceof Error ? error.message : String(error)
  };
}
function readArtifactBytes(path) {
  let bytes;
  try {
    bytes = readFileSync(path);
  } catch (error) {
    return err(readFailure(path, error));
  }
  return ok(bytes);
}
function readArtifactText(path) {
  try {
    return ok(readFileSync(path, "utf-8"));
  } catch (error) {
    return err(readFailure(path, error));
  }
}
function readDirectory(path) {
  let entries;
  try {
    entries = readdirSync(path, { withFileTypes: true });
  } catch (error) {
    return err(readFailure(path, error));
  }
  return ok(Object.freeze(entries));
}
function readArtifactStat(path) {
  try {
    return ok(statSync(path));
  } catch (error) {
    return err(readFailure(path, error));
  }
}
// src/kernel/adapter/atomic-write.ts
import { mkdirSync, renameSync, rmSync, writeFileSync } from "fs";
import { basename, dirname, join } from "path";
var sequence = 0;
function writeFileAtomically(path, data) {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  sequence += 1;
  const tmp = join(dir, `.${basename(path)}.tmp-${Date.now().toString(36)}-${sequence.toString(36)}`);
  try {
    writeFileSync(tmp, data);
    renameSync(tmp, path);
  } catch (e) {
    try {
      rmSync(tmp, { force: true });
    } catch {}
    throw e;
  }
}
// src/kernel/adapter/bindings-decoder.ts
function decodeDeclaredBindings(raw) {
  const values = [];
  for (const [key, value] of Object.entries(raw)) {
    const path = AttributePath.parse(key);
    if (!path.ok)
      return err(JSON.stringify(path.error));
    const declared = Declaration.parse(value);
    if (!declared.ok)
      return err(JSON.stringify(declared.error));
    values.push(BindingDeclaration.of(path.value, DeclaredBindingValue.of(declared.value)));
  }
  const bindings = DeclaredBindings.parse(values);
  return bindings.ok ? bindings : err(JSON.stringify(bindings.error));
}
function decodeScenarioBindings(raw) {
  const declarations = decodeDeclaredBindings(raw);
  if (!declarations.ok)
    return declarations;
  const values = [];
  for (const declaration of declarations.value) {
    const path = declaration.path();
    const declared = declaration.value();
    const value = BindingValue.resolve(declared);
    if (!value.ok)
      return err(`${path.asString()}: ${value.error}`);
    values.push(ScenarioBinding.of(path, value.value));
  }
  const bindings = ScenarioBindings.parse(values);
  return bindings.ok ? bindings : err(JSON.stringify(bindings.error));
}
// src/kernel/adapter/contract-schema.ts
import { readFileSync as readFileSync2 } from "fs";
function readContractSchema(path) {
  try {
    const document = JSON.parse(readFileSync2(path, "utf-8"));
    if (!isObject(document))
      return err({ cause: "contract schema must be a JSON object" });
    return ok(document);
  } catch (e) {
    return err({ cause: e instanceof Error ? e.message : String(e) });
  }
}
// src/kernel/adapter/directory-finalization-lock.ts
import { randomBytes } from "crypto";
import { mkdirSync as mkdirSync2, renameSync as renameSync2, rmSync as rmSync2, writeFileSync as writeFileSync2 } from "fs";
import { join as join2 } from "path";
var DESIGN_LOCK_BASENAME = ".deep-spec-design-finalization.lock";
var METADATA_BASENAME = "owner.lockmeta";
var LEASE_MS = 30000;
var OWNER_TOKEN_BYTES = 16;
function causeOf(e) {
  return e instanceof Error ? e.message : String(e);
}

class DirectoryFinalizationLock {
  #clock;
  #liveness;
  #lockBasename;
  #ownerTokens;
  constructor(clock, liveness, lockBasename = DESIGN_LOCK_BASENAME) {
    this.#clock = clock;
    this.#liveness = liveness;
    this.#lockBasename = lockBasename;
    this.#ownerTokens = new Map;
  }
  canonicalPathOf(directory) {
    return join2(directory.asString(), this.#lockBasename);
  }
  ownerTokenOf(directory) {
    return this.#ownerTokens.get(this.canonicalPathOf(directory)) ?? null;
  }
  acquire(directory) {
    const canonical = this.canonicalPathOf(directory);
    const token = randomBytes(OWNER_TOKEN_BYTES).toString("hex");
    const blocked = this.#createOwned(canonical, token);
    if (blocked === null) {
      this.#ownerTokens.set(canonical, token);
      return { kind: "acquired" };
    }
    const observed = this.#readMetadata(canonical);
    if (!observed.ok) {
      return { kind: "lock-contended", cause: `owner metadata is unreadable (${blocked})` };
    }
    if (observed.value.state !== "held") {
      return { kind: "lock-contended", cause: `owner metadata is in state "${observed.value.state}"` };
    }
    if (this.#clock.now() < observed.value.leaseExpiresAtMs) {
      return { kind: "lock-contended", cause: "the lease has not expired" };
    }
    const status = this.#liveness.statusOf(observed.value.pid);
    if (status !== "absent") {
      return { kind: "lock-contended", cause: `owner process ${observed.value.pid} is ${status}` };
    }
    const reread = this.#readMetadata(canonical);
    if (!reread.ok || reread.value.token !== observed.value.token) {
      return { kind: "lock-contended", cause: "the lock changed hands during the recovery check" };
    }
    const stale = `${canonical}.stale.${observed.value.token}.${token}`;
    try {
      renameSync2(canonical, stale);
    } catch (e) {
      return { kind: "lock-recovery-failed", cause: causeOf(e) };
    }
    const lost = this.#createOwned(canonical, token);
    this.#discard(stale);
    if (lost !== null) {
      return { kind: "lock-recovery-failed", cause: lost };
    }
    this.#ownerTokens.set(canonical, token);
    return { kind: "recovered", displacedToken: observed.value.token };
  }
  holdsOwnership(directory) {
    const canonical = this.canonicalPathOf(directory);
    const mine = this.#ownerTokens.get(canonical);
    if (mine === undefined)
      return false;
    const observed = this.#readMetadata(canonical);
    return observed.ok && observed.value.state === "held" && observed.value.token === mine;
  }
  release(directory) {
    const canonical = this.canonicalPathOf(directory);
    const mine = this.#ownerTokens.get(canonical);
    if (mine === undefined) {
      return { kind: "lock-release-failed", cause: "this writer does not hold the lock" };
    }
    this.#ownerTokens.delete(canonical);
    const observed = this.#readMetadata(canonical);
    if (!observed.ok || observed.value.token !== mine) {
      return { kind: "lock-release-failed", cause: "the canonical lock is no longer owned by this writer" };
    }
    const cleanup = `${canonical}.cleanup.${mine}`;
    try {
      renameSync2(canonical, cleanup);
    } catch (e) {
      return { kind: "lock-release-failed", cause: causeOf(e) };
    }
    const swept = this.#discard(cleanup);
    if (swept !== null) {
      return { kind: "cleanup-failed", cause: swept };
    }
    return { kind: "released" };
  }
  #createOwned(canonical, token) {
    const acquiredAtMs = this.#clock.now();
    try {
      mkdirSync2(canonical);
    } catch (e) {
      return causeOf(e);
    }
    const metadata = {
      state: "held",
      token,
      pid: this.#liveness.self(),
      acquiredAtMs,
      leaseExpiresAtMs: acquiredAtMs + LEASE_MS
    };
    try {
      writeFileSync2(join2(canonical, METADATA_BASENAME), `${JSON.stringify(metadata)}
`, "utf-8");
      return null;
    } catch (e) {
      const cleanup = `${canonical}.cleanup.${token}`;
      try {
        renameSync2(canonical, cleanup);
        this.#discard(cleanup);
      } catch {}
      return causeOf(e);
    }
  }
  #readMetadata(canonical) {
    const path = join2(canonical, METADATA_BASENAME);
    const read = readArtifactText(path);
    if (!read.ok)
      return err(read.error);
    let raw;
    try {
      raw = JSON.parse(read.value);
    } catch (error) {
      return err({ kind: "corrupt", path, cause: error instanceof Error ? error.message : String(error) });
    }
    if (typeof raw !== "object" || raw === null)
      return err({ kind: "corrupt", path, cause: "owner metadata must be an object" });
    const doc = raw;
    if (typeof doc.state !== "string" || typeof doc.token !== "string")
      return err({ kind: "corrupt", path, cause: "owner metadata lacks state or token" });
    if (typeof doc.pid !== "number" || typeof doc.acquiredAtMs !== "number" || typeof doc.leaseExpiresAtMs !== "number")
      return err({ kind: "corrupt", path, cause: "owner metadata has invalid numeric fields" });
    return ok({
      state: doc.state,
      token: doc.token,
      pid: doc.pid,
      acquiredAtMs: doc.acquiredAtMs,
      leaseExpiresAtMs: doc.leaseExpiresAtMs
    });
  }
  #discard(ownPath) {
    try {
      rmSync2(ownPath, { recursive: true, force: true });
      return null;
    } catch (e) {
      return causeOf(e);
    }
  }
}
// src/kernel/adapter/fence.ts
function extractFences(md, lang) {
  const fences = [];
  const lines = md.split(`
`);
  let open = false;
  let info = "";
  let openLine = 0;
  let buf = [];
  for (let i = 0;i < lines.length; i++) {
    const m = (lines[i] ?? "").match(/^\s*```(.*)$/);
    if (m && !open) {
      open = true;
      info = (m[1] ?? "").trim().toLowerCase();
      openLine = i + 1;
      buf = [];
      continue;
    }
    if (m && open) {
      if (info === lang || info.startsWith(`${lang} `)) {
        fences.push({ info, body: buf.join(`
`), line: openLine });
      }
      open = false;
      continue;
    }
    if (open)
      buf.push(lines[i] ?? "");
  }
  return fences;
}
// src/kernel/adapter/findings-document.ts
var strings = (value) => Array.isArray(value) && value.every((v) => typeof v === "string");
var optionalString = (value) => value === undefined || typeof value === "string";
function decodeFindingsDocument(raw) {
  if (!isObject(raw))
    return err("findings document must be an object");
  for (const field of ["backend", "irVersion", "irHash", "method"]) {
    if (typeof raw[field] !== "string")
      return err(`${field} must be a string`);
  }
  if (!Array.isArray(raw.findings) || !raw.findings.every((f) => isObject(f) && typeof f.kind === "string" && Array.isArray(f.targets) && f.targets.length > 0 && f.targets.length <= MAX_FINDING_TARGETS && strings(f.frRefs) && strings(f.targets) && isObject(f.witness) && typeof f.detail === "string" && optionalString(f.unit))) {
    return err("findings must be an array of complete finding records");
  }
  if (!Array.isArray(raw.skipped) || !raw.skipped.every((s) => isObject(s) && typeof s.target === "string" && typeof s.reason === "string" && optionalString(s.detail) && optionalString(s.unit))) {
    return err("skipped must be an array of complete skip records");
  }
  if (raw.unavailable !== undefined && (!isObject(raw.unavailable) || typeof raw.unavailable.reason !== "string")) {
    return err("unavailable must carry a reason");
  }
  if (raw.inputs !== undefined && (!Array.isArray(raw.inputs) || !raw.inputs.every((i) => isObject(i) && typeof i.artifact === "string" && typeof i.sha256 === "string"))) {
    return err("inputs must be an array of input anchors");
  }
  if (raw.checked !== undefined && !strings(raw.checked))
    return err("checked must be an array of strings");
  if (raw.crossChecked !== undefined && (!Array.isArray(raw.crossChecked) || !raw.crossChecked.every((c) => isObject(c) && typeof c.backend === "string" && (c.unit === undefined || typeof c.unit === "string") && strings(c.targets)))) {
    return err("crossChecked must be an array of backend comparisons");
  }
  return ok(raw);
}
// src/kernel/adapter/findings-values-parser.ts
function parseFindingsValues(raw) {
  const decoded = decodeFindingsDocument(raw);
  if (!decoded.ok)
    return decoded;
  const doc = decoded.value;
  const parsed = combineResults({
    backend: BackendName.parse(doc.backend),
    irVersion: IntermediateRepresentationVersion.parse(doc.irVersion),
    irHash: ContentHash.parse(doc.irHash),
    method: VerificationMethod.parse(doc.method),
    findings: traverseResult(doc.findings, (entry) => {
      const fields = combineResults({
        kind: FindingKind.parse(entry.kind),
        functionalRequirementReferences: flatMapResult(traverseResult(entry.frRefs, RequirementIdentifier.parse), FunctionalRequirementReferences.parse),
        targets: flatMapResult(traverseResult(entry.targets, TargetIdentifier.parse), (targets) => {
          const [head, ...tail] = targets;
          return head === undefined ? err({ kind: "empty-finding-targets" }) : FindingTargets.parse(head, tail);
        }),
        unit: entry.unit === undefined ? ok(undefined) : UnitName.parse(entry.unit)
      });
      if (!fields.ok)
        return fields;
      return ok({
        ...fields.value,
        functionalRequirementReferences: fields.value.functionalRequirementReferences,
        targets: fields.value.targets,
        witness: entry.witness,
        detail: entry.detail
      });
    }),
    skipped: traverseResult(doc.skipped, (entry) => {
      const fields = combineResults({
        target: TargetIdentifier.parse(entry.target),
        reason: SkipReason.parse(entry.reason),
        unit: entry.unit === undefined ? ok(undefined) : UnitName.parse(entry.unit)
      });
      if (!fields.ok)
        return fields;
      return ok({ ...fields.value, detail: entry.detail });
    }),
    inputs: doc.inputs === undefined ? ok(undefined) : traverseResult(doc.inputs, (entry) => combineResults({
      artifact: ArtifactPath.parse(entry.artifact),
      sha256: ContentHash.parse(entry.sha256)
    })),
    crossChecked: doc.crossChecked === undefined ? ok(undefined) : traverseResult(doc.crossChecked, (entry) => {
      const fields = combineResults({
        backend: BackendName.parse(entry.backend),
        unit: entry.unit === undefined ? ok(undefined) : UnitName.parse(entry.unit),
        targets: flatMapResult(traverseResult(entry.targets, TargetIdentifier.parse), TargetIdentifiers.parse)
      });
      if (!fields.ok)
        return fields;
      return ok({
        backend: fields.value.backend,
        unit: fields.value.unit,
        targets: fields.value.targets
      });
    })
  });
  if (!parsed.ok)
    return err(JSON.stringify(parsed.error));
  return ok({ ...parsed.value, checked: doc.checked, unavailable: doc.unavailable });
}
// src/kernel/adapter/record-root.ts
import { dirname as dirname2, join as join3 } from "path";
function findRecordRoot(startDir) {
  let d = startDir;
  for (let i = 0;i < 8; i++) {
    const inception = readArtifactStat(join3(d, "inception"));
    if (inception.ok)
      return ok(d);
    if (inception.error.kind !== "not-found")
      return err(inception.error);
    const state = readArtifactStat(join3(d, "aidlc-state.md"));
    if (state.ok)
      return ok(d);
    if (state.error.kind !== "not-found")
      return err(state.error);
    const parent = dirname2(d);
    if (parent === d)
      break;
    d = parent;
  }
  return ok(null);
}
function relArtifact(recordRoot, absPath) {
  if (recordRoot && absPath.startsWith(`${recordRoot}/`)) {
    return absPath.slice(recordRoot.length + 1);
  }
  return absPath.split("/").slice(-1)[0] ?? absPath;
}
// src/kernel/adapter/sensor-flags.ts
function parseFlags(argv) {
  let stage = "";
  let outputPath = "";
  let reportOnly = false;
  for (let i = 0;i < argv.length; i++) {
    if (argv[i] === "--stage")
      stage = argv[i + 1] ?? "";
    if (argv[i] === "--output-path")
      outputPath = argv[i + 1] ?? "";
    if (argv[i] === "--report-only")
      reportOnly = true;
  }
  return { stage, outputPath, reportOnly };
}
// src/kernel/adapter/smt-symbols.ts
function smtVar(path, primed) {
  return `${primed ? "p" : "v"}_${path.replace(/\./g, "_")}`;
}
function smtName(prefix, id) {
  return `${prefix}_${id.replace(/[^A-Za-z0-9_]/g, "_")}`;
}
function smtLit(n) {
  if (!Number.isInteger(n))
    return n < 0 ? `(- ${-n})` : String(n);
  return n < 0 ? `(- ${BigInt(-n)})` : String(BigInt(n));
}
function smtIntOf(raw) {
  const m = raw.match(/^\(-\s*(\d+)\)$/);
  return m ? -Number.parseInt(m[1] ?? "0", 10) : Number.parseInt(raw, 10);
}
// src/kernel/adapter/solver-child-results-parser.ts
var MAX_RESULTS = 65536;
var MAX_QUERY_ID_LENGTH = 2048;
var MAX_VALUE_NODES = 65536;
var MAX_VALUE_STRING = 65536;
var MAX_VALUE_TOTAL_TEXT = 16777216;
function consumeNode(budget, field) {
  budget.nodes++;
  return budget.nodes > MAX_VALUE_NODES ? `solver child ${field} exceeds the value node budget` : null;
}
function consumeText(budget, field, value) {
  if (value.length > MAX_VALUE_STRING)
    return `solver child ${field} contains an oversized string`;
  budget.totalText += value.length;
  return budget.totalText > MAX_VALUE_TOTAL_TEXT ? `solver child ${field} exceeds the total text budget` : null;
}
function consumeString(budget, field, value) {
  return consumeNode(budget, field) ?? consumeText(budget, field, value);
}
function copyModel(raw, budget) {
  const nodeError = consumeNode(budget, "model");
  if (nodeError !== null)
    return err(nodeError);
  const entries = [];
  for (const name in raw) {
    if (!Object.hasOwn(raw, name))
      continue;
    const keyError = consumeText(budget, "model key", name);
    if (keyError !== null)
      return err(keyError);
    const value = raw[name];
    if (typeof value !== "string")
      return err("solver child returned an invalid model");
    const valueError = consumeString(budget, "model value", value);
    if (valueError !== null)
      return err(valueError);
    entries.push([name, value]);
  }
  return ok(Object.fromEntries(entries));
}
function copyCore(raw, budget) {
  if (raw.length > MAX_VALUE_NODES)
    return err("solver child core exceeds the value node budget");
  const nodeError = consumeNode(budget, "core");
  if (nodeError !== null)
    return err(nodeError);
  const core = [];
  for (let index = 0;index < raw.length; index++) {
    const value = raw[index];
    if (typeof value !== "string")
      return err("solver child returned an invalid core");
    const valueError = consumeString(budget, "core value", value);
    if (valueError !== null)
      return err(valueError);
    core.push(value);
  }
  return ok(core);
}
function parseSolverChildResults(raw, expectedIds) {
  if (!isObject(raw))
    return err("solver child response lacks a results array");
  const resultItems = raw.results;
  if (!Array.isArray(resultItems))
    return err("solver child response lacks a results array");
  if (expectedIds.length > MAX_RESULTS)
    return err("solver child expected query set exceeds 65,536 entries");
  if (resultItems.length > MAX_RESULTS)
    return err("solver child response has too-many-results");
  const expectedIdsSnapshot = [];
  let expectedInspected = 0;
  for (const id of expectedIds) {
    if (++expectedInspected > MAX_RESULTS)
      return err("solver child expected query set exceeds 65,536 entries");
    if (id.length > MAX_QUERY_ID_LENGTH)
      return err("solver child expected query id is too long");
    expectedIdsSnapshot.push(id);
  }
  if (expectedInspected !== expectedIds.length)
    return err("solver child expected query set length does not match its iteration");
  const expected = new Set(expectedIdsSnapshot);
  if (expected.size !== expectedIdsSnapshot.length)
    return err("solver query ids are not unique");
  const items = [];
  const resultIds = new Set;
  for (let index = 0;index < resultItems.length; index++) {
    const item = resultItems[index];
    if (!isObject(item))
      return err("solver child result lacks a query id");
    const id = item.id;
    if (typeof id !== "string")
      return err("solver child result lacks a query id");
    if (id.length > MAX_QUERY_ID_LENGTH)
      return err("solver child returned an oversized query id");
    if (!expected.has(id))
      return err(`solver child returned unexpected query ${id}`);
    if (resultIds.has(id))
      return err(`solver child returned duplicate query ${id}`);
    resultIds.add(id);
    items.push({ item, id });
  }
  const missing = expectedIdsSnapshot.filter((id) => !resultIds.has(id));
  if (missing.length > 0)
    return err(`solver child omitted query results: ${missing.join(", ")}`);
  if (resultIds.size !== expectedIdsSnapshot.length)
    return err("solver query ids are not unique");
  const results = new Map;
  for (const { item, id } of items) {
    const status = item.status;
    if (status !== "sat" && status !== "unsat" && status !== "unknown" && status !== "budget" && status !== "error")
      return err(`solver child returned an invalid status for query ${id}`);
    const budget = { nodes: 0, totalText: 0 };
    let model;
    const rawModel = item.model;
    if (rawModel !== undefined) {
      if (!isObject(rawModel))
        return err(`solver child returned an invalid model for query ${id}`);
      const copied = copyModel(rawModel, budget);
      if (!copied.ok)
        return err(`${copied.error} for query ${id}`);
      model = copied.value;
    }
    let core;
    const rawCore = item.core;
    if (rawCore !== undefined) {
      if (!Array.isArray(rawCore))
        return err(`solver child returned an invalid core for query ${id}`);
      const copied = copyCore(rawCore, budget);
      if (!copied.ok)
        return err(`${copied.error} for query ${id}`);
      core = copied.value;
    }
    const rawError = item.error;
    if (rawError !== undefined) {
      if (typeof rawError !== "string")
        return err(`solver child returned an invalid error for query ${id}`);
      const error = consumeString(budget, "error", rawError);
      if (error !== null)
        return err(`${error} for query ${id}`);
    }
    results.set(id, {
      id,
      status,
      ...model === undefined ? {} : { model },
      ...core === undefined ? {} : { core },
      ...rawError === undefined ? {} : { error: rawError }
    });
  }
  return ok(results);
}
// src/kernel/adapter/system-clock.ts
class SystemClock {
  now() {
    return Date.now();
  }
}
// src/design/adapter/parse-business-rule-reference-index.ts
function parseBusinessRuleReferenceIndex(markdown) {
  return flatMapResult(traverseResult([...markdown.matchAll(/\bBR[0-9]+\.[0-9]+\b/g)], (match) => BusinessRuleReference.parse(match[0])), (values) => flatMapResult(BusinessRuleReferences.parse(values), BusinessRuleReferenceIndex.parse));
}

// src/design/adapter/design-intermediate-representation-validation-materials-repository-implementation.ts
import { basename as basename2, dirname as dirname3, join as join4 } from "path";
var DESIGN_MODEL_BASENAME = "deep-spec-analysis-functional-formal-model.md";
function asExpression(v) {
  return isObject(v) ? v : undefined;
}
function strArrayOrUndefined(v) {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : undefined;
}
function businessRuleReferencesOrUndefined(v) {
  const arr = strArrayOrUndefined(v);
  if (arr === undefined)
    return ok(undefined);
  const parsed = flatMapResult(traverseResult(arr, BusinessRuleReference.parse), BusinessRuleReferences.parse);
  return parsed.ok ? ok(parsed.value) : parsed;
}
function buildUnitView(rawUnit, unitName, directoryExists, rulesMarkdown) {
  const unit = DesignUnitIdentifier.parse(unitName);
  if (!unit.ok)
    return err(JSON.stringify(unit.error));
  const entities = parseDesignEntities(isObject(rawUnit.schema) ? rawUnit.schema : {});
  if (!entities.ok)
    return err(JSON.stringify(entities.error));
  const obligations = [];
  for (const ob of Array.isArray(rawUnit.obligations) ? rawUnit.obligations : []) {
    if (!isObject(ob) || typeof ob.id !== "string")
      continue;
    const temporal = isObject(ob.temporal) ? ob.temporal : null;
    const parsed = combineResults({
      id: DesignObligationIdentifier.parse(ob.id),
      origin: typeof ob.origin === "string" ? DesignObligationOrigin.parse(ob.origin) : ok(undefined),
      brRefs: businessRuleReferencesOrUndefined(ob.brRefs ?? null)
    });
    if (!parsed.ok)
      return err(JSON.stringify(parsed.error));
    const constructed = DesignObligationDeclaration.parse({
      id: parsed.value.id,
      origin: parsed.value.origin,
      businessRuleReferences: parsed.value.brRefs,
      assert: asExpression(ob.assert ?? null),
      guard: asExpression(ob.guard ?? null),
      effect: asExpression(ob.effect ?? null),
      temporal: temporal === null ? undefined : {
        assert: asExpression(temporal.assert ?? null),
        from: asExpression(temporal.from ?? null),
        to: asExpression(temporal.to ?? null)
      }
    });
    if (!constructed.ok)
      return err(JSON.stringify(constructed.error));
    obligations.push(constructed.value);
  }
  const stateMachines = [];
  for (const sm of Array.isArray(rawUnit.stateMachines) ? rawUnit.stateMachines : []) {
    if (!isObject(sm) || typeof sm.id !== "string")
      continue;
    const attrPath = `${typeof sm.entity === "string" ? sm.entity : "?"}.${typeof sm.attribute === "string" ? sm.attribute : "?"}`;
    const initial = (Array.isArray(sm.initial) ? sm.initial : []).filter((s) => typeof s === "string");
    const transitions = [];
    for (const tr of Array.isArray(sm.transitions) ? sm.transitions : []) {
      if (!isObject(tr) || typeof tr.id !== "string")
        continue;
      const parsed = combineResults({
        id: DesignTransitionIdentifier.parse(tr.id),
        trigger: typeof tr.trigger === "string" ? TriggerName.parse(tr.trigger) : ok(undefined),
        brRefs: businessRuleReferencesOrUndefined(tr.brRefs ?? null)
      });
      if (!parsed.ok)
        return err(JSON.stringify(parsed.error));
      const constructed = DesignTransitionDeclaration.parse({
        id: parsed.value.id,
        from: typeof tr.from === "string" ? tr.from : undefined,
        to: typeof tr.to === "string" ? tr.to : undefined,
        trigger: parsed.value.trigger,
        businessRuleReferences: parsed.value.brRefs,
        guard: asExpression(tr.guard ?? null),
        effect: asExpression(tr.effect ?? null)
      });
      if (!constructed.ok)
        return err(JSON.stringify(constructed.error));
      transitions.push(constructed.value);
    }
    const ignores = [];
    for (const ig of Array.isArray(sm.ignores) ? sm.ignores : []) {
      if (!isObject(ig) || typeof ig.state !== "string" || typeof ig.trigger !== "string")
        continue;
      const trigger = TriggerName.parse(ig.trigger);
      if (!trigger.ok)
        return err(JSON.stringify(trigger.error));
      ignores.push(DesignIgnoreDeclaration.of({ state: ig.state, trigger: trigger.value }));
    }
    const states = flatMapResult(traverseResult(initial, InitialState.parse), InitialStates.parse);
    if (!states.ok)
      return err(JSON.stringify(states.error));
    const id = DesignMachineIdentifier.parse(sm.id);
    if (!id.ok)
      return err(JSON.stringify(id.error));
    const children = combineResults({
      transitions: DesignTransitionDeclarations.parse(transitions),
      ignores: DesignIgnoreDeclarations.parse(ignores)
    });
    if (!children.ok)
      return err(JSON.stringify(children.error));
    stateMachines.push(DesignMachineDeclaration.of({
      id: id.value,
      attrPath,
      initial: states.value,
      ...children.value
    }));
  }
  const scenarios = [];
  for (const sc of Array.isArray(rawUnit.scenarios) ? rawUnit.scenarios : []) {
    if (!isObject(sc) || typeof sc.id !== "string")
      continue;
    const bindings = decodeDeclaredBindings(isObject(sc.bindings) ? sc.bindings : {});
    if (!bindings.ok)
      return err(bindings.error);
    const parsed = combineResults({
      id: DesignScenarioIdentifier.parse(sc.id),
      brRefs: businessRuleReferencesOrUndefined(sc.brRefs ?? null)
    });
    if (!parsed.ok)
      return err(JSON.stringify(parsed.error));
    const constructed = DesignScenarioDeclaration.parse({
      id: parsed.value.id,
      bindings: bindings.value,
      hasEvent: isObject(sc.event ?? null),
      expect: asExpression(sc.expect ?? null),
      businessRuleReferences: parsed.value.brRefs
    });
    if (!constructed.ok)
      return err(JSON.stringify(constructed.error));
    scenarios.push(constructed.value);
  }
  const background = [];
  for (const bg of Array.isArray(rawUnit.background) ? rawUnit.background : []) {
    if (!isObject(bg) || typeof bg.id !== "string")
      continue;
    const id = DesignBackgroundIdentifier.parse(bg.id);
    if (!id.ok)
      return err(JSON.stringify(id.error));
    const constructed = DesignBackgroundDeclaration.parse({ id: id.value, assert: asExpression(bg.assert ?? null) });
    if (!constructed.ok)
      return err(JSON.stringify(constructed.error));
    background.push(constructed.value);
  }
  const unformalizedTargets = [];
  for (const uf of Array.isArray(rawUnit.unformalized) ? rawUnit.unformalized : []) {
    if (!isObject(uf))
      continue;
    for (const t of Array.isArray(uf.targets) ? uf.targets : []) {
      if (typeof t === "string")
        unformalizedTargets.push(t);
    }
  }
  const rules = rulesMarkdown === null ? ok(null) : parseBusinessRuleReferenceIndex(rulesMarkdown);
  if (!rules.ok)
    return err(JSON.stringify(rules.error));
  const targets = traverseResult(unformalizedTargets, TargetIdentifier.parse);
  if (!targets.ok)
    return err(JSON.stringify(targets.error));
  const declarations = combineResults({
    obligations: DesignObligationDeclarations.parse(obligations),
    stateMachines: DesignMachineDeclarations.parse(stateMachines),
    scenarios: DesignScenarioDeclarations.parse(scenarios),
    background: DesignBackgroundDeclarations.parse(background),
    unformalizedTargets: UnformalizedTargets.parse(targets.value)
  });
  if (!declarations.ok)
    return err(JSON.stringify(declarations.error));
  return ok(DesignUnitDeclaration.of({
    unit: unit.value,
    entities: entities.value,
    ...declarations.value,
    directoryExists,
    rules: rules.value
  }));
}

class DesignIntermediateRepresentationValidationMaterialsRepositoryImplementation {
  #schemaPath;
  constructor(config) {
    this.#schemaPath = config.schemaPath;
  }
  findById(id) {
    const outputPath = id.modelId().artifactPath().asString();
    if (basename2(outputPath) !== DESIGN_MODEL_BASENAME) {
      return err({ kind: "not-found", path: outputPath });
    }
    const corrupt = (cause) => err({ kind: "corrupt", path: outputPath, cause });
    const read = readArtifactBytes(outputPath);
    if (!read.ok)
      return err(read.error);
    const bytes = read.value;
    const md = Buffer.from(bytes).toString("utf-8");
    const fences = extractFences(md, "json");
    if (fences.length !== 1) {
      return corrupt("formal model must contain exactly one ```json fence");
    }
    let ir;
    try {
      ir = JSON.parse(fences[0]?.body ?? "");
    } catch (err2) {
      return corrupt(`design IR fence is not valid JSON: ${err2 instanceof Error ? err2.message : String(err2)}`);
    }
    if (!isObject(ir)) {
      return corrupt("design IR fence must contain a JSON object");
    }
    const schemaStat = readArtifactStat(this.#schemaPath);
    if (!schemaStat.ok) {
      return corrupt(schemaStat.error.kind === "not-found" ? `design IR schema not installed at ${this.#schemaPath} \u2014 run plugin sync` : `design IR schema unreadable: ${schemaStat.error.cause}`);
    }
    const schema = readContractSchema(this.#schemaPath);
    if (!schema.ok) {
      return corrupt(`design IR schema unreadable: ${schema.error.cause}`);
    }
    const schemaErrors2 = [];
    validateSchema(schema.value, schema.value, ir, "", schemaErrors2);
    const messages = flatMapResult(traverseResult(schemaErrors2, ErrorMessage.parse), ErrorMessages.parse);
    if (!messages.ok)
      return corrupt(JSON.stringify(messages.error));
    const irVersion = IntermediateRepresentationVersion.parse(typeof ir.irVersion === "string" ? ir.irVersion : "");
    if (!irVersion.ok)
      return corrupt(JSON.stringify(irVersion.error));
    const major = irVersion.value.majorVersion();
    const semanticGateOpen = schemaErrors2.length === 0 && !(Number.isInteger(major) && major !== SUPPORTED_DESIGN_IR_MAJOR);
    const units = [];
    if (semanticGateOpen) {
      const foundRecordRoot = findRecordRoot(dirname3(outputPath));
      if (!foundRecordRoot.ok)
        return err(foundRecordRoot.error);
      const recordRoot = foundRecordRoot.value;
      for (const rawUnit of Array.isArray(ir.units) ? ir.units : []) {
        if (!isObject(rawUnit) || typeof rawUnit.unit !== "string")
          continue;
        const unitMaterials = this.#readUnitMaterials(recordRoot, rawUnit.unit);
        if (!unitMaterials.ok)
          return err(unitMaterials.error);
        const parsed = buildUnitView(rawUnit, rawUnit.unit, unitMaterials.value.directoryExists, unitMaterials.value.rulesMarkdown);
        if (!parsed.ok)
          return corrupt(parsed.error);
        units.push(parsed.value);
      }
    }
    const declarations = DesignUnitDeclarations.parse(units);
    if (!declarations.ok)
      return corrupt(JSON.stringify(declarations.error));
    return ok(DesignIntermediateRepresentationValidationMaterials.of({
      id,
      irVersion: irVersion.value,
      schemaErrors: messages.value,
      units: declarations.value,
      sourceDocument: bytes
    }));
  }
  #readUnitMaterials(recordRoot, unitName) {
    if (recordRoot === null)
      return ok({ directoryExists: true, rulesMarkdown: null });
    const unitDirectory = join4(recordRoot, "construction", unitName);
    const directory = readArtifactStat(unitDirectory);
    if (!directory.ok && directory.error.kind !== "not-found")
      return err(directory.error);
    const directoryExists = directory.ok && directory.value.isDirectory();
    if (!directoryExists)
      return ok({ directoryExists, rulesMarkdown: null });
    const rules = readArtifactText(join4(unitDirectory, "functional-design", "rules.md"));
    if (!rules.ok && rules.error.kind !== "not-found")
      return err(rules.error);
    return ok({
      directoryExists,
      rulesMarkdown: rules.ok ? rules.value : null
    });
  }
  store(materials) {
    const outputPath = materials.id().modelId().artifactPath().asString();
    const bytes = materials.sourceDocument();
    try {
      writeFileAtomically(outputPath, bytes);
      return ok(undefined);
    } catch (e) {
      return err({
        kind: "io-failed",
        operation: "write",
        path: outputPath,
        cause: e instanceof Error ? e.message : String(e)
      });
    }
  }
}
// src/design/adapter/design-report-serializer.ts
function renderDesignReportBytes(report) {
  return `${JSON.stringify(report.toDocument(), null, 2)}
`;
}
function parseSiblingDesignReportDocument(directory, fileName, raw) {
  const decoded = parseFindingsValues(raw);
  if (!decoded.ok)
    return decoded;
  const doc = decoded.value;
  if (`${doc.backend.asString()}.json` !== fileName)
    return err("backend must match the report filename");
  const findings = [];
  for (const entry of doc.findings) {
    if (entry.unit === undefined)
      return err("design finding requires a unit");
    const witness = DesignWitness.parse(entry.witness);
    if (!witness.ok)
      return err(JSON.stringify(witness.error));
    findings.push(DesignFinding.of({ ...entry, unit: entry.unit, witness: witness.value }));
  }
  const skipped = [];
  for (const entry of doc.skipped) {
    if (entry.unit === undefined)
      return err("design skip requires a unit");
    skipped.push(DesignSkipped.of({ ...entry, unit: entry.unit }));
  }
  const checked = doc.checked === undefined ? ok(undefined) : traverseResult(doc.checked, UnitName.parse);
  if (!checked.ok)
    return err(JSON.stringify(checked.error));
  const comparisons = doc.crossChecked === undefined ? ok(null) : traverseResult(doc.crossChecked, (entry) => {
    if (entry.unit === undefined)
      return err("design cross-check requires a unit");
    const parsed = DesignCrossCheckedEntry.parse({ ...entry, unit: entry.unit });
    return parsed.ok ? ok(parsed.value) : err(JSON.stringify(parsed.error));
  });
  if (!comparisons.ok)
    return comparisons;
  const collections = combineResults({
    findings: DesignFindings.parse(findings),
    skipped: DesignSkips.parse(skipped),
    inputs: doc.inputs === undefined ? ok(null) : DesignInputAnchors.parse(doc.inputs.map((entry) => DesignInputAnchor.of({ artifact: entry.artifact.asString(), sha256: entry.sha256 }))),
    checked: checked.value === undefined ? ok(null) : CheckedUnits.parse(checked.value),
    crossChecked: comparisons.value === null ? ok(null) : DesignCrossCheckedEntries.parse(comparisons.value)
  });
  if (!collections.ok)
    return err(JSON.stringify(collections.error));
  return ok(DesignReport.of({
    id: DesignReportIdentifier.of(directory, doc.backend.asString()),
    irVersion: doc.irVersion,
    irHash: doc.irHash,
    method: doc.method,
    ...collections.value,
    unavailableReason: doc.unavailable?.reason ?? null
  }));
}
// src/design/adapter/design-verify-directory-repository-implementation.ts
import { mkdirSync as mkdirSync3, renameSync as renameSync3, rmSync as rmSync3 } from "fs";
import { join as join5 } from "path";
var CROSS_CHECK_BASENAME = "cross-check.json";
var STALE_CROSS_CHECK_BASENAME = ".cross-check.stale";
var encoder = new TextEncoder;
var UNPROBED_LIVENESS = {
  self: () => 0,
  statusOf: () => "unknown"
};
function causeOf2(e) {
  return e instanceof Error ? e.message : String(e);
}
function lockCauseOf(outcome) {
  return "cause" in outcome ? `${outcome.kind}: ${outcome.cause}` : outcome.kind;
}
function crossCheckFailure(error) {
  const detail = "cause" in error ? `${error.kind}: ${error.cause}` : error.kind;
  const parsed = ErrorMessage.parse(`cross-check could not be loaded (${detail})`);
  return parsed.ok ? parsed.value : ErrorMessage.of("cross-check could not be loaded");
}
function documentsByFileName(reports) {
  const out = new Map;
  for (const report of reports)
    out.set(report.id().fileName(), JSON.stringify(report.toDocument()));
  return out;
}

class DesignVerifyDirectoryRepositoryImplementation {
  #lock;
  constructor(lock = new DirectoryFinalizationLock(new SystemClock, UNPROBED_LIVENESS)) {
    this.#lock = lock;
  }
  findByDirectory(directory) {
    const siblings = this.#siblingsOf(directory);
    if (!siblings.ok)
      return err(siblings.error);
    const reports = DesignReports.parse(siblings.value);
    if (!reports.ok)
      return err({ kind: "corrupt", path: directory.asString(), cause: JSON.stringify(reports.error) });
    const crossPath = join5(directory.asString(), CROSS_CHECK_BASENAME);
    const crossText = readArtifactText(crossPath);
    if (!crossText.ok && crossText.error.kind === "not-found") {
      return ok(DesignVerifyDirectory.of(directory, reports.value, null));
    }
    if (!crossText.ok)
      return ok(DesignVerifyDirectory.unreadableCrossCheck(directory, reports.value, crossCheckFailure(crossText.error)));
    const crossCheck = this.#parseReport(directory, CROSS_CHECK_BASENAME, crossText.value);
    if (!crossCheck.ok)
      return ok(DesignVerifyDirectory.unreadableCrossCheck(directory, reports.value, crossCheckFailure(crossCheck.error)));
    return ok(DesignVerifyDirectory.of(directory, reports.value, crossCheck.value));
  }
  store(aggregate) {
    const directory = aggregate.directory();
    const directoryPath = directory.asString();
    const candidate = aggregate.publishedReport();
    try {
      mkdirSync3(directoryPath, { recursive: true });
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path: directoryPath, cause: causeOf2(e) });
    }
    const lockPath = this.#lock.canonicalPathOf(directory);
    const acquired = this.#lock.acquire(directory);
    if (acquired.kind !== "acquired" && acquired.kind !== "recovered") {
      return err({ kind: "io-failed", operation: "write", path: lockPath, cause: lockCauseOf(acquired) });
    }
    let outcome;
    let released;
    try {
      outcome = this.#publish(aggregate, candidate, directory);
    } finally {
      released = this.#lock.release(directory);
    }
    if (released.kind !== "released" && outcome.ok) {
      return err({ kind: "io-failed", operation: "write", path: lockPath, cause: lockCauseOf(released) });
    }
    return outcome;
  }
  #publish(aggregate, candidate, directory) {
    const directoryPath = directory.asString();
    const backendPath = join5(directoryPath, candidate.id().fileName());
    const crossPath = join5(directoryPath, CROSS_CHECK_BASENAME);
    const stalePath = join5(directoryPath, STALE_CROSS_CHECK_BASENAME);
    const unchanged = this.#siblingsUnchanged(aggregate, candidate, directory);
    if (!unchanged.ok)
      return err(unchanged.error);
    const crossCheck = aggregate.crossCheck();
    if (!crossCheck.ok)
      return err({ kind: "corrupt", path: crossPath, cause: crossCheck.error.asString() });
    const backendBytes = renderDesignReportBytes(candidate);
    const crossBytes = crossCheck.value === null ? null : renderDesignReportBytes(crossCheck.value);
    if (!this.#lock.holdsOwnership(directory))
      return this.#fenced(directory, crossPath);
    const crossStat = readArtifactStat(crossPath);
    if (!crossStat.ok && crossStat.error.kind === "io-failed")
      return err({ kind: "io-failed", operation: "write", path: crossPath, cause: crossStat.error.cause });
    if (crossStat.ok) {
      try {
        renameSync3(crossPath, stalePath);
      } catch (e) {
        return err({ kind: "io-failed", operation: "write", path: crossPath, cause: causeOf2(e) });
      }
    }
    if (!this.#lock.holdsOwnership(directory))
      return this.#fenced(directory, backendPath);
    try {
      writeFileAtomically(backendPath, encoder.encode(backendBytes));
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path: backendPath, cause: causeOf2(e) });
    }
    if (crossBytes !== null) {
      if (!this.#lock.holdsOwnership(directory))
        return this.#fenced(directory, crossPath);
      try {
        writeFileAtomically(crossPath, encoder.encode(crossBytes));
      } catch (e) {
        return err({ kind: "io-failed", operation: "write", path: crossPath, cause: causeOf2(e) });
      }
    }
    try {
      rmSync3(stalePath, { force: true });
    } catch {}
    return ok(undefined);
  }
  #siblingsUnchanged(aggregate, candidate, directory) {
    const observed = this.#siblingsOf(directory);
    if (!observed.ok)
      return err(observed.error);
    const candidateFileName = candidate.id().fileName();
    const onDisk = documentsByFileName(observed.value.filter((r) => r.id().fileName() !== candidateFileName));
    const loaded = documentsByFileName(aggregate.reports().toArray().filter((r) => r.id().fileName() !== candidateFileName));
    let same = onDisk.size === loaded.size;
    if (same) {
      for (const [fileName, document] of loaded) {
        if (onDisk.get(fileName) !== document) {
          same = false;
          break;
        }
      }
    }
    if (same)
      return ok(undefined);
    return err({
      kind: "io-failed",
      operation: "write",
      path: directory.asString(),
      cause: "conflict: sibling set changed since load"
    });
  }
  #siblingsOf(directory) {
    const directoryRead = readDirectory(directory.asString());
    if (!directoryRead.ok && directoryRead.error.kind === "not-found")
      return ok([]);
    if (!directoryRead.ok)
      return err(directoryRead.error);
    const entries = directoryRead.value.map((entry) => entry.name).filter((f) => f.endsWith(".json") && f !== CROSS_CHECK_BASENAME).sort();
    const reports = [];
    for (const file of entries) {
      const report = this.#readReport(directory, file);
      if (!report.ok)
        return err(report.error);
      reports.push(report.value);
    }
    return ok(reports);
  }
  #readReport(directory, fileName) {
    const path = join5(directory.asString(), fileName);
    const read = readArtifactText(path);
    if (!read.ok) {
      return read.error.kind === "not-found" ? err({ kind: "io-failed", operation: "read", path, cause: "artifact disappeared during read" }) : err(read.error);
    }
    return this.#parseReport(directory, fileName, read.value);
  }
  #parseReport(directory, fileName, text) {
    const path = join5(directory.asString(), fileName);
    let raw;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      return err({ kind: "corrupt", path, cause: causeOf2(e) });
    }
    const parsed = parseSiblingDesignReportDocument(directory, fileName, raw);
    return parsed.ok ? ok(parsed.value) : err({ kind: "corrupt", path, cause: parsed.error });
  }
  #fenced(directory, path) {
    return err({
      kind: "io-failed",
      operation: "write",
      path,
      cause: `lock-fenced: ${this.#lock.canonicalPathOf(directory)} is no longer held by this writer`
    });
  }
}
// src/design/adapter/lowered-document-serializer.ts
function renderLoweredDocument(u, low) {
  const obligations = low.obligations().toArray().map((ob) => {
    const out = {
      id: ob.id().asString(),
      nature: ob.nature(),
      frRefs: ob.functionalRequirementReferences().toStrings()
    };
    const assertion = ob.assertion();
    if (assertion)
      out.assert = assertion;
    const trigger = ob.trigger();
    if (trigger !== undefined)
      out.trigger = trigger;
    const guard = ob.guard();
    if (guard)
      out.guard = guard;
    const effect = ob.effect();
    if (effect)
      out.effect = effect;
    const temporal = ob.temporal();
    if (temporal)
      out.temporal = temporal;
    return out;
  });
  const scenarios = low.scenarios().toArray().map((sc) => {
    const out = {
      id: sc.id().asString(),
      kind: sc.kind(),
      frRefs: sc.functionalRequirementReferences().toStrings(),
      bindings: sc.bindings().toDocument()
    };
    const event = sc.event();
    if (event)
      out.event = event;
    const expectation = sc.expectedExpression();
    if (expectation)
      out.expect = expectation;
    return out;
  });
  const background = low.background().toArray().map((bg) => ({ id: bg.id().asString(), assert: bg.assertion() }));
  return {
    irVersion: "1.0.0",
    schema: { entities: renderDesignEntities(u.entities()) },
    obligations,
    scenarios,
    background
  };
}
// src/design/adapter/reachability-variant.ts
function reachabilityVariant(base, attrPath, state) {
  if (!isObject(base))
    return base;
  const obligations = Array.isArray(base.obligations) ? base.obligations : [];
  const events = obligations.filter((ob) => isObject(ob) && ob.nature === "event");
  const probe = {
    id: "OB-9999",
    nature: "invariant",
    frRefs: [],
    assert: {
      op: "ne",
      args: [
        { op: "ref", path: attrPath },
        { op: "enum", value: state }
      ]
    }
  };
  return {
    irVersion: base.irVersion ?? "1.0.0",
    schema: base.schema ?? { entities: [] },
    obligations: [...events, probe],
    scenarios: [],
    background: Array.isArray(base.background) ? base.background : []
  };
}
// src/design/adapter/refinement-materials-repository-implementation.ts
import { dirname as dirname4, join as join6 } from "path";
var REFINEMENT_MAP_BASENAME = "deep-spec-analysis-refinement-map.md";
var REQUIREMENTS_MODEL_RELPATH = [
  "inception",
  "deep-spec-analysis-verify",
  "deep-spec-analysis-formal-model.md"
];
function extractSingleJsonFence(md) {
  const fences = extractFences(md, "json");
  return fences.length === 1 ? fences[0]?.body ?? null : null;
}

class RefinementMaterialsRepositoryImplementation {
  #mapSchemaPath;
  constructor(mapSchemaPath) {
    this.#mapSchemaPath = mapSchemaPath;
  }
  findById(id) {
    const modelPath = id.modelArtifactPath().asString();
    const foundRecordRoot = findRecordRoot(dirname4(modelPath));
    if (!foundRecordRoot.ok)
      return err(foundRecordRoot.error);
    const recordRoot = foundRecordRoot.value;
    if (recordRoot === null)
      return ok(RefinementMaterials.inactive(id));
    const requirements = this.#loadRequirements(recordRoot);
    if (!requirements.ok) {
      return requirements.error.kind === "not-found" ? ok(RefinementMaterials.inactive(id)) : err(requirements.error);
    }
    const map = this.#loadMap(recordRoot, dirname4(modelPath), modelPath, requirements.value.bytes);
    if (!map.ok)
      return err(map.error);
    return ok(RefinementMaterials.active(id, requirements.value.model, map.value));
  }
  #read(path) {
    return readArtifactBytes(path);
  }
  #loadRequirements(recordRoot) {
    const path = join6(recordRoot, ...REQUIREMENTS_MODEL_RELPATH);
    const bytes = this.#read(path);
    if (!bytes.ok)
      return err(bytes.error);
    const fence = extractSingleJsonFence(Buffer.from(bytes.value).toString("utf-8"));
    if (fence === null)
      return err({ kind: "corrupt", path, cause: "requirements model must contain exactly one JSON fence" });
    let raw;
    try {
      raw = JSON.parse(fence);
    } catch (e) {
      return err({ kind: "corrupt", path, cause: e instanceof Error ? e.message : String(e) });
    }
    if (!isObject(raw) || typeof raw.irVersion !== "string" || !isObject(raw.schema) || !Array.isArray(raw.schema.entities) || !Array.isArray(raw.obligations) || !Array.isArray(raw.scenarios)) {
      return err({
        kind: "corrupt",
        path,
        cause: "requirements model lacks its version, schema, obligations or scenarios"
      });
    }
    const attributes = [];
    const schema = isObject(raw.schema) ? raw.schema : {};
    for (const ent of Array.isArray(schema.entities) ? schema.entities : []) {
      if (!isObject(ent) || typeof ent.name !== "string")
        continue;
      for (const attr of Array.isArray(ent.attributes) ? ent.attributes : []) {
        if (!isObject(attr) || typeof attr.name !== "string" || !isObject(attr.type))
          continue;
        const t = attr.type;
        if (t.kind !== "bool" && t.kind !== "int" && t.kind !== "enum")
          continue;
        const parsed = combineResults({
          path: AttributePath.parse(`${ent.name}.${attr.name}`),
          values: Array.isArray(t.values) ? flatMapResult(traverseResult(strArr(t.values), EnumerationMember.parse), EnumerationMembers.parse) : ok(undefined)
        });
        if (!parsed.ok)
          return err({ kind: "corrupt", path, cause: JSON.stringify(parsed.error) });
        attributes.push(RefinementAttribute.of({
          path: parsed.value.path,
          kind: t.kind,
          values: parsed.value.values === undefined ? undefined : parsed.value.values
        }));
      }
    }
    const obligations = [];
    for (const ob of Array.isArray(raw.obligations) ? raw.obligations : []) {
      if (!isObject(ob) || typeof ob.id !== "string" || typeof ob.nature !== "string")
        continue;
      const parsed = combineResults({
        id: ObligationIdentifier.parse(ob.id),
        nature: ObligationNature.parse(ob.nature),
        frRefs: flatMapResult(traverseResult(strArr(ob.frRefs), RequirementIdentifier.parse), FunctionalRequirementReferences.parse),
        trigger: typeof ob.trigger === "string" ? TriggerName.parse(ob.trigger) : ok(undefined)
      });
      if (!parsed.ok)
        return err({ kind: "corrupt", path, cause: JSON.stringify(parsed.error) });
      const constructed = RefinementObligation.parse({
        id: parsed.value.id,
        nature: parsed.value.nature,
        functionalRequirementReferences: parsed.value.frRefs,
        assert: isObject(ob.assert) ? ob.assert : undefined,
        trigger: parsed.value.trigger,
        guard: isObject(ob.guard) ? ob.guard : undefined,
        effect: isObject(ob.effect) ? ob.effect : undefined
      });
      if (!constructed.ok)
        return err({ kind: "corrupt", path, cause: JSON.stringify(constructed.error) });
      obligations.push(constructed.value);
    }
    const scenarios = [];
    for (const sc of Array.isArray(raw.scenarios) ? raw.scenarios : []) {
      if (!isObject(sc) || typeof sc.id !== "string" || !isObject(sc.bindings))
        continue;
      if (sc.kind !== "accept" && sc.kind !== "reject")
        continue;
      const parsed = combineResults({
        id: ScenarioIdentifier.parse(sc.id),
        expectation: ScenarioExpectation.parse(sc.kind),
        bindings: decodeScenarioBindings(sc.bindings),
        frRefs: flatMapResult(traverseResult(strArr(sc.frRefs), RequirementIdentifier.parse), FunctionalRequirementReferences.parse),
        trigger: isObject(sc.event) && typeof sc.event.trigger === "string" ? TriggerName.parse(sc.event.trigger) : ok(undefined)
      });
      if (!parsed.ok)
        return err({ kind: "corrupt", path, cause: JSON.stringify(parsed.error) });
      scenarios.push(RefinementScenario.of({
        id: parsed.value.id,
        expectation: parsed.value.expectation,
        functionalRequirementReferences: parsed.value.frRefs,
        bindings: parsed.value.bindings,
        event: parsed.value.trigger === undefined ? undefined : { trigger: parsed.value.trigger }
      }));
    }
    const collections = combineResults({
      attributes: RefinementAttributes.parse(attributes),
      obligations: RefinementObligations.parse(obligations),
      scenarios: RefinementScenarios.parse(scenarios)
    });
    if (!collections.ok)
      return err({ kind: "corrupt", path, cause: JSON.stringify(collections.error) });
    const model = RefinementRequirements.of({
      id: FormalModelIdentifier.of(ArtifactPath.of(path)),
      hash: ContentHash.ofText(canonicalStringify(raw)),
      ...collections.value
    });
    return ok({ model, bytes: bytes.value });
  }
  #loadMap(recordRoot, stageDir, modelPath, requirementsBytes) {
    const path = join6(stageDir, REFINEMENT_MAP_BASENAME);
    const bytes = this.#read(path);
    if (!bytes.ok) {
      return bytes.error.kind === "not-found" ? ok(RefinementMapAcquisition.absent(null)) : err(bytes.error);
    }
    const parsed = parseRefinementMapDocument(bytes.value, RefinementMapIdentifier.of(ArtifactPath.of(path)), this.#mapSchemaPath);
    if (parsed.kind === "malformed")
      return ok(RefinementMapAcquisition.absent(parsed.error));
    const modelBytes = this.#read(modelPath);
    if (!modelBytes.ok)
      return err(modelBytes.error);
    const reqModelPath = join6(recordRoot, ...REQUIREMENTS_MODEL_RELPATH);
    const mapArtifact = relArtifact(recordRoot, path);
    const inputs = [
      DesignInputAnchor.of({
        artifact: relArtifact(recordRoot, modelPath),
        sha256: ContentHash.ofText(Buffer.from(modelBytes.value).toString("utf-8"))
      }),
      DesignInputAnchor.of({
        artifact: mapArtifact,
        sha256: ContentHash.ofText(Buffer.from(bytes.value).toString("utf-8"))
      }),
      DesignInputAnchor.of({
        artifact: relArtifact(recordRoot, reqModelPath),
        sha256: ContentHash.ofText(Buffer.from(requirementsBytes).toString("utf-8"))
      })
    ];
    return ok(RefinementMapAcquisition.loaded(parsed.map, ArtifactPath.of(mapArtifact), DesignInputAnchors.of(inputs)));
  }
}
function parseRefinementMapDocument(bytes, id, mapSchemaPath) {
  const md = Buffer.from(bytes).toString("utf-8");
  const fence = extractSingleJsonFence(md);
  if (fence === null)
    return { kind: "malformed", error: "refinement map does not contain exactly one ```json fence" };
  let raw;
  try {
    raw = JSON.parse(fence);
  } catch (err2) {
    return {
      kind: "malformed",
      error: `refinement map fence is not valid JSON: ${err2 instanceof Error ? err2.message : String(err2)}`
    };
  }
  const schemaText = readArtifactText(mapSchemaPath);
  if (!schemaText.ok) {
    return {
      kind: "malformed",
      error: `refinement map schema unreadable: ${schemaText.error.kind === "not-found" ? mapSchemaPath : schemaText.error.cause}`
    };
  }
  try {
    const schemaDoc = JSON.parse(schemaText.value);
    const errors = [];
    validateSchema(schemaDoc, schemaDoc, raw, "", errors);
    if (errors.length > 0)
      return { kind: "malformed", error: `refinement map does not conform to contract 4: ${errors[0]}` };
  } catch (err2) {
    return {
      kind: "malformed",
      error: `refinement map schema unreadable: ${err2 instanceof Error ? err2.message : String(err2)}`
    };
  }
  const doc = raw;
  const units = [];
  for (const u of Array.isArray(doc.units) ? doc.units : []) {
    if (!isObject(u) || typeof u.unit !== "string")
      continue;
    const attrMap = [];
    for (const m of Array.isArray(u.attrMap) ? u.attrMap : []) {
      if (!isObject(m) || typeof m.req !== "string")
        continue;
      const req = AttributePath.parse(m.req);
      if (!req.ok)
        return { kind: "malformed", error: JSON.stringify(req.error) };
      let mapping;
      if (isObject(m.enumMap) && typeof m.enumMap.from === "string" && isObject(m.enumMap.cases)) {
        const from = AttributePath.parse(m.enumMap.from);
        if (!from.ok)
          return { kind: "malformed", error: JSON.stringify(from.error) };
        mapping = AttributeMapping.parse(req.value, {
          kind: "enum-cases",
          from: from.value,
          cases: m.enumMap.cases
        });
      } else if (isObject(m.expr)) {
        mapping = AttributeMapping.parse(req.value, { kind: "expression", expr: m.expr });
      } else {
        mapping = AttributeMapping.parse(req.value, { kind: "unspecified" });
      }
      if (!mapping.ok)
        return { kind: "malformed", error: JSON.stringify(mapping.error) };
      attrMap.push(mapping.value);
    }
    const eventMap = [];
    for (const e of Array.isArray(u.eventMap) ? u.eventMap : []) {
      if (!isObject(e) || typeof e.reqTrigger !== "string")
        continue;
      const parsed = combineResults({
        reqTrigger: TriggerName.parse(e.reqTrigger),
        transitions: flatMapResult(traverseResult(strArr(e.transitions), TransitionReference.parse), TransitionReferences.parse)
      });
      if (!parsed.ok)
        return { kind: "malformed", error: JSON.stringify(parsed.error) };
      eventMap.push(EventMapping.of({
        reqTrigger: parsed.value.reqTrigger,
        transitions: parsed.value.transitions,
        waived: isObject(e.waived) && typeof e.waived.reason === "string" ? { reason: e.waived.reason } : undefined
      }));
    }
    const unmapped = [];
    for (const un of Array.isArray(u.unmapped) ? u.unmapped : []) {
      if (isObject(un) && typeof un.target === "string") {
        const target = UnmappedTargetReference.parse(un.target);
        if (!target.ok)
          return { kind: "malformed", error: JSON.stringify(target.error) };
        unmapped.push(UnmappedTarget.of({ target: target.value, reason: typeof un.reason === "string" ? un.reason : "" }));
      }
    }
    const unit = DesignUnitIdentifier.parse(u.unit);
    if (!unit.ok)
      return { kind: "malformed", error: JSON.stringify(unit.error) };
    const collections = combineResults({
      attrMap: AttributeMappings.parse(attrMap),
      eventMap: EventMappings.parse(eventMap),
      unmapped: UnmappedDeclarations.parse(unmapped)
    });
    if (!collections.ok)
      return { kind: "malformed", error: JSON.stringify(collections.error) };
    units.push(RefinementUnitMap.of({
      unit: unit.value,
      ...collections.value
    }));
  }
  const hashes = combineResults({
    requirements: ContentHash.parse(typeof doc.requirementsIrHash === "string" ? doc.requirementsIrHash : ""),
    design: ContentHash.parse(typeof doc.designIrHash === "string" ? doc.designIrHash : "")
  });
  if (!hashes.ok)
    return { kind: "malformed", error: JSON.stringify(hashes.error) };
  const unitMaps = RefinementUnitMaps.parse(units);
  if (!unitMaps.ok)
    return { kind: "malformed", error: JSON.stringify(unitMaps.error) };
  return {
    kind: "parsed",
    map: RefinementMap.of({
      id,
      requirementsIrHash: hashes.value.requirements,
      designIrHash: hashes.value.design,
      units: unitMaps.value,
      sourceDocument: bytes
    })
  };
}

// src/design/adapter/refinement-map-repository-implementation.ts
class RefinementMapRepositoryImplementation {
  #mapSchemaPath;
  constructor(mapSchemaPath) {
    this.#mapSchemaPath = mapSchemaPath;
  }
  findById(id) {
    const path = id.artifactPath().asString();
    const read = readArtifactBytes(path);
    if (!read.ok)
      return err(read.error);
    const parsed = parseRefinementMapDocument(read.value, id, this.#mapSchemaPath);
    if (parsed.kind === "malformed")
      return err({ kind: "corrupt", path, cause: parsed.error });
    return ok(parsed.map);
  }
  store(map) {
    const path = map.id().artifactPath().asString();
    const bytes = map.sourceDocument();
    try {
      writeFileAtomically(path, bytes);
      return ok(undefined);
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path, cause: e instanceof Error ? e.message : String(e) });
    }
  }
}
// src/design/adapter/refinement-query-plan.ts
class SatisfiabilityModuloTheoriesCompileError extends Error {
}
function refinementSmtContext(u) {
  const attrs = [];
  for (const ent of u.entities()) {
    for (const attr of ent.attributes()) {
      const kind = attr.kindLabel();
      if (kind !== "bool" && kind !== "int" && kind !== "enum")
        continue;
      const min = attr.minBound();
      const max = attr.maxBound();
      const values = attr.enumStates();
      attrs.push({
        path: `${ent.name().asString()}.${attr.name().asString()}`,
        kind,
        ...min !== undefined ? { min: min.asNumber() } : {},
        ...max !== undefined ? { max: max.asNumber() } : {},
        ...values !== null ? { values: values.toArray().map((member) => member.asString()) } : {}
      });
    }
  }
  return { attrs, byPath: new Map(attrs.map((a) => [a.path, a])) };
}
function enumCode(ctx, attrPath, value) {
  const attr = ctx.byPath.get(attrPath);
  if (attr?.kind !== "enum" || !attr.values)
    throw new SatisfiabilityModuloTheoriesCompileError(`"${attrPath}" is not an enum attribute`);
  const idx = attr.values.indexOf(value);
  if (idx < 0)
    throw new SatisfiabilityModuloTheoriesCompileError(`enum value "${value}" is not declared on "${attrPath}"`);
  return idx;
}
function smtOfExpr(ctx, e) {
  const bin = (op) => {
    const [a, b] = e.args ?? [];
    if (!a || !b)
      throw new SatisfiabilityModuloTheoriesCompileError(`operator "${e.op}" needs two arguments`);
    const refArg = a.op === "ref" ? a : b.op === "ref" ? b : null;
    const enumArg = a.op === "enum" ? a : b.op === "enum" ? b : null;
    if (enumArg && refArg && typeof refArg.path === "string" && typeof enumArg.value === "string") {
      const code = String(enumCode(ctx, refArg.path, enumArg.value));
      const left = a === enumArg ? code : smtOfExpr(ctx, a);
      const right = b === enumArg ? code : smtOfExpr(ctx, b);
      return `(${op} ${left} ${right})`;
    }
    if (enumArg)
      throw new SatisfiabilityModuloTheoriesCompileError("enum literal without a ref sibling has no resolvable encoding");
    return `(${op} ${smtOfExpr(ctx, a)} ${smtOfExpr(ctx, b)})`;
  };
  switch (e.op) {
    case "and":
    case "or":
      return `(${e.op} ${(e.args ?? []).map((a) => smtOfExpr(ctx, a)).join(" ")})`;
    case "not":
      return `(not ${smtOfExpr(ctx, (e.args ?? [])[0])})`;
    case "implies":
      return bin("=>");
    case "iff":
    case "eq":
      return bin("=");
    case "ne":
      return `(not ${bin("=")})`;
    case "lt":
      return bin("<");
    case "le":
      return bin("<=");
    case "gt":
      return bin(">");
    case "ge":
      return bin(">=");
    case "add":
      return bin("+");
    case "sub":
      return bin("-");
    case "mul":
      return bin("*");
    case "ref": {
      if (typeof e.path !== "string" || !ctx.byPath.has(e.path))
        throw new SatisfiabilityModuloTheoriesCompileError(`unresolvable reference "${e.path ?? ""}"`);
      return smtVar(e.path, e.prime === true);
    }
    case "bool":
      return e.value === true ? "true" : "false";
    case "int": {
      const n = typeof e.value === "number" ? e.value : Number.NaN;
      if (!Number.isInteger(n))
        throw new SatisfiabilityModuloTheoriesCompileError("int literal is not an integer");
      return smtLit(n);
    }
    default:
      throw new SatisfiabilityModuloTheoriesCompileError(`unknown operator "${e.op}"`);
  }
}
function designBase(ctx, u, primed) {
  const decls = [];
  const constraints = [];
  for (const attr of ctx.attrs) {
    const sort = attr.kind === "bool" ? "Bool" : "Int";
    decls.push(`(declare-const ${smtVar(attr.path, primed)} ${sort})`);
    const v = smtVar(attr.path, primed);
    if (attr.kind === "enum" && attr.values) {
      constraints.push({
        name: `${primed ? "typ" : "ty"}_${attr.path.replace(/\./g, "_")}`,
        smt: `(and (>= ${v} 0) (<= ${v} ${attr.values.length - 1}))`
      });
    } else if (attr.kind === "int" && (attr.min !== undefined || attr.max !== undefined)) {
      const parts = [];
      if (attr.min !== undefined)
        parts.push(`(>= ${v} ${smtLit(attr.min)})`);
      if (attr.max !== undefined)
        parts.push(`(<= ${v} ${smtLit(attr.max)})`);
      constraints.push({
        name: `${primed ? "typ" : "ty"}_${attr.path.replace(/\./g, "_")}`,
        smt: parts.length === 1 ? parts[0] : `(and ${parts.join(" ")})`
      });
    }
  }
  if (!primed) {
    for (const bg of u.background()) {
      try {
        constraints.push({ name: smtName("bg", bg.id().asString()), smt: smtOfExpr(ctx, bg.assertion()) });
      } catch (error) {
        if (!(error instanceof SatisfiabilityModuloTheoriesCompileError))
          throw error;
      }
    }
    for (const ob of u.obligations()) {
      const assertion = ob.assertion();
      if (ob.isInvariantLike() && assertion !== undefined) {
        try {
          constraints.push({ name: smtName("inv", ob.id().asString()), smt: smtOfExpr(ctx, assertion) });
        } catch (error) {
          if (!(error instanceof SatisfiabilityModuloTheoriesCompileError))
            throw error;
        }
      }
    }
  }
  return { decls, constraints };
}
function assembleQuery(id, decls, constraints, modelVars) {
  const script = [
    ...decls,
    ...constraints.flatMap((c) => [`(declare-const ${c.name} Bool)`, `(assert (=> ${c.name} ${c.smt}))`])
  ].join(`
`);
  return { id, script, assumptions: constraints.map((c) => c.name), model: modelVars };
}
function decodeDesignModel(ctx, model, primed) {
  const entries = [];
  for (const attr of [...ctx.attrs].sort((a, b) => a.path < b.path ? -1 : 1)) {
    const raw = model[smtVar(attr.path, primed)];
    if (raw === undefined)
      continue;
    if (attr.kind === "bool")
      entries.push([attr.path, raw === "true"]);
    else {
      const n = smtIntOf(raw);
      if (!Number.isSafeInteger(n)) {
        const m = raw.match(/^\(-\s*(\d+)\)$/);
        entries.push([attr.path, m ? `-${m[1]}` : raw]);
      } else if (attr.kind === "enum" && attr.values)
        entries.push([attr.path, attr.values[n] ?? n]);
      else
        entries.push([attr.path, n]);
    }
  }
  return Object.fromEntries(entries);
}
function buildRefinementQueries(plan) {
  const u = plan.unit();
  const req = plan.requirements();
  const ctx = refinementSmtContext(u);
  const pre = designBase(ctx, u, false);
  const post = designBase(ctx, u, true);
  const modelVars = ctx.attrs.map((a) => ({
    name: smtVar(a.path, false),
    sort: a.kind === "bool" ? "Bool" : "Int"
  }));
  const modelVarsBoth = [
    ...modelVars,
    ...ctx.attrs.map((a) => ({
      name: smtVar(a.path, true),
      sort: a.kind === "bool" ? "Bool" : "Int"
    }))
  ];
  const catalog = DesignEventRuleCatalog.parse(u);
  const queries = [];
  const pending = new Map;
  const compileSkips = [];
  const alphaFail = (target, message) => {
    compileSkips.push(DesignSkipped.of({
      target: TargetIdentifier.of(target),
      reason: SkipReason.compileError(),
      unit: UnitName.of(u.name()),
      detail: `alpha substitution failed: ${message}`
    }));
  };
  const failureMessage = (err2) => err2 instanceof Error ? err2.message : String(err2);
  const mappings = plan.attributeMappings();
  obligations:
    for (const [obId, st] of plan.sortedObligationStatuses()) {
      if (!st.isCheckable())
        continue;
      const ob = req.obligationById(obId);
      if (!ob)
        continue;
      const assertion = ob.assertion();
      if (ob.isInvariantLike() && assertion !== undefined) {
        const alphaP = mappings.substitute(assertion, false);
        if (!alphaP.ok) {
          alphaFail(obId, alphaP.error.message());
          continue;
        }
        try {
          const q = assembleQuery(`rv:${obId}`, pre.decls, [...pre.constraints, { name: smtName("neg", obId), smt: `(not ${smtOfExpr(ctx, alphaP.value)})` }], modelVars);
          queries.push(q);
          pending.set(q.id, RefinementProbe.invariant(ob, UnitName.of(u.name())));
        } catch (err2) {
          if (!(err2 instanceof SatisfiabilityModuloTheoriesCompileError))
            throw err2;
          alphaFail(obId, failureMessage(err2));
        }
        continue;
      }
      const event = ob.eventDefinition();
      if (event !== null) {
        const mapped = plan.mappedTransitionsOf(obId);
        if (!catalog.ok) {
          alphaFail(obId, `design event catalog could not be constructed: ${catalog.error.kind}`);
          continue;
        }
        const alphaG = mappings.substitute(event.guard, false);
        if (!alphaG.ok) {
          alphaFail(obId, alphaG.error.message());
          continue;
        }
        try {
          const designGuards = mapped.map((id) => catalog.value.eventOf(TargetIdentifier.of(id.asString()))).filter((d) => d !== null).map((d) => smtOfExpr(ctx, d.guard()));
          const notEnabled = designGuards.length === 0 ? "true" : `(not (or ${designGuards.join(" ")}))`;
          const qe = assembleQuery(`re:${obId}`, pre.decls, [
            ...pre.constraints,
            { name: smtName("ag", obId), smt: smtOfExpr(ctx, alphaG.value) },
            { name: smtName("ne", obId), smt: notEnabled }
          ], modelVars);
          queries.push(qe);
          pending.set(qe.id, RefinementProbe.enabledness(ob, UnitName.of(u.name()), TransitionReferences.of(plan.mappedTransitionsOf(obId))));
          const decomposed = EffectAssignments.fromEffect(ExpressionTree.of(event.effect));
          if (!decomposed.ok) {
            alphaFail(obId, decomposed.error.kind === "effect-not-assignment-conjunction" ? RefinementMapDefect.effectNotAssignmentConjunction().message() : JSON.stringify(decomposed.error));
            continue;
          }
          const assigned = decomposed.value;
          const frameParts = [];
          for (const a of req.attributes().sortedByPath()) {
            if (assigned.covers(a.path()))
              continue;
            const eq = mappings.equalityFor(a.path().asString());
            if (!eq.ok) {
              alphaFail(obId, eq.error.message());
              continue obligations;
            }
            if (eq.value !== null)
              frameParts.push(smtOfExpr(ctx, eq.value));
          }
          const alphaF = mappings.substitute(event.effect, false);
          if (!alphaF.ok) {
            alphaFail(obId, alphaF.error.message());
            continue;
          }
          const fBar = smtOfExpr(ctx, alphaF.value);
          const postCond = frameParts.length === 0 ? fBar : `(and ${fBar} ${frameParts.join(" ")})`;
          for (const designId of mapped) {
            const ev = catalog.value.eventOf(TargetIdentifier.of(designId.asString()));
            if (!ev)
              continue;
            const stepParts = [smtOfExpr(ctx, ev.guard())];
            for (const attr of ctx.attrs) {
              const rhs = ev.assignedRhsOf(attr.path);
              const target = smtVar(attr.path, true);
              if (rhs) {
                const rhsSmt = rhs.op === "enum" && typeof rhs.value === "string" ? String(enumCode(ctx, attr.path, rhs.value)) : smtOfExpr(ctx, rhs);
                stepParts.push(`(= ${target} ${rhsSmt})`);
              } else {
                stepParts.push(`(= ${target} ${smtVar(attr.path, false)})`);
              }
            }
            const qs = assembleQuery(`rs2:${obId}:${designId.asString()}`, [...pre.decls, ...post.decls], [
              ...pre.constraints,
              ...post.constraints,
              { name: smtName("step", designId.asString()), smt: `(and ${stepParts.join(" ")})` },
              { name: smtName("ag2", obId), smt: smtOfExpr(ctx, alphaG.value) },
              { name: smtName("viol", obId), smt: `(not ${postCond})` }
            ], modelVarsBoth);
            queries.push(qs);
            pending.set(qs.id, RefinementProbe.simulation(ob, UnitName.of(u.name()), designId));
          }
        } catch (err2) {
          if (!(err2 instanceof SatisfiabilityModuloTheoriesCompileError))
            throw err2;
          alphaFail(obId, failureMessage(err2));
        }
      }
    }
  for (const [scId, st] of plan.sortedScenarioStatuses()) {
    if (!st.isCheckable())
      continue;
    const sc = req.scenarioById(scId);
    if (!sc)
      continue;
    let defect = null;
    try {
      const parts = [];
      for (const binding of sc.bindings().entriesCanonically()) {
        const path = binding.path();
        const value = binding.value();
        const constraint = { op: "eq", args: [{ op: "ref", path: path.asString() }, value.asExpression()] };
        const bound = mappings.substitute(constraint, false);
        if (!bound.ok) {
          defect = bound.error;
          break;
        }
        parts.push(smtOfExpr(ctx, bound.value));
      }
      if (defect !== null) {
        alphaFail(scId, defect.message());
        continue;
      }
      const q = assembleQuery(`rs:${scId}`, pre.decls, [
        ...pre.constraints,
        { name: smtName("sc", scId), smt: parts.length === 1 ? parts[0] : `(and ${parts.join(" ")})` }
      ], modelVars);
      queries.push(q);
      pending.set(q.id, RefinementProbe.scenario(sc, UnitName.of(u.name())));
    } catch (err2) {
      if (!(err2 instanceof SatisfiabilityModuloTheoriesCompileError))
        throw err2;
      alphaFail(scId, failureMessage(err2));
    }
  }
  return {
    queries,
    plan: RefinementSolverPlan.of({
      preparation: plan,
      pending: KeyedIndex.of([...pending].map(([id, probe]) => [QueryLabel.of(id), probe])),
      compileSkips: DesignSkips.of(compileSkips)
    }),
    context: ctx
  };
}
// src/design/adapter/refinement-solver-client-implementation.ts
import { spawnSync } from "child_process";
class RefinementSolverClientImplementation {
  #config;
  constructor(config) {
    this.#config = config;
  }
  check(plan, budgetMs) {
    const built = buildRefinementQueries(plan);
    if (built.queries.length === 0) {
      return RefinementCheck.noQueries(built.plan);
    }
    const child = this.#runChild(built.queries, budgetMs);
    if (child.results === null) {
      const reason = ErrorMessage.parse(child.unavailable ?? "z3 unavailable");
      return RefinementCheck.unavailable(built.plan, reason.ok ? reason.value : ErrorMessage.of("z3 child reported an invalid unavailable reason"));
    }
    const verdicts = [];
    for (const [queryId, r] of child.results) {
      const label = QueryLabel.parse(queryId);
      if (!label.ok)
        return RefinementCheck.unavailable(built.plan, ErrorMessage.of(`invalid solver query label: ${JSON.stringify(label.error)}`));
      const verdict = RefinementQueryVerdict.parse({
        status: r.status,
        decodedModel: r.status === "sat" ? decodeDesignModel(built.context, r.model ?? {}, false) : undefined,
        decodedPostModel: r.status === "sat" ? decodeDesignModel(built.context, r.model ?? {}, true) : undefined,
        core: r.core
      });
      if (!verdict.ok)
        return RefinementCheck.unavailable(built.plan, ErrorMessage.of(`invalid solver verdict: ${JSON.stringify(verdict.error)}`));
      verdicts.push(RefinementQueryVerdictEntry.of(label.value, verdict.value));
    }
    const collected = RefinementQueryVerdicts.parse(verdicts);
    if (!collected.ok)
      return RefinementCheck.unavailable(built.plan, ErrorMessage.of(`invalid solver verdict collection: ${JSON.stringify(collected.error)}`));
    return RefinementCheck.solved(built.plan, collected.value);
  }
  #runChild(queries, budgetMs) {
    const payload = JSON.stringify({ queries, timeoutMs: this.#config.perQueryTimeoutMs, budgetMs });
    const runtimes = this.#config.runtimeOverride ? [this.#config.runtimeOverride] : ["node", "bun"];
    const attempts = [];
    for (const runtime of runtimes) {
      const res = spawnSync(runtime, [this.#config.childHostPath, "--smt-child"], {
        input: payload,
        encoding: "utf-8",
        timeout: budgetMs + 15000,
        cwd: this.#config.workingDirectory
      });
      if (res.error && res.error.code === "ENOENT") {
        attempts.push(`${runtime}: not on PATH`);
        continue;
      }
      if (res.error && res.error.code === "ETIMEDOUT") {
        attempts.push(`${runtime}: ${String(res.error)}`);
        break;
      }
      if (res.error || res.status !== 0) {
        attempts.push(`${runtime}: ${res.error ? String(res.error) : `exit ${res.status}`}`);
        continue;
      }
      let parsed;
      try {
        parsed = JSON.parse((res.stdout ?? "").trim().split(`
`).pop() ?? "");
      } catch {
        attempts.push(`${runtime}: solver child produced unreadable output`);
        continue;
      }
      if (isObject(parsed) && typeof parsed.unavailable === "string")
        return { results: null, unavailable: parsed.unavailable };
      const validated = parseSolverChildResults(parsed, queries.map((query) => query.id));
      if (!validated.ok) {
        attempts.push(`${runtime}: ${validated.error}`);
        continue;
      }
      return { results: validated.value, unavailable: null };
    }
    return { results: null, unavailable: `no runtime could execute the z3 child process (${attempts.join("; ")})` };
  }
}
// src/design/adapter/sibling-backend-client-implementation.ts
import { spawnSync as spawnSync2 } from "child_process";
import { mkdtempSync, rmSync as rmSync4, writeFileSync as writeFileSync3 } from "fs";
import { tmpdir } from "os";
import { join as join7 } from "path";

// src/design/adapter/sibling-document-parser.ts
function parseSiblingVerdictDocument(raw) {
  const decoded = parseFindingsValues(raw);
  if (!decoded.ok)
    return SiblingVerdictDocument.unreadable(decoded.error);
  const doc = decoded.value;
  if (doc.unavailable !== undefined)
    return SiblingVerdictDocument.unavailable(doc.unavailable.reason, doc.method);
  const findings = [];
  for (const finding of doc.findings) {
    const fields = combineResults({
      targets: traverseResult([...finding.targets], (target) => LoweredIdentifier.parse(target.asString())),
      witness: DesignWitness.parse(finding.witness)
    });
    if (!fields.ok)
      return SiblingVerdictDocument.unreadable(JSON.stringify(fields.error));
    findings.push(SiblingVerdictFinding.of({ ...finding, ...fields.value }));
  }
  const skipped = [];
  for (const skip of doc.skipped) {
    const target = LoweredIdentifier.parse(skip.target.asString());
    if (!target.ok)
      return SiblingVerdictDocument.unreadable(JSON.stringify(target.error));
    skipped.push(SiblingVerdictSkip.of({ ...skip, target: target.value }));
  }
  const collections = combineResults({
    findings: SiblingVerdictFindings.parse(findings),
    skipped: SiblingVerdictSkips.parse(skipped)
  });
  if (!collections.ok)
    return SiblingVerdictDocument.unreadable(JSON.stringify(collections.error));
  return SiblingVerdictDocument.readable(doc.method, collections.value.findings, collections.value.skipped);
}

// src/design/adapter/sibling-backend-client-implementation.ts
function errorMessageOrFallback(raw, fallback) {
  const parsed = ErrorMessage.parse(raw);
  return parsed.ok ? parsed.value : ErrorMessage.of(fallback);
}

class SiblingBackendClientImplementation {
  #config;
  constructor(config) {
    this.#config = config;
  }
  runLowered(backend, unit, lowered, wallTimeoutMs) {
    const run = this.#spawn(backend, renderLoweredDocument(unit, lowered), wallTimeoutMs);
    const refinementFailure = ErrorMessage.of(`refinement pass could not run (${run.note.slice(0, 120)})`);
    if (!run.document.ok)
      return SiblingVerificationResult.incomplete(errorMessageOrFallback(`lowered v1 backend findings document could not be read (${this.#errorDetail(run.document.error)})`, "lowered v1 backend findings document could not be read"), refinementFailure);
    const document = run.document.value === null ? null : parseSiblingVerdictDocument(run.document.value);
    if (run.exit === 127) {
      const reason = document?.unavailableReason() ?? (backend === "smt" ? "z3 could not be executed by the lowered v1 backend" : "quint CLI could not be executed by the lowered v1 backend");
      const parsedReason = ErrorMessage.parse(reason);
      return SiblingVerificationResult.backendUnavailable(parsedReason.ok ? parsedReason.value : ErrorMessage.of("lowered backend reported an invalid unavailable reason"), refinementFailure);
    }
    if (document === null)
      return SiblingVerificationResult.incomplete(ErrorMessage.of(`lowered v1 backend produced no findings document (${run.note.slice(0, 160)})`), refinementFailure);
    return SiblingVerificationResult.completed(document, run.exit === 0 ? null : refinementFailure);
  }
  runRefinement(plan, wallTimeoutMs) {
    const lowered = plan.loweredForQuint();
    if (!lowered.ok) {
      const reason = ErrorMessage.of(`refinement lowering failed: ${lowered.error.kind}`);
      return SiblingVerificationResult.incomplete(reason, reason);
    }
    return this.runLowered("quint", plan.unit(), lowered.value, wallTimeoutMs);
  }
  probeState(probe, wallTimeoutMs) {
    const variant = reachabilityVariant(renderLoweredDocument(probe.unit(), probe.lowered()), probe.attributePath(), probe.state());
    const run = this.#spawn("quint", variant, wallTimeoutMs);
    if (run.exit !== 0 || !run.document.ok || run.document.value === null)
      return ReachabilityVerdict.unverified();
    return parseSiblingVerdictDocument(run.document.value).reachabilityOf(probe.attributePath(), probe.state());
  }
  #spawn(backend, loweredDoc, wallTimeoutMs) {
    const tool = this.#config.siblingToolPaths[backend];
    const work = mkdtempSync(join7(tmpdir(), "deep-spec-design-lower-"));
    try {
      const modelPath = join7(work, "deep-spec-analysis-formal-model.md");
      writeFileSync3(modelPath, `# Lowered design unit

\`\`\`json
${JSON.stringify(loweredDoc, null, 2)}
\`\`\`
`, "utf-8");
      const res = spawnSync2("bun", [tool, "--stage", "deep-spec-analysis-functional-verify", "--output-path", modelPath], {
        encoding: "utf-8",
        timeout: wallTimeoutMs,
        cwd: this.#config.workingDirectory,
        ...this.#config.spawnEnvironment ? { env: this.#config.spawnEnvironment } : {}
      });
      const findingsPath = join7(work, "deep-spec-verify", `${backend}.json`);
      const document = this.#readDocument(findingsPath);
      const note = res.error ? String(res.error) : (res.stdout ?? "").trim().split(`
`).pop() ?? "";
      return {
        exit: res.status,
        document,
        note
      };
    } finally {
      rmSync4(work, { recursive: true, force: true });
    }
  }
  #readDocument(path) {
    const text = readArtifactText(path);
    if (!text.ok)
      return text.error.kind === "not-found" ? ok(null) : err(text.error);
    try {
      return ok(JSON.parse(text.value));
    } catch (error) {
      return err({
        kind: "corrupt",
        path,
        cause: error instanceof Error ? error.message : String(error)
      });
    }
  }
  #errorDetail(error) {
    switch (error.kind) {
      case "not-found":
        return `not-found: ${error.path}`;
      case "io-failed":
        return `io-failed: ${error.cause}`;
      case "corrupt":
        return `corrupt: ${error.cause}`;
    }
  }
}
// src/design/usecase/design-report-finalizer.ts
class DesignReportFinalizer {
  #repository;
  #findingsSchema;
  constructor(repository, findingsSchema) {
    this.#repository = repository;
    this.#findingsSchema = findingsSchema;
  }
  finalize(directory, report, model) {
    return matchResult(this.#repository.findByDirectory(directory), {
      err: (error) => err(error),
      ok: (loaded) => {
        const aggregate = loaded.finalizedWith(report, model, this.#findingsSchema);
        return matchResult(this.#repository.store(aggregate), {
          err: (error) => err(error),
          ok: () => ok(aggregate)
        });
      }
    });
  }
}
// src/design/usecase/design-verification-acquirer.ts
class DesignVerificationAcquirer {
  #repository;
  #finalizer;
  constructor(repository, finalizer) {
    this.#repository = repository;
    this.#finalizer = finalizer;
  }
  acquire(modelId, reportId, method, directory) {
    return matchResult(this.#repository.findById(modelId), {
      err: (error) => {
        if (error.kind === "not-found")
          return err({ kind: "not-applicable" });
        if (error.kind === "io-failed")
          return err({ kind: "acquisition-failed", error });
        return matchResult(this.#finalizer.finalize(directory, DesignReport.irUnreadable(reportId, method, error.cause), null), {
          err: (error2) => err({ kind: "save-failed", error: error2 }),
          ok: () => err({ kind: "model-unreadable" })
        });
      },
      ok: (model) => matchResult(model.prepareVerification(reportId, method), {
        ok: (ready) => ok(ready),
        err: (report) => matchResult(this.#finalizer.finalize(directory, report, model), {
          err: (error) => err({ kind: "save-failed", error }),
          ok: () => err({ kind: "version-mismatch", report })
        })
      })
    });
  }
}
// src/design/usecase/validate-design-intermediate-representation-usecase.ts
class ValidateDesignIntermediateRepresentationUseCase {
  #repository;
  constructor(repository) {
    this.#repository = repository;
  }
  execute(modelId) {
    return matchResult(this.#repository.findById(DesignIntermediateRepresentationValidationMaterialsIdentifier.of(modelId)), {
      ok: (materials) => ({
        kind: "verdict",
        assessment: materials.assess()
      }),
      err: (error) => error.kind === "not-found" ? { kind: "not-applicable" } : { kind: "acquisition-failed", error }
    });
  }
}
// src/design/usecase/verify-design-quint-usecase.ts
var INITIAL_METHOD = VerificationMethod.of("simulation");
var UNIT_WALL_TIMEOUT_MS = 50000;
var RUN_BUDGET_MS = 50000;
var UNREACH_BUDGET_MS = 70000;

class VerifyDesignQuintUseCase {
  #siblingBackendClient;
  #refinementMaterialsRepository;
  #clock;
  #unreachCap;
  #finalizer;
  #acquirer;
  constructor(designModelRepository, designVerifyDirectoryRepository, findingsSchema, siblingBackendClient, refinementMaterialsRepository, clock, unreachCap) {
    this.#siblingBackendClient = siblingBackendClient;
    this.#refinementMaterialsRepository = refinementMaterialsRepository;
    this.#clock = clock;
    this.#unreachCap = unreachCap;
    this.#finalizer = new DesignReportFinalizer(designVerifyDirectoryRepository, findingsSchema);
    this.#acquirer = new DesignVerificationAcquirer(designModelRepository, this.#finalizer);
  }
  execute(input) {
    const id = DesignReportIdentifier.of(input.verifyDirectory, "quint");
    return matchResult(this.#acquirer.acquire(input.modelId, id, INITIAL_METHOD, input.verifyDirectory), {
      err: (outcome) => outcome,
      ok: (model) => this.#verify(input, id, model)
    });
  }
  #verify(input, id, model) {
    let report = DesignReport.started(id, model, INITIAL_METHOD);
    const started = this.#clock.now();
    let probesUsed = 0;
    for (const unit of model) {
      if (this.#clock.now() - started > RUN_BUDGET_MS) {
        report = report.unitTimedOut(unit);
        continue;
      }
      const terminal = unit.withLowering({ synthetics: false }, {
        failed: (problem) => {
          report = report.loweringFailed(unit, problem);
          return null;
        },
        ready: (lowered) => {
          const remaining = Math.min(UNIT_WALL_TIMEOUT_MS, RUN_BUDGET_MS - (this.#clock.now() - started));
          if (remaining < 3000) {
            report = report.unitTimedOut(unit);
            return null;
          }
          const run = this.#siblingBackendClient.runLowered("quint", unit, lowered, remaining);
          report = run.recordedIn(report, model, unit, lowered);
          if (run.isBackendUnavailable()) {
            return matchResult(this.#finalizer.finalize(input.verifyDirectory, report, model), {
              err: (error) => ({ kind: "save-failed", error }),
              ok: () => ({ kind: "backend-unavailable" })
            });
          }
          if (!run.canInspectReachability())
            return null;
          for (let machine of report.planReachability(unit, lowered)) {
            for (const probe of machine) {
              const probeRemaining = Math.min(UNIT_WALL_TIMEOUT_MS, UNREACH_BUDGET_MS - (this.#clock.now() - started));
              if (probesUsed >= this.#unreachCap || probeRemaining < 3000)
                continue;
              probesUsed += 1;
              machine = machine.withVerdict(probe, this.#siblingBackendClient.probeState(probe, probeRemaining));
            }
            report = machine.recordedIn(report, probesUsed >= this.#unreachCap, this.#unreachCap);
          }
          return null;
        }
      });
      if (terminal !== null)
        return terminal;
    }
    const materials = this.#refinementMaterialsRepository.findById(RefinementMaterialsIdentifier.of(input.modelId));
    report = matchResult(materials, {
      err: (error) => report.refinementUnavailable(error.path, error.kind),
      ok: (context) => {
        const prepared = context.prepare(model);
        let refined = prepared.recordedIn(report);
        for (const plan of prepared) {
          refined = plan.quintPreparedIn(refined);
          if (!plan.hasQuintInvariants())
            continue;
          const remaining = Math.min(UNIT_WALL_TIMEOUT_MS, RUN_BUDGET_MS + UNREACH_BUDGET_MS - (this.#clock.now() - started));
          if (remaining < 3000) {
            refined = plan.quintTimedOut(refined);
            continue;
          }
          refined = plan.quintRecordedIn(refined, this.#siblingBackendClient.runRefinement(plan, remaining));
        }
        return refined;
      }
    });
    return matchResult(this.#finalizer.finalize(input.verifyDirectory, report, model), {
      err: (error) => ({ kind: "save-failed", error }),
      ok: (directory) => matchResult(materials, {
        err: (error) => ({ kind: "acquisition-failed", error }),
        ok: () => ({ kind: "verified", directory })
      })
    });
  }
}
// src/design/usecase/verify-design-satisfiability-modulo-theories-usecase.ts
var METHOD = VerificationMethod.of("exhaustive");
var UNIT_WALL_TIMEOUT_MS2 = 55000;
var RUN_BUDGET_MS2 = 60000;
var REFINEMENT_DEADLINE_MS = 65000;

class VerifyDesignSatisfiabilityModuloTheoriesUseCase {
  #siblingBackendClient;
  #refinementMaterialsRepository;
  #refinementSolverClient;
  #clock;
  #finalizer;
  #acquirer;
  constructor(designModelRepository, designVerifyDirectoryRepository, findingsSchema, siblingBackendClient, refinementMaterialsRepository, refinementSolverClient, clock) {
    this.#siblingBackendClient = siblingBackendClient;
    this.#refinementMaterialsRepository = refinementMaterialsRepository;
    this.#refinementSolverClient = refinementSolverClient;
    this.#clock = clock;
    this.#finalizer = new DesignReportFinalizer(designVerifyDirectoryRepository, findingsSchema);
    this.#acquirer = new DesignVerificationAcquirer(designModelRepository, this.#finalizer);
  }
  execute(input) {
    const id = DesignReportIdentifier.of(input.verifyDirectory, "smt");
    return matchResult(this.#acquirer.acquire(input.modelId, id, METHOD, input.verifyDirectory), {
      err: (outcome) => outcome,
      ok: (model) => this.#verify(input, id, model)
    });
  }
  #verify(input, id, model) {
    let report = DesignReport.started(id, model, METHOD);
    const started = this.#clock.now();
    for (const unit of model) {
      if (this.#clock.now() - started > RUN_BUDGET_MS2) {
        report = report.unitTimedOut(unit);
        continue;
      }
      const terminal = unit.withLowering({ synthetics: true }, {
        failed: (problem) => {
          report = report.loweringFailed(unit, problem);
          return null;
        },
        ready: (lowered) => {
          const remaining = Math.min(UNIT_WALL_TIMEOUT_MS2, RUN_BUDGET_MS2 - (this.#clock.now() - started));
          if (remaining < 3000) {
            report = report.unitTimedOut(unit);
            return null;
          }
          const run = this.#siblingBackendClient.runLowered("smt", unit, lowered, remaining);
          report = run.recordedIn(report, model, unit, lowered);
          if (run.isBackendUnavailable()) {
            return matchResult(this.#finalizer.finalize(input.verifyDirectory, report, model), {
              err: (error) => ({ kind: "save-failed", error }),
              ok: () => ({ kind: "backend-unavailable" })
            });
          }
          return null;
        }
      });
      if (terminal !== null)
        return terminal;
    }
    const materials = this.#refinementMaterialsRepository.findById(RefinementMaterialsIdentifier.of(input.modelId));
    report = matchResult(materials, {
      err: (error) => report.refinementUnavailable(error.path, error.kind),
      ok: (context) => {
        const prepared = context.prepare(model);
        let refined = prepared.recordedIn(report);
        for (const plan of prepared) {
          const remaining = REFINEMENT_DEADLINE_MS - (this.#clock.now() - started);
          if (remaining < 5000) {
            refined = plan.smtTimedOut(refined);
            continue;
          }
          refined = this.#refinementSolverClient.check(plan, Math.min(30000, remaining)).recordedIn(refined);
        }
        return refined;
      }
    });
    return matchResult(this.#finalizer.finalize(input.verifyDirectory, report, model), {
      err: (error) => ({ kind: "save-failed", error }),
      ok: (directory) => matchResult(materials, {
        err: (error) => ({ kind: "acquisition-failed", error }),
        ok: () => ({ kind: "verified", directory })
      })
    });
  }
}
// src/entries/aidlc-sensor-deep-spec-design-ir-valid.ts
var MAX_REPORTED_ERRORS = 25;
function main() {
  const flags = parseFlags(process.argv.slice(2));
  const target = ArtifactPath.parse(flags.outputPath);
  if (!target.ok) {
    process.stderr.write(`deep-spec-design-ir-valid: --output-path is required
`);
    process.exit(1);
  }
  const schemaPath = join8(dirname5(fileURLToPath(import.meta.url)), "data", "deep-spec-design-ir-schema.json");
  const useCase = new ValidateDesignIntermediateRepresentationUseCase(new DesignIntermediateRepresentationValidationMaterialsRepositoryImplementation({ schemaPath }));
  const outcome = useCase.execute(DesignModelIdentifier.of(target.value));
  if (outcome.kind === "not-applicable") {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, errors: [], note: "not-applicable" })}
`);
    process.exit(0);
  }
  const errors = outcome.kind === "acquisition-failed" ? [outcome.error.cause] : Array.from(outcome.assessment.errors(), (message) => message.asString());
  process.stdout.write(`${JSON.stringify({
    pass: outcome.kind === "verdict" && outcome.assessment.passes(),
    findings_count: errors.length,
    errors: errors.slice(0, MAX_REPORTED_ERRORS)
  })}
`);
  process.exit(0);
}
main();
