// @bun
// src/entries/aidlc-sensor-deep-spec-refcheck-contract.ts
import { basename as basename3, dirname as dirname4, join as join6 } from "path";
import { fileURLToPath } from "url";

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
// src/kernel/infrastructure/json.ts
function isObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
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
  const values = {};
  for (const key in fields) {
    const field = fields[key];
    if (!field.ok)
      return err(field.error);
    values[key] = field.value;
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

// src/kernel/domain/immutable-first-class-collection.ts
class ImmutableFirstClassCollection {
  #values;
  constructor(values) {
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-immutable-collection-elements");
  }
  static of(values) {
    return new ImmutableFirstClassCollection(values);
  }
  static parse(values) {
    return parseConstruction(() => new ImmutableFirstClassCollection(values));
  }
  [Symbol.iterator]() {
    return this.#values[Symbol.iterator]();
  }
  at(index) {
    return collectionAt(this, index);
  }
  head() {
    return collectionHead(this);
  }
  tail() {
    return ImmutableFirstClassCollection.of(collectionTail(this));
  }
  include(element) {
    return collectionInclude(this, element);
  }
  exists(predicate) {
    return collectionExists(this, predicate);
  }
  filter(predicate) {
    return ImmutableFirstClassCollection.of(collectionFilter(this, predicate));
  }
  map(transform) {
    return ImmutableFirstClassCollection.of(collectionMap(this, transform));
  }
  isEmpty() {
    return this.#values.length === 0;
  }
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
  map(transform) {
    return ImmutableFirstClassCollection.of(collectionMap(this, transform));
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
  static of(head, tail) {
    return new FindingTargets(head, tail);
  }
  static parse(head, tail) {
    return parseConstruction(() => new FindingTargets(head, tail));
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
  asString() {
    return this.#value;
  }
}
// src/kernel/adapter/contract-schema.ts
import { readFileSync } from "fs";
function readContractSchema(path) {
  try {
    const document = JSON.parse(readFileSync(path, "utf-8"));
    if (!isObject(document))
      return err({ cause: "contract schema must be a JSON object" });
    return ok(document);
  } catch (e) {
    return err({ cause: e instanceof Error ? e.message : String(e) });
  }
}
function readFindingsSchema(path) {
  const document = readContractSchema(path);
  if (!document.ok)
    return FindingsSchema.unreadable(document.error.cause);
  const parsed = FindingsSchema.parse(document.value);
  return parsed.ok ? parsed.value : FindingsSchema.unreadable(JSON.stringify(parsed.error));
}
// src/kernel/adapter/directory-finalization-lock.ts
import { randomBytes } from "crypto";
import { mkdirSync as mkdirSync2, readFileSync as readFileSync2, renameSync as renameSync2, rmSync as rmSync2, writeFileSync as writeFileSync2 } from "fs";
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
    if (observed === null) {
      return { kind: "lock-contended", cause: `owner metadata is unreadable (${blocked})` };
    }
    if (observed.state !== "held") {
      return { kind: "lock-contended", cause: `owner metadata is in state "${observed.state}"` };
    }
    if (this.#clock.now() < observed.leaseExpiresAtMs) {
      return { kind: "lock-contended", cause: "the lease has not expired" };
    }
    const status = this.#liveness.statusOf(observed.pid);
    if (status !== "absent") {
      return { kind: "lock-contended", cause: `owner process ${observed.pid} is ${status}` };
    }
    const reread = this.#readMetadata(canonical);
    if (reread === null || reread.token !== observed.token) {
      return { kind: "lock-contended", cause: "the lock changed hands during the recovery check" };
    }
    const stale = `${canonical}.stale.${observed.token}.${token}`;
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
    return { kind: "recovered", displacedToken: observed.token };
  }
  holdsOwnership(directory) {
    const canonical = this.canonicalPathOf(directory);
    const mine = this.#ownerTokens.get(canonical);
    if (mine === undefined)
      return false;
    const observed = this.#readMetadata(canonical);
    return observed !== null && observed.state === "held" && observed.token === mine;
  }
  release(directory) {
    const canonical = this.canonicalPathOf(directory);
    const mine = this.#ownerTokens.get(canonical);
    if (mine === undefined) {
      return { kind: "lock-release-failed", cause: "this writer does not hold the lock" };
    }
    this.#ownerTokens.delete(canonical);
    const observed = this.#readMetadata(canonical);
    if (observed === null || observed.token !== mine) {
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
    let raw;
    try {
      raw = JSON.parse(readFileSync2(join2(canonical, METADATA_BASENAME), "utf-8"));
    } catch {
      return null;
    }
    if (typeof raw !== "object" || raw === null)
      return null;
    const doc = raw;
    if (typeof doc.state !== "string" || typeof doc.token !== "string")
      return null;
    if (typeof doc.pid !== "number" || typeof doc.acquiredAtMs !== "number" || typeof doc.leaseExpiresAtMs !== "number")
      return null;
    return {
      state: doc.state,
      token: doc.token,
      pid: doc.pid,
      acquiredAtMs: doc.acquiredAtMs,
      leaseExpiresAtMs: doc.leaseExpiresAtMs
    };
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
// src/kernel/adapter/list-subdirectories.ts
import { readdirSync } from "fs";
function listSubdirectories(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch {
    return [];
  }
}
// src/kernel/adapter/markdown-table.ts
function parseMarkdownTables(md) {
  const tables = [];
  const lines = md.split(`
`);
  let i = 0;
  const splitRow = (row) => row.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
  while (i < lines.length) {
    const isRow = (n) => /^\s*\|.*\|\s*$/.test(lines[n] ?? "");
    if (isRow(i) && isRow(i + 1) && /^[\s|:-]+$/.test(lines[i + 1] ?? "")) {
      const table = { header: splitRow(lines[i] ?? ""), rows: [], line: i + 1 };
      let j = i + 2;
      while (j < lines.length && isRow(j)) {
        table.rows.push({ cells: splitRow(lines[j] ?? ""), line: j + 1 });
        j++;
      }
      tables.push(table);
      i = j;
      continue;
    }
    i++;
  }
  return tables;
}
// src/kernel/adapter/read-if-exists.ts
import { existsSync, readFileSync as readFileSync3 } from "fs";
function readIfExists(path) {
  return existsSync(path) ? readFileSync3(path, "utf-8") : null;
}
// src/kernel/adapter/record-root.ts
import { existsSync as existsSync2 } from "fs";
import { dirname as dirname2, join as join3 } from "path";
function findRecordRoot(startDir) {
  let d = startDir;
  for (let i = 0;i < 8; i++) {
    if (existsSync2(join3(d, "inception")) || existsSync2(join3(d, "aidlc-state.md")))
      return d;
    const parent = dirname2(d);
    if (parent === d)
      break;
    d = parent;
  }
  return null;
}
function relArtifact(recordRoot, absPath) {
  if (recordRoot && absPath.startsWith(`${recordRoot}/`)) {
    return absPath.slice(recordRoot.length + 1);
  }
  return absPath.split("/").slice(-1)[0] ?? absPath;
}
// src/kernel/adapter/requirement-identifiers-parser.ts
function parseRequirementIdentifiers(text) {
  const values = [];
  for (const match of text.matchAll(/\b(?:FR|NFR)-?[0-9]+(?:\.[0-9]+)*\b/g)) {
    const parsed = RequirementIdentifier.parse(match[0]);
    if (!parsed.ok)
      return parsed;
    values.push(parsed.value);
  }
  return RequirementIdentifiers.parse(values);
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
// src/kernel/adapter/verdict-line.ts
function renderVerdictLine(pass, findings, skipped, note) {
  const out = { pass, findings_count: findings, skipped_count: skipped, method: "static" };
  if (note)
    out.note = note;
  return `${JSON.stringify(out)}
`;
}
// src/kernel/adapter/yaml.ts
class YamlError extends Error {
}
function parseYamlSubset(src) {
  const raw = src.split(`
`);
  const lines = [];
  for (let i = 0;i < raw.length; i++) {
    const expanded = (raw[i] ?? "").replace(/\t/g, "  ");
    const trimmed = expanded.trim();
    if (trimmed === "" || trimmed.startsWith("#"))
      continue;
    lines.push({ indent: expanded.length - expanded.trimStart().length, text: trimmed, n: i + 1 });
  }
  if (lines.length === 0)
    return { value: null };
  try {
    const [value, next] = parseBlock(lines, 0, lines[0]?.indent ?? 0);
    if (next < lines.length) {
      throw new YamlError(`line ${lines[next]?.n}: content outside the top-level block`);
    }
    return { value };
  } catch (err2) {
    return { error: err2 instanceof Error ? err2.message : String(err2) };
  }
}
function parseBlock(lines, start, indent) {
  const first = lines[start];
  if (!first)
    return [null, start];
  if (first.text === "-" || first.text.startsWith("- ")) {
    return parseSequence(lines, start, indent);
  }
  return parseMapping(lines, start, indent);
}
function parseSequence(lines, start, indent) {
  const out = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (!line || line.indent !== indent || !(line.text === "-" || line.text.startsWith("- ")))
      break;
    const rest = line.text === "-" ? "" : line.text.slice(2).trim();
    if (rest === "") {
      const next = lines[i + 1];
      if (next && next.indent > indent) {
        const [child, ni] = parseBlock(lines, i + 1, next.indent);
        out.push(child);
        i = ni;
      } else {
        out.push(null);
        i++;
      }
      continue;
    }
    if (isMappingEntry(rest)) {
      const virtual = { indent: indent + 2, text: rest, n: line.n };
      const sub = [virtual];
      let j = i + 1;
      while (j < lines.length && (lines[j]?.indent ?? 0) > indent) {
        sub.push(lines[j]);
        j++;
      }
      const [child] = parseMapping(sub, 0, indent + 2);
      out.push(child);
      i = j;
      continue;
    }
    out.push(parseScalar(rest, line.n));
    i++;
  }
  return [out, i];
}
function isMappingEntry(text) {
  if (text.startsWith("[") || text.startsWith("'") || text.startsWith('"'))
    return false;
  return /^[^:]+:(\s|$)/.test(text);
}
function parseMapping(lines, start, indent) {
  const out = {};
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (!line || line.indent !== indent)
      break;
    if (line.text === "-" || line.text.startsWith("- "))
      break;
    const m = line.text.match(/^([^:]+):(?:\s+(.*))?$/);
    if (!m)
      throw new YamlError(`line ${line.n}: not a mapping entry: "${line.text}"`);
    const key = unquote((m[1] ?? "").trim());
    const valPart = (m[2] ?? "").trim();
    if (valPart === "") {
      const next = lines[i + 1];
      if (next && next.indent > indent) {
        const [child, ni] = parseBlock(lines, i + 1, next.indent);
        out[key] = child;
        i = ni;
      } else {
        out[key] = null;
        i++;
      }
      continue;
    }
    if (/^[>|][+-]?$/.test(valPart)) {
      const parts = [];
      let j = i + 1;
      while (j < lines.length && (lines[j]?.indent ?? 0) > indent) {
        parts.push(lines[j]?.text ?? "");
        j++;
      }
      out[key] = parts.join(valPart.startsWith(">") ? " " : `
`);
      i = j;
      continue;
    }
    out[key] = parseScalar(valPart, line.n);
    i++;
  }
  return [out, i];
}
function unquote(s) {
  if (s.startsWith('"') && s.endsWith('"') || s.startsWith("'") && s.endsWith("'")) {
    return s.slice(1, -1);
  }
  return s;
}
function parseScalar(s, lineNo) {
  let v = s;
  if (v.startsWith("&") || v.startsWith("*") || v.startsWith("!")) {
    throw new YamlError(`line ${lineNo}: unsupported YAML feature (anchor/alias/tag): "${v}"`);
  }
  if (v.startsWith("{")) {
    throw new YamlError(`line ${lineNo}: unsupported YAML feature (flow mapping): "${v}"`);
  }
  if (v.startsWith('"') || v.startsWith("'")) {
    const quote = v[0];
    const close = v.indexOf(quote, 1);
    if (close > 0)
      return v.slice(1, close);
    throw new YamlError(`line ${lineNo}: unterminated quoted scalar: "${v}"`);
  }
  const hash = v.indexOf(" #");
  if (hash >= 0)
    v = v.slice(0, hash).trim();
  if (v.startsWith("[")) {
    if (!v.endsWith("]"))
      throw new YamlError(`line ${lineNo}: unterminated inline sequence: "${v}"`);
    const inner = v.slice(1, -1).trim();
    if (inner === "")
      return [];
    return inner.split(",").map((item) => parseScalar(item.trim(), lineNo));
  }
  if (v === "true")
    return true;
  if (v === "false")
    return false;
  if (v === "null" || v === "~")
    return null;
  if (/^-?[0-9]+$/.test(v))
    return Number.parseInt(v, 10);
  if (/^-?[0-9]+\.[0-9]+$/.test(v))
    return Number.parseFloat(v);
  return v;
}
// src/refcheck/domain/allowed-value.ts
class AllowedValue {
  #value;
  constructor(raw) {
    if (raw.length > 4096)
      throw new IllegalArgumentException({ kind: "allowed-value-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new AllowedValue(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new AllowedValue(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
  normalized() {
    return NormalizedName.of(this.#value);
  }
}
// src/refcheck/domain/allowed-values.ts
class AllowedValues extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-allowed-values");
  }
  rebuild(values) {
    return new AllowedValues(values);
  }
  static parse(values) {
    return parseConstruction(() => new AllowedValues(values));
  }
  static of(values) {
    return new AllowedValues(values);
  }
  add(value) {
    return new AllowedValues([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  containsValue(raw) {
    return this.#values.some((v) => v.asString() === raw);
  }
  rogueAmong(states) {
    const norm = new Set(this.#values.map((v) => v.normalized().asString()));
    return states.toArray().filter((s) => !norm.has(s.normalized().asString())).map((s) => s.asString()).sort();
  }
  absentFrom(states) {
    const stateNorm = new Set(states.toArray().map((s) => s.normalized().asString()));
    return this.#values.filter((v) => !stateNorm.has(v.normalized().asString())).map((v) => v.asString()).sort();
  }
  toArray() {
    return this.#values;
  }
}
// src/refcheck/domain/applies-to.ts
class AppliesTo {
  #value;
  constructor(raw) {
    if (raw.length > 4096)
      throw new IllegalArgumentException({ kind: "applies-to-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new AppliesTo(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new AppliesTo(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
  entityToken() {
    const token = this.#value.match(/^([A-Za-z][A-Za-z0-9_]*)(?:\.([A-Za-z][A-Za-z0-9_]*))?$/);
    return token ? token[1] ?? null : null;
  }
  attributeToken() {
    const token = this.#value.match(/^([A-Za-z][A-Za-z0-9_]*)(?:\.([A-Za-z][A-Za-z0-9_]*))?$/);
    return token?.[2] ?? null;
  }
  looselyMentions(name) {
    return this.#value.toLowerCase().includes(name.asString().toLowerCase());
  }
}
// src/refcheck/domain/check-families.ts
class CheckFamilies extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-check-families");
  }
  rebuild(values) {
    return new CheckFamilies(values);
  }
  static parse(values) {
    return parseConstruction(() => new CheckFamilies(values));
  }
  static of(values) {
    return new CheckFamilies(values);
  }
  add(value) {
    return new CheckFamilies([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  checkTargets() {
    return TargetIdentifiers.of(Array.from(this.#values.map((f) => f.asCheckTarget()), (raw) => TargetIdentifier.of(raw)));
  }
  toArray() {
    return this.#values;
  }
}

// src/refcheck/domain/check-family.ts
class CheckFamily {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "check-family-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-family", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new CheckFamily(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new CheckFamily(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
  prefixedDetail(detail) {
    return `${this.#value}: ${detail}`;
  }
  asCheckTarget() {
    return `check:${this.#value}`;
  }
}

// src/refcheck/domain/functional-check-families.ts
var FD_E1 = CheckFamily.of("FD-E1");
var FD_E2 = CheckFamily.of("FD-E2");
var FD_E3 = CheckFamily.of("FD-E3");
var FD_E4 = CheckFamily.of("FD-E4");
var FD_E5 = CheckFamily.of("FD-E5");
var FD_E6 = CheckFamily.of("FD-E6");
var FD_R1 = CheckFamily.of("FD-R1");
var FD_R2 = CheckFamily.of("FD-R2");
var FD_R3 = CheckFamily.of("FD-R3");
var FD_R4 = CheckFamily.of("FD-R4");
var FD_R5 = CheckFamily.of("FD-R5");
var FD_S1 = CheckFamily.of("FD-S1");
var FD_S2 = CheckFamily.of("FD-S2");
var XS_1 = CheckFamily.of("XS-1");
var XS_2 = CheckFamily.of("XS-2");
var XS_3 = CheckFamily.of("XS-3");
var FUNCTIONAL_FAMILIES = CheckFamilies.of([
  FD_E1,
  FD_E2,
  FD_E3,
  FD_E4,
  FD_E5,
  FD_E6,
  FD_R1,
  FD_R2,
  FD_R3,
  FD_R4,
  FD_R5,
  FD_S1,
  FD_S2,
  XS_1,
  XS_2,
  XS_3
]);

// src/refcheck/domain/element-path.ts
class ElementPath {
  #value;
  constructor(raw) {
    if (raw.length > 4096)
      throw new IllegalArgumentException({ kind: "element-path-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new ElementPath(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new ElementPath(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
}

// src/refcheck/domain/witness-reference.ts
class WitnessReference {
  #artifact;
  #element;
  #value;
  constructor(props) {
    this.#artifact = ArtifactPath.of(props.artifact);
    this.#element = ElementPath.of(props.element);
    this.#value = props.value;
  }
  static parse(props) {
    return parseConstruction(() => new WitnessReference(props));
  }
  static of(props) {
    return new WitnessReference(props);
  }
  artifact() {
    return this.#artifact.asString();
  }
  element() {
    return this.#element.asString();
  }
  value() {
    return this.#value;
  }
  equals(other) {
    return this.#artifact.equals(other.#artifact) && this.#element.equals(other.#element) && this.#value === other.#value;
  }
  pointsAt(artifact, element) {
    return this.#artifact.asString() === artifact && this.#element.asString() === element;
  }
  static at(artifact, element, value) {
    return new WitnessReference(value === undefined ? { artifact, element } : { artifact, element, value });
  }
}

// src/refcheck/domain/attribute-declaration.ts
class AttributeDeclaration {
  #name;
  #element;
  #type;
  #uniqueIsTrue;
  #references;
  #allowed;
  #def;
  #minDeclared;
  #maxDeclared;
  #min;
  #max;
  constructor(seed) {
    this.#name = seed.name;
    this.#element = seed.element;
    this.#type = seed.type;
    this.#uniqueIsTrue = seed.uniqueIsTrue;
    this.#references = seed.references;
    this.#allowed = seed.allowed;
    this.#def = seed.def;
    this.#minDeclared = seed.minDeclared;
    this.#maxDeclared = seed.maxDeclared;
    this.#min = seed.min;
    this.#max = seed.max;
  }
  static of(seed) {
    return new AttributeDeclaration(seed);
  }
  #record(report, family, entity, artifact, value, detail, kind = FindingKind.structureInvalid()) {
    const label = `${entity.asString()}.${this.#name.asString()}`;
    report.finding(family, kind, FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("attr", label)), []), [WitnessReference.at(artifact.asString(), this.#element.asString(), value)], detail);
  }
  checkDiagramStates(states, report, entity, specArtifact, entitiesArtifact, el) {
    const specArt = specArtifact.asString();
    const entitiesArt = entitiesArtifact.asString();
    const attrId = TargetIdentifiers.safe("attr", `${entity.asString()}.${this.#name.asString()}`);
    const rogue = this.rogueDiagramStates(states);
    if (rogue.length > 0) {
      report.finding(FD_S1, FindingKind.consistencyMismatch(), FindingTargets.of(TargetIdentifier.of(attrId), []), rogue.map((v) => WitnessReference.at(specArt, el, v)), `diagram state(s) ${rogue.join(", ")} are not allowed values of ${entity.asString()}.${this.#name.asString()} in entities.md`);
    }
    const dangling = this.allowedValuesAbsentFrom(states);
    if (dangling.length > 0) {
      report.finding(FD_S2, FindingKind.consistencyMismatch(), FindingTargets.of(TargetIdentifier.of(attrId), []), dangling.map((v) => WitnessReference.at(entitiesArt, this.#element.asString(), v)), `allowed value(s) ${dangling.join(", ")} of ${entity.asString()}.${this.#name.asString()} appear in no diagram state`);
    }
  }
  checkType(report, entity, artifact) {
    const label = `${entity.asString()}.${this.#name.asString()}`;
    if (this.declaresAllowedValuesOnNonEnumerableType())
      this.#record(report, FD_E2, entity, artifact, this.typeToken(), `"${label}" declares allowed values but its type "${this.typeText()}" is not an enumerable type`);
    if (this.declaresBoundsOnNonNumericType())
      this.#record(report, FD_E2, entity, artifact, this.typeToken(), `"${label}" declares min/max but its type "${this.typeText()}" is not numeric or date-like`);
    if (this.declaresUniqueOnCollectionType())
      this.#record(report, FD_E2, entity, artifact, this.typeToken(), `"${label}" declares unique but its type "${this.typeText()}" is not scalar`);
  }
  checkBounds(report, entity, artifact) {
    const label = `${entity.asString()}.${this.#name.asString()}`;
    if (this.boundsInverted())
      this.#record(report, FD_E3, entity, artifact, `min ${this.#min?.asNumber()} > max ${this.#max?.asNumber()}`, `"${label}": min ${this.#min?.asNumber()} exceeds max ${this.#max?.asNumber()}`);
    if (this.defaultBelowMin())
      this.#record(report, FD_E3, entity, artifact, this.#def?.render(), `"${label}": default ${this.#def?.render()} is below min ${this.#min?.asNumber()}`);
    if (this.defaultAboveMax())
      this.#record(report, FD_E3, entity, artifact, this.#def?.render(), `"${label}": default ${this.#def?.render()} is above max ${this.#max?.asNumber()}`);
    if (this.defaultOutsideAllowed())
      this.#record(report, FD_E3, entity, artifact, this.#def?.render(), `"${label}": default "${this.#def?.render()}" is not one of the allowed values`);
  }
  checkReference(entities, report, entity, artifact) {
    const reference = this.#references;
    if (reference !== null && !entities.resolvesReference(reference))
      this.#record(report, FD_E6, entity, artifact, reference.asString(), `"${entity.asString()}.${this.#name.asString()}" references "${reference.asString()}" which is not a declared entity`, FindingKind.referenceBroken());
  }
  name() {
    return this.#name;
  }
  element() {
    return this.#element;
  }
  equals(other) {
    const optionalEqual = (left, right) => left === null ? right === null : right !== null && left.equals(right);
    const allowedEqual = this.#allowed === null ? other.#allowed === null : other.#allowed !== null && this.#allowed.toArray().length === other.#allowed.toArray().length && this.#allowed.toArray().every((value, index) => value.equals(other.#allowed?.toArray()[index]));
    const defaultsEqual = optionalEqual(this.#def, other.#def);
    const boundEqual = (left, right) => left === null ? right === null : right !== null && left.equals(right);
    return this.#name.equals(other.#name) && this.#element.equals(other.#element) && optionalEqual(this.#type, other.#type) && this.#uniqueIsTrue === other.#uniqueIsTrue && optionalEqual(this.#references, other.#references) && allowedEqual && defaultsEqual && this.#minDeclared === other.#minDeclared && this.#maxDeclared === other.#maxDeclared && boundEqual(this.#min, other.#min) && boundEqual(this.#max, other.#max);
  }
  hasAllowedValues() {
    return this.#allowed !== null;
  }
  typeToken() {
    return this.#type === null ? "" : this.#type.normalized();
  }
  typeText() {
    return this.#type === null ? "null" : this.#type.asString();
  }
  declaresAllowedValuesOnNonEnumerableType() {
    const t = this.#type;
    if (t === null || this.#allowed === null)
      return false;
    return t.classifiesNumeric() || t.classifiesDate() || t.classifiesBool();
  }
  declaresBoundsOnNonNumericType() {
    const t = this.#type;
    if (!(this.#minDeclared || this.#maxDeclared))
      return false;
    if (t === null || t.normalized() === "")
      return false;
    return !t.classifiesNumeric() && !t.classifiesDate();
  }
  declaresUniqueOnCollectionType() {
    return this.#uniqueIsTrue && (this.#type?.classifiesCollection() ?? false);
  }
  boundsInverted() {
    return this.#min !== null && this.#max !== null && this.#min.exceeds(this.#max);
  }
  defaultBelowMin() {
    const d = this.#def;
    return d !== null && this.#min !== null && d.belowBound(this.#min);
  }
  defaultAboveMax() {
    const d = this.#def;
    return d !== null && this.#max !== null && d.aboveBound(this.#max);
  }
  defaultOutsideAllowed() {
    const d = this.#def;
    if (this.#allowed === null || d === null || !d.isString())
      return false;
    return !this.#allowed.containsValue(d.asString());
  }
  bearsLifecycleName() {
    return this.#name.isLifecycleName();
  }
  rogueDiagramStates(states) {
    return this.#allowed === null ? [] : this.#allowed.rogueAmong(states);
  }
  allowedValuesAbsentFrom(states) {
    return this.#allowed === null ? [] : this.#allowed.absentFrom(states);
  }
}
// src/refcheck/domain/attribute-declarations.ts
class AttributeDeclarations extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-attribute-declarations");
  }
  rebuild(values) {
    return new AttributeDeclarations(values);
  }
  static parse(values) {
    return parseConstruction(() => new AttributeDeclarations(values));
  }
  static of(values) {
    return new AttributeDeclarations(values);
  }
  add(value) {
    return new AttributeDeclarations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  duplicatesByName() {
    const seen = new Set;
    const dups = [];
    for (const a of this.#values) {
      if (seen.has(a.name().asString()))
        dups.push(a);
      seen.add(a.name().asString());
    }
    return dups;
  }
  lifecycleAttr() {
    const named = this.#values.find((a) => a.bearsLifecycleName() && a.hasAllowedValues());
    if (named)
      return named;
    const withAllowed = this.#values.filter((a) => a.hasAllowedValues());
    return withAllowed.length === 1 ? withAllowed[0] ?? null : null;
  }
  named(name) {
    return this.#values.find((a) => a.name().equals(name)) ?? null;
  }
  names() {
    return this.#values.map((a) => a.name());
  }
  toArray() {
    return this.#values;
  }
}
// src/refcheck/domain/attribute-default.ts
class AttributeDefault {
  #value;
  constructor(value) {
    if (typeof value === "string" && value.length > 4096)
      throw new IllegalArgumentException({ kind: "attribute-default-too-long", raw: value.length });
    this.#value = value;
  }
  static parse(value) {
    return parseConstruction(() => new AttributeDefault(value));
  }
  static of(raw) {
    return new AttributeDefault(raw);
  }
  equals(other) {
    return this.#value === other.#value || Number.isNaN(this.#value) && Number.isNaN(other.#value);
  }
  isNumber() {
    return typeof this.#value === "number";
  }
  isString() {
    return typeof this.#value === "string";
  }
  asNumber() {
    return this.#value;
  }
  asString() {
    return String(this.#value);
  }
  render() {
    return String(this.#value);
  }
  belowBound(bound) {
    return typeof this.#value === "number" && this.#value < bound.asNumber();
  }
  aboveBound(bound) {
    return typeof this.#value === "number" && this.#value > bound.asNumber();
  }
}
// src/refcheck/domain/attribute-name.ts
class AttributeName {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "attribute-name-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new AttributeName(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new AttributeName(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
  normalized() {
    return NormalizedName.of(this.#value);
  }
  isLifecycleName() {
    return this.#value === "status" || this.#value === "state";
  }
  isEmpty() {
    return this.#value === "";
  }
}
// src/refcheck/domain/attribute-names.ts
class AttributeNames extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-attribute-names");
  }
  rebuild(values) {
    return new AttributeNames(values);
  }
  static parse(values) {
    return parseConstruction(() => new AttributeNames(values));
  }
  static of(values) {
    return new AttributeNames(values);
  }
  add(value) {
    return new AttributeNames([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  count() {
    return this.#values.length;
  }
  coversNormalized(name) {
    return this.#values.some((v) => v.normalized().equals(name.normalized()));
  }
  toArray() {
    return this.#values;
  }
}
// src/refcheck/domain/block-index.ts
class BlockIndex {
  #value;
  constructor(raw) {
    if (!Number.isSafeInteger(raw) || raw < 1)
      throw new IllegalArgumentException({ kind: "non-positive-location", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new BlockIndex(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new BlockIndex(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asNumber() {
    return this.#value;
  }
}
// src/refcheck/domain/business-rule-identifier.ts
class BusinessRuleIdentifier {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "business-rule-id-too-long", raw: raw.length });
    if (!/^BR[0-9]+\.[0-9]+$/.test(raw))
      throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new BusinessRuleIdentifier(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new BusinessRuleIdentifier(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
  matchesShape() {
    return /^BR[0-9]+\.[0-9]+$/.test(this.#value);
  }
}
// src/refcheck/domain/cardinality-notation.ts
var CARDINALITIES = new Set(["1:1", "1:N", "N:1", "N:M"]);

class CardinalityNotation {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "cardinality-notation-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new CardinalityNotation(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new CardinalityNotation(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
  normalizedToken() {
    return this.#value.toUpperCase().replace(/\s/g, "");
  }
  isInClosedSet() {
    return CARDINALITIES.has(this.normalizedToken());
  }
}
// src/refcheck/domain/catalog-version.ts
var CATALOG_VERSION = "1.0.0";
// src/refcheck/domain/component-check-families.ts
var DD_0 = CheckFamily.of("DD-0");
var DD_1 = CheckFamily.of("DD-1");
var DD_2 = CheckFamily.of("DD-2");
var DD_3 = CheckFamily.of("DD-3");
var DD_4 = CheckFamily.of("DD-4");
var DD_5 = CheckFamily.of("DD-5");
var DD_6 = CheckFamily.of("DD-6");
var DD_7 = CheckFamily.of("DD-7");
var COMPONENT_FAMILIES = CheckFamilies.of([DD_0, DD_1, DD_2, DD_3, DD_4, DD_5, DD_6, DD_7]);

// src/refcheck/domain/component.ts
class Component {
  #name;
  #element;
  #dependsOn;
  #dependents;
  #entities;
  constructor(props) {
    this.#name = props.name;
    this.#element = props.element;
    this.#dependsOn = props.dependsOn;
    this.#dependents = props.dependents;
    this.#entities = props.entities;
  }
  static of(props) {
    return new Component(props);
  }
  checkName(report, artifact) {
    const name = this.#name.asString();
    if (!this.nameIsPascalCase())
      report.finding(DD_1, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("component", name)), []), [WitnessReference.at(artifact.asString(), `${this.#element.asString()}.name`, name)], `component name "${name}" is not PascalCase`);
  }
  checkReferences(components, report, artifact) {
    for (const reference of [...this.#dependsOn, ...this.#dependents]) {
      if (!components.declares(reference.component()))
        report.finding(DD_2, FindingKind.referenceBroken(), FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("component", reference.component().asString())), []), [WitnessReference.at(artifact.asString(), reference.element().asString(), reference.component().asString())], `"${this.#name.asString()}" references undeclared component "${reference.component().asString()}"`);
    }
    for (const entity of this.#entities)
      entity.checkReferenceOwners(components, report, artifact);
  }
  checkSelfReferences(report, artifact) {
    for (const reference of this.selfReferences())
      report.finding(DD_3, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("component", this.#name.asString())), []), [WitnessReference.at(artifact.asString(), reference.element().asString(), this.#name.asString())], `component "${this.#name.asString()}" lists itself as a dependency`);
  }
  checkIdentifiers(report, artifact) {
    for (const entity of this.#entities)
      entity.checkIdentifier(report, artifact);
  }
  checkEntityReferences(components, report, artifact) {
    for (const entity of this.#entities)
      entity.checkReferenceTargets(components, report, artifact);
  }
  declaresEntity(name) {
    return this.#entities.declaresEntity(name);
  }
  name() {
    return this.#name;
  }
  element() {
    return this.#element;
  }
  equals(other) {
    const sameReferences = (left, right) => {
      const leftValues = left.toArray();
      const rightValues = right.toArray();
      return leftValues.length === rightValues.length && leftValues.every((value, index) => value.equals(rightValues[index]));
    };
    const sameEntities = (left, right) => {
      const leftValues = left.toArray();
      const rightValues = right.toArray();
      return leftValues.length === rightValues.length && leftValues.every((value, index) => value.equals(rightValues[index]));
    };
    return this.#name.equals(other.#name) && this.#element.equals(other.#element) && sameReferences(this.#dependsOn, other.#dependsOn) && sameReferences(this.#dependents, other.#dependents) && sameEntities(this.#entities, other.#entities);
  }
  dependsOn() {
    return this.#dependsOn;
  }
  dependents() {
    return this.#dependents;
  }
  entities() {
    return this.#entities;
  }
  nameIsPascalCase() {
    return /^[A-Z][A-Za-z0-9]*$/.test(this.#name.asString());
  }
  selfReferences() {
    return [...this.#dependsOn, ...this.#dependents].filter((r) => r.pointsAt(this.#name));
  }
}
// src/refcheck/domain/fence-count.ts
class FenceCount {
  #value;
  constructor(value) {
    if (!Number.isSafeInteger(value) || value < 0)
      throw new IllegalArgumentException({ kind: "invalid-fence-count", raw: value });
    this.#value = value;
  }
  static of(value) {
    return new FenceCount(value);
  }
  static parse(value) {
    return parseConstruction(() => new FenceCount(value));
  }
  asNumber() {
    return this.#value;
  }
}

// src/refcheck/domain/component-catalog-outcome.ts
class ComponentCatalogOutcome {
  #kind;
  #found;
  #line;
  #error;
  #components;
  #shapeErrors;
  constructor(props) {
    this.#kind = props.kind;
    this.#found = props.found;
    this.#line = props.line;
    this.#error = props.error;
    this.#components = props.components;
    this.#shapeErrors = props.shapeErrors;
  }
  static wrongFenceCount(found) {
    return new ComponentCatalogOutcome({
      kind: "wrong-fence-count",
      found,
      line: null,
      error: null,
      components: null,
      shapeErrors: null
    });
  }
  static unparseable(line, error) {
    return new ComponentCatalogOutcome({
      kind: "unparseable",
      found: FenceCount.of(0),
      line,
      error,
      components: null,
      shapeErrors: null
    });
  }
  static extracted(components, shapeErrors) {
    return new ComponentCatalogOutcome({
      kind: "extracted",
      found: FenceCount.of(0),
      line: null,
      error: null,
      components,
      shapeErrors
    });
  }
  match(handlers) {
    if (this.#kind === "wrong-fence-count")
      return handlers.wrongFenceCount(this.#found.asNumber());
    if (this.#kind === "unparseable" && this.#line !== null)
      return handlers.unparseable(this.#line, this.#error ?? "");
    if (this.#components === null || this.#shapeErrors === null)
      throw new Error("defect: an extracted component catalog carries no components");
    return handlers.extracted(this.#components, this.#shapeErrors);
  }
  check(report, artifact) {
    const art = artifact.asString();
    const usable = this.match({
      wrongFenceCount: (found) => {
        report.finding(DD_0, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(DD_0.asCheckTarget()), []), [WitnessReference.at(art, "yaml fence")], `components.md must carry exactly one fenced yaml source-of-truth block (found ${found})`);
        return null;
      },
      unparseable: (line, error) => {
        report.finding(DD_0, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(DD_0.asCheckTarget()), []), [WitnessReference.at(art, `yaml fence (line ${line.asNumber()})`)], `yaml block does not parse in the supported subset: ${error}`);
        return null;
      },
      extracted: (components, shapeErrors) => {
        for (const e of shapeErrors) {
          report.finding(DD_0, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(DD_0.asCheckTarget()), []), [WitnessReference.at(art, e.element().asString())], e.detail());
        }
        return shapeErrors.count() > 0 && components.count() === 0 ? null : components;
      }
    });
    if (usable === null) {
      for (const family of [DD_1, DD_2, DD_3, DD_4, DD_5, DD_6, DD_7]) {
        report.skip(family, "unrecognized-format", "blocked by DD-0: the yaml source-of-truth block is unusable");
      }
      return;
    }
    usable.check(report, artifact);
  }
}
// src/refcheck/domain/component-entities.ts
class ComponentEntities extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-component-entities");
  }
  rebuild(values) {
    return new ComponentEntities(values);
  }
  static parse(values) {
    return parseConstruction(() => new ComponentEntities(values));
  }
  static of(values) {
    return new ComponentEntities(values);
  }
  add(value) {
    return new ComponentEntities([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  declaresEntity(name) {
    return this.#values.some((e) => e.name().equals(name));
  }
  toArray() {
    return this.#values;
  }
}
// src/refcheck/domain/component-entity.ts
class ComponentEntity {
  #name;
  #element;
  #identifier;
  #references;
  constructor(props) {
    this.#name = props.name;
    this.#element = props.element;
    this.#identifier = props.identifier;
    this.#references = props.references;
  }
  static of(props) {
    return new ComponentEntity(props);
  }
  checkIdentifier(report, artifact) {
    if (!this.hasIdentifier())
      report.finding(DD_5, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("entity", this.#name.asString())), []), [WitnessReference.at(artifact.asString(), `${this.#element.asString()}.identifier`)], `entity "${this.#name.asString()}" has no identifier`);
  }
  checkReferenceOwners(components, report, artifact) {
    for (const reference of this.#references) {
      if (!components.declares(reference.ownedBy()))
        report.finding(DD_2, FindingKind.referenceBroken(), FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("component", reference.ownedBy().asString())), []), [
          WitnessReference.at(artifact.asString(), `${reference.element().asString()}.owned_by`, reference.ownedBy().asString())
        ], `entity "${this.#name.asString()}" references owner component "${reference.ownedBy().asString()}" which is not declared`);
    }
  }
  checkReferenceTargets(components, report, artifact) {
    for (const reference of this.#references) {
      const owner = components.byName(reference.ownedBy());
      if (owner !== null && !owner.declaresEntity(reference.entity()))
        report.finding(DD_6, FindingKind.referenceBroken(), FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("entity", reference.entity().asString())), []), [
          WitnessReference.at(artifact.asString(), `${reference.element().asString()}.entity`, reference.entity().asString())
        ], `entity "${this.#name.asString()}" references "${reference.entity().asString()}" as owned by "${reference.ownedBy().asString()}", but "${reference.ownedBy().asString()}" declares no such entity`);
    }
  }
  name() {
    return this.#name;
  }
  element() {
    return this.#element;
  }
  references() {
    return this.#references;
  }
  hasIdentifier() {
    return this.#identifier !== null;
  }
  equals(other) {
    const references = this.#references.toArray();
    const otherReferences = other.#references.toArray();
    const identifiersEqual = this.#identifier === null ? other.#identifier === null : other.#identifier !== null && this.#identifier.equals(other.#identifier);
    return this.#name.equals(other.#name) && this.#element.equals(other.#element) && identifiersEqual && references.length === otherReferences.length && references.every((reference, index) => reference.equals(otherReferences[index]));
  }
}
// src/refcheck/domain/component-name.ts
class ComponentName {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "component-name-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new ComponentName(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new ComponentName(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  compareTo(other) {
    return compareCanonically(this.#value, other.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/refcheck/domain/component-reference.ts
class ComponentReference {
  #component;
  #element;
  constructor(props) {
    this.#component = props.component;
    this.#element = props.element;
  }
  static of(props) {
    return new ComponentReference(props);
  }
  component() {
    return this.#component;
  }
  element() {
    return this.#element;
  }
  pointsAt(name) {
    return this.#component.equals(name);
  }
  equals(other) {
    return this.#component.equals(other.#component) && this.#element.equals(other.#element);
  }
}
// src/refcheck/domain/component-references.ts
class ComponentReferences extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-component-references");
  }
  rebuild(values) {
    return new ComponentReferences(values);
  }
  static parse(values) {
    return parseConstruction(() => new ComponentReferences(values));
  }
  static of(values) {
    return new ComponentReferences(values);
  }
  add(value) {
    return new ComponentReferences([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  listsComponent(name) {
    return this.#values.some((r) => r.component().equals(name));
  }
  toArray() {
    return this.#values;
  }
}
// src/refcheck/domain/component-shape-error.ts
class ComponentShapeError {
  #element;
  #detail;
  constructor(element, detail) {
    this.#element = element;
    this.#detail = detail;
  }
  static of(props) {
    return new ComponentShapeError(props.element, props.detail);
  }
  element() {
    return this.#element;
  }
  detail() {
    return this.#detail;
  }
  equals(other) {
    return this.#element.equals(other.#element) && this.#detail === other.#detail;
  }
}
// src/refcheck/domain/component-shape-errors.ts
class ComponentShapeErrors extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-component-shape-errors");
  }
  rebuild(values) {
    return new ComponentShapeErrors(values);
  }
  static parse(values) {
    return parseConstruction(() => new ComponentShapeErrors(values));
  }
  static of(values) {
    return new ComponentShapeErrors(values);
  }
  add(value) {
    return new ComponentShapeErrors([...this.#values, value]);
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
// src/refcheck/domain/entity-name.ts
class EntityName {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "entity-name-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new EntityName(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new EntityName(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
  normalized() {
    return NormalizedName.of(this.#value);
  }
}

// src/refcheck/domain/components.ts
class Components extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-components");
  }
  rebuild(values) {
    return new Components(values);
  }
  static parse(values) {
    return parseConstruction(() => new Components(values));
  }
  static of(values) {
    return new Components(values);
  }
  add(value) {
    return new Components([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  count() {
    return this.#values.length;
  }
  declares(name) {
    return this.#values.some((c) => c.name().equals(name));
  }
  duplicateNamePairs() {
    const seen = new Map;
    const pairs = [];
    for (const c of this.#values) {
      const prior = seen.get(c.name().asString());
      if (prior)
        pairs.push({ prior, current: c });
      seen.set(c.name().asString(), c);
    }
    return pairs;
  }
  byName(name) {
    let found = null;
    for (const c of this.#values) {
      if (c.name().equals(name))
        found = c;
    }
    return found;
  }
  ownershipConflicts() {
    const owners = new Map;
    for (const c of this.#values) {
      for (const e of c.entities()) {
        const list = owners.get(e.name().asString()) ?? [];
        list.push({ component: c, entity: e });
        owners.set(e.name().asString(), list);
      }
    }
    return [...owners.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).filter(([, list]) => list.length > 1).map(([name, list]) => ({ name: EntityName.of(name), owners: list }));
  }
  dependencyCycles() {
    const declared = new Set(this.#values.map((c) => c.name().asString()));
    const adj = new Map;
    for (const c of [...this.#values].sort((a, b) => a.name().asString() < b.name().asString() ? -1 : 1)) {
      const deps = c.dependsOn().toArray().map((d) => d.component()).filter((n) => declared.has(n.asString())).sort((a, b) => a.compareTo(b));
      const names = [];
      for (const n of deps)
        if (!names.includes(n.asString()))
          names.push(n.asString());
      adj.set(c.name().asString(), names);
    }
    const cycles = new Map;
    const state = new Map;
    const stack = [];
    const visit = (node) => {
      state.set(node, "active");
      stack.push(node);
      for (const next of adj.get(node) ?? []) {
        const s = state.get(next);
        if (s === "done")
          continue;
        if (s === "active") {
          const from = stack.indexOf(next);
          const cycle = stack.slice(from);
          let minIdx = 0;
          cycle.forEach((n, i) => {
            if (n < (cycle[minIdx] ?? ""))
              minIdx = i;
          });
          const canonical = [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)];
          cycles.set(canonical.join("->"), canonical);
          continue;
        }
        visit(next);
      }
      stack.pop();
      state.set(node, "done");
    };
    for (const name of [...adj.keys()]) {
      if (!state.has(name))
        visit(name);
    }
    return [...cycles.keys()].sort().map((k) => cycles.get(k));
  }
  toArray() {
    return this.#values;
  }
  check(report, artifact) {
    for (const component of this.#values)
      component.checkName(report, artifact);
    this.#checkDuplicateNames(report, artifact);
    for (const component of this.#values)
      component.checkReferences(this, report, artifact);
    for (const component of this.#values)
      component.checkSelfReferences(report, artifact);
    this.#checkSymmetry(report, artifact);
    for (const component of this.#values)
      component.checkIdentifiers(report, artifact);
    this.#checkOwnership(report, artifact);
    for (const component of this.#values)
      component.checkEntityReferences(this, report, artifact);
    this.#checkCycles(report, artifact);
  }
  #checkDuplicateNames(report, artifact) {
    const art = artifact.asString();
    for (const { prior, current } of this.duplicateNamePairs()) {
      const cName = current.name().asString();
      report.finding(DD_1, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("component", cName)), []), [
        WitnessReference.at(art, `${prior.element().asString()}.name`, cName),
        WitnessReference.at(art, `${current.element().asString()}.name`, cName)
      ], `component name "${cName}" is declared more than once`);
    }
  }
  #checkSymmetry(report, artifact) {
    const art = artifact.asString();
    for (const c of this) {
      for (const r of c.dependsOn()) {
        const other = this.byName(r.component());
        if (!other || r.pointsAt(c.name()))
          continue;
        if (!other.dependents().listsComponent(c.name())) {
          report.finding(DD_4, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("component", c.name().asString())), [
            TargetIdentifier.of(TargetIdentifiers.safe("component", r.component().asString()))
          ]), [
            WitnessReference.at(art, r.element().asString(), r.component().asString()),
            WitnessReference.at(art, `${other.element().asString()}.dependents`, c.name().asString())
          ], `"${c.name().asString()}" depends on "${r.component().asString()}" but "${r.component().asString()}" does not list "${c.name().asString()}" in dependents`);
        }
      }
      for (const r of c.dependents()) {
        const other = this.byName(r.component());
        if (!other || r.pointsAt(c.name()))
          continue;
        if (!other.dependsOn().listsComponent(c.name())) {
          report.finding(DD_4, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("component", c.name().asString())), [
            TargetIdentifier.of(TargetIdentifiers.safe("component", r.component().asString()))
          ]), [
            WitnessReference.at(art, r.element().asString(), r.component().asString()),
            WitnessReference.at(art, `${other.element().asString()}.depends_on`, c.name().asString())
          ], `"${c.name().asString()}" lists "${r.component().asString()}" as a dependent but "${r.component().asString()}" does not depend on "${c.name().asString()}"`);
        }
      }
    }
  }
  #checkOwnership(report, artifact) {
    const art = artifact.asString();
    for (const conflict of this.ownershipConflicts()) {
      const name = conflict.name.asString();
      report.finding(DD_5, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("entity", name)), []), conflict.owners.map((o) => WitnessReference.at(art, o.entity.element().asString(), o.component.name().asString())), `entity "${name}" is owned by ${conflict.owners.length} components (${conflict.owners.map((o) => o.component.name().asString()).join(", ")}) \u2014 must be exactly one`);
    }
  }
  #checkCycles(report, artifact) {
    const art = artifact.asString();
    for (const cycle of this.dependencyCycles()) {
      const [head, ...tail] = cycle;
      if (head === undefined || tail.length === 0)
        continue;
      report.finding(DD_7, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("component", head)), tail.map((name) => TargetIdentifier.of(TargetIdentifiers.safe("component", name)))), cycle.map((n, i) => WitnessReference.at(art, `${this.byName(ComponentName.of(n))?.element().asString() ?? "components"}.depends_on`, cycle[(i + 1) % cycle.length])), `dependency cycle: ${[...cycle, cycle[0]].join(" -> ")}`);
    }
  }
}
// src/refcheck/domain/contract-identifier.ts
class ContractIdentifier {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "contract-id-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-contract-id", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new ContractIdentifier(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new ContractIdentifier(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
}
// src/refcheck/domain/contract-party.ts
class ContractParty {
  #value;
  constructor(value) {
    if (value.length > 4096)
      throw new IllegalArgumentException({ kind: "contract-party-too-long", raw: value.length });
    this.#value = value.replace(/[`*]/g, "").trim();
  }
  static parse(value) {
    return parseConstruction(() => new ContractParty(value));
  }
  static of(raw) {
    return new ContractParty(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
  isBlank() {
    return this.#value === "";
  }
  declaresExternal() {
    return /^external\b/i.test(this.#value);
  }
}
// src/refcheck/domain/contract-check-families.ts
var CD_1 = CheckFamily.of("CD-1");
var CD_2 = CheckFamily.of("CD-2");
var CD_3 = CheckFamily.of("CD-3");
var CONTRACT_FAMILIES = CheckFamilies.of([CD_1, CD_2, CD_3]);

// src/refcheck/domain/contract-row.ts
class ContractRow {
  #id;
  #provider;
  #consumer;
  #owner;
  #line;
  constructor(props) {
    this.#id = props.id;
    this.#provider = props.provider;
    this.#consumer = props.consumer;
    this.#owner = props.owner;
    this.#line = props.line;
  }
  static of(props) {
    return new ContractRow(props);
  }
  id() {
    return this.#id;
  }
  equals(other) {
    return this.#id.equals(other.#id) && this.#provider.equals(other.#provider) && this.#consumer.equals(other.#consumer) && this.#owner.equals(other.#owner) && this.#line.equals(other.#line);
  }
  connects(from, to) {
    return this.#provider.asString() === from && this.#consumer.asString() === to || this.#consumer.asString() === from && this.#provider.asString() === to;
  }
  locationLabel() {
    return `contracts table row ${this.#id.asString()} (line ${this.#line.asNumber()})`;
  }
  checkPartiesDeclared(declared, report, artifact, depArtifact) {
    const art = artifact.asString();
    const depArt = depArtifact.asString();
    const el = this.locationLabel();
    if (!this.#provider.isBlank() && !declared.declares(this.#provider.asString())) {
      report.finding(CD_1, FindingKind.referenceBroken(), FindingTargets.of(TargetIdentifier.of(`contract:${this.#id.asString()}`), [
        TargetIdentifier.of(TargetIdentifiers.safe("unit", this.#provider.asString()))
      ]), [WitnessReference.at(art, el, this.#provider.asString()), WitnessReference.at(depArt, "units")], `Provider Unit "${this.#provider.asString()}" is not a declared unit`);
    }
    if (!this.#consumer.isBlank() && !declared.declares(this.#consumer.asString()) && !this.#consumer.declaresExternal()) {
      report.finding(CD_1, FindingKind.referenceBroken(), FindingTargets.of(TargetIdentifier.of(`contract:${this.#id.asString()}`), [
        TargetIdentifier.of(TargetIdentifiers.safe("unit", this.#consumer.asString()))
      ]), [WitnessReference.at(art, el, this.#consumer.asString()), WitnessReference.at(depArt, "units")], `Consumer "${this.#consumer.asString()}" is neither a declared unit nor \`External: \u2026\``);
    }
    if (!this.#owner.isBlank() && !declared.declares(this.#owner.asString())) {
      report.finding(CD_1, FindingKind.referenceBroken(), FindingTargets.of(TargetIdentifier.of(`contract:${this.#id.asString()}`), [
        TargetIdentifier.of(TargetIdentifiers.safe("unit", this.#owner.asString()))
      ]), [WitnessReference.at(art, el, this.#owner.asString()), WitnessReference.at(depArt, "units")], `Owner "${this.#owner.asString()}" is not a declared unit`);
    }
  }
}
// src/refcheck/domain/contract-rows.ts
class ContractRows extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-contract-rows");
  }
  rebuild(values) {
    return new ContractRows(values);
  }
  static parse(values) {
    return parseConstruction(() => new ContractRows(values));
  }
  static of(values) {
    return new ContractRows(values);
  }
  add(value) {
    return new ContractRows([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  coversEdge(from, to) {
    return this.#values.some((r) => r.connects(from, to));
  }
  toArray() {
    return this.#values;
  }
  checkPartiesDeclared(declared, report, artifact, depArtifact) {
    for (const row of this) {
      row.checkPartiesDeclared(declared, report, artifact, depArtifact);
    }
  }
}
// src/refcheck/domain/contracts-table-outcome.ts
class ContractsTableOutcome {
  #rows;
  #error;
  constructor(rows, error) {
    this.#rows = rows;
    this.#error = error;
  }
  static absent() {
    return new ContractsTableOutcome(null, null);
  }
  static rows(rows) {
    return new ContractsTableOutcome(rows, null);
  }
  static unparseable(error) {
    return new ContractsTableOutcome(null, error);
  }
  match(handlers) {
    if (this.#error !== null)
      return handlers.unparseable(this.#error);
    return this.#rows === null ? handlers.absent() : handlers.rows(this.#rows);
  }
  check(report, units, artifact, depArtifact) {
    return this.match({
      unparseable: (error) => {
        report.skip(CD_1, "unrecognized-format", error.asString());
        report.skip(CD_3, "unrecognized-format", error.asString());
        return null;
      },
      absent: () => {
        if (units !== null)
          report.skip(CD_1, "unrecognized-format", "no markdown table with a Provider column found");
        report.skip(CD_3, "unrecognized-format", "no contracts table \u2014 DAG edge coverage cannot be checked");
        return null;
      },
      rows: (tableRows) => {
        if (units !== null)
          tableRows.checkPartiesDeclared(units, report, artifact, depArtifact);
        return tableRows;
      }
    });
  }
}
// src/refcheck/domain/declared-entities.ts
class DeclaredEntities {
  #entities;
  #rels;
  #shapeErrors;
  constructor(seed) {
    this.#entities = seed.entities;
    this.#rels = seed.rels;
    this.#shapeErrors = seed.shapeErrors;
  }
  static of(seed) {
    return new DeclaredEntities(seed);
  }
  entities() {
    return this.#entities;
  }
  allRels() {
    let all = this.#rels;
    for (const e of this.#entities)
      all = all.concat(e.rels());
    return all;
  }
  check(report, artifact) {
    for (const error of this.#shapeErrors)
      error.recordIn(FD_E1, report, artifact);
    this.#entities.checkDuplicates(report, artifact);
    for (const entity of this.#entities)
      entity.checkDuplicateAttributes(report, artifact);
    for (const entity of this.#entities)
      entity.checkAttributes(this.#entities, report, artifact);
    for (const relationship of this.allRels())
      relationship.checkAgainst(this.#entities, report, artifact);
  }
}
// src/refcheck/domain/declared-rule-identifier.ts
class DeclaredRuleIdentifier {
  #value;
  constructor(value) {
    if (value.length > 128)
      throw new IllegalArgumentException({ kind: "declared-rule-id-too-long", raw: value.length });
    this.#value = value;
  }
  static parse(value) {
    return parseConstruction(() => new DeclaredRuleIdentifier(value));
  }
  static of(value) {
    return new DeclaredRuleIdentifier(value);
  }
  asString() {
    return this.#value;
  }
  matchesShape() {
    return BusinessRuleIdentifier.parse(this.#value).ok;
  }
}
// src/refcheck/domain/declared-units-outcome.ts
class DeclaredUnitsOutcome {
  #kind;
  #error;
  #units;
  constructor(kind, error, units) {
    this.#kind = kind;
    this.#error = error;
    this.#units = units;
  }
  static absent() {
    return new DeclaredUnitsOutcome("absent", undefined, null);
  }
  static unrecognized(error) {
    return new DeclaredUnitsOutcome("unrecognized", error, null);
  }
  static declared(units) {
    return new DeclaredUnitsOutcome("declared", undefined, units);
  }
  match(handlers) {
    if (this.#kind === "absent")
      return handlers.absent();
    if (this.#kind === "unrecognized" || this.#units === null)
      return handlers.unrecognized(this.#error);
    return handlers.declared(this.#units);
  }
  check(report) {
    return this.match({
      absent: () => {
        report.skip(CD_1, "absent-input", "unit-of-work-dependency.md is not present under this intent record \u2014 declared units are unknown");
        report.skip(CD_3, "absent-input", "unit-of-work-dependency.md is not present under this intent record \u2014 the unit dependency DAG is unknown");
        return null;
      },
      unrecognized: (error) => {
        report.skip(CD_1, "unrecognized-format", `unit-of-work-dependency.md carries no parseable \`units:\` edge block${error ? ` (${error})` : ""}`);
        report.skip(CD_3, "unrecognized-format", "blocked: the units edge block is unusable");
        return null;
      },
      declared: (declaredUnits) => declaredUnits
    });
  }
}
// src/refcheck/domain/domain-entities-outcome.ts
class DomainEntitiesOutcome {
  #kind;
  #error;
  #entities;
  constructor(kind, error, entities) {
    this.#kind = kind;
    this.#error = error;
    this.#entities = entities;
  }
  static absent() {
    return new DomainEntitiesOutcome("absent", null, null);
  }
  static unusable(error) {
    return new DomainEntitiesOutcome("unusable", error, null);
  }
  static extracted(entities) {
    return new DomainEntitiesOutcome("extracted", null, entities);
  }
  isExtracted() {
    return this.#kind === "extracted";
  }
  match(handlers) {
    if (this.#kind === "absent")
      return handlers.absent();
    if (this.#kind === "unusable" || this.#entities === null)
      return handlers.unusable(this.#error ?? "");
    return handlers.extracted(this.#entities);
  }
  check(report, componentsArtifact, siblingUnits, unit) {
    this.match({
      absent: () => {
        for (const f of [XS_1, XS_2, XS_3]) {
          report.skip(f, "absent-input", "domain-design components.md is not present under this intent record");
        }
      },
      unusable: (error) => {
        for (const f of [XS_1, XS_2, XS_3]) {
          report.skip(f, "unrecognized-format", `components.md yaml block is unusable (${error})`);
        }
      },
      extracted: (domainEntities) => {
        if (!siblingUnits.ok) {
          for (const family of [XS_1, XS_2, XS_3])
            report.skip(family, "unrecognized-format", `sibling unit index is unusable (${siblingUnits.error.kind})`);
          return;
        }
        domainEntities.check(report, componentsArtifact, siblingUnits.value, unit);
      }
    });
  }
}

// src/refcheck/domain/entities-outcome.ts
class EntitiesOutcome {
  #kind;
  #found;
  #line;
  #error;
  #model;
  constructor(props) {
    this.#kind = props.kind;
    this.#found = props.found;
    this.#line = props.line;
    this.#error = props.error;
    this.#model = props.model;
  }
  static absent() {
    return new EntitiesOutcome({ kind: "absent", found: FenceCount.of(0), line: null, error: null, model: null });
  }
  static wrongFenceCount(found) {
    return new EntitiesOutcome({ kind: "wrong-fence-count", found, line: null, error: null, model: null });
  }
  static unparseable(line, error) {
    return new EntitiesOutcome({ kind: "unparseable", found: FenceCount.of(0), line, error, model: null });
  }
  static extracted(model) {
    return new EntitiesOutcome({ kind: "extracted", found: FenceCount.of(0), line: null, error: null, model });
  }
  match(handlers) {
    if (this.#kind === "absent")
      return handlers.absent();
    if (this.#kind === "wrong-fence-count")
      return handlers.wrongFenceCount(this.#found.asNumber());
    if (this.#kind === "unparseable" && this.#line !== null)
      return handlers.unparseable(this.#line, this.#error ?? "");
    if (this.#model === null)
      throw new Error("defect: an extracted entities document carries no model");
    return handlers.extracted(this.#model);
  }
  check(report, artifact) {
    const art = artifact.asString();
    return this.match({
      absent: () => {
        for (const f of [FD_E1, FD_E2, FD_E3, FD_E4, FD_E5, FD_E6]) {
          report.skip(f, "absent-input", "entities.md is not present in this unit's functional-design record");
        }
        return null;
      },
      wrongFenceCount: (found) => {
        report.finding(FD_E1, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(FD_E1.asCheckTarget()), []), [WitnessReference.at(art, "yaml fence")], `entities.md must carry exactly one fenced yaml source-of-truth block (found ${found})`);
        for (const f of [FD_E2, FD_E3, FD_E4, FD_E5, FD_E6]) {
          report.skip(f, "unrecognized-format", "blocked by FD-E1: the entities yaml block is unusable");
        }
        return null;
      },
      unparseable: (line, error) => {
        report.finding(FD_E1, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(FD_E1.asCheckTarget()), []), [WitnessReference.at(art, `yaml fence (line ${line.asNumber()})`)], `yaml block does not parse in the supported subset: ${error}`);
        for (const f of [FD_E2, FD_E3, FD_E4, FD_E5, FD_E6]) {
          report.skip(f, "unrecognized-format", "blocked by FD-E1: the entities yaml block is unusable");
        }
        return null;
      },
      extracted: (model) => {
        model.check(report, artifact);
        return model;
      }
    });
  }
}

// src/refcheck/domain/functional-specification-outcome.ts
class FunctionalSpecificationOutcome {
  #machines;
  constructor(machines) {
    this.#machines = machines;
  }
  static absent() {
    return new FunctionalSpecificationOutcome(null);
  }
  static present(machines) {
    return new FunctionalSpecificationOutcome(machines);
  }
  match(handlers) {
    return this.#machines === null ? handlers.absent() : handlers.present(this.#machines);
  }
  check(report, specArtifact, entitiesArtifact, entities) {
    this.match({
      absent: () => {
        report.skip(FD_S1, "absent-input", "functional-spec.md is not present in this unit's functional-design record");
        report.skip(FD_S2, "absent-input", "functional-spec.md is not present in this unit's functional-design record");
      },
      present: (machines) => {
        if (entities === null) {
          report.skip(FD_S1, "absent-input", "entities.md is unavailable \u2014 state machines cannot be checked against allowed values");
          report.skip(FD_S2, "absent-input", "entities.md is unavailable \u2014 state machines cannot be checked against allowed values");
          return;
        }
        machines.check(report, specArtifact, entitiesArtifact, entities);
      }
    });
  }
}

// src/refcheck/domain/finding.ts
class Finding {
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
    this.#witness = props.witness.refs;
    this.#unit = props.unit;
    this.#detail = props.detail;
  }
  static of(props) {
    return new Finding(props);
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
  witnessRefs() {
    return this.#witness;
  }
  unit() {
    return this.#unit?.asString();
  }
  detail() {
    return this.#detail;
  }
  equals(other) {
    const sameValues = (left, right) => left.length === right.length && left.every((value, index) => value.equals(right[index]));
    const unitsEqual = this.#unit === undefined ? other.#unit === undefined : other.#unit !== undefined && this.#unit.equals(other.#unit);
    return this.#kind.equals(other.#kind) && sameValues(this.#functionalRequirementReferences.toArray(), other.#functionalRequirementReferences.toArray()) && sameValues(this.#targets.toArray(), other.#targets.toArray()) && sameValues(this.#witness.toArray(), other.#witness.toArray()) && unitsEqual && this.#detail === other.#detail;
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

// src/refcheck/domain/findings.ts
class Findings extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-findings");
  }
  rebuild(values) {
    return new Findings(values);
  }
  static parse(values) {
    return parseConstruction(() => new Findings(values));
  }
  static of(values) {
    return new Findings(values);
  }
  add(value) {
    return new Findings([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  count() {
    return this.#values.length;
  }
  sortedCanonically() {
    return new Findings([...this.#values].sort((a, b) => a.compareTo(b)));
  }
  toArray() {
    return this.#values;
  }
}

// src/refcheck/domain/input-anchors.ts
class InputAnchors extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-input-anchors");
  }
  rebuild(values) {
    return new InputAnchors(values);
  }
  static parse(values) {
    return parseConstruction(() => new InputAnchors(values));
  }
  static of(values) {
    return new InputAnchors(values);
  }
  add(value) {
    return new InputAnchors([...this.#values, value]);
  }
  addAll(values) {
    return new InputAnchors([...this.#values, ...values]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  sortedByArtifact() {
    return new InputAnchors([...this.#values].sort((a, b) => a.compareByArtifact(b)));
  }
  toArray() {
    return this.#values;
  }
}

// src/refcheck/domain/skipped.ts
class Skipped {
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
    return new Skipped(props);
  }
  target() {
    return this.#target.asString();
  }
  reason() {
    return this.#reason.asString();
  }
  unit() {
    return this.#unit?.asString();
  }
  detail() {
    return this.#detail;
  }
  equals(other) {
    return this.#target.equals(other.#target) && this.#reason.asString() === other.#reason.asString() && (this.#unit === undefined ? other.#unit === undefined : other.#unit !== undefined && this.#unit.equals(other.#unit)) && this.#detail === other.#detail;
  }
  compareTo(other) {
    const c = this.#target.compareTo(other.#target);
    if (c !== 0)
      return c;
    return this.#reason.compareTo(other.#reason);
  }
}

// src/refcheck/domain/skips.ts
class Skips extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-skips");
  }
  rebuild(values) {
    return new Skips(values);
  }
  static parse(values) {
    return parseConstruction(() => new Skips(values));
  }
  static of(values) {
    return new Skips(values);
  }
  add(value) {
    return new Skips([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  count() {
    return this.#values.length;
  }
  sortedCanonically() {
    return new Skips([...this.#values].sort((a, b) => a.compareTo(b)));
  }
  toArray() {
    return this.#values;
  }
}

// src/refcheck/domain/witness-references.ts
class WitnessReferences extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-witness-references");
  }
  rebuild(values) {
    return new WitnessReferences(values);
  }
  static parse(values) {
    return parseConstruction(() => new WitnessReferences(values));
  }
  static of(values) {
    return new WitnessReferences(values);
  }
  add(value) {
    return new WitnessReferences([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}

// src/refcheck/domain/reference-check-report.ts
class ReferenceCheckReport {
  #id;
  #inputs;
  #checked;
  #findings;
  #skipped;
  #unavailableReason;
  #unit;
  constructor(id, inputs, checked, findings, skipped, unavailableReason, unit) {
    this.#id = id;
    this.#inputs = inputs;
    this.#checked = checked;
    this.#findings = findings;
    this.#skipped = skipped;
    this.#unavailableReason = unavailableReason;
    this.#unit = unit;
  }
  static open(id, families, unit) {
    return new ReferenceCheckReport(id, InputAnchors.of([]), families.checkTargets().sortedUniqueCanonically(), Findings.of([]), Skips.of([]), null, unit);
  }
  degraded(reason) {
    return new ReferenceCheckReport(this.#id, this.#inputs, TargetIdentifiers.of([]), Findings.of([]), Skips.of([]), reason, undefined);
  }
  static of(seed) {
    return new ReferenceCheckReport(seed.id, seed.inputs, seed.checked, seed.findings, seed.skipped, seed.unavailableReason, undefined);
  }
  finding(family, kind, targets, refs, detail, functionalRequirementReferences = []) {
    this.#findings = this.#findings.add(Finding.of({
      kind,
      functionalRequirementReferences: FunctionalRequirementReferences.of(Array.from(functionalRequirementReferences, (raw) => RequirementIdentifier.of(raw))).sortedUnique(),
      targets: targets.sortedUniqueCanonically(),
      witness: { refs: WitnessReferences.of(refs) },
      detail: family.prefixedDetail(detail),
      ...this.#unit !== undefined ? { unit: this.#unit } : {}
    })).sortedCanonically();
    this.#checked = this.#checked.excluding(TargetIdentifier.of(family.asCheckTarget()));
  }
  skip(family, reason, detail) {
    this.#skipped = this.#skipped.add(Skipped.of({
      target: TargetIdentifier.of(family.asCheckTarget()),
      reason: SkipReason.of(reason),
      detail,
      ...this.#unit !== undefined ? { unit: this.#unit } : {}
    })).sortedCanonically();
    this.#checked = this.#checked.excluding(TargetIdentifier.of(family.asCheckTarget()));
  }
  input(anchor) {
    this.#inputs = this.#inputs.add(anchor).sortedByArtifact();
  }
  id() {
    return this.#id;
  }
  inputs() {
    return this.#inputs;
  }
  checked() {
    return this.#checked;
  }
  findings() {
    return this.#findings;
  }
  skipped() {
    return this.#skipped;
  }
  unavailableReason() {
    return this.#unavailableReason;
  }
  isUnavailable() {
    return this.#unavailableReason !== null;
  }
  findingsCount() {
    return this.#findings.count();
  }
  skippedCount() {
    return this.#skipped.count();
  }
  passes() {
    return this.#unavailableReason === null && this.#findings.isEmpty();
  }
  toDocument() {
    const inputs = this.#inputs.toArray().map((i) => ({ artifact: i.artifact(), sha256: i.sha256().asString() }));
    const ordered = {
      backend: this.#id.backendName().asString(),
      irVersion: CATALOG_VERSION,
      irHash: ContentHash.ofText(canonicalStringify(inputs)).asString(),
      method: "static"
    };
    const reason = this.#unavailableReason;
    if (reason !== null)
      ordered.unavailable = { reason };
    ordered.inputs = inputs;
    ordered.checked = this.#checked.toStrings();
    ordered.findings = this.#findings.toArray().map((f) => {
      const refs = f.witnessRefs().toArray().map((r) => {
        const out2 = { artifact: r.artifact(), element: r.element() };
        const value = r.value();
        if (value !== undefined)
          out2.value = value;
        return out2;
      });
      const out = {
        kind: f.kind(),
        frRefs: f.functionalRequirementReferences().toStrings(),
        targets: f.targets().toStrings(),
        witness: { refs },
        detail: f.detail()
      };
      const unit = f.unit();
      if (unit !== undefined)
        out.unit = unit;
      return out;
    });
    ordered.skipped = this.#skipped.toArray().map((sk) => {
      const out = { target: sk.target(), reason: sk.reason() };
      const detail = sk.detail();
      if (detail !== undefined)
        out.detail = detail;
      const unit = sk.unit();
      if (unit !== undefined)
        out.unit = unit;
      return out;
    });
    return ordered;
  }
  conformedTo(schema) {
    const reason = schema.degradationReasonFor(this.toDocument());
    return reason === null ? this : this.degraded(reason);
  }
}

// src/refcheck/domain/reference-check-report-identifier.ts
class ReferenceCheckReportIdentifier {
  #directory;
  #backend;
  constructor(directory, backend) {
    this.#directory = directory;
    this.#backend = backend;
  }
  static of(directory, backend) {
    return new ReferenceCheckReportIdentifier(directory, BackendName.of(backend));
  }
  equals(other) {
    return this.#directory.equals(other.#directory) && this.#backend.equals(other.#backend);
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

// src/refcheck/domain/rules-outcome.ts
class RulesOutcome {
  #kind;
  #found;
  #line;
  #error;
  #rules;
  constructor(props) {
    this.#kind = props.kind;
    this.#found = props.found;
    this.#line = props.line;
    this.#error = props.error;
    this.#rules = props.rules;
  }
  static absent() {
    return new RulesOutcome({ kind: "absent", found: FenceCount.of(0), line: null, error: null, rules: null });
  }
  static wrongFenceCount(found) {
    return new RulesOutcome({ kind: "wrong-fence-count", found, line: null, error: null, rules: null });
  }
  static unparseable(line, error) {
    return new RulesOutcome({ kind: "unparseable", found: FenceCount.of(0), line, error, rules: null });
  }
  static noRulesList() {
    return new RulesOutcome({ kind: "no-rules-list", found: FenceCount.of(0), line: null, error: null, rules: null });
  }
  static extracted(rules) {
    return new RulesOutcome({ kind: "extracted", found: FenceCount.of(0), line: null, error: null, rules });
  }
  isExtracted() {
    return this.#kind === "extracted";
  }
  match(handlers) {
    if (this.#kind === "absent")
      return handlers.absent();
    if (this.#kind === "wrong-fence-count")
      return handlers.wrongFenceCount(this.#found.asNumber());
    if (this.#kind === "unparseable" && this.#line !== null)
      return handlers.unparseable(this.#line, this.#error ?? "");
    if (this.#kind === "no-rules-list")
      return handlers.noRulesList();
    if (this.#rules === null)
      throw new Error("defect: an extracted rules document carries no rules");
    return handlers.extracted(this.#rules);
  }
  check(report, artifact, requirementIdsKnown, entities) {
    const art = artifact.asString();
    const blockRs = (why) => {
      for (const f of [FD_R2, FD_R3, FD_R4, FD_R5])
        report.skip(f, "unrecognized-format", why);
    };
    this.match({
      absent: () => {
        for (const f of [FD_R1, FD_R2, FD_R3, FD_R4, FD_R5]) {
          report.skip(f, "absent-input", "rules.md is not present in this unit's functional-design record");
        }
      },
      wrongFenceCount: (found) => {
        report.finding(FD_R1, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(FD_R1.asCheckTarget()), []), [WitnessReference.at(art, "yaml fence")], `rules.md must carry exactly one fenced yaml source-of-truth block (found ${found})`);
        blockRs("blocked by FD-R1: the rules yaml block is unusable");
      },
      unparseable: (line, error) => {
        report.finding(FD_R1, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(FD_R1.asCheckTarget()), []), [WitnessReference.at(art, `yaml fence (line ${line.asNumber()})`)], `yaml block does not parse in the supported subset: ${error}`);
        blockRs("blocked by FD-R1: the rules yaml block is unusable");
      },
      noRulesList: () => {
        report.finding(FD_R1, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(FD_R1.asCheckTarget()), []), [WitnessReference.at(art, "rules")], "top-level `rules:` list is missing");
        blockRs("blocked by FD-R1: the rules yaml block is unusable");
      },
      extracted: (ruleDecls) => {
        ruleDecls.check(report, artifact, requirementIdsKnown, entities);
      }
    });
  }
}

// src/refcheck/domain/design-record.ts
class DesignRecord {
  #id;
  #target;
  #sourceDocument;
  #componentCatalog;
  #contractSummary;
  #functional;
  constructor(seed) {
    this.#id = seed.id;
    this.#target = seed.target;
    this.#sourceDocument = seed.sourceDocument;
    this.#componentCatalog = seed.componentCatalog;
    this.#contractSummary = seed.contractSummary;
    this.#functional = seed.functional;
  }
  static of(seed) {
    return new DesignRecord(seed);
  }
  id() {
    return this.#id;
  }
  sourceDocument() {
    return new Uint8Array(this.#sourceDocument);
  }
  checkComponents(reportDirectory) {
    const catalog = this.#componentCatalog;
    if (catalog === null)
      return err({ kind: "not-applicable" });
    const report = ReferenceCheckReport.open(ReferenceCheckReportIdentifier.of(reportDirectory, "components"), COMPONENT_FAMILIES);
    catalog.check(report, ArtifactPath.of(this.#target.artifact()));
    report.input(this.#target);
    return ok(report);
  }
  checkContracts(reportDirectory) {
    const summary = this.#contractSummary;
    if (summary === null)
      return err({ kind: "not-applicable" });
    const report = ReferenceCheckReport.open(ReferenceCheckReportIdentifier.of(reportDirectory, "contract-summary"), CONTRACT_FAMILIES);
    const artifact = ArtifactPath.of(this.#target.artifact());
    const depArtifact = summary.declaredUnits.artifactName;
    const units = (summary.declaredUnits.document === null ? DeclaredUnitsOutcome.absent() : summary.declaredUnits.document.outcome).check(report);
    const rows = summary.contractsTable.check(report, units, artifact, depArtifact);
    summary.specBlocks.check(report, artifact);
    if (units !== null && rows !== null)
      units.checkEdgesCovered(rows, report, artifact, depArtifact);
    report.input(this.#target);
    if (summary.declaredUnits.document !== null)
      report.input(summary.declaredUnits.document.input);
    return ok(report);
  }
  checkFunctionalDesign(reportDirectory) {
    const fd = this.#functional;
    if (fd === null)
      return err({ kind: "not-applicable" });
    const report = ReferenceCheckReport.open(ReferenceCheckReportIdentifier.of(reportDirectory, "functional-design"), FUNCTIONAL_FAMILIES, fd.unit);
    const entities = (fd.entities === null ? EntitiesOutcome.absent() : fd.entities.outcome).check(report, fd.entitiesArtifact);
    (fd.rules === null ? RulesOutcome.absent() : fd.rules.outcome).check(report, fd.rulesArtifact, fd.requirements === null ? null : fd.requirements.outcome, entities);
    (fd.spec === null ? FunctionalSpecificationOutcome.absent() : fd.spec.outcome).check(report, fd.specArtifact, fd.entitiesArtifact, entities);
    (fd.components === null ? DomainEntitiesOutcome.absent() : fd.components.outcome).check(report, fd.componentsArtifact, fd.siblingUnits, fd.unit);
    if (fd.entities !== null)
      report.input(fd.entities.input);
    if (fd.rules !== null)
      report.input(fd.rules.input);
    if (fd.requirements !== null)
      report.input(fd.requirements.input);
    if (fd.spec !== null)
      report.input(fd.spec.input);
    if (fd.components !== null)
      report.input(fd.components.input);
    for (const anchor of fd.siblingInputs)
      report.input(anchor);
    return ok(report);
  }
}
// src/refcheck/domain/design-record-identifier.ts
class DesignRecordIdentifier {
  #path;
  constructor(path) {
    this.#path = path;
  }
  static of(path) {
    return new DesignRecordIdentifier(path);
  }
  equals(other) {
    return this.#path.equals(other.#path);
  }
  artifactPath() {
    return this.#path;
  }
}
// src/refcheck/domain/domain-entity-sketch.ts
class DomainEntitySketch {
  #name;
  #component;
  #attributes;
  constructor(seed) {
    this.#name = seed.name;
    this.#component = seed.component;
    this.#attributes = seed.attributes;
  }
  static of(seed) {
    return new DomainEntitySketch(seed);
  }
  checkAgainst(unitEntities, unit, report, componentsArtifact) {
    const compArt = componentsArtifact.asString();
    const key = this.#name.normalized();
    const definers = unitEntities.definersOf(key).toArray();
    if (definers.length >= 2) {
      report.finding(XS_1, FindingKind.consistencyMismatch(), FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("entity", this.#name.asString())), []), [
        WitnessReference.at(compArt, this.catalogLabel()),
        ...definers.map((u) => WitnessReference.at(`construction/${u.asString()}/functional-design/entities.md`, `entity ${this.#name.asString()}`))
      ], `domain entity "${this.#name.asString()}" is defined in ${definers.length} units (${definers.map((unit2) => unit2.asString()).join(", ")}) \u2014 ownership is duplicated`);
    } else if (definers.length === 0 && unitEntities.hasAnyUnit()) {
      report.finding(XS_2, FindingKind.consistencyMismatch(), FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("entity", this.#name.asString())), []), [WitnessReference.at(compArt, this.catalogLabel())], `domain entity "${this.#name.asString()}" is defined in no unit's entities.md \u2014 it was dropped on the way to functional design`);
    }
    if (unit !== undefined) {
      const mine = unitEntities.entityDeclaredIn(unit, key);
      if (mine) {
        const dropped = this.attributesDroppedIn(mine.attributeNames());
        if (dropped.length > 0) {
          report.finding(XS_3, FindingKind.consistencyMismatch(), FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("entity", this.#name.asString())), []), dropped.map((a) => WitnessReference.at(compArt, `entity ${this.#name.asString()}.attributes`, a)), `domain-design declares attribute(s) ${dropped.join(", ")} on "${this.#name.asString()}" that this unit's entities.md does not carry`);
        }
      }
    }
  }
  name() {
    return this.#name;
  }
  equals(other) {
    const attributes = this.#attributes.toArray();
    const otherAttributes = other.#attributes.toArray();
    return this.#name.equals(other.#name) && this.#component.equals(other.#component) && attributes.length === otherAttributes.length && attributes.every((attribute, index) => attribute.equals(otherAttributes[index]));
  }
  catalogLabel() {
    return `entity ${this.#name.asString()} (component ${this.#component.asString()})`;
  }
  attributesDroppedIn(unitAttrs) {
    return this.#attributes.toArray().filter((a) => !unitAttrs.coversNormalized(a)).map((a) => a.asString()).sort();
  }
}
// src/refcheck/domain/domain-entity-sketches.ts
class DomainEntitySketches extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-domain-entity-sketches");
  }
  rebuild(values) {
    return new DomainEntitySketches(values);
  }
  static parse(values) {
    return parseConstruction(() => new DomainEntitySketches(values));
  }
  static of(values) {
    return new DomainEntitySketches(values);
  }
  add(value) {
    return new DomainEntitySketches([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  sortedDistinctByNormalizedName() {
    const sorted = [...this.#values].sort((a, b) => a.name().asString() < b.name().asString() ? -1 : 1);
    const seen = new Set;
    const out = [];
    for (const de of sorted) {
      const key = de.name().normalized().asString();
      if (seen.has(key))
        continue;
      seen.add(key);
      out.push(de);
    }
    return out;
  }
  toArray() {
    return this.#values;
  }
  check(report, componentsArtifact, unitEntities, unit) {
    for (const declaration of this.sortedDistinctByNormalizedName())
      declaration.checkAgainst(unitEntities, unit, report, componentsArtifact);
    if (unit === undefined) {
      report.skip(XS_3, "unrecognized-format", "the unit for this functional-design record could not be determined from its path");
    }
  }
}
// src/refcheck/domain/entity-declaration.ts
class EntityDeclaration {
  #name;
  #element;
  #attrs;
  #rels;
  constructor(seed) {
    this.#name = seed.name;
    this.#element = seed.element;
    this.#attrs = seed.attrs;
    this.#rels = seed.rels;
  }
  static of(seed) {
    return new EntityDeclaration(seed);
  }
  checkDuplicateAttributes(report, artifact) {
    for (const duplicate of this.#attrs.duplicatesByName())
      report.finding(FD_E1, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("attr", `${this.#name.asString()}.${duplicate.name().asString()}`)), []), [
        WitnessReference.at(artifact.asString(), `${duplicate.element().asString()}.name`, duplicate.name().asString())
      ], `attribute "${this.#name.asString()}.${duplicate.name().asString()}" is declared more than once`);
  }
  checkAttributes(entities, report, artifact) {
    for (const attribute of this.#attrs) {
      attribute.checkType(report, this.#name, artifact);
      attribute.checkBounds(report, this.#name, artifact);
      attribute.checkReference(entities, report, this.#name, artifact);
    }
  }
  name() {
    return this.#name;
  }
  element() {
    return this.#element;
  }
  equals(other) {
    const sameValues = (left, right) => left.length === right.length && left.every((value, index) => value.equals(right[index]));
    return this.#name.equals(other.#name) && this.#element.equals(other.#element) && sameValues(this.#attrs.toArray(), other.#attrs.toArray()) && sameValues(this.#rels.toArray(), other.#rels.toArray());
  }
  attributeNames() {
    return AttributeNames.of(this.#attrs.names());
  }
  attrs() {
    return this.#attrs;
  }
  rels() {
    return this.#rels;
  }
  lifecycleIsNamedBy(entity, attribute) {
    const lifecycle = this.lifecycleAttribute(attribute);
    return this.#name.normalized().equals(entity.normalized()) && lifecycle?.hasAllowedValues() === true;
  }
  reportMissingLifecycleIn(report) {
    for (const family of [FD_S1, FD_S2])
      report.skip(family, "unrecognized-format", `no \`### State Machine: ${this.#name.asString()}\` heading with a stateDiagram fence found for lifecycle entity "${this.#name.asString()}"`);
  }
  lifecycleAttribute(attribute) {
    return attribute === null ? this.#attrs.lifecycleAttr() : this.#attrs.named(attribute);
  }
  hasLifecycle() {
    return this.#attrs.lifecycleAttr() !== null;
  }
  attrNamed(name) {
    return this.#attrs.named(name);
  }
}
// src/refcheck/domain/entity-declarations.ts
class EntityDeclarations extends FirstClassCollectionBase {
  #values;
  #names;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-entity-declarations");
    this.#names = KeySet.of(this.#values.map((e) => e.name()));
  }
  rebuild(values) {
    return new EntityDeclarations(values);
  }
  static parse(values) {
    return parseConstruction(() => new EntityDeclarations(values));
  }
  static of(values) {
    return new EntityDeclarations(values);
  }
  add(value) {
    return new EntityDeclarations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  duplicatesByName() {
    const seen = new Set;
    const dups = [];
    for (const e of this.#values) {
      if (seen.has(e.name().asString()))
        dups.push(e);
      seen.add(e.name().asString());
    }
    return dups;
  }
  checkDuplicates(report, artifact) {
    for (const duplicate of this.duplicatesByName())
      report.finding(FD_E1, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("entity", duplicate.name().asString())), []), [
        WitnessReference.at(artifact.asString(), `${duplicate.element().asString()}.name`, duplicate.name().asString())
      ], `entity "${duplicate.name().asString()}" is declared more than once`);
  }
  containsNamed(name) {
    return this.#names.has(name);
  }
  byNormalizedName(normalized) {
    return this.#values.find((e) => e.name().normalized().equals(normalized));
  }
  lifecycleOnly() {
    return this.#values.filter((e) => e.hasLifecycle());
  }
  resolvesReference(reference) {
    const token = reference.entityToken();
    if (token !== null) {
      const parsed = EntityName.parse(token);
      return parsed.ok && this.#names.has(parsed.value);
    }
    return this.#values.some((d) => reference.looselyMentions(d.name()));
  }
  resolvesAppliesTo(target) {
    const token = target.entityToken();
    if (token !== null) {
      const ent = this.#values.find((e) => e.name().asString() === token);
      const attr = target.attributeToken();
      if (ent === undefined)
        return false;
      if (attr === null)
        return true;
      const parsed = AttributeName.parse(attr);
      return parsed.ok && ent.attrNamed(parsed.value) !== null;
    }
    return this.#values.some((e) => target.looselyMentions(e.name()));
  }
  toArray() {
    return this.#values;
  }
}
// src/refcheck/domain/entity-reference.ts
class EntityReference {
  #entity;
  #ownedBy;
  #element;
  constructor(props) {
    this.#entity = props.entity;
    this.#ownedBy = props.ownedBy;
    this.#element = props.element;
  }
  static of(props) {
    return new EntityReference(props);
  }
  entity() {
    return this.#entity;
  }
  ownedBy() {
    return this.#ownedBy;
  }
  element() {
    return this.#element;
  }
  equals(other) {
    return this.#entity.equals(other.#entity) && this.#ownedBy.equals(other.#ownedBy) && this.#element.equals(other.#element);
  }
}
// src/refcheck/domain/entity-references.ts
class EntityReferences extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-entity-references");
  }
  rebuild(values) {
    return new EntityReferences(values);
  }
  static parse(values) {
    return parseConstruction(() => new EntityReferences(values));
  }
  static of(values) {
    return new EntityReferences(values);
  }
  add(value) {
    return new EntityReferences([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/refcheck/domain/input-anchor.ts
class InputAnchor {
  #artifact;
  #sha256;
  constructor(props) {
    this.#artifact = ArtifactPath.of(props.artifact);
    this.#sha256 = props.sha256;
  }
  static parse(props) {
    return parseConstruction(() => new InputAnchor(props));
  }
  static of(props) {
    return new InputAnchor(props);
  }
  artifact() {
    return this.#artifact.asString();
  }
  sha256() {
    return this.#sha256;
  }
  equals(other) {
    return this.#artifact.equals(other.#artifact) && this.#sha256.equals(other.#sha256);
  }
  compareByArtifact(other) {
    const a = this.#artifact.asString();
    const b = other.#artifact.asString();
    return a < b ? -1 : a > b ? 1 : 0;
  }
}
// src/refcheck/domain/line-number.ts
class LineNumber {
  #value;
  constructor(raw) {
    if (!Number.isSafeInteger(raw) || raw < 1)
      throw new IllegalArgumentException({ kind: "non-positive-location", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new LineNumber(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new LineNumber(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asNumber() {
    return this.#value;
  }
}
// src/refcheck/domain/machine-specification.ts
class MachineSpecification {
  #value;
  #entity;
  #attribute;
  constructor(raw) {
    if (raw.length > 4096)
      throw new IllegalArgumentException({ kind: "machine-spec-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-token", raw });
    if (!raw.isWellFormed() || /\p{Cc}/u.test(raw))
      throw new IllegalArgumentException({ kind: "invalid-machine-spec-characters" });
    const parts = raw.split(".");
    if (parts.length > 2 || parts.some((part) => part.length === 0 || part.trim() !== part))
      throw new IllegalArgumentException({ kind: "invalid-machine-spec-syntax" });
    this.#entity = EntityName.of(parts[0]);
    this.#attribute = parts[1] === undefined ? null : AttributeName.of(parts[1]);
    this.#value = raw;
  }
  static of(raw) {
    return new MachineSpecification(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new MachineSpecification(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
  entityToken() {
    return this.#entity;
  }
  attributeToken() {
    return this.#attribute;
  }
}
// src/refcheck/domain/numeric-bound.ts
class NumericBound {
  #value;
  constructor(raw) {
    if (!Number.isFinite(raw))
      throw new IllegalArgumentException({ kind: "not-finite", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new NumericBound(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new NumericBound(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asNumber() {
    return this.#value;
  }
  exceeds(other) {
    return this.#value > other.#value;
  }
}
// src/refcheck/domain/reference-target.ts
class ReferenceTarget {
  #value;
  constructor(raw) {
    if (raw.length > 4096)
      throw new IllegalArgumentException({ kind: "reference-target-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new ReferenceTarget(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new ReferenceTarget(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
  entityToken() {
    const token = this.#value.match(/^([A-Za-z][A-Za-z0-9_]*)(?:\.[A-Za-z][A-Za-z0-9_]*)?$/);
    return token ? token[1] ?? null : null;
  }
  looselyMentions(name) {
    return this.#value.toLowerCase().includes(name.asString().toLowerCase());
  }
}
// src/refcheck/domain/relationship-declaration.ts
class RelationshipDeclaration {
  #element;
  #from;
  #to;
  #cardinality;
  #hasDirection;
  constructor(seed) {
    this.#element = seed.element;
    this.#from = seed.from;
    this.#to = seed.to;
    this.#cardinality = seed.cardinality;
    this.#hasDirection = seed.hasDirection;
  }
  static of(seed) {
    return new RelationshipDeclaration(seed);
  }
  checkAgainst(entities, report, artifact) {
    for (const endpoint of [this.#from, this.#to]) {
      if (endpoint !== null && !entities.containsNamed(endpoint))
        report.finding(FD_E4, FindingKind.referenceBroken(), FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("entity", endpoint.asString())), []), [WitnessReference.at(artifact.asString(), this.#element.asString(), endpoint.asString())], `relationship endpoint "${endpoint.asString()}" is not a declared entity`);
    }
    if (this.cardinalityOutsideClosedSet())
      report.finding(FD_E5, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(FD_E5.asCheckTarget()), []), [WitnessReference.at(artifact.asString(), this.#element.asString(), this.#cardinality?.asString())], `cardinality "${this.#cardinality?.asString()}" is not in the closed set 1:1 | 1:N | N:1 | N:M`);
    if (this.cardinalityWithoutDirection())
      report.finding(FD_E5, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(FD_E5.asCheckTarget()), []), [WitnessReference.at(artifact.asString(), this.#element.asString())], "relationship declares a cardinality but no direction (from/to or direction key)");
  }
  cardinalityOutsideClosedSet() {
    return this.#cardinality !== null && !this.#cardinality.isInClosedSet();
  }
  cardinalityWithoutDirection() {
    return this.#cardinality !== null && !this.#hasDirection;
  }
  equals(other) {
    const optionalEqual = (left, right) => left === null ? right === null : right !== null && left.equals(right);
    return this.#element.equals(other.#element) && optionalEqual(this.#from, other.#from) && optionalEqual(this.#to, other.#to) && optionalEqual(this.#cardinality, other.#cardinality) && this.#hasDirection === other.#hasDirection;
  }
}
// src/refcheck/domain/relationship-declarations.ts
class RelationshipDeclarations extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-relationship-declarations");
  }
  rebuild(values) {
    return new RelationshipDeclarations(values);
  }
  static parse(values) {
    return parseConstruction(() => new RelationshipDeclarations(values));
  }
  static of(values) {
    return new RelationshipDeclarations(values);
  }
  add(value) {
    return new RelationshipDeclarations([...this.#values, value]);
  }
  concat(other) {
    return new RelationshipDeclarations([...this.#values, ...other.#values]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/refcheck/domain/rule-category.ts
var CATEGORIES = new Set(["validation", "authorization", "constraint", "calculation", "policy"]);

class RuleCategory {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "rule-category-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new RuleCategory(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new RuleCategory(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
  normalized() {
    return this.#value.toLowerCase();
  }
  isKnownCategory() {
    return CATEGORIES.has(this.normalized());
  }
}
// src/refcheck/domain/rule-declaration.ts
class RuleDeclaration {
  #id;
  #element;
  #category;
  #appliesTo;
  #sourceIds;
  #missing;
  constructor(seed) {
    this.#id = seed.id;
    this.#element = seed.element;
    this.#category = seed.category;
    this.#appliesTo = seed.appliesTo;
    this.#sourceIds = seed.sourceIds;
    this.#missing = Object.freeze([...seed.missing]);
  }
  static of(seed) {
    return new RuleDeclaration(seed);
  }
  identifierForUniqueness() {
    return this.#id?.matchesShape() ? this.#id : null;
  }
  equals(other) {
    const optionalEqual = (left, right) => left === null ? right === null : right !== null && left.equals(right);
    const sourceIds = this.#sourceIds.toArray();
    const otherSourceIds = other.#sourceIds.toArray();
    const sourceIdsEqual = sourceIds.length === otherSourceIds.length && sourceIds.every((sourceId, index) => sourceId.equals(otherSourceIds[index]));
    return (this.#id === null ? other.#id === null : other.#id !== null && this.#id.asString() === other.#id.asString()) && this.#element.equals(other.#element) && optionalEqual(this.#category, other.#category) && optionalEqual(this.#appliesTo, other.#appliesTo) && sourceIdsEqual && this.#missing.length === other.#missing.length && this.#missing.every((missing, index) => missing === other.#missing[index]);
  }
  #findingTarget(fallback) {
    return this.identifierForUniqueness()?.asString() ?? fallback;
  }
  checkRequiredKeys(report, artifact) {
    if (this.#missing.length === 0)
      return;
    report.finding(FD_R1, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(this.#findingTarget("check:FD-R1")), []), [WitnessReference.at(artifact.asString(), this.#element.asString())], `rule is missing required key(s): ${this.#missing.join(", ")}`);
  }
  checkIdentifier(report, artifact) {
    const id = this.#id;
    if (id === null || id.matchesShape())
      return;
    report.finding(FD_R2, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(FD_R2.asCheckTarget()), []), [WitnessReference.at(artifact.asString(), `${this.#element.asString()}.id`, id.asString())], `rule id "${id.asString()}" does not match BR{group}.{seq}`);
  }
  reportDuplicateIdentifier(report, artifact) {
    const id = this.identifierForUniqueness();
    if (id === null)
      throw new Error("defect: a malformed rule identifier cannot be a duplicate identifier");
    report.finding(FD_R2, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(id.asString()), []), [WitnessReference.at(artifact.asString(), `${this.#element.asString()}.id`, id.asString())], `rule id "${id.asString()}" is declared more than once`);
  }
  checkSource(known, report, artifact) {
    const missing = this.#sourceIds.valuesMissingFrom(known);
    if (missing.length === 0)
      return;
    report.finding(FD_R3, FindingKind.referenceBroken(), FindingTargets.of(TargetIdentifier.of(this.#findingTarget("check:FD-R3")), []), missing.map((id) => WitnessReference.at(artifact.asString(), `${this.#element.asString()}.source`, id)), `source id(s) ${missing.join(", ")} do not exist in requirements.md`, missing);
  }
  checkApplicability(entities, report, artifact) {
    const target = this.#appliesTo;
    if (target === null || entities.resolvesAppliesTo(target))
      return;
    report.finding(FD_R4, FindingKind.referenceBroken(), FindingTargets.of(TargetIdentifier.of(this.#findingTarget("check:FD-R4")), []), [WitnessReference.at(artifact.asString(), this.#element.asString(), target.asString())], `applies-to "${target.asString()}" does not resolve to a declared entity or entity.attribute`);
  }
  checkCategory(report, artifact) {
    const category = this.#category;
    if (category === null || category.isKnownCategory())
      return;
    report.finding(FD_R5, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(this.#findingTarget("check:FD-R5")), []), [WitnessReference.at(artifact.asString(), `${this.#element.asString()}.category`, category.asString())], `category "${category.asString()}" is not one of validation | authorization | constraint | calculation | policy`);
  }
}
// src/refcheck/domain/rule-declarations.ts
class RuleDeclarations extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-rule-declarations");
  }
  rebuild(values) {
    return new RuleDeclarations(values);
  }
  static parse(values) {
    return parseConstruction(() => new RuleDeclarations(values));
  }
  static of(values) {
    return new RuleDeclarations(values);
  }
  add(value) {
    return new RuleDeclarations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
  check(report, artifact, requirementIdsKnown, entities) {
    for (const rule of this)
      rule.checkRequiredKeys(report, artifact);
    const seen = new Set;
    for (const rule of this) {
      rule.checkIdentifier(report, artifact);
      const id = rule.identifierForUniqueness();
      if (id === null)
        continue;
      if (seen.has(id.asString()))
        rule.reportDuplicateIdentifier(report, artifact);
      seen.add(id.asString());
    }
    if (requirementIdsKnown === null)
      report.skip(FD_R3, "absent-input", "requirements.md not found under this intent record \u2014 source ids cannot be reverse-verified");
    else
      for (const rule of this)
        rule.checkSource(requirementIdsKnown, report, artifact);
    if (entities === null)
      report.skip(FD_R4, "absent-input", "entities.md is unavailable \u2014 applies-to cannot be resolved");
    else
      for (const rule of this)
        rule.checkApplicability(entities.entities(), report, artifact);
    for (const rule of this)
      rule.checkCategory(report, artifact);
  }
}
// src/refcheck/domain/shape-error.ts
class ShapeError {
  #element;
  #detail;
  constructor(element, detail) {
    this.#element = element;
    this.#detail = detail;
  }
  static of(props) {
    return new ShapeError(props.element, props.detail);
  }
  equals(other) {
    return this.#element.equals(other.#element) && this.#detail === other.#detail;
  }
  recordIn(family, report, artifact) {
    report.finding(family, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(family.asCheckTarget()), []), [WitnessReference.at(artifact.asString(), this.#element.asString())], this.#detail);
  }
}
// src/refcheck/domain/shape-errors.ts
class ShapeErrors extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-shape-errors");
  }
  rebuild(values) {
    return new ShapeErrors(values);
  }
  static parse(values) {
    return parseConstruction(() => new ShapeErrors(values));
  }
  static of(values) {
    return new ShapeErrors(values);
  }
  add(value) {
    return new ShapeErrors([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/refcheck/domain/sibling-unit-index-entry.ts
class SiblingUnitIndexEntry {
  #unit;
  #declarations;
  constructor(unit, declarations) {
    this.#unit = unit;
    this.#declarations = declarations;
  }
  static of(unit, declarations) {
    return new SiblingUnitIndexEntry(unit, declarations);
  }
  unit() {
    return this.#unit;
  }
  declarations() {
    return this.#declarations;
  }
  equals(other) {
    const values = this.#declarations.toArray();
    const otherValues = other.#declarations.toArray();
    return this.#unit.equals(other.#unit) && values.length === otherValues.length && values.every((value, index) => value.equals(otherValues[index]));
  }
}

// src/refcheck/domain/unit-names.ts
class UnitNames extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-unit-names");
  }
  rebuild(values) {
    return new UnitNames(values);
  }
  static parse(values) {
    return parseConstruction(() => new UnitNames(values));
  }
  static of(values) {
    return new UnitNames(values);
  }
  add(value) {
    return new UnitNames([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  declares(value) {
    return this.#values.some((v) => v.asString() === value);
  }
  sortedByValue() {
    return new UnitNames([...this.#values].sort((a, b) => a.asString() < b.asString() ? -1 : 1));
  }
  toArray() {
    return this.#values;
  }
}

// src/refcheck/domain/sibling-unit-index.ts
class SiblingUnitIndex extends FirstClassCollectionBase {
  #units;
  #entries;
  constructor(units, entries) {
    super();
    if (units.size() > 65536)
      throw new IllegalArgumentException({ kind: "too-many-sibling-units", raw: units.size() });
    let count = 0;
    for (const declarations of units.values())
      for (const _entity of declarations)
        if (++count > 65536)
          throw new IllegalArgumentException({ kind: "too-many-sibling-entities", raw: count });
    this.#entries = Object.freeze(entries ?? [...units].map(([unit, declarations]) => SiblingUnitIndexEntry.of(unit, declarations)));
    this.#units = KeyedIndex.of([...units].map(([unit, declarations]) => [
      unit,
      KeyedIndex.of([...declarations].map((entity) => [entity.name().normalized(), entity]))
    ]));
  }
  rebuild(values) {
    return new SiblingUnitIndex(KeyedIndex.of(values.map((entry) => [entry.unit(), entry.declarations()])), values);
  }
  *[Symbol.iterator]() {
    yield* this.#entries;
  }
  toArray() {
    return this.#entries;
  }
  static of(units) {
    return new SiblingUnitIndex(units);
  }
  static parse(units) {
    return parseConstruction(() => new SiblingUnitIndex(units));
  }
  definersOf(normalizedName) {
    return UnitNames.of([...this.#units].filter(([, declarations]) => declarations.has(normalizedName)).map(([unit]) => unit));
  }
  entityDeclaredIn(unit, normalizedName) {
    return this.#units.get(unit)?.get(normalizedName);
  }
  hasAnyUnit() {
    return !this.#units.isEmpty();
  }
}
// src/refcheck/domain/source-identifier.ts
class SourceIdentifier {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "source-id-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new SourceIdentifier(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new SourceIdentifier(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
}
// src/refcheck/domain/source-identifiers.ts
class SourceIdentifiers extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-source-identifiers");
  }
  rebuild(values) {
    return new SourceIdentifiers(values);
  }
  static parse(values) {
    return parseConstruction(() => new SourceIdentifiers(values));
  }
  static of(values) {
    return new SourceIdentifiers(values);
  }
  add(value) {
    return new SourceIdentifiers([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  valuesMissingFrom(known) {
    return this.#values.map((id) => id.asString()).filter((id) => {
      const parsed = RequirementIdentifier.parse(id);
      return !parsed.ok || !known.has(parsed.value);
    }).sort();
  }
  toArray() {
    return this.#values;
  }
}
// src/refcheck/domain/specification-block-assessment.ts
class SpecificationBlockAssessment {
  #index;
  #line;
  #issue;
  #error;
  constructor(index, line, issue, error) {
    this.#index = index;
    this.#line = line;
    this.#issue = issue;
    this.#error = error;
  }
  static sound(index, line) {
    return new SpecificationBlockAssessment(index, line, "sound", null);
  }
  static unparseable(index, line, error) {
    return new SpecificationBlockAssessment(index, line, "unparseable", error);
  }
  static notAMapping(index, line) {
    return new SpecificationBlockAssessment(index, line, "not-a-mapping", null);
  }
  static openapiWithoutPaths(index, line) {
    return new SpecificationBlockAssessment(index, line, "openapi-without-paths", null);
  }
  blockId() {
    return `contract:block-${this.#index.asNumber()}`;
  }
  equals(other) {
    return this.#index.equals(other.#index) && this.#line.equals(other.#line) && this.#issue === other.#issue && this.#error === other.#error;
  }
  locationLabel() {
    return `yaml fence #${this.#index.asNumber()} (line ${this.#line.asNumber()})`;
  }
  matchIssue(handlers) {
    if (this.#issue === "sound")
      return handlers.sound();
    if (this.#issue === "unparseable")
      return handlers.unparseable(this.#error ?? "");
    if (this.#issue === "not-a-mapping")
      return handlers.notAMapping();
    return handlers.openapiWithoutPaths();
  }
  check(report, artifact) {
    const art = artifact.asString();
    const blockId = this.blockId();
    const el = this.locationLabel();
    this.matchIssue({
      sound: () => {},
      unparseable: (error) => {
        report.finding(CD_2, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(blockId), []), [WitnessReference.at(art, el)], `spec block does not parse in the supported YAML subset: ${error}`);
      },
      notAMapping: () => {
        report.finding(CD_2, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(blockId), []), [WitnessReference.at(art, el)], "spec block is not a YAML mapping");
      },
      openapiWithoutPaths: () => {
        report.finding(CD_2, FindingKind.structureInvalid(), FindingTargets.of(TargetIdentifier.of(blockId), []), [WitnessReference.at(art, el, "openapi")], "OpenAPI spec block carries `openapi:` but no `paths:`");
      }
    });
  }
}
// src/refcheck/domain/specification-block-assessments.ts
class SpecificationBlockAssessments extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-specification-block-assessments");
  }
  rebuild(values) {
    return new SpecificationBlockAssessments(values);
  }
  static parse(values) {
    return parseConstruction(() => new SpecificationBlockAssessments(values));
  }
  static of(values) {
    return new SpecificationBlockAssessments(values);
  }
  add(value) {
    return new SpecificationBlockAssessments([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
  check(report, artifact) {
    for (const block of this) {
      block.check(report, artifact);
    }
  }
}
// src/refcheck/domain/state-machine-sketch.ts
class StateMachineSketch {
  #state;
  constructor(state) {
    this.#state = state.kind === "declared" ? { kind: "declared", declaration: { ...state.declaration } } : { ...state };
  }
  static of(seed) {
    return new StateMachineSketch({ kind: "declared", declaration: seed });
  }
  static unrecognized(line, reason) {
    return new StateMachineSketch({ kind: "unrecognized", line, reason });
  }
  coversLifecycleOf(entity) {
    if (this.#state.kind === "unrecognized")
      return false;
    const specification = this.#state.declaration.spec;
    return entity.lifecycleIsNamedBy(specification.entityToken(), specification.attributeToken());
  }
  locationLabel() {
    const state = this.#state;
    return state.kind === "unrecognized" ? `State Machine heading (line ${state.line.asNumber()})` : `State Machine: ${state.declaration.spec.asString()} (fence line ${state.declaration.fenceLine.asNumber()})`;
  }
  equals(other) {
    if (this.#state.kind !== other.#state.kind)
      return false;
    if (this.#state.kind === "unrecognized" && other.#state.kind === "unrecognized")
      return this.#state.line.equals(other.#state.line) && this.#state.reason.equals(other.#state.reason);
    if (this.#state.kind !== "declared" || other.#state.kind !== "declared")
      return false;
    const left = this.#state.declaration;
    const right = other.#state.declaration;
    const states = left.states.toArray();
    const otherStates = right.states.toArray();
    return left.spec.equals(right.spec) && states.length === otherStates.length && states.every((state, index) => state.equals(otherStates[index])) && left.fenceLine.equals(right.fenceLine) && left.unsupported === right.unsupported;
  }
  check(report, specArtifact, entitiesArtifact, entities) {
    if (this.#state.kind === "unrecognized") {
      for (const family of [FD_S1, FD_S2])
        report.skip(family, "unrecognized-format", `${this.locationLabel()}: ${this.#state.reason.asString()}`);
      return;
    }
    const declaration = this.#state.declaration;
    const specArt = specArtifact.asString();
    const entity = declaration.spec.entityToken();
    const entName = entity.asString();
    const attrName = declaration.spec.attributeToken();
    const el = this.locationLabel();
    if (declaration.unsupported !== null) {
      report.skip(FD_S1, "unrecognized-format", `${el}: ${declaration.unsupported}`);
      report.skip(FD_S2, "unrecognized-format", `${el}: ${declaration.unsupported}`);
      return;
    }
    const ent = entities.entities().byNormalizedName(entity.normalized());
    if (!ent) {
      report.finding(FD_S1, FindingKind.consistencyMismatch(), FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("entity", entName)), []), [WitnessReference.at(specArt, el, entName)], `state machine names entity "${entName}" which is not declared in entities.md`);
      return;
    }
    const attr = ent.lifecycleAttribute(attrName);
    if (!attr?.hasAllowedValues()) {
      report.skip(FD_S1, "unrecognized-format", `${el}: no lifecycle attribute with allowed values could be determined for entity "${ent.name().asString()}"`);
      report.skip(FD_S2, "unrecognized-format", `${el}: no lifecycle attribute with allowed values could be determined for entity "${ent.name().asString()}"`);
      return;
    }
    attr.checkDiagramStates(declaration.states, report, ent.name(), specArtifact, entitiesArtifact, el);
  }
}
// src/refcheck/domain/state-machine-sketches.ts
class StateMachineSketches extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-state-machine-sketches");
  }
  rebuild(values) {
    return new StateMachineSketches(values);
  }
  static parse(values) {
    return parseConstruction(() => new StateMachineSketches(values));
  }
  static of(values) {
    return new StateMachineSketches(values);
  }
  add(value) {
    return new StateMachineSketches([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
  check(report, specArtifact, entitiesArtifact, entities) {
    for (const entity of entities.entities().lifecycleOnly())
      if (!this.#values.some((machine) => machine.coversLifecycleOf(entity)))
        entity.reportMissingLifecycleIn(report);
    for (const m of this) {
      m.check(report, specArtifact, entitiesArtifact, entities);
    }
  }
}
// src/refcheck/domain/state-name.ts
class StateName {
  #value;
  constructor(raw) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "state-name-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new StateName(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new StateName(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
  normalized() {
    return NormalizedName.of(this.#value);
  }
}
// src/refcheck/domain/state-names.ts
class StateNames extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-state-names");
  }
  rebuild(values) {
    return new StateNames(values);
  }
  static parse(values) {
    return parseConstruction(() => new StateNames(values));
  }
  static of(values) {
    return new StateNames(values);
  }
  add(value) {
    return new StateNames([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/refcheck/domain/type-name.ts
var NUMERICISH = new Set(["int", "integer", "number", "decimal", "float", "double", "long"]);
var DATEISH = new Set(["date", "datetime", "timestamp", "time"]);
var COLLECTIONISH = new Set(["list", "array", "map", "object", "collection", "set"]);
var BOOLISH = new Set(["bool", "boolean"]);

class TypeName {
  #value;
  constructor(raw) {
    if (raw.length > 4096)
      throw new IllegalArgumentException({ kind: "type-name-too-long", raw: raw.length });
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new TypeName(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new TypeName(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
  normalized() {
    return this.#value.toLowerCase();
  }
  classifiesNumeric() {
    return NUMERICISH.has(this.normalized());
  }
  classifiesDate() {
    return DATEISH.has(this.normalized());
  }
  classifiesBool() {
    return BOOLISH.has(this.normalized());
  }
  classifiesCollection() {
    return COLLECTIONISH.has(this.normalized());
  }
}
// src/refcheck/domain/unit-declaration.ts
class UnitDeclaration {
  #name;
  #dependsOn;
  constructor(props) {
    this.#name = props.name;
    this.#dependsOn = props.dependsOn;
  }
  static of(props) {
    return new UnitDeclaration(props);
  }
  name() {
    return this.#name;
  }
  equals(other) {
    const dependencies = this.#dependsOn.toArray();
    const otherDependencies = other.#dependsOn.toArray();
    return this.#name.equals(other.#name) && dependencies.length === otherDependencies.length && dependencies.every((dependency, index) => dependency.equals(otherDependencies[index]));
  }
  dependsOn() {
    return this.#dependsOn;
  }
  declaredDependencies(declared) {
    return [...this.#dependsOn.sortedByValue()].filter((dep) => declared.declares(dep.asString()));
  }
}
// src/refcheck/domain/unit-declarations.ts
class UnitDeclarations extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-unit-declarations");
  }
  rebuild(values) {
    return new UnitDeclarations(values);
  }
  static parse(values) {
    return parseConstruction(() => new UnitDeclarations(values));
  }
  static of(values) {
    return new UnitDeclarations(values);
  }
  add(value) {
    return new UnitDeclarations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  declares(value) {
    return this.#values.some((u) => u.name().asString() === value);
  }
  names() {
    return UnitNames.of(this.#values.map((u) => u.name()));
  }
  sortedByName() {
    return new UnitDeclarations([...this.#values].sort((a, b) => a.name().asString() < b.name().asString() ? -1 : 1));
  }
  toArray() {
    return this.#values;
  }
  checkEdgesCovered(rows, report, artifact, depArtifact) {
    const art = artifact.asString();
    const depArt = depArtifact.asString();
    for (const u of this.sortedByName()) {
      const uName = u.name().asString();
      for (const dep of u.declaredDependencies(this)) {
        const depName = dep.asString();
        if (!rows.coversEdge(depName, uName)) {
          report.finding(CD_3, FindingKind.consistencyMismatch(), FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("unit", depName)), [
            TargetIdentifier.of(TargetIdentifiers.safe("unit", uName))
          ]), [
            WitnessReference.at(depArt, `units (${uName} depends_on ${depName})`),
            WitnessReference.at(art, "contracts table")
          ], `unit dependency edge "${uName}" -> "${depName}" has no contracts-table row in either orientation`);
        }
      }
    }
  }
}
// src/refcheck/adapter/component-catalog-parser.ts
function str(v) {
  return typeof v === "string" ? v : null;
}
function extractComponents(value) {
  const shapeErrors = [];
  const comps = [];
  if (!isObject(value) || !Array.isArray(value.components)) {
    shapeErrors.push(ComponentShapeError.of({
      element: ElementPath.of("components"),
      detail: "top-level `components:` list is missing"
    }));
    const parsed2 = combineResults({
      comps: Components.parse(comps),
      shapeErrors: ComponentShapeErrors.parse(shapeErrors)
    });
    return parsed2.ok ? ok(parsed2.value) : err(JSON.stringify(parsed2.error));
  }
  for (const [i, raw] of value.components.entries()) {
    const element = `components[${i}]`;
    if (!isObject(raw)) {
      shapeErrors.push(ComponentShapeError.of({ element: ElementPath.of(element), detail: "component entry is not a mapping" }));
      continue;
    }
    const name = str(raw.name);
    if (name === null) {
      shapeErrors.push(ComponentShapeError.of({
        element: ElementPath.of(`${element}.name`),
        detail: "component has no string `name`"
      }));
      continue;
    }
    const parsedName = ComponentName.parse(name);
    if (!parsedName.ok) {
      shapeErrors.push(ComponentShapeError.of({
        element: ElementPath.of(`${element}.name`),
        detail: JSON.stringify(parsedName.error)
      }));
      continue;
    }
    const refs = (key) => {
      const out = [];
      if (!Array.isArray(raw[key])) {
        const parsed3 = ComponentReferences.parse(out);
        return parsed3.ok ? ok(parsed3.value) : err(JSON.stringify(parsed3.error));
      }
      raw[key].forEach((entry, j) => {
        const el = `${element}.${key}[${j}].component`;
        const comp = isObject(entry) ? str(entry.component) : str(entry);
        if (comp === null)
          return;
        const component = ComponentName.parse(comp);
        if (!component.ok) {
          shapeErrors.push(ComponentShapeError.of({ element: ElementPath.of(el), detail: JSON.stringify(component.error) }));
          return;
        }
        out.push(ComponentReference.of({ component: component.value, element: ElementPath.of(el) }));
      });
      const parsed2 = ComponentReferences.parse(out);
      return parsed2.ok ? ok(parsed2.value) : err(JSON.stringify(parsed2.error));
    };
    const entities = [];
    if (Array.isArray(raw.entities)) {
      for (const [j, entry] of raw.entities.entries()) {
        if (!isObject(entry))
          continue;
        const ename = str(entry.name);
        if (ename === null)
          continue;
        const entity = EntityName.parse(ename);
        if (!entity.ok) {
          shapeErrors.push(ComponentShapeError.of({
            element: ElementPath.of(`${element}.entities[${j}].name`),
            detail: JSON.stringify(entity.error)
          }));
          continue;
        }
        const references = [];
        if (Array.isArray(entry.references)) {
          entry.references.forEach((ref, k) => {
            if (!isObject(ref))
              return;
            const target = str(ref.entity);
            const ownedBy = str(ref.owned_by);
            if (target !== null && ownedBy !== null) {
              const fields = combineResults({
                entity: EntityName.parse(target),
                ownedBy: ComponentName.parse(ownedBy)
              });
              if (!fields.ok) {
                shapeErrors.push(ComponentShapeError.of({
                  element: ElementPath.of(`${element}.entities[${j}].references[${k}]`),
                  detail: JSON.stringify(fields.error)
                }));
                return;
              }
              references.push(EntityReference.of({
                entity: fields.value.entity,
                ownedBy: fields.value.ownedBy,
                element: ElementPath.of(`${element}.entities[${j}].references[${k}]`)
              }));
            }
          });
        }
        const identifier = str(entry.identifier);
        const parsedIdentifier = identifier === null || identifier === "" ? ok(null) : AttributeName.parse(identifier);
        if (!parsedIdentifier.ok) {
          shapeErrors.push(ComponentShapeError.of({
            element: ElementPath.of(`${element}.entities[${j}].identifier`),
            detail: JSON.stringify(parsedIdentifier.error)
          }));
          continue;
        }
        const parsedReferences = EntityReferences.parse(references);
        if (!parsedReferences.ok)
          return err(JSON.stringify(parsedReferences.error));
        entities.push(ComponentEntity.of({
          name: entity.value,
          element: ElementPath.of(`${element}.entities[${j}]`),
          identifier: parsedIdentifier.value,
          references: parsedReferences.value
        }));
      }
    }
    const dependsOn = refs("depends_on");
    if (!dependsOn.ok)
      return err(dependsOn.error);
    const dependents = refs("dependents");
    if (!dependents.ok)
      return err(dependents.error);
    const parsedEntities = ComponentEntities.parse(entities);
    if (!parsedEntities.ok)
      return err(JSON.stringify(parsedEntities.error));
    comps.push(Component.of({
      name: parsedName.value,
      element: ElementPath.of(element),
      dependsOn: dependsOn.value,
      dependents: dependents.value,
      entities: parsedEntities.value
    }));
  }
  const parsed = combineResults({
    comps: Components.parse(comps),
    shapeErrors: ComponentShapeErrors.parse(shapeErrors)
  });
  return parsed.ok ? ok(parsed.value) : err(JSON.stringify(parsed.error));
}
function parseComponentCatalog(md) {
  const fences = extractFences(md, "yaml");
  if (fences.length !== 1) {
    return ComponentCatalogOutcome.wrongFenceCount(FenceCount.of(fences.length));
  }
  const parsed = parseYamlSubset(fences[0]?.body ?? "");
  if (parsed.error !== undefined) {
    return ComponentCatalogOutcome.unparseable(LineNumber.of(fences[0]?.line ?? 0), parsed.error);
  }
  const extracted = extractComponents(parsed.value ?? null);
  return extracted.ok ? ComponentCatalogOutcome.extracted(extracted.value.comps, extracted.value.shapeErrors) : ComponentCatalogOutcome.unparseable(LineNumber.of(fences[0]?.line ?? 0), extracted.error);
}
// src/refcheck/adapter/contract-summary-parser.ts
function parseDeclaredUnits(depMd) {
  if (depMd === null)
    return DeclaredUnitsOutcome.absent();
  const fences = extractFences(depMd, "yaml");
  for (const fence of fences) {
    const parsed = parseYamlSubset(fence.body);
    if (parsed.error !== undefined)
      return DeclaredUnitsOutcome.unrecognized(parsed.error);
    const v = parsed.value ?? null;
    if (!isObject(v) || !Array.isArray(v.units))
      continue;
    const units = [];
    for (const raw of v.units) {
      if (!isObject(raw) || typeof raw.name !== "string")
        continue;
      const dependsOn = Array.isArray(raw.depends_on) ? raw.depends_on.filter((d) => typeof d === "string") : [];
      const fields = combineResults({
        name: UnitName.parse(raw.name),
        dependsOn: traverseResult(dependsOn, UnitName.parse)
      });
      if (!fields.ok)
        return DeclaredUnitsOutcome.unrecognized(JSON.stringify(fields.error));
      const parsedDependsOn = UnitNames.parse(fields.value.dependsOn);
      if (!parsedDependsOn.ok)
        return DeclaredUnitsOutcome.unrecognized(JSON.stringify(parsedDependsOn.error));
      units.push(UnitDeclaration.of({ name: fields.value.name, dependsOn: parsedDependsOn.value }));
    }
    if (units.length === 0)
      return DeclaredUnitsOutcome.unrecognized();
    const parsedUnits = UnitDeclarations.parse(units);
    return parsedUnits.ok ? DeclaredUnitsOutcome.declared(parsedUnits.value) : DeclaredUnitsOutcome.unrecognized(JSON.stringify(parsedUnits.error));
  }
  return DeclaredUnitsOutcome.unrecognized("no yaml fence with a top-level `units:` list");
}
function cleanCell(cell) {
  return cell.replace(/[`*]/g, "").trim();
}
function parseContractsTable(md) {
  const tables = parseMarkdownTables(md);
  const contractsTable = tables.find((t) => t.header.some((h) => /provider/i.test(h)));
  if (!contractsTable)
    return ContractsTableOutcome.absent();
  const col = (re) => contractsTable.header.findIndex((h) => re.test(h));
  const pCol = col(/provider/i);
  const cCol = col(/consumer/i);
  const oCol = col(/owner/i);
  const rows = [];
  for (const [i, row] of contractsTable.rows.entries()) {
    const first = ContractIdentifier.parse(row.cells[0] || String(i + 1));
    if (!first.ok)
      return ContractsTableOutcome.unparseable(ErrorMessage.of(JSON.stringify(first.error)));
    const token = cleanCell(first.value.asString());
    const fields = combineResults({
      provider: ContractParty.parse(row.cells[pCol] ?? ""),
      consumer: ContractParty.parse(cCol >= 0 ? row.cells[cCol] ?? "" : ""),
      owner: ContractParty.parse(oCol >= 0 ? row.cells[oCol] ?? "" : "")
    });
    if (!fields.ok)
      return ContractsTableOutcome.unparseable(ErrorMessage.of(JSON.stringify(fields.error)));
    rows.push(ContractRow.of({
      id: ContractIdentifier.of(/^[0-9]+$/.test(token) ? token : String(i + 1)),
      ...fields.value,
      line: LineNumber.of(row.line)
    }));
  }
  const parsedRows = ContractRows.parse(rows);
  return parsedRows.ok ? ContractsTableOutcome.rows(parsedRows.value) : ContractsTableOutcome.unparseable(ErrorMessage.of(JSON.stringify(parsedRows.error)));
}
function assessSpecBlocks(md) {
  const blocks = extractFences(md, "yaml").map((fence, i) => {
    const index = BlockIndex.of(i + 1);
    const line = LineNumber.of(fence.line);
    const parsed = parseYamlSubset(fence.body);
    if (parsed.error !== undefined) {
      return SpecificationBlockAssessment.unparseable(index, line, parsed.error);
    }
    const v = parsed.value ?? null;
    if (!isObject(v)) {
      return SpecificationBlockAssessment.notAMapping(index, line);
    }
    if ("openapi" in v && !("paths" in v)) {
      return SpecificationBlockAssessment.openapiWithoutPaths(index, line);
    }
    return SpecificationBlockAssessment.sound(index, line);
  });
  return SpecificationBlockAssessments.parse(blocks);
}
// src/refcheck/adapter/design-record-repository-implementation.ts
import { readFileSync as readFileSync4 } from "fs";
import { basename as basename2, dirname as dirname3, join as join4 } from "path";

// src/refcheck/adapter/functional-design-parser.ts
function str2(v) {
  return typeof v === "string" ? v : null;
}
function pick(v, keys) {
  for (const k of keys) {
    if (k in v)
      return v[k];
  }
  return null;
}
function extractRel(raw, element, implicitFrom) {
  if (!isObject(raw))
    return ok(null);
  const from = str2(pick(raw, ["from", "source"])) ?? implicitFrom;
  const to = str2(pick(raw, ["to", "target", "entity"]));
  const cardinality = str2(pick(raw, ["cardinality"]));
  const hasDirection = from !== null && to !== null || str2(pick(raw, ["direction"])) !== null;
  const fields = combineResults({
    from: from === null ? ok(null) : EntityName.parse(from),
    to: to === null ? ok(null) : EntityName.parse(to),
    cardinality: cardinality === null ? ok(null) : CardinalityNotation.parse(cardinality)
  });
  if (!fields.ok)
    return err(JSON.stringify(fields.error));
  return ok(RelationshipDeclaration.of({
    element: ElementPath.of(element),
    from: fields.value.from,
    to: fields.value.to,
    cardinality: fields.value.cardinality,
    hasDirection
  }));
}
function extractEntities(value) {
  const collected = {
    entities: [],
    rels: [],
    shapeErrors: []
  };
  const model = collected;
  if (!isObject(value) || !Array.isArray(value.entities)) {
    model.shapeErrors.push(ShapeError.of({ element: ElementPath.of("entities"), detail: "top-level `entities:` list is missing" }));
    const parsed2 = combineResults({
      entities: EntityDeclarations.parse(collected.entities),
      rels: RelationshipDeclarations.parse(collected.rels),
      shapeErrors: ShapeErrors.parse(collected.shapeErrors)
    });
    return parsed2.ok ? ok(DeclaredEntities.of(parsed2.value)) : err(JSON.stringify(parsed2.error));
  }
  for (const [i, raw] of value.entities.entries()) {
    const element = `entities[${i}]`;
    if (!isObject(raw)) {
      model.shapeErrors.push(ShapeError.of({ element: ElementPath.of(element), detail: "entity entry is not a mapping" }));
      continue;
    }
    const name = str2(raw.name);
    if (name === null) {
      model.shapeErrors.push(ShapeError.of({ element: ElementPath.of(`${element}.name`), detail: "entity has no string `name`" }));
      continue;
    }
    const entity = EntityName.parse(name);
    if (!entity.ok) {
      model.shapeErrors.push(ShapeError.of({ element: ElementPath.of(`${element}.name`), detail: JSON.stringify(entity.error) }));
      continue;
    }
    const attrs = [];
    let collectionError = null;
    if (Array.isArray(raw.attributes)) {
      raw.attributes.forEach((a, j) => {
        const ael = `${element}.attributes[${j}]`;
        if (!isObject(a)) {
          model.shapeErrors.push(ShapeError.of({ element: ElementPath.of(ael), detail: "attribute entry is not a mapping" }));
          return;
        }
        const aname = str2(a.name);
        if (aname === null) {
          model.shapeErrors.push(ShapeError.of({ element: ElementPath.of(`${ael}.name`), detail: "attribute has no string `name`" }));
          return;
        }
        const type = str2(pick(a, ["type", "logical_type", "logical-type"]));
        if (type === null) {
          model.shapeErrors.push(ShapeError.of({
            element: ElementPath.of(`${ael}.type`),
            detail: `attribute "${name}.${aname}" has no logical type`
          }));
        }
        const allowedRaw = pick(a, ["allowed_values", "allowed-values", "allowed", "values"]);
        const allowed = Array.isArray(allowedRaw) ? allowedRaw.map((x) => typeof x === "string" ? x : JSON.stringify(x)) : null;
        const defRaw = pick(a, ["default"]);
        const minRaw = pick(a, ["min"]);
        const maxRaw = pick(a, ["max"]);
        const references = str2(pick(a, ["references", "reference", "ref"]));
        const fields = combineResults({
          name: AttributeName.parse(aname),
          def: typeof defRaw === "number" || typeof defRaw === "string" ? AttributeDefault.parse(defRaw) : ok(null),
          type: type === null ? ok(null) : TypeName.parse(type),
          references: references === null ? ok(null) : ReferenceTarget.parse(references),
          allowed: allowed === null ? ok(null) : traverseResult(allowed, AllowedValue.parse),
          min: typeof minRaw === "number" ? NumericBound.parse(minRaw) : ok(null),
          max: typeof maxRaw === "number" ? NumericBound.parse(maxRaw) : ok(null)
        });
        if (!fields.ok) {
          model.shapeErrors.push(ShapeError.of({ element: ElementPath.of(ael), detail: JSON.stringify(fields.error) }));
          return;
        }
        const parsedAllowed = fields.value.allowed === null ? null : AllowedValues.parse(fields.value.allowed);
        if (parsedAllowed !== null && !parsedAllowed.ok) {
          collectionError = JSON.stringify(parsedAllowed.error);
          return;
        }
        attrs.push(AttributeDeclaration.of({
          name: fields.value.name,
          element: ElementPath.of(ael),
          type: fields.value.type,
          uniqueIsTrue: pick(a, ["unique"]) === true,
          references: fields.value.references,
          allowed: parsedAllowed === null ? null : parsedAllowed.value,
          def: fields.value.def,
          minDeclared: minRaw !== null,
          maxDeclared: maxRaw !== null,
          min: fields.value.min,
          max: fields.value.max
        }));
      });
    }
    if (collectionError !== null)
      return err(collectionError);
    const rels = [];
    if (Array.isArray(raw.relationships)) {
      raw.relationships.forEach((r, j) => {
        const rel = extractRel(r, `${element}.relationships[${j}]`, name);
        if (!rel.ok)
          model.shapeErrors.push(ShapeError.of({ element: ElementPath.of(`${element}.relationships[${j}]`), detail: rel.error }));
        else if (rel.value !== null)
          rels.push(rel.value);
      });
    }
    const parsedAttributes = AttributeDeclarations.parse(attrs);
    if (!parsedAttributes.ok)
      return err(JSON.stringify(parsedAttributes.error));
    const parsedRelationships = RelationshipDeclarations.parse(rels);
    if (!parsedRelationships.ok)
      return err(JSON.stringify(parsedRelationships.error));
    model.entities.push(EntityDeclaration.of({
      name: entity.value,
      element: ElementPath.of(element),
      attrs: parsedAttributes.value,
      rels: parsedRelationships.value
    }));
  }
  if (Array.isArray(value.relationships)) {
    value.relationships.forEach((r, j) => {
      const rel = extractRel(r, `relationships[${j}]`, null);
      if (!rel.ok)
        model.shapeErrors.push(ShapeError.of({ element: ElementPath.of(`relationships[${j}]`), detail: rel.error }));
      else if (rel.value !== null)
        model.rels.push(rel.value);
    });
  }
  const parsed = combineResults({
    entities: EntityDeclarations.parse(collected.entities),
    rels: RelationshipDeclarations.parse(collected.rels),
    shapeErrors: ShapeErrors.parse(collected.shapeErrors)
  });
  return parsed.ok ? ok(DeclaredEntities.of(parsed.value)) : err(JSON.stringify(parsed.error));
}
function parseEntitiesDocument(md) {
  if (md === null)
    return EntitiesOutcome.absent();
  const fences = extractFences(md, "yaml");
  if (fences.length !== 1)
    return EntitiesOutcome.wrongFenceCount(FenceCount.of(fences.length));
  const parsed = parseYamlSubset(fences[0]?.body ?? "");
  if (parsed.error !== undefined) {
    return EntitiesOutcome.unparseable(LineNumber.of(fences[0]?.line ?? 0), parsed.error);
  }
  const extracted = extractEntities(parsed.value ?? null);
  return extracted.ok ? EntitiesOutcome.extracted(extracted.value) : EntitiesOutcome.unparseable(LineNumber.of(fences[0]?.line ?? 0), extracted.error);
}
function parseRulesDocument(md) {
  if (md === null)
    return RulesOutcome.absent();
  const fences = extractFences(md, "yaml");
  if (fences.length !== 1)
    return RulesOutcome.wrongFenceCount(FenceCount.of(fences.length));
  const parsed = parseYamlSubset(fences[0]?.body ?? "");
  if (parsed.error !== undefined) {
    return RulesOutcome.unparseable(LineNumber.of(fences[0]?.line ?? 0), parsed.error);
  }
  const v = parsed.value ?? null;
  if (!isObject(v) || !Array.isArray(v.rules))
    return RulesOutcome.noRulesList();
  let collectionError = null;
  const ruleList = v.rules.map((raw, i) => {
    const element = `rules[${i}]`;
    if (!isObject(raw)) {
      return RuleDeclaration.of({
        id: null,
        element: ElementPath.of(element),
        category: null,
        appliesTo: null,
        sourceIds: SourceIdentifiers.of([]),
        missing: ["<entry is not a mapping>"]
      });
    }
    const missing = ["id", "statement", "category"].filter((k) => !(k in raw));
    if (!("source" in raw) && !("sources" in raw))
      missing.push("source");
    const source = pick(raw, ["source", "sources"]);
    const sourceText = Array.isArray(source) ? source.filter((s) => typeof s === "string").join(" ") : str2(source) ?? "";
    const id = str2(raw.id);
    const category = str2(raw.category);
    const appliesTo = str2(pick(raw, ["applies_to", "applies-to", "applies to", "appliesTo"]));
    const parsedId = id === null ? ok(null) : DeclaredRuleIdentifier.parse(id);
    if (!parsedId.ok)
      missing.push("id");
    const parsedCategory = category === null ? ok(null) : RuleCategory.parse(category);
    const parsedAppliesTo = appliesTo === null ? ok(null) : AppliesTo.parse(appliesTo);
    if (!parsedCategory.ok)
      missing.push("category");
    if (!parsedAppliesTo.ok)
      missing.push("applies_to");
    const parsedRequirementIds = parseRequirementIdentifiers(sourceText);
    let sourceIds;
    if (!parsedRequirementIds.ok) {
      collectionError = JSON.stringify(parsedRequirementIds.error);
      sourceIds = SourceIdentifiers.of([]);
    } else {
      const parsedSourceIds = SourceIdentifiers.parse([...parsedRequirementIds.value].map((value) => SourceIdentifier.of(value.asString())));
      if (!parsedSourceIds.ok) {
        collectionError = JSON.stringify(parsedSourceIds.error);
        sourceIds = SourceIdentifiers.of([]);
      } else {
        sourceIds = parsedSourceIds.value;
      }
    }
    return RuleDeclaration.of({
      id: parsedId.ok ? parsedId.value : null,
      element: ElementPath.of(element),
      category: parsedCategory.ok ? parsedCategory.value : null,
      appliesTo: parsedAppliesTo.ok ? parsedAppliesTo.value : null,
      sourceIds,
      missing
    });
  });
  if (collectionError !== null)
    return RulesOutcome.unparseable(LineNumber.of(fences[0]?.line ?? 0), collectionError);
  const parsedRules = RuleDeclarations.parse(ruleList);
  return parsedRules.ok ? RulesOutcome.extracted(parsedRules.value) : RulesOutcome.unparseable(LineNumber.of(fences[0]?.line ?? 0), JSON.stringify(parsedRules.error));
}
function parseFunctionalSpecDocument(md) {
  if (md === null)
    return FunctionalSpecificationOutcome.absent();
  const machines = [];
  const lines = md.split(`
`);
  for (let i = 0;i < lines.length; i++) {
    const h = (lines[i] ?? "").match(/^#{2,4}\s+State Machine:\s*(.*?)\s*$/i);
    if (!h)
      continue;
    const spec = MachineSpecification.parse((h[1] ?? "").trim());
    if (!spec.ok) {
      machines.push(StateMachineSketch.unrecognized(LineNumber.of(i + 1), ErrorMessage.of(`invalid state machine specification: ${spec.error.kind}`)));
      continue;
    }
    for (let j = i + 1;j < lines.length; j++) {
      if (/^#{1,4}\s/.test(lines[j] ?? ""))
        break;
      const f = (lines[j] ?? "").match(/^\s*```\s*mermaid\s*$/i);
      if (!f)
        continue;
      const body = [];
      let k = j + 1;
      while (k < lines.length && !/^\s*```\s*$/.test(lines[k] ?? "")) {
        body.push(lines[k] ?? "");
        k++;
      }
      const text = body.join(`
`);
      if (!/stateDiagram/i.test(text))
        break;
      let unsupported = null;
      if (/\{/.test(text))
        unsupported = "composite states are outside the supported stateDiagram subset";
      if (/<<choice>>|<<fork>>|<<join>>/.test(text))
        unsupported = "choice/fork/join nodes are outside the supported stateDiagram subset";
      const states = new Set;
      for (const line of body) {
        const t = (line ?? "").trim();
        const m = t.match(/^(\[?\*?\]?[\w-]*)\s*-->\s*([\w-]+)/);
        if (m) {
          for (const s of [m[1] ?? "", m[2] ?? ""]) {
            if (s !== "" && s !== "[*]" && !s.startsWith("["))
              states.add(s);
          }
        }
      }
      const parsedStates = traverseResult([...states].sort(), StateName.parse);
      if (!parsedStates.ok) {
        machines.push(StateMachineSketch.unrecognized(LineNumber.of(j + 1), ErrorMessage.of(`invalid diagram state: ${parsedStates.error.kind}`)));
        break;
      }
      const stateNames = StateNames.parse(parsedStates.value);
      if (!stateNames.ok) {
        machines.push(StateMachineSketch.unrecognized(LineNumber.of(j + 1), ErrorMessage.of(`state collection is too large: ${stateNames.error.kind}`)));
        break;
      }
      machines.push(StateMachineSketch.of({
        spec: spec.value,
        states: stateNames.value,
        fenceLine: LineNumber.of(j + 1),
        unsupported
      }));
      break;
    }
  }
  return FunctionalSpecificationOutcome.present(StateMachineSketches.of(machines));
}
function parseDomainEntitiesDocument(md) {
  if (md === null)
    return DomainEntitiesOutcome.absent();
  const compFence = extractFences(md, "yaml")[0];
  const parsed = compFence === undefined ? { error: "no yaml fence" } : parseYamlSubset(compFence.body);
  if (parsed.error !== undefined)
    return DomainEntitiesOutcome.unusable(parsed.error);
  const value = "value" in parsed ? parsed.value ?? null : null;
  const out = [];
  if (isObject(value) && Array.isArray(value.components)) {
    for (const raw of value.components) {
      if (!isObject(raw) || typeof raw.name !== "string")
        continue;
      if (!Array.isArray(raw.entities))
        continue;
      for (const e of raw.entities) {
        if (!isObject(e) || typeof e.name !== "string")
          continue;
        const attributes = Array.isArray(e.attributes) ? e.attributes.filter((a) => typeof a === "string") : [];
        const fields = combineResults({
          name: EntityName.parse(e.name),
          component: ComponentName.parse(raw.name),
          attributes: traverseResult(attributes, AttributeName.parse)
        });
        if (!fields.ok)
          return DomainEntitiesOutcome.unusable(JSON.stringify(fields.error));
        const parsedAttributes = AttributeNames.parse(fields.value.attributes);
        if (!parsedAttributes.ok)
          return DomainEntitiesOutcome.unusable(JSON.stringify(parsedAttributes.error));
        out.push(DomainEntitySketch.of({
          name: fields.value.name,
          component: fields.value.component,
          attributes: parsedAttributes.value
        }));
      }
    }
  }
  const parsedEntities = DomainEntitySketches.parse(out);
  return parsedEntities.ok ? DomainEntitiesOutcome.extracted(parsedEntities.value) : DomainEntitiesOutcome.unusable(JSON.stringify(parsedEntities.error));
}
function buildSiblingUnitEntities(texts) {
  const unitEntities = [];
  for (const { unit, text } of texts) {
    const fence = extractFences(text, "yaml")[0];
    if (fence === undefined)
      continue;
    const parsed = parseYamlSubset(fence.body);
    if (parsed.error !== undefined)
      continue;
    const model = extractEntities(parsed.value ?? null);
    if (!model.ok)
      return err({ kind: "invalid-entities", raw: model.error });
    const name = UnitName.parse(unit);
    if (!name.ok)
      return name;
    unitEntities.push([name.value, model.value.entities()]);
  }
  return SiblingUnitIndex.parse(KeyedIndex.of(unitEntities));
}

// src/refcheck/adapter/design-record-repository-implementation.ts
class DesignRecordRepositoryImplementation {
  findById(id) {
    const artifactPath = id.artifactPath().asString();
    let sourceBytes;
    try {
      sourceBytes = new Uint8Array(readFileSync4(artifactPath));
    } catch {
      return err({ kind: "not-found", path: artifactPath });
    }
    const md = Buffer.from(sourceBytes).toString("utf-8");
    const targetBase = basename2(artifactPath);
    const fdDir = dirname3(artifactPath);
    const isFunctional = basename2(fdDir) === "functional-design";
    const recordRoot = findRecordRoot(isFunctional ? fdDir : dirname3(artifactPath));
    const rel = (p) => relArtifact(recordRoot, p);
    const input = (p, text) => InputAnchor.of({ artifact: rel(p), sha256: ContentHash.ofText(text) });
    let contractSummary = null;
    if (targetBase === "contract-summary.md") {
      const specBlocks = assessSpecBlocks(md);
      if (!specBlocks.ok)
        return err({ kind: "corrupt", path: artifactPath, cause: JSON.stringify(specBlocks.error) });
      contractSummary = {
        contractsTable: parseContractsTable(md),
        specBlocks: specBlocks.value,
        declaredUnits: this.#declaredUnits(recordRoot)
      };
    }
    const functional = isFunctional ? this.#functional(recordRoot, fdDir) : ok(null);
    if (!functional.ok)
      return functional;
    const seed = {
      id,
      target: input(artifactPath, md),
      sourceDocument: sourceBytes,
      componentCatalog: targetBase === "components.md" ? parseComponentCatalog(md) : null,
      contractSummary,
      functional: functional.value
    };
    return ok(DesignRecord.of(seed));
  }
  store(record) {
    const path = record.id().artifactPath().asString();
    const bytes = record.sourceDocument();
    try {
      writeFileAtomically(path, bytes);
      return ok(undefined);
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path, cause: e instanceof Error ? e.message : String(e) });
    }
  }
  #declaredUnits(recordRoot) {
    const depPath = recordRoot === null ? null : join4(recordRoot, "inception", "units-generation", "unit-of-work-dependency.md");
    const depMd = depPath === null ? null : readIfExists(depPath);
    if (depPath === null || depMd === null) {
      return {
        artifactName: ArtifactPath.of(depPath === null ? "unit-of-work-dependency.md" : relArtifact(recordRoot, depPath)),
        document: null
      };
    }
    return {
      artifactName: ArtifactPath.of(relArtifact(recordRoot, depPath)),
      document: {
        input: InputAnchor.of({ artifact: relArtifact(recordRoot, depPath), sha256: ContentHash.ofText(depMd) }),
        outcome: parseDeclaredUnits(depMd)
      }
    };
  }
  #functional(recordRoot, fdDir) {
    const rel = (p) => relArtifact(recordRoot, p);
    const load = (path, parse) => {
      const text = readIfExists(path);
      if (text === null)
        return null;
      return { input: InputAnchor.of({ artifact: rel(path), sha256: ContentHash.ofText(text) }), outcome: parse(text) };
    };
    const unitDir = dirname3(fdDir);
    const unit = recordRoot !== null && basename2(unitDir) !== "construction" && unitDir !== recordRoot ? basename2(unitDir) : undefined;
    const entitiesPath = join4(fdDir, "entities.md");
    const entities = load(entitiesPath, (t) => parseEntitiesDocument(t));
    const rulesPath = join4(fdDir, "rules.md");
    const rules = load(rulesPath, (t) => parseRulesDocument(t));
    const specPath = join4(fdDir, "functional-spec.md");
    const spec = load(specPath, (t) => parseFunctionalSpecDocument(t));
    const reqPath = recordRoot === null ? null : join4(recordRoot, "inception", "requirements-analysis", "requirements.md");
    let requirements = null;
    if (rules?.outcome.isExtracted() && reqPath !== null) {
      const text = readIfExists(reqPath);
      if (text !== null) {
        const parsed = parseRequirementIdentifiers(text);
        if (!parsed.ok)
          return err({ kind: "corrupt", path: reqPath, cause: JSON.stringify(parsed.error) });
        requirements = {
          input: InputAnchor.of({ artifact: rel(reqPath), sha256: ContentHash.ofText(text) }),
          outcome: parsed.value
        };
      }
    }
    const componentsPath = recordRoot === null ? null : join4(recordRoot, "inception", "domain-design", "components.md");
    const components = componentsPath === null ? null : load(componentsPath, (t) => parseDomainEntitiesDocument(t));
    const siblingTexts = [];
    if (components?.outcome.isExtracted() && recordRoot !== null) {
      const constructionDir = join4(recordRoot, "construction");
      for (const u of listSubdirectories(constructionDir)) {
        const p = join4(constructionDir, u, "functional-design", "entities.md");
        const text = readIfExists(p);
        if (text !== null)
          siblingTexts.push({ unit: u, path: p, text });
      }
    }
    const siblingInputs = InputAnchors.parse(siblingTexts.filter((s) => s.path !== entitiesPath).map((s) => InputAnchor.of({ artifact: rel(s.path), sha256: ContentHash.ofText(s.text) })));
    if (!siblingInputs.ok)
      return err({ kind: "corrupt", path: fdDir, cause: JSON.stringify(siblingInputs.error) });
    return ok({
      unit: unit === undefined ? undefined : UnitName.of(unit),
      entitiesArtifact: ArtifactPath.of(rel(entitiesPath)),
      entities,
      rulesArtifact: ArtifactPath.of(rel(rulesPath)),
      rules,
      specArtifact: ArtifactPath.of(rel(specPath)),
      spec,
      requirements,
      componentsArtifact: ArtifactPath.of(componentsPath === null ? "components.md" : rel(componentsPath)),
      components,
      siblingUnits: buildSiblingUnitEntities(siblingTexts),
      siblingInputs: siblingInputs.value
    });
  }
}
// src/refcheck/adapter/reference-check-report-repository-implementation.ts
import { existsSync as existsSync3, readFileSync as readFileSync5 } from "fs";
import { join as join5 } from "path";

// src/refcheck/adapter/reference-check-report-serializer.ts
function renderReportBytes(report) {
  return `${JSON.stringify(report.toDocument(), null, 2)}
`;
}
function parseReportDocument(id, raw) {
  const decoded = parseFindingsValues(raw);
  if (!decoded.ok)
    return err({ cause: decoded.error });
  const doc = decoded.value;
  if (!doc.backend.equals(id.backendName()))
    return err({
      cause: `document backend "${doc.backend.asString()}" does not match the id backend "${id.backendName().asString()}"`
    });
  if (doc.inputs === undefined || doc.checked === undefined)
    return err({ cause: "document lacks inputs/checked/findings/skipped arrays" });
  const checked = traverseResult(doc.checked, TargetIdentifier.parse);
  if (!checked.ok)
    return err({ cause: JSON.stringify(checked.error) });
  const findings = [];
  for (const entry of doc.findings) {
    const witness = isObject(entry.witness) ? entry.witness : {};
    const refs = [];
    for (const rawRef of Array.isArray(witness.refs) ? witness.refs : []) {
      const ref = isObject(rawRef) ? rawRef : {};
      const parsed = combineResults({
        artifact: ArtifactPath.parse(typeof ref.artifact === "string" ? ref.artifact : ""),
        element: ElementPath.parse(typeof ref.element === "string" ? ref.element : "")
      });
      if (!parsed.ok)
        return err({ cause: JSON.stringify(parsed.error) });
      refs.push(WitnessReference.of({
        artifact: parsed.value.artifact.asString(),
        element: parsed.value.element.asString(),
        ...typeof ref.value === "string" ? { value: ref.value } : {}
      }));
    }
    const parsedRefs = WitnessReferences.parse(refs);
    if (!parsedRefs.ok)
      return err({ cause: JSON.stringify(parsedRefs.error) });
    findings.push(Finding.of({ ...entry, witness: { refs: parsedRefs.value } }));
  }
  const collections = combineResults({
    inputs: InputAnchors.parse(doc.inputs.map((entry) => InputAnchor.of({ artifact: entry.artifact.asString(), sha256: entry.sha256 }))),
    checked: TargetIdentifiers.parse(checked.value),
    findings: Findings.parse(findings),
    skipped: Skips.parse(doc.skipped.map(Skipped.of))
  });
  if (!collections.ok)
    return err({ cause: JSON.stringify(collections.error) });
  return ok(ReferenceCheckReport.of({
    id,
    inputs: collections.value.inputs,
    checked: collections.value.checked,
    findings: collections.value.findings,
    skipped: collections.value.skipped,
    unavailableReason: doc.unavailable?.reason ?? null
  }));
}

// src/refcheck/adapter/reference-check-report-repository-implementation.ts
var encoder = new TextEncoder;

class ReferenceCheckReportRepositoryImplementation {
  findById(aggregateId) {
    const path = join5(aggregateId.directory().asString(), aggregateId.fileName());
    if (!existsSync3(path)) {
      return err({ kind: "not-found", path });
    }
    let raw;
    try {
      raw = JSON.parse(readFileSync5(path, "utf-8"));
    } catch (e) {
      return err({ kind: "corrupt", path, cause: e instanceof Error ? e.message : String(e) });
    }
    const report = parseReportDocument(aggregateId, raw);
    if (!report.ok) {
      return err({ kind: "corrupt", path, cause: report.error.cause });
    }
    return report;
  }
  store(report) {
    const path = join5(report.id().directory().asString(), report.id().fileName());
    const bytes = encoder.encode(renderReportBytes(report));
    try {
      writeFileAtomically(path, bytes);
      return ok(undefined);
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path, cause: e instanceof Error ? e.message : String(e) });
    }
  }
}
// src/refcheck/usecase/check-contract-summary-usecase.ts
class CheckContractSummaryUseCase {
  #designRecordRepository;
  #referenceCheckReportRepository;
  #findingsSchema;
  constructor(designRecordRepository, referenceCheckReportRepository, findingsSchema) {
    this.#designRecordRepository = designRecordRepository;
    this.#referenceCheckReportRepository = referenceCheckReportRepository;
    this.#findingsSchema = findingsSchema;
  }
  execute(input) {
    return matchResult(this.#designRecordRepository.findById(input.recordId), {
      err: () => ({ kind: "not-applicable" }),
      ok: (record) => matchResult(record.checkContracts(input.reportDirectory), {
        err: () => ({ kind: "not-applicable" }),
        ok: (report) => {
          const conformed = report.conformedTo(this.#findingsSchema);
          if (input.mode === "report-only")
            return { kind: "verified", report: conformed };
          return matchResult(this.#referenceCheckReportRepository.store(conformed), {
            err: (error) => ({ kind: "save-failed", error }),
            ok: () => ({ kind: "verified", report: conformed })
          });
        }
      })
    });
  }
}
// src/refcheck/usecase/check-domain-components-usecase.ts
class CheckDomainComponentsUseCase {
  #designRecordRepository;
  #referenceCheckReportRepository;
  #findingsSchema;
  constructor(designRecordRepository, referenceCheckReportRepository, findingsSchema) {
    this.#designRecordRepository = designRecordRepository;
    this.#referenceCheckReportRepository = referenceCheckReportRepository;
    this.#findingsSchema = findingsSchema;
  }
  execute(input) {
    return matchResult(this.#designRecordRepository.findById(input.recordId), {
      err: () => ({ kind: "not-applicable" }),
      ok: (record) => matchResult(record.checkComponents(input.reportDirectory), {
        err: () => ({ kind: "not-applicable" }),
        ok: (report) => {
          const conformed = report.conformedTo(this.#findingsSchema);
          if (input.mode === "report-only")
            return { kind: "verified", report: conformed };
          return matchResult(this.#referenceCheckReportRepository.store(conformed), {
            err: (error) => ({ kind: "save-failed", error }),
            ok: () => ({ kind: "verified", report: conformed })
          });
        }
      })
    });
  }
}
// src/refcheck/usecase/check-functional-design-usecase.ts
class CheckFunctionalDesignUseCase {
  #designRecordRepository;
  #referenceCheckReportRepository;
  #findingsSchema;
  constructor(designRecordRepository, referenceCheckReportRepository, findingsSchema) {
    this.#designRecordRepository = designRecordRepository;
    this.#referenceCheckReportRepository = referenceCheckReportRepository;
    this.#findingsSchema = findingsSchema;
  }
  execute(input) {
    return matchResult(this.#designRecordRepository.findById(input.recordId), {
      err: () => ({ kind: "not-applicable" }),
      ok: (record) => matchResult(record.checkFunctionalDesign(input.reportDirectory), {
        err: () => ({ kind: "not-applicable" }),
        ok: (report) => {
          const conformed = report.conformedTo(this.#findingsSchema);
          if (input.mode === "report-only")
            return { kind: "verified", report: conformed };
          return matchResult(this.#referenceCheckReportRepository.store(conformed), {
            err: (error) => ({ kind: "save-failed", error }),
            ok: () => ({ kind: "verified", report: conformed })
          });
        }
      })
    });
  }
}
// src/entries/aidlc-sensor-deep-spec-refcheck-contract.ts
function main() {
  const flags = parseFlags(process.argv.slice(2));
  const target = ArtifactPath.parse(flags.outputPath);
  const reportLocation = ArtifactPath.parse(join6(dirname4(flags.outputPath), "deep-spec-refcheck"));
  if (!target.ok || !reportLocation.ok) {
    process.stderr.write(`deep-spec-refcheck-contract: --output-path is required
`);
    process.exit(1);
  }
  if (basename3(flags.outputPath) !== "contract-summary.md") {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "not-applicable" })}
`);
    process.exit(0);
  }
  const findingsSchema = readFindingsSchema(join6(dirname4(fileURLToPath(import.meta.url)), "data", "deep-spec-findings-schema.json"));
  const reportRepository = new ReferenceCheckReportRepositoryImplementation;
  const useCase = new CheckContractSummaryUseCase(new DesignRecordRepositoryImplementation, reportRepository, findingsSchema);
  const outcome = useCase.execute({
    recordId: DesignRecordIdentifier.of(target.value),
    reportDirectory: reportLocation.value,
    mode: flags.reportOnly ? "report-only" : "persist"
  });
  if (outcome.kind === "not-applicable") {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "not-applicable" })}
`);
    process.exit(0);
  }
  if (outcome.kind === "save-failed") {
    process.stderr.write(`deep-spec-refcheck: failed to write ${outcome.error.path}: ${outcome.error.kind}${"cause" in outcome.error ? ` (${outcome.error.cause})` : ""}
`);
    process.exit(1);
  }
  process.stdout.write(renderVerdictLine(outcome.report.passes(), outcome.report.findingsCount(), outcome.report.skippedCount(), flags.reportOnly ? "report-only" : undefined));
  process.exit(0);
}
main();
