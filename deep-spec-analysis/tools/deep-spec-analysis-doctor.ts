// @bun
// src/entries/deep-spec-analysis-doctor.ts
import { join as join8 } from "path";

// src/doctor/adapter/backend-evidence-reader.ts
import { join as join2 } from "path";

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
// src/doctor/domain/artifact-modified-at.ts
class ArtifactModifiedAt {
  #value;
  constructor(milliseconds) {
    if (!Number.isFinite(milliseconds) || Math.abs(milliseconds) > Number.MAX_SAFE_INTEGER)
      throw new IllegalArgumentException({ kind: "invalid-artifact-modified-at", raw: milliseconds });
    this.#value = milliseconds;
  }
  static of(milliseconds) {
    return new ArtifactModifiedAt(milliseconds);
  }
  static parse(milliseconds) {
    return parseConstruction(() => new ArtifactModifiedAt(milliseconds));
  }
  isAfter(other) {
    return this.#value > other.#value;
  }
}
// src/doctor/domain/check.ts
class Check {
  #pass;
  #label;
  #fix;
  #severity;
  constructor(props) {
    this.#pass = props.pass;
    this.#label = props.label;
    this.#fix = props.fix;
    this.#severity = props.severity;
  }
  static of(props) {
    return new Check(props);
  }
  passes() {
    return this.#pass;
  }
  label() {
    return this.#label;
  }
  fix() {
    return this.#fix;
  }
  severity() {
    return this.#severity;
  }
  equals(other) {
    return this.#pass === other.#pass && this.#label === other.#label && this.#fix === other.#fix && this.#severity.equals(other.#severity);
  }
  toDocument() {
    return {
      pass: this.#pass,
      label: this.#label,
      ...this.#fix !== undefined ? { fix: this.#fix } : {},
      severity: this.#severity.asString()
    };
  }
}
// src/doctor/domain/check-severity.ts
class CheckSeverity {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static error() {
    return new CheckSeverity("error");
  }
  static advisory() {
    return new CheckSeverity("advisory");
  }
  blocksDoctor() {
    return this.#value === "error";
  }
  isAdvisory() {
    return this.#value === "advisory";
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
}
// src/doctor/domain/coverage-assessment.ts
class CoverageAssessment {
  #observations;
  #scopes;
  constructor(observations, scopes) {
    this.#observations = boundedCollectionSnapshot(observations, 65536, "too-many-verification-observations");
    this.#scopes = scopes;
  }
  static of(observations, scopes) {
    return new CoverageAssessment(observations, scopes);
  }
  static parse(observations, scopes) {
    return parseConstruction(() => new CoverageAssessment(observations, scopes));
  }
  isClean() {
    return this.problems().length === 0;
  }
  verifiedCount() {
    return this.#observations.length - this.problems().length;
  }
  eligibleCount() {
    return this.#observations.length;
  }
  problems() {
    return this.#observations.filter((observation) => observation.problemState() !== null);
  }
  scopes() {
    return this.#scopes;
  }
}
// src/doctor/domain/coverage-state.ts
class CoverageState {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static unverified() {
    return new CoverageState("unverified");
  }
  static stale() {
    return new CoverageState("stale");
  }
  match(handlers) {
    return this.#value === "unverified" ? handlers.unverified() : handlers.stale();
  }
  equals(other) {
    return this.#value === other.#value;
  }
}
// src/doctor/domain/design-artifact-reference.ts
class DesignArtifactReference {
  #location;
  #tool;
  #artifactPath;
  #relativePath;
  constructor(props) {
    this.#location = props.location;
    this.#tool = props.tool;
    this.#artifactPath = props.artifactPath;
    this.#relativePath = props.relativePath;
  }
  static of(props) {
    return new DesignArtifactReference(props);
  }
  location() {
    return this.#location;
  }
  tool() {
    return this.#tool;
  }
  artifactPath() {
    return this.#artifactPath;
  }
  relativePath() {
    return this.#relativePath;
  }
  equals(other) {
    return this.#location.space().equals(other.#location.space()) && this.#location.intent().equals(other.#location.intent()) && this.#tool.equals(other.#tool) && this.#artifactPath.equals(other.#artifactPath) && this.#relativePath.equals(other.#relativePath);
  }
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
// src/doctor/domain/design-artifacts.ts
class DesignArtifacts extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-design-artifacts");
  }
  rebuild(values) {
    return new DesignArtifacts(values);
  }
  static of(values) {
    return new DesignArtifacts(values);
  }
  static parse(values) {
    return parseConstruction(() => new DesignArtifacts(values));
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
}
// src/doctor/domain/digest-anchor.ts
class DigestAnchor {
  #expected;
  #actual;
  constructor(expected, actual) {
    this.#expected = expected;
    this.#actual = actual;
  }
  static of(expected, actual) {
    return new DigestAnchor(expected, actual);
  }
  isStale() {
    return !this.#expected.equals(this.#actual);
  }
}
// src/doctor/domain/finding-count.ts
class FindingCount {
  #value;
  constructor(value) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 1e6)
      throw new IllegalArgumentException({ kind: "invalid-finding-count", raw: value });
    this.#value = value;
  }
  static of(value) {
    return new FindingCount(value);
  }
  static parse(value) {
    return parseConstruction(() => new FindingCount(value));
  }
  isEmpty() {
    return this.#value === 0;
  }
  asNumber() {
    return this.#value;
  }
}
// src/doctor/domain/unit-coverage-problem.ts
class UnitCoverageProblem {
  #location;
  #state;
  constructor(location, state) {
    this.#location = location;
    this.#state = state;
  }
  static of(location, unit, state) {
    return new UnitCoverageProblem(location, { kind: "valid", unit, coverage: state });
  }
  static invalid(location, detail) {
    return new UnitCoverageProblem(location, { kind: "invalid", detail });
  }
  location() {
    return this.#location;
  }
  match(handlers) {
    return this.#state.kind === "valid" ? handlers.valid(this.#state.unit, this.#state.coverage) : handlers.invalid(this.#state.detail);
  }
}

// src/doctor/domain/functional-observation.ts
class FunctionalObservation {
  #location;
  #units;
  #modelModifiedAt;
  #modelUnits;
  #completedUnits;
  #hasFindings;
  #requirementsModelModifiedAt;
  constructor(props) {
    const units = boundedCollectionSnapshot(props.units, 65536, "too-many-functional-units");
    const modelUnits = boundedCollectionSnapshot(props.modelUnits, 65536, "too-many-functional-units");
    const completedUnits = boundedCollectionSnapshot(props.completedUnits, 65536, "too-many-functional-units");
    this.#location = props.location;
    this.#units = units;
    this.#modelModifiedAt = props.modelModifiedAt;
    this.#modelUnits = KeySet.of(modelUnits);
    this.#completedUnits = KeySet.of(completedUnits);
    this.#hasFindings = props.hasFindings;
    this.#requirementsModelModifiedAt = props.requirementsModelModifiedAt;
  }
  static of(props) {
    return new FunctionalObservation(props);
  }
  static parse(props) {
    return parseConstruction(() => new FunctionalObservation(props));
  }
  location() {
    return this.#location;
  }
  eligibleCount() {
    return this.#units.length;
  }
  problems() {
    const out = [];
    for (const unit of this.#units) {
      if (this.#modelModifiedAt === null || !this.#modelUnits.has(unit.name()) || !this.#hasFindings || !this.#completedUnits.has(unit.name())) {
        out.push(UnitCoverageProblem.of(this.#location, unit.name(), CoverageState.unverified()));
      } else if (unit.changedAfter(this.#modelModifiedAt)) {
        out.push(UnitCoverageProblem.of(this.#location, unit.name(), CoverageState.stale()));
      }
    }
    return out;
  }
  refinementIsStale() {
    return this.#modelModifiedAt !== null && this.#hasFindings && (this.#requirementsModelModifiedAt?.isAfter(this.#modelModifiedAt) ?? false);
  }
}
// src/doctor/domain/functional-unit-observation.ts
class FunctionalUnitObservation {
  #name;
  #newestArtifact;
  constructor(name, newestArtifact) {
    this.#name = name;
    this.#newestArtifact = newestArtifact;
  }
  static of(name, newestArtifact) {
    return new FunctionalUnitObservation(name, newestArtifact);
  }
  name() {
    return this.#name;
  }
  changedAfter(model) {
    return this.#newestArtifact.isAfter(model);
  }
}
// src/doctor/domain/health-verdict.ts
class HealthVerdict extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65536, "too-many-health-checks");
  }
  rebuild(values) {
    return new HealthVerdict(values);
  }
  static parse(values) {
    return parseConstruction(() => new HealthVerdict(values));
  }
  static of(values) {
    return new HealthVerdict(values);
  }
  add(value) {
    return new HealthVerdict([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  document() {
    return { checks: this.#values.map((c) => c.toDocument()) };
  }
}
// src/doctor/domain/manifest-entry.ts
class ManifestEntry {
  #rel;
  #severity;
  constructor(rel, severity) {
    this.#rel = rel;
    this.#severity = severity;
  }
  static error(rel) {
    return new ManifestEntry(rel, CheckSeverity.error());
  }
  rel() {
    return this.#rel.asString();
  }
  severity() {
    return this.#severity;
  }
  equals(other) {
    return this.#rel.equals(other.#rel) && this.#severity.equals(other.#severity);
  }
}

// src/doctor/domain/installation-manifest.ts
var err2 = (rel) => ManifestEntry.error(ArtifactPath.of(rel));

class InstallationManifest extends NonEmptyFirstClassCollectionBase {
  #entries;
  constructor(entries) {
    super();
    this.#entries = Object.freeze([...entries]);
  }
  rebuild(values) {
    return ImmutableFirstClassCollection.of(values);
  }
  static standard() {
    return new InstallationManifest([
      err2("sensors/aidlc-deep-spec-ir-valid.md"),
      err2("sensors/aidlc-deep-spec-verify-smt.md"),
      err2("sensors/aidlc-deep-spec-verify-quint.md"),
      err2("tools/aidlc-sensor-deep-spec-ir-valid.ts"),
      err2("tools/aidlc-sensor-deep-spec-verify-smt.ts"),
      err2("tools/aidlc-sensor-deep-spec-verify-quint.ts"),
      err2("tools/data/deep-spec-ir-schema.json"),
      err2("tools/data/deep-spec-findings-schema.json"),
      err2("knowledge/aidlc-product-agent/deep-spec-ir-authoring.md"),
      err2("sensors/aidlc-deep-spec-refcheck-domain.md"),
      err2("sensors/aidlc-deep-spec-refcheck-contract.md"),
      err2("sensors/aidlc-deep-spec-refcheck-functional.md"),
      err2("tools/aidlc-sensor-deep-spec-refcheck-domain.ts"),
      err2("tools/aidlc-sensor-deep-spec-refcheck-contract.ts"),
      err2("tools/aidlc-sensor-deep-spec-refcheck-functional.ts"),
      err2("tools/deep-spec-analysis-doctor.ts"),
      err2("sensors/aidlc-deep-spec-design-ir-valid.md"),
      err2("sensors/aidlc-deep-spec-design-verify-smt.md"),
      err2("sensors/aidlc-deep-spec-design-verify-quint.md"),
      err2("tools/aidlc-sensor-deep-spec-design-ir-valid.ts"),
      err2("tools/aidlc-sensor-deep-spec-design-verify-smt.ts"),
      err2("tools/aidlc-sensor-deep-spec-design-verify-quint.ts"),
      err2("tools/data/deep-spec-design-ir-schema.json"),
      err2("knowledge/aidlc-architect-agent/deep-spec-design-ir-authoring.md"),
      err2("tools/data/deep-spec-refinement-map-schema.json"),
      err2("knowledge/aidlc-architect-agent/deep-spec-refinement-map-authoring.md")
    ]);
  }
  *[Symbol.iterator]() {
    yield* this.#entries;
  }
}
// src/doctor/domain/version-advisory.ts
class VersionAdvisory {
  #variant;
  constructor(variant) {
    this.#variant = Object.freeze({ ...variant });
  }
  static current(installed, latest) {
    return new VersionAdvisory({ kind: "current", installed, latest });
  }
  static updateAvailable(installed, latest) {
    return new VersionAdvisory({ kind: "update-available", installed, latest });
  }
  static skipped(installed, reason) {
    return new VersionAdvisory({ kind: "skipped", installed, reason });
  }
  static provenanceMissing() {
    return new VersionAdvisory({ kind: "provenance-missing" });
  }
  static provenanceMalformed(reason) {
    return new VersionAdvisory({ kind: "provenance-malformed", reason });
  }
  match(cases) {
    const variant = this.#variant;
    if (variant.kind === "provenance-missing")
      return cases.provenanceMissing();
    if (variant.kind === "provenance-malformed")
      return cases.provenanceMalformed(variant.reason);
    if (variant.kind === "skipped")
      return cases.skipped(variant.installed, variant.reason);
    return variant.kind === "current" ? cases.current(variant.installed, variant.latest) : cases.updateAvailable(variant.installed, variant.latest);
  }
}

// src/doctor/domain/installation-provenance.ts
class InstallationProvenance {
  #variant;
  constructor(variant) {
    this.#variant = Object.freeze({ ...variant });
  }
  static installed(release) {
    return new InstallationProvenance({ kind: "installed", release });
  }
  static missing() {
    return new InstallationProvenance({ kind: "unavailable", advisory: VersionAdvisory.provenanceMissing() });
  }
  static malformed(reason) {
    return new InstallationProvenance({ kind: "unavailable", advisory: VersionAdvisory.provenanceMalformed(reason) });
  }
  match(cases) {
    return this.#variant.kind === "installed" ? cases.installed(this.#variant.release) : cases.unavailable(this.#variant.advisory);
  }
}
// src/doctor/domain/installation-source.ts
class InstallationSource {
  #value;
  constructor(value) {
    if (value.length > 6)
      throw new IllegalArgumentException({ kind: "invalid-installation-source-size", raw: value.length });
    if (value !== "local" && value !== "ref" && value !== "tag" && value !== "latest")
      throw new IllegalArgumentException({ kind: "invalid-installation-source", raw: value });
    this.#value = value;
  }
  static of(value) {
    return new InstallationSource(value);
  }
  static parse(value) {
    return parseConstruction(() => new InstallationSource(value));
  }
  asString() {
    return this.#value;
  }
}
// src/doctor/domain/installed-release.ts
class InstalledRelease {
  #version;
  #source;
  #reference;
  constructor(version, source, reference) {
    this.#version = version;
    this.#source = source;
    this.#reference = reference;
  }
  static of(version, source, reference) {
    return new InstalledRelease(version, source, reference);
  }
  assessLatest(latest) {
    return this.#version.isOlderThan(latest) ? VersionAdvisory.updateAvailable(this, latest) : VersionAdvisory.current(this, latest);
  }
  version() {
    return this.#version;
  }
  source() {
    return this.#source;
  }
  reference() {
    return this.#reference;
  }
}
// src/doctor/domain/installed-status.ts
class InstalledStatus {
  #entry;
  #present;
  constructor(entry, present) {
    this.#entry = entry;
    this.#present = present;
  }
  static of(entry, present) {
    return new InstalledStatus(entry, present);
  }
  entry() {
    return this.#entry;
  }
  isPresent() {
    return this.#present;
  }
}
// src/doctor/domain/intent-location.ts
class IntentLocation {
  #space;
  #intent;
  constructor(space, intent) {
    this.#space = space;
    this.#intent = intent;
  }
  static of(space, intent) {
    return new IntentLocation(space, intent);
  }
  space() {
    return this.#space;
  }
  intent() {
    return this.#intent;
  }
}
// src/doctor/domain/plugin-version.ts
class PluginVersion {
  #major;
  #minor;
  #patch;
  constructor(raw) {
    if (raw.length > 129 || raw.length === 129 && raw[0] !== "v")
      throw new IllegalArgumentException({ kind: "plugin-version-too-long", raw: raw.length });
    const match = raw.match(/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
    const major = match?.[1];
    const minor = match?.[2];
    const patch = match?.[3];
    if (major === undefined || minor === undefined || patch === undefined)
      throw new IllegalArgumentException({ kind: "invalid-plugin-version", raw });
    this.#major = BigInt(major);
    this.#minor = BigInt(minor);
    this.#patch = BigInt(patch);
  }
  static of(raw) {
    return new PluginVersion(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new PluginVersion(raw));
  }
  isOlderThan(other) {
    if (this.#major !== other.#major)
      return this.#major < other.#major;
    if (this.#minor !== other.#minor)
      return this.#minor < other.#minor;
    return this.#patch < other.#patch;
  }
  equals(other) {
    return this.#major === other.#major && this.#minor === other.#minor && this.#patch === other.#patch;
  }
  asString() {
    return `${this.#major}.${this.#minor}.${this.#patch}`;
  }
  asTag() {
    return `v${this.asString()}`;
  }
}
// src/doctor/domain/release-catalog.ts
class ReleaseCatalog {
  #variant;
  constructor(variant) {
    this.#variant = Object.freeze({ ...variant });
  }
  static available(releases) {
    return new ReleaseCatalog({ kind: "available", releases });
  }
  static unavailable(reason) {
    return new ReleaseCatalog({ kind: "unavailable", reason });
  }
  advise(installed) {
    return this.#variant.kind === "available" ? this.#variant.releases.advise(installed) : VersionAdvisory.skipped(installed, this.#variant.reason);
  }
}
// src/doctor/domain/solver-availability.ts
class SolverAvailability {
  #z3Package;
  #nodeRuntime;
  #quintCli;
  #apalache;
  #apalacheServerStale;
  constructor(props) {
    this.#z3Package = props.z3Package;
    this.#nodeRuntime = props.nodeRuntime;
    this.#quintCli = props.quintCli;
    this.#apalache = props.apalache;
    this.#apalacheServerStale = props.apalacheServerStale;
  }
  static of(props) {
    return new SolverAvailability(props);
  }
  hasZ3Package() {
    return this.#z3Package;
  }
  hasNodeRuntime() {
    return this.#nodeRuntime;
  }
  hasQuintCli() {
    return this.#quintCli;
  }
  hasApalache() {
    return this.#apalache && !this.#apalacheServerStale;
  }
  apalacheServerIsStale() {
    return this.#apalacheServerStale;
  }
}
// src/doctor/domain/stable-releases.ts
class StableReleases extends FirstClassCollectionBase {
  #versions;
  constructor(versions) {
    super();
    this.#versions = boundedCollectionSnapshot(versions, 1e4, "too-many-stable-releases");
  }
  rebuild(values) {
    return new StableReleases(values);
  }
  *[Symbol.iterator]() {
    yield* this.#versions;
  }
  static of(versions) {
    return new StableReleases(versions);
  }
  static parse(versions) {
    return parseConstruction(() => new StableReleases(versions));
  }
  advise(installed) {
    let latest = null;
    for (const version of this.#versions)
      if (latest === null || latest.isOlderThan(version))
        latest = version;
    return latest === null ? VersionAdvisory.skipped(installed, ErrorMessage.of("GitHub returned no stable Semantic Versioning tag")) : installed.assessLatest(latest);
  }
}
// src/doctor/domain/stage-scope.ts
class StageScope {
  #value;
  constructor(value) {
    if (value.length === 0 || value.length > 128)
      throw new IllegalArgumentException({ kind: "invalid-stage-scope-size", raw: value.length });
    if (!/^[a-z][a-z0-9-]*$/.test(value))
      throw new IllegalArgumentException({ kind: "invalid-stage-scope", raw: value });
    this.#value = value;
  }
  static of(value) {
    return new StageScope(value);
  }
  static parse(value) {
    return parseConstruction(() => new StageScope(value));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
}
// src/doctor/domain/stage-scopes.ts
class StageScopes extends FirstClassCollectionBase {
  #values;
  constructor(values) {
    super();
    this.#values = boundedCollectionSnapshot(values, 1024, "too-many-stage-scopes");
  }
  rebuild(values) {
    return new StageScopes(values);
  }
  static of(values) {
    return new StageScopes(values);
  }
  static parse(values) {
    return parseConstruction(() => new StageScopes(values));
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
}
// src/doctor/domain/structural-debt.ts
class StructuralDebt extends FirstClassCollectionBase {
  #observations;
  constructor(observations) {
    super();
    this.#observations = boundedCollectionSnapshot(observations, 65536, "too-many-structural-observations");
  }
  rebuild(values) {
    return new StructuralDebt(values);
  }
  *[Symbol.iterator]() {
    yield* this.#observations;
  }
  static of(observations) {
    return new StructuralDebt(observations);
  }
  static parse(observations) {
    return parseConstruction(() => new StructuralDebt(observations));
  }
  hasScans() {
    return this.#observations.some((observation) => observation.wasScanned());
  }
  isComplete() {
    return this.#observations.every((observation) => observation.isComplete());
  }
  scannedCount() {
    return this.#observations.filter((observation) => observation.wasScanned()).length;
  }
  totalFindings() {
    return this.#observations.reduce((sum, observation) => sum + observation.match({
      complete: (findings) => findings.asNumber(),
      partial: (findings) => findings.asNumber(),
      unavailable: () => 0
    }), 0);
  }
  rows() {
    return this.#observations.filter((observation) => !observation.isComplete() || observation.hasDebt());
  }
}
// src/doctor/domain/structural-observation.ts
class StructuralObservation {
  #artifact;
  #state;
  constructor(artifact, state) {
    this.#artifact = artifact;
    this.#state = state;
  }
  static of(artifact, findings) {
    return new StructuralObservation(artifact, { kind: "complete", findings });
  }
  static partial(artifact, findings, reason) {
    return new StructuralObservation(artifact, { kind: "partial", findings, reason });
  }
  static unavailable(artifact, reason) {
    return new StructuralObservation(artifact, { kind: "unavailable", reason });
  }
  wasScanned() {
    return this.#state.kind !== "unavailable";
  }
  isComplete() {
    return this.#state.kind === "complete";
  }
  hasDebt() {
    return this.#state.kind !== "unavailable" && !this.#state.findings.isEmpty();
  }
  artifact() {
    return this.#artifact;
  }
  match(handlers) {
    if (this.#state.kind === "complete")
      return handlers.complete(this.#state.findings);
    if (this.#state.kind === "partial")
      return handlers.partial(this.#state.findings, this.#state.reason);
    return handlers.unavailable(this.#state.reason);
  }
  equals(other) {
    if (!this.#artifact.equals(other.#artifact) || this.#state.kind !== other.#state.kind)
      return false;
    if (this.#state.kind === "unavailable" && other.#state.kind === "unavailable")
      return this.#state.reason.equals(other.#state.reason);
    if (this.#state.kind === "complete" && other.#state.kind === "complete")
      return this.#state.findings.asNumber() === other.#state.findings.asNumber();
    if (this.#state.kind === "partial" && other.#state.kind === "partial")
      return this.#state.findings.asNumber() === other.#state.findings.asNumber() && this.#state.reason.equals(other.#state.reason);
    return false;
  }
}
// src/doctor/domain/unit-coverage.ts
class UnitCoverage {
  #observations;
  #scopes;
  #invalidProblems;
  constructor(observations, scopes, invalidProblems) {
    const snapshot = boundedCollectionSnapshot(observations, 65536, "too-many-functional-observations");
    const invalidSnapshot = boundedCollectionSnapshot(invalidProblems, 65536, "too-many-invalid-functional-units");
    let units = invalidSnapshot.length;
    for (const observation of snapshot) {
      units += observation.eligibleCount();
      if (units > 65536)
        throw new IllegalArgumentException({ kind: "too-many-covered-units", raw: units });
    }
    this.#observations = snapshot;
    this.#scopes = scopes;
    this.#invalidProblems = invalidSnapshot;
  }
  static of(observations, scopes, invalidProblems) {
    return new UnitCoverage(observations, scopes, invalidProblems);
  }
  static parse(observations, scopes, invalidProblems) {
    return parseConstruction(() => new UnitCoverage(observations, scopes, invalidProblems));
  }
  hasEligible() {
    return this.eligibleCount() > 0;
  }
  isClean() {
    return this.problems().length === 0;
  }
  verifiedCount() {
    return this.eligibleCount() - this.#observations.flatMap((observation) => observation.problems()).length;
  }
  eligibleCount() {
    return this.#observations.reduce((sum, observation) => sum + observation.eligibleCount(), 0);
  }
  problems() {
    return [...this.#invalidProblems, ...this.#observations.flatMap((observation) => observation.problems())];
  }
  refinementStale() {
    return this.#observations.filter((observation) => observation.refinementIsStale()).map((observation) => observation.location());
  }
  scopes() {
    return this.#scopes;
  }
}
// src/doctor/domain/verification-evidence.ts
var INCOMPLETE_SKIP_REASONS = new Set([
  "timeout",
  "unavailable",
  "compile-error",
  "ir-version-mismatch",
  "unrecognized-format"
]);

class VerificationEvidence {
  #irHash;
  #unavailable;
  #skippedReasons;
  #checkedUnits;
  constructor(props) {
    this.#irHash = props.irHash;
    this.#unavailable = props.unavailable;
    this.#skippedReasons = boundedCollectionSnapshot(props.skippedReasons, 65536, "too-many-skip-reasons");
    this.#checkedUnits = boundedCollectionSnapshot(props.checkedUnits, 65536, "too-many-checked-units");
  }
  static of(props) {
    return new VerificationEvidence(props);
  }
  static parse(props) {
    return parseConstruction(() => new VerificationEvidence(props));
  }
  countsFor(hash) {
    return this.#irHash.equals(hash) && this.#unavailable === null && this.#skippedReasons.every((reason) => !INCOMPLETE_SKIP_REASONS.has(reason.asString()));
  }
  completedUnitsFor(hash) {
    return this.countsFor(hash) ? [...this.#checkedUnits] : [];
  }
  equals(other) {
    return this.#irHash.equals(other.#irHash) && (this.#unavailable === null ? other.#unavailable === null : other.#unavailable !== null && this.#unavailable.equals(other.#unavailable)) && this.#skippedReasons.length === other.#skippedReasons.length && this.#skippedReasons.every((reason, index) => reason.asString() === other.#skippedReasons[index]?.asString()) && this.#checkedUnits.length === other.#checkedUnits.length && this.#checkedUnits.every((unit, index) => {
      const otherUnit = other.#checkedUnits[index];
      return otherUnit !== undefined && unit.equals(otherUnit);
    });
  }
}
// src/doctor/domain/verification-staleness.ts
class VerificationStaleness {
  #anchor;
  constructor(props) {
    this.#anchor = props.anchor;
  }
  static of(props) {
    return new VerificationStaleness(props);
  }
  isStale() {
    return this.#anchor === null ? true : this.#anchor.isStale();
  }
}

// src/doctor/domain/verification-observation.ts
class VerificationObservation {
  #location;
  #hasModel;
  #hasFindings;
  #anchor;
  constructor(props) {
    this.#location = props.location;
    this.#hasModel = props.hasModel;
    this.#hasFindings = props.hasFindings;
    this.#anchor = props.anchor;
  }
  static of(props) {
    return new VerificationObservation(props);
  }
  location() {
    return this.#location;
  }
  problemState() {
    if (!this.#hasModel || !this.#hasFindings)
      return CoverageState.unverified();
    return VerificationStaleness.of({ anchor: this.#anchor }).isStale() ? CoverageState.stale() : null;
  }
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
// src/kernel/adapter/directory-finalization-lock.ts
import { randomBytes } from "crypto";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
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
    return join(directory.asString(), this.#lockBasename);
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
      renameSync(canonical, stale);
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
      renameSync(canonical, cleanup);
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
      mkdirSync(canonical);
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
      writeFileSync(join(canonical, METADATA_BASENAME), `${JSON.stringify(metadata)}
`, "utf-8");
      return null;
    } catch (e) {
      const cleanup = `${canonical}.cleanup.${token}`;
      try {
        renameSync(canonical, cleanup);
        this.#discard(cleanup);
      } catch {}
      return causeOf(e);
    }
  }
  #readMetadata(canonical) {
    const path = join(canonical, METADATA_BASENAME);
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
      rmSync(ownPath, { recursive: true, force: true });
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
  } catch (err3) {
    return { error: err3 instanceof Error ? err3.message : String(err3) };
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
  const entries = [];
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
        entries.push([key, child]);
        i = ni;
      } else {
        entries.push([key, null]);
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
      entries.push([key, parts.join(valPart.startsWith(">") ? " " : `
`)]);
      i = j;
      continue;
    }
    entries.push([key, parseScalar(valPart, line.n)]);
    i++;
  }
  return [Object.fromEntries(entries), i];
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
// src/doctor/adapter/backend-evidence-reader.ts
var BACKENDS = ["smt.json", "quint.json"];
function readBackendEvidence(directory) {
  const listing = readDirectory(directory);
  if (!listing.ok)
    return listing.error.kind === "not-found" ? ok([]) : err(listing.error);
  const names = new Set(listing.value.map((entry) => entry.name));
  const evidence = [];
  for (const backend of BACKENDS) {
    if (!names.has(backend))
      continue;
    const path = join2(directory, backend);
    const read = readArtifactText(path);
    if (!read.ok)
      return err(read.error);
    let raw;
    try {
      raw = JSON.parse(read.value);
    } catch (error) {
      return err({ kind: "corrupt", path, cause: error instanceof Error ? error.message : String(error) });
    }
    const parsed = parseFindingsValues(raw);
    if (!parsed.ok)
      return err({ kind: "corrupt", path, cause: parsed.error });
    if (parsed.value.backend.asString() !== backend.slice(0, -5))
      return err({ kind: "corrupt", path, cause: "findings backend does not match its filename" });
    const unavailable = parsed.value.unavailable === undefined ? null : ErrorMessage.parse(parsed.value.unavailable.reason);
    if (unavailable !== null && !unavailable.ok)
      return err({ kind: "corrupt", path, cause: JSON.stringify(unavailable.error) });
    const checkedUnits = [];
    for (const checked of parsed.value.checked ?? []) {
      const target = TargetIdentifier.parse(checked);
      if (!target.ok || !checked.startsWith("unit:"))
        return err({
          kind: "corrupt",
          path,
          cause: JSON.stringify(target.ok ? { kind: "checked-unit-prefix" } : target.error)
        });
      const unit = UnitName.parse(checked.slice("unit:".length));
      if (!unit.ok)
        return err({ kind: "corrupt", path, cause: JSON.stringify(unit.error) });
      checkedUnits.push(unit.value);
    }
    const built = VerificationEvidence.parse({
      irHash: parsed.value.irHash,
      unavailable: unavailable === null ? null : unavailable.value,
      skippedReasons: parsed.value.skipped.map((entry) => entry.reason),
      checkedUnits
    });
    if (!built.ok)
      return err({ kind: "corrupt", path, cause: JSON.stringify(built.error) });
    evidence.push(built.value);
  }
  return ok(Object.freeze(evidence));
}
// src/doctor/adapter/doctor-presenter.ts
class DoctorPresenter {
  #harnessDir;
  constructor(config) {
    this.#harnessDir = config.harnessDir;
  }
  installation(result) {
    if (!result.ok)
      return [this.#acquisitionFailure("installation manifest", result.error, CheckSeverity.error())];
    return result.value.map((s) => Check.of({
      pass: s.isPresent(),
      label: `deep-spec-analysis: ${s.entry().rel()} installed`,
      fix: `Run \`bun ${this.#harnessDir}/tools/aidlc-utility.ts plugin-sync\` (or re-run the plugin's \`hooks/compose.ts\`).`,
      severity: s.entry().severity()
    }));
  }
  version(advisory) {
    return advisory.match({
      current: (installed, latest) => Check.of({
        pass: true,
        label: `deep-spec-analysis: version ${installed.version().asString()} from ${installed.source().asString()} ${installed.reference().asString()} is current (latest stable tag: ${latest.asTag()})`,
        severity: CheckSeverity.advisory()
      }),
      updateAvailable: (installed, latest) => Check.of({
        pass: false,
        label: `deep-spec-analysis: update available \u2014 version ${installed.version().asString()} from ${installed.source().asString()} ${installed.reference().asString()}; latest stable tag is ${latest.asTag()}`,
        fix: "Re-run the installer with `--project . --update` (and the same `--harness` selector used for this installation).",
        severity: CheckSeverity.advisory()
      }),
      skipped: (installed, reason) => Check.of({
        pass: true,
        label: `deep-spec-analysis: version update check skipped for ${installed.version().asString()} from ${installed.source().asString()} ${installed.reference().asString()} \u2014 ${reason.asString()}`,
        severity: CheckSeverity.advisory()
      }),
      provenanceMissing: () => Check.of({
        pass: false,
        label: "deep-spec-analysis: version update check unavailable \u2014 installation provenance is missing",
        fix: `Re-run the installer normally (without \`--update\`) to create ${this.#harnessDir}/tools/data/deep-spec-analysis-install.json.`,
        severity: CheckSeverity.advisory()
      }),
      provenanceMalformed: (reason) => Check.of({
        pass: false,
        label: `deep-spec-analysis: version update check unavailable \u2014 installation provenance is malformed (${reason.asString()})`,
        fix: `Re-run the installer normally (without \`--update\`) to replace ${this.#harnessDir}/tools/data/deep-spec-analysis-install.json.`,
        severity: CheckSeverity.advisory()
      })
    });
  }
  solvers(result) {
    if (!result.ok)
      return [this.#acquisitionFailure("solver availability", result.error)];
    const availability = result.value;
    return [
      Check.of({
        pass: availability.hasZ3Package(),
        label: "deep-spec-analysis: z3-solver package present (SMT backend)",
        fix: "Run `bun add z3-solver` in the project root. Without it the SMT backend reports `unavailable` and skips its checks.",
        severity: CheckSeverity.advisory()
      }),
      Check.of({
        pass: availability.hasNodeRuntime(),
        label: "deep-spec-analysis: node runtime on PATH (executes the z3 child process)",
        fix: "Install Node.js >= 23 (its TypeScript type-stripping runs the solver child). Without it the SMT backend falls back to bun, which currently aborts on z3's pthread build.",
        severity: CheckSeverity.advisory()
      }),
      Check.of({
        pass: availability.hasQuintCli(),
        label: "deep-spec-analysis: quint CLI on PATH (Quint backend)",
        fix: "Run `npm i -g @informalsystems/quint`. Without it the Quint backend reports `unavailable` and skips its checks.",
        severity: CheckSeverity.advisory()
      }),
      Check.of({
        pass: availability.hasApalache(),
        label: "deep-spec-analysis: Apalache available (quint verify, method: bounded)",
        fix: availability.apalacheServerIsStale() ? "An Apalache server is listening on localhost:8822 but cannot verify \u2014 typically an orphan that still holds a deleted working directory. Stop it (`lsof -nP -iTCP:8822 -sTCP:LISTEN` shows the PID, then `kill <pid>`); quint starts a fresh server on the next `quint verify`." : "Install a JDK (17+) and run any `quint verify` once so quint downloads its Apalache distribution into ~/.quint (or set APALACHE_DIST). Without it the Quint backend uses seeded simulation (method: simulation) and skips leads-to temporal obligations.",
        severity: CheckSeverity.advisory()
      })
    ];
  }
  verificationCoverage(result) {
    if (!result.ok)
      return [this.#acquisitionFailure("verification coverage", result.error)];
    const assessment = result.value;
    const rows = assessment.problems().map((row) => {
      const noun = row.problemState()?.match({
        unverified: () => "has requirements with no deep-spec verification",
        stale: () => "changed its requirements after the last deep-spec verification"
      });
      return Check.of({
        pass: false,
        label: `deep-spec-analysis: intent ${row.location().space().asString()}/${row.location().intent().asString()} ${noun}`,
        fix: `Make it the active intent (\`bun ${this.#harnessDir}/tools/aidlc-utility.ts intent ${row.location().intent().asString()}\`), ` + "then run `/aidlc --stage deep-spec-analysis-verify --single` to verify its requirements without advancing the workflow.",
        severity: CheckSeverity.advisory()
      });
    });
    rows.push(Check.of({
      pass: assessment.isClean(),
      label: `deep-spec-analysis: verification coverage \u2014 ${assessment.verifiedCount()}/${assessment.eligibleCount()} ` + "eligible intents verified (scopes: " + [...assessment.scopes()].map((scope) => scope.asString()).join(", ") + ")",
      fix: "See the per-intent rows above for the exact command each unverified intent needs.",
      severity: CheckSeverity.advisory()
    }));
    return rows;
  }
  structuralDebt(result) {
    if (!result.ok)
      return [this.#acquisitionFailure("design refcheck", result.error)];
    const debt = result.value;
    const rows = debt.rows().map((row) => Check.of({
      pass: false,
      label: `deep-spec-analysis: ${row.artifact().location().space().asString()}/${row.artifact().location().intent().asString()} ${row.artifact().relativePath().asString()} ${row.match({
        complete: (findings) => `has ${findings.asNumber()} reference-integrity finding(s)`,
        partial: (findings, reason) => `has ${findings.asNumber()} reference-integrity finding(s); inspection incomplete (${reason.asString()})`,
        unavailable: (reason) => `could not be inspected (${reason.asString()})`
      })}`,
      fix: "Open the artifact and fix (or record as an accepted risk) each finding; " + "the deep-spec-refcheck sensors re-check on every write and write the detail next to the artifact under deep-spec-refcheck/.",
      severity: CheckSeverity.advisory()
    }));
    if (debt.hasScans()) {
      rows.push(Check.of({
        pass: debt.isComplete() && debt.totalFindings() === 0,
        label: `deep-spec-analysis: design refcheck \u2014 ${debt.totalFindings()} structural finding(s) across ${debt.scannedCount()} design artifact(s) scanned (report-only)`,
        fix: "See the per-artifact rows above.",
        severity: CheckSeverity.advisory()
      }));
    }
    return rows;
  }
  functionalCoverage(result) {
    if (!result.ok)
      return [this.#acquisitionFailure("design verification coverage", result.error)];
    const coverage = result.value;
    const rows = coverage.refinementStale().map((row) => Check.of({
      pass: false,
      label: `deep-spec-analysis: intent ${row.space().asString()}/${row.intent().asString()} re-verified its requirements after the last design verification (refinement evidence is stale)`,
      fix: `Make it the active intent (\`bun ${this.#harnessDir}/tools/aidlc-utility.ts intent ${row.intent().asString()}\`), ` + "then run `/aidlc --stage deep-spec-analysis-functional-verify --single` to re-check the design against the current requirements.",
      severity: CheckSeverity.advisory()
    }));
    for (const row of coverage.problems()) {
      const label = row.match({
        valid: (unit, state) => {
          const noun = state.match({
            unverified: () => "has functional-design artifacts with no deep-spec design verification",
            stale: () => "changed its functional-design artifacts after the last design verification"
          });
          return `deep-spec-analysis: unit ${row.location().space().asString()}/${row.location().intent().asString()}/${unit.asString()} ${noun}`;
        },
        invalid: (detail) => `deep-spec-analysis: unit ${row.location().space().asString()}/${row.location().intent().asString()}/<invalid-unit-name> has an invalid functional-design unit name (${detail.asString()})`
      });
      rows.push(Check.of({
        pass: false,
        label,
        fix: `Make it the active intent (\`bun ${this.#harnessDir}/tools/aidlc-utility.ts intent ${row.location().intent().asString()}\`), ` + "then run `/aidlc --stage deep-spec-analysis-functional-verify --single` to verify its functional design without advancing the workflow.",
        severity: CheckSeverity.advisory()
      }));
    }
    if (coverage.hasEligible()) {
      rows.push(Check.of({
        pass: coverage.isClean(),
        label: `deep-spec-analysis: design verification coverage \u2014 ${coverage.verifiedCount()}/${coverage.eligibleCount()} ` + "eligible units verified (scopes: " + [...coverage.scopes()].map((scope) => scope.asString()).join(", ") + ")",
        fix: "See the per-unit rows above for the exact command each unverified unit needs.",
        severity: CheckSeverity.advisory()
      }));
    }
    return rows;
  }
  #acquisitionFailure(subject, error, severity = CheckSeverity.advisory()) {
    return Check.of({
      pass: false,
      label: `deep-spec-analysis: ${subject} unavailable \u2014 ${error.path}: ${error.kind}${"cause" in error ? ` (${error.cause})` : ""}`,
      fix: "Restore the artifact or directory and its read permissions, then run the doctor again.",
      severity
    });
  }
}
// src/doctor/adapter/doctor-workspace-client-implementation.ts
import { join as join3 } from "path";
function corrupt(path, cause) {
  return { kind: "corrupt", path, cause };
}
function optionalText(path) {
  const read = readArtifactText(path);
  if (read.ok)
    return read;
  return read.error.kind === "not-found" ? ok(null) : read;
}
function optionalBytes(path) {
  const read = readArtifactBytes(path);
  if (read.ok)
    return read;
  return read.error.kind === "not-found" ? ok(null) : read;
}
function optionalStat(path) {
  const read = readArtifactStat(path);
  if (read.ok)
    return read;
  return read.error.kind === "not-found" ? ok(null) : read;
}
function optionalDirectory(path) {
  const read = readDirectory(path);
  if (read.ok)
    return read;
  return read.error.kind === "not-found" ? ok([]) : read;
}
function modelDocument(text, path) {
  const fences = extractFences(text, "json");
  if (fences.length !== 1)
    return err(corrupt(path, "model must contain exactly one JSON fence"));
  let value;
  try {
    value = JSON.parse(fences[0].body);
  } catch (cause) {
    if (!(cause instanceof SyntaxError))
      throw cause;
    return err(corrupt(path, cause.message));
  }
  return isObject(value) ? ok(value) : err(corrupt(path, "model must be a JSON object"));
}
function locationOf(space, intent, path) {
  const parsedSpace = ArtifactPath.parse(space);
  const parsedIntent = ArtifactPath.parse(intent);
  if (!parsedSpace.ok)
    return err(corrupt(path, JSON.stringify(parsedSpace.error)));
  if (!parsedIntent.ok)
    return err(corrupt(path, JSON.stringify(parsedIntent.error)));
  return ok(IntentLocation.of(parsedSpace.value, parsedIntent.value));
}

class DoctorWorkspaceClientImplementation {
  #projectDir;
  #root;
  #refcheckToolNames;
  constructor(config) {
    this.#projectDir = config.projectDir;
    this.#root = config.root;
    this.#refcheckToolNames = config.refcheckToolNames;
  }
  static #FALLBACK_STAGE_SCOPES = StageScopes.of([StageScope.of("enterprise"), StageScope.of("feature")]);
  #scopesOfStage(phase, name) {
    const path = join3(this.#root, "aidlc-common", "stages", phase, name);
    const read = optionalText(path);
    if (!read.ok)
      return read;
    if (read.value === null)
      return ok(DoctorWorkspaceClientImplementation.#FALLBACK_STAGE_SCOPES);
    const frontmatter = read.value.split(`
---`)[0];
    const lines = frontmatter.split(`
`);
    const indexes = lines.flatMap((line, index) => /^scopes\s*:/.test(line) ? [index] : []);
    if (indexes.length === 0)
      return ok(DoctorWorkspaceClientImplementation.#FALLBACK_STAGE_SCOPES);
    if (indexes.length !== 1)
      return err(corrupt(path, "stage scopes are duplicated"));
    const start = indexes[0];
    const section = [lines[start]];
    for (let index = start + 1;index < lines.length && /^(?:\s|#|$)/.test(lines[index]); index++)
      section.push(lines[index]);
    const parsedYaml = parseYamlSubset(section.join(`
`));
    if (parsedYaml.error !== undefined)
      return err(corrupt(path, parsedYaml.error));
    if (parsedYaml.value === undefined || !isObject(parsedYaml.value) || !Array.isArray(parsedYaml.value.scopes))
      return err(corrupt(path, "stage scopes must be a list"));
    const values = [];
    for (const item of parsedYaml.value.scopes) {
      if (typeof item !== "string")
        return err(corrupt(path, "stage scope must be a string"));
      const scope = StageScope.parse(item);
      if (!scope.ok)
        return err(corrupt(path, JSON.stringify(scope.error)));
      values.push(scope.value);
    }
    const parsed = StageScopes.parse(values);
    return parsed.ok ? parsed : err(corrupt(path, JSON.stringify(parsed.error)));
  }
  #records() {
    const spacesPath = join3(this.#projectDir, "aidlc", "spaces");
    const spaces = optionalDirectory(spacesPath);
    if (!spaces.ok)
      return spaces;
    const records = [];
    for (const space of spaces.value) {
      if (!space.isDirectory())
        continue;
      const intents = optionalDirectory(join3(spacesPath, space.name, "intents"));
      if (!intents.ok)
        return intents;
      for (const intent of intents.value) {
        if (!intent.isDirectory() || intent.name.startsWith("."))
          continue;
        const path = join3(spacesPath, space.name, "intents", intent.name);
        const location = locationOf(space.name, intent.name, path);
        if (!location.ok)
          return location;
        records.push({ path, location: location.value });
      }
    }
    return ok(records);
  }
  #scopeOf(record) {
    const path = join3(record, "aidlc-state.md");
    const state = readArtifactText(path);
    if (!state.ok)
      return state;
    const scope = state.value.match(/^- \*\*Scope\*\*: (\S+)/m)?.[1];
    if (scope === undefined)
      return err(corrupt(path, "intent scope is missing"));
    const parsed = StageScope.parse(scope);
    return parsed.ok ? parsed : err(corrupt(path, JSON.stringify(parsed.error)));
  }
  verificationCoverage() {
    const scopes = this.#scopesOfStage("inception", "deep-spec-analysis-verify.md");
    if (!scopes.ok)
      return scopes;
    const records = this.#records();
    if (!records.ok)
      return records;
    const observations = [];
    for (const { path: record, location } of records.value) {
      const scope = this.#scopeOf(record);
      if (!scope.ok)
        return scope;
      if (!scopes.value.include(scope.value))
        continue;
      const requirementsPath = join3(record, "inception", "requirements-analysis", "requirements.md");
      const requirements = optionalBytes(requirementsPath);
      if (!requirements.ok)
        return requirements;
      if (requirements.value === null)
        continue;
      const modelPath = join3(record, "inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md");
      const model = optionalText(modelPath);
      if (!model.ok)
        return model;
      let anchor = null;
      let hasFindings = false;
      if (model.value !== null) {
        const document = modelDocument(model.value, modelPath);
        if (!document.ok)
          return document;
        if (document.value.sourceDigest !== undefined) {
          if (typeof document.value.sourceDigest !== "string")
            return err(corrupt(modelPath, "sourceDigest must be a string"));
          const digest = ContentHash.parse(document.value.sourceDigest);
          if (!digest.ok)
            return err(corrupt(modelPath, JSON.stringify(digest.error)));
          anchor = DigestAnchor.of(digest.value, ContentHash.ofBytes(requirements.value));
        }
        const hash = ContentHash.ofText(canonicalStringify(document.value));
        const evidence = readBackendEvidence(join3(record, "inception", "deep-spec-analysis-verify", "deep-spec-verify"));
        if (!evidence.ok)
          return evidence;
        hasFindings = evidence.value.some((report) => report.countsFor(hash));
      }
      observations.push(VerificationObservation.of({ location, hasModel: model.value !== null, hasFindings, anchor }));
    }
    const parsed = CoverageAssessment.parse(observations, scopes.value);
    return parsed.ok ? parsed : err(corrupt(join3(this.#projectDir, "aidlc"), JSON.stringify(parsed.error)));
  }
  designArtifacts() {
    const records = this.#records();
    if (!records.ok)
      return records;
    const values = [];
    for (const { path: record, location } of records.value) {
      const append = (tool, path, label) => {
        const present = optionalStat(path);
        if (!present.ok)
          return present;
        if (present.value === null)
          return ok(undefined);
        const parsedPath = ArtifactPath.parse(path);
        if (!parsedPath.ok)
          return err(corrupt(path, JSON.stringify(parsedPath.error)));
        values.push(DesignArtifactReference.of({
          location,
          tool: ArtifactPath.of(tool),
          artifactPath: parsedPath.value,
          relativePath: ArtifactPath.of(label)
        }));
        return ok(undefined);
      };
      for (const [tool, label] of [
        [this.#refcheckToolNames.domain, "inception/domain-design/components.md"],
        [this.#refcheckToolNames.contract, "inception/contract-design/contract-summary.md"]
      ]) {
        const appended = append(tool, join3(record, label), label);
        if (!appended.ok)
          return appended;
      }
      const construction = join3(record, "construction");
      const units = optionalDirectory(construction);
      if (!units.ok)
        return units;
      for (const unit of [...units.value].filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
        const directory = join3(construction, unit.name, "functional-design");
        for (const name of ["entities.md", "rules.md", "functional-spec.md"]) {
          const path = join3(directory, name);
          const found = optionalStat(path);
          if (!found.ok)
            return found;
          if (found.value === null)
            continue;
          const appended = append(this.#refcheckToolNames.functional, path, `construction/${unit.name}/functional-design`);
          if (!appended.ok)
            return appended;
          break;
        }
      }
    }
    const parsed = DesignArtifacts.parse(values);
    return parsed.ok ? parsed : err(corrupt(join3(this.#projectDir, "aidlc"), JSON.stringify(parsed.error)));
  }
  functionalCoverage() {
    const scopes = this.#scopesOfStage("construction", "deep-spec-analysis-functional-verify.md");
    if (!scopes.ok)
      return scopes;
    const records = this.#records();
    if (!records.ok)
      return records;
    const observations = [];
    const invalidUnits = [];
    for (const { path: record, location } of records.value) {
      const scope = this.#scopeOf(record);
      if (!scope.ok)
        return scope;
      if (!scopes.value.include(scope.value))
        continue;
      const construction = join3(record, "construction");
      const listed = optionalDirectory(construction);
      if (!listed.ok)
        return listed;
      const units = [];
      for (const unit of [...listed.value].filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
        const directory = join3(construction, unit.name, "functional-design");
        const present = optionalStat(directory);
        if (!present.ok)
          return present;
        if (present.value === null)
          continue;
        if (!present.value.isDirectory())
          return err(corrupt(directory, "functional-design must be a directory"));
        const name = UnitName.parse(unit.name);
        if (!name.ok) {
          const message = ErrorMessage.parse(JSON.stringify(name.error));
          if (!message.ok)
            return err(corrupt(directory, JSON.stringify(message.error)));
          invalidUnits.push(UnitCoverageProblem.invalid(location, message.value));
          continue;
        }
        let newest = 0;
        for (const filename of ["entities.md", "rules.md", "functional-spec.md"]) {
          const modified3 = optionalStat(join3(directory, filename));
          if (!modified3.ok)
            return modified3;
          if (modified3.value !== null && !modified3.value.isFile())
            return err(corrupt(join3(directory, filename), "functional-design artifact must be a file"));
          if (modified3.value !== null)
            newest = Math.max(newest, modified3.value.mtimeMs);
        }
        const modified2 = ArtifactModifiedAt.parse(newest);
        if (!modified2.ok)
          return err(corrupt(directory, JSON.stringify(modified2.error)));
        units.push(FunctionalUnitObservation.of(name.value, modified2.value));
      }
      if (units.length === 0)
        continue;
      const stage = join3(construction, "deep-spec-analysis-functional-verify");
      const modelPath = join3(stage, "deep-spec-analysis-functional-formal-model.md");
      const model = optionalText(modelPath);
      if (!model.ok)
        return model;
      const modelStat = optionalStat(modelPath);
      if (!modelStat.ok)
        return modelStat;
      const modelUnits = [];
      const completedUnits = [];
      let hasFindings = false;
      if (model.value !== null) {
        const document = modelDocument(model.value, modelPath);
        if (!document.ok)
          return document;
        if (!Array.isArray(document.value.units))
          return err(corrupt(modelPath, "design model units must be an array"));
        for (const unit of document.value.units) {
          if (!isObject(unit) || typeof unit.unit !== "string")
            return err(corrupt(modelPath, "design model unit name is missing"));
          const name = UnitName.parse(unit.unit);
          if (!name.ok)
            return err(corrupt(modelPath, JSON.stringify(name.error)));
          modelUnits.push(name.value);
        }
        const hash = ContentHash.ofText(canonicalStringify(document.value));
        const evidence = readBackendEvidence(join3(stage, "deep-spec-design-verify"));
        if (!evidence.ok)
          return evidence;
        hasFindings = evidence.value.some((report) => report.countsFor(hash));
        for (const report of evidence.value)
          completedUnits.push(...report.completedUnitsFor(hash));
      }
      const requirementsPath = join3(record, "inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md");
      const requirementsStat = optionalStat(requirementsPath);
      if (!requirementsStat.ok)
        return requirementsStat;
      const modified = modelStat.value === null ? ok(null) : ArtifactModifiedAt.parse(modelStat.value.mtimeMs);
      if (!modified.ok)
        return err(corrupt(modelPath, JSON.stringify(modified.error)));
      const requirementsModified = requirementsStat.value === null ? ok(null) : ArtifactModifiedAt.parse(requirementsStat.value.mtimeMs);
      if (!requirementsModified.ok)
        return err(corrupt(requirementsPath, JSON.stringify(requirementsModified.error)));
      const observation = FunctionalObservation.parse({
        location,
        units,
        modelModifiedAt: modified.value,
        modelUnits,
        completedUnits,
        hasFindings,
        requirementsModelModifiedAt: requirementsModified.value
      });
      if (!observation.ok)
        return err(corrupt(record, JSON.stringify(observation.error)));
      observations.push(observation.value);
    }
    const parsed = UnitCoverage.parse(observations, scopes.value, invalidUnits);
    return parsed.ok ? parsed : err(corrupt(join3(this.#projectDir, "aidlc"), JSON.stringify(parsed.error)));
  }
}
// src/doctor/adapter/git-hub-release-tags-client-implementation.ts
class GitHubReleaseTagsClientImplementation {
  #repository;
  #fetcher;
  #timeoutMs;
  constructor(config) {
    this.#repository = config.repository;
    this.#fetcher = config.fetcher ?? globalThis.fetch;
    this.#timeoutMs = config.timeoutMs ?? 5000;
  }
  async list() {
    const response = await this.#requestTags();
    if (response.kind === "unavailable") {
      const reason = ErrorMessage.parse(response.reason);
      return ReleaseCatalog.unavailable(reason.ok ? reason.value : ErrorMessage.of("network request failed"));
    }
    const versions = [];
    for (const tag of response.tags) {
      const parsed = PluginVersion.parse(tag);
      if (parsed.ok)
        versions.push(parsed.value);
    }
    const releases = StableReleases.parse(versions);
    return releases.ok ? ReleaseCatalog.available(releases.value) : ReleaseCatalog.unavailable(ErrorMessage.of("GitHub tags API pagination limit was exceeded"));
  }
  async#requestTags() {
    const tags = [];
    try {
      for (let page = 1;page <= 100; page++) {
        const response = await this.#fetcher(`https://api.github.com/repos/${this.#repository}/tags?per_page=100&page=${page}`, {
          headers: { Accept: "application/vnd.github+json", "User-Agent": "deep-spec-analysis-doctor" },
          signal: AbortSignal.timeout(this.#timeoutMs)
        });
        if (!response.ok)
          return { kind: "unavailable", reason: `GitHub tags API returned HTTP ${response.status}` };
        const body = await response.json();
        if (!Array.isArray(body))
          return { kind: "unavailable", reason: "GitHub tags API returned an invalid document" };
        if (body.length > 100)
          return { kind: "unavailable", reason: "GitHub tags API pagination limit was exceeded" };
        for (const entry of body) {
          if (entry && typeof entry === "object" && typeof entry.name === "string")
            tags.push(entry.name);
        }
        if (body.length < 100)
          return { kind: "available", tags };
      }
      return { kind: "unavailable", reason: "GitHub tags API pagination limit was exceeded" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { kind: "unavailable", reason: message.replace(/[\r\n]+/g, " ") || "network request failed" };
    }
  }
}
// src/doctor/adapter/harness-file-client-implementation.ts
import { join as join4 } from "path";
class HarnessFileClientImplementation {
  #root;
  constructor(config) {
    this.#root = config.root;
  }
  isInstalled(entry) {
    const stat = readArtifactStat(join4(this.#root, entry.rel()));
    if (!stat.ok)
      return stat.error.kind === "not-found" ? ok(false) : stat;
    return ok(stat.value.isFile());
  }
}
// src/doctor/adapter/installation-provenance-client-implementation.ts
import { join as join5 } from "path";
class InstallationProvenanceClientImplementation {
  #path;
  constructor(config) {
    this.#path = join5(config.harnessRoot, "tools", "data", "deep-spec-analysis-install.json");
  }
  read() {
    const read = readArtifactText(this.#path);
    if (!read.ok) {
      if (read.error.kind === "not-found")
        return InstallationProvenance.missing();
      const reason = ErrorMessage.parse(read.error.cause);
      return InstallationProvenance.malformed(reason.ok ? reason.value : ErrorMessage.of("provenance read failure could not be represented"));
    }
    let value;
    try {
      value = JSON.parse(read.value);
    } catch (error) {
      if (!(error instanceof SyntaxError))
        throw error;
      return InstallationProvenance.malformed(ErrorMessage.of("file is not readable JSON"));
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return InstallationProvenance.malformed(ErrorMessage.of("document must be an object"));
    }
    const row = value;
    if (typeof row.version !== "string" || typeof row.ref !== "string" || row.ref.length === 0 || typeof row.source !== "string" || typeof row.installed_at !== "string" || row.installed_at.length === 0 || typeof row.payload_sha256 !== "string" || !/^sha256:[0-9a-f]{64}$/.test(row.payload_sha256)) {
      return InstallationProvenance.malformed(ErrorMessage.of("required provenance fields are invalid"));
    }
    const reference = ArtifactPath.parse(row.ref);
    const source = InstallationSource.parse(row.source);
    if (!reference.ok || !source.ok)
      return InstallationProvenance.malformed(ErrorMessage.of("required provenance fields are invalid"));
    const version = PluginVersion.parse(row.version);
    if (!version.ok)
      return InstallationProvenance.malformed(ErrorMessage.of("version is not a stable Semantic Version"));
    return InstallationProvenance.installed(InstalledRelease.of(version.value, source.value, reference.value));
  }
}
// src/doctor/adapter/reference-check-backend-client-implementation.ts
import { spawnSync } from "child_process";
import { join as join6 } from "path";
class ReferenceCheckBackendClientImplementation {
  #root;
  constructor(config) {
    this.#root = config.root;
  }
  observe(artifact) {
    const script = join6(this.#root, "tools", artifact.tool().asString());
    const scriptStat = readArtifactStat(script);
    if (!scriptStat.ok)
      return StructuralObservation.unavailable(artifact, this.#error(scriptStat.error));
    const result = spawnSync("bun", [script, "--stage", "doctor", "--output-path", artifact.artifactPath().asString(), "--report-only"], { encoding: "utf-8", timeout: 15000 });
    if (result.error)
      return StructuralObservation.unavailable(artifact, this.#message(String(result.error)));
    if (result.status !== 0)
      return StructuralObservation.unavailable(artifact, this.#message(`backend exited with status ${result.status}`));
    const verdict = this.#parseVerdict(result.stdout ?? "");
    if (!verdict.ok)
      return StructuralObservation.unavailable(artifact, this.#message(verdict.error));
    if (!verdict.value.pass && verdict.value.findingsCount === 0)
      return StructuralObservation.unavailable(artifact, this.#message("backend returned a failed zero-finding verdict"));
    const findings = FindingCount.parse(verdict.value.findingsCount);
    if (!findings.ok)
      return StructuralObservation.unavailable(artifact, this.#message(JSON.stringify(findings.error)));
    if (verdict.value.skippedCount > 0)
      return StructuralObservation.partial(artifact, findings.value, this.#message("backend skipped one or more checks"));
    return StructuralObservation.of(artifact, findings.value);
  }
  #error(error) {
    return this.#message("cause" in error ? `${error.kind}: ${error.cause}` : error.kind);
  }
  #parseVerdict(stdout) {
    const line = stdout.trim().split(`
`).pop() ?? "";
    let raw;
    try {
      raw = JSON.parse(line);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
    if (!isObject(raw) || raw.note === "not-applicable" || typeof raw.pass !== "boolean" || typeof raw.findings_count !== "number" || typeof raw.skipped_count !== "number" || !Number.isSafeInteger(raw.findings_count) || raw.findings_count < 0 || !Number.isSafeInteger(raw.skipped_count) || raw.skipped_count < 0)
      return { ok: false, error: "backend verdict lacks valid checked pass/findings_count/skipped_count" };
    return {
      ok: true,
      value: { pass: raw.pass, findingsCount: raw.findings_count, skippedCount: raw.skipped_count }
    };
  }
  #message(raw) {
    const parsed = ErrorMessage.parse(raw);
    return parsed.ok ? parsed.value : ErrorMessage.of("reference-check backend failed");
  }
}
// src/doctor/adapter/solver-probe-client-implementation.ts
import { spawnSync as spawnSync2 } from "child_process";
import { mkdtempSync, rmSync as rmSync2, writeFileSync as writeFileSync2 } from "fs";
import { tmpdir } from "os";
import { join as join7 } from "path";
function listenProbe(port) {
  return `const s=require("node:net").connect(${port},"127.0.0.1");` + "s.setTimeout(300);" + 's.on("connect",()=>{s.destroy();s.unref()});' + 's.on("timeout",()=>{s.destroy();throw new Error("no apalache server")});' + 's.on("error",()=>{throw new Error("no apalache server")});';
}
var PROBE_MODULE = `module probe {
  var x: int
  action init = { x' = 0 }
  action step = { x' = x + 1 }
  val inv = x >= 0
}
`;

class SolverProbeClientImplementation {
  #config;
  constructor(config) {
    this.#config = config;
  }
  #probe(cmd, args) {
    const res = spawnSync2(cmd, args, { encoding: "utf-8", timeout: 5000 });
    return !res.error && res.status === 0;
  }
  #apalacheServerIsListening() {
    const res = spawnSync2(this.#config.runtimeBin, ["-e", listenProbe(this.#config.apalachePort)], {
      encoding: "utf-8",
      timeout: 2000
    });
    return !res.error && res.status === 0;
  }
  #apalacheServerIsStale() {
    if (!this.#apalacheServerIsListening())
      return false;
    const work = mkdtempSync(join7(tmpdir(), "deep-spec-doctor-probe-"));
    try {
      const spec = join7(work, "probe.qnt");
      writeFileSync2(spec, PROBE_MODULE, "utf-8");
      const res = spawnSync2(this.#config.quintBin, ["verify", spec, "--main=probe", "--invariant=inv", "--max-steps=1"], {
        encoding: "utf-8",
        timeout: 30000,
        cwd: work,
        killSignal: "SIGINT"
      });
      return Boolean(res.error) || res.status !== 0;
    } finally {
      rmSync2(work, { recursive: true, force: true });
    }
  }
  availability() {
    let apalacheDist = this.#config.apalacheDistDeclared;
    if (!apalacheDist) {
      const directory = readDirectory(join7(this.#config.homeDir, ".quint"));
      if (!directory.ok && directory.error.kind !== "not-found")
        return directory;
      apalacheDist = directory.ok && directory.value.some((entry) => entry.isDirectory() && entry.name.startsWith("apalache-dist-"));
    }
    const quintCli = this.#probe(this.#config.quintBin, ["--version"]);
    const apalache = this.#probe("java", ["-version"]) && apalacheDist;
    const packageStat = readArtifactStat(join7(this.#config.projectDir, "node_modules", "z3-solver", "package.json"));
    if (!packageStat.ok && packageStat.error.kind !== "not-found")
      return packageStat;
    return ok(SolverAvailability.of({
      z3Package: packageStat.ok && packageStat.value.isFile(),
      nodeRuntime: this.#probe("node", ["--version"]),
      quintCli,
      apalache,
      apalacheServerStale: apalache && quintCli && this.#apalacheServerIsStale()
    }));
  }
}
// src/doctor/usecase/check-functional-coverage-usecase.ts
class CheckFunctionalCoverageUseCase {
  #workspace;
  constructor(workspace) {
    this.#workspace = workspace;
  }
  execute() {
    return this.#workspace.functionalCoverage();
  }
}
// src/doctor/usecase/check-installation-usecase.ts
class CheckInstallationUseCase {
  #files;
  constructor(files) {
    this.#files = files;
  }
  execute() {
    return traverseResult([...InstallationManifest.standard()], (entry) => flatMapResult(this.#files.isInstalled(entry), (present) => ok(InstalledStatus.of(entry, present))));
  }
}
// src/doctor/usecase/check-solvers-usecase.ts
class CheckSolversUseCase {
  #probes;
  constructor(probes) {
    this.#probes = probes;
  }
  execute() {
    return this.#probes.availability();
  }
}
// src/doctor/usecase/check-structural-debt-usecase.ts
class CheckStructuralDebtUseCase {
  #workspace;
  #backend;
  constructor(workspace, backend) {
    this.#workspace = workspace;
    this.#backend = backend;
  }
  execute() {
    return matchResult(this.#workspace.designArtifacts(), {
      err: (error) => err(error),
      ok: (artifacts) => {
        const observations = [];
        for (const artifact of artifacts)
          observations.push(this.#backend.observe(artifact));
        return ok(StructuralDebt.of(observations));
      }
    });
  }
}
// src/doctor/usecase/check-verification-coverage-usecase.ts
class CheckVerificationCoverageUseCase {
  #workspace;
  constructor(workspace) {
    this.#workspace = workspace;
  }
  execute() {
    return this.#workspace.verificationCoverage();
  }
}
// src/doctor/usecase/check-version-advisory-usecase.ts
class CheckVersionAdvisoryUseCase {
  #provenance;
  #releaseTags;
  constructor(provenance, releaseTags) {
    this.#provenance = provenance;
    this.#releaseTags = releaseTags;
  }
  async execute() {
    return this.#provenance.read().match({
      unavailable: async (advisory) => advisory,
      installed: async (installed) => (await this.#releaseTags.list()).advise(installed)
    });
  }
}
// src/entries/deep-spec-analysis-doctor.ts
async function main() {
  const projectDir = process.env.AIDLC_PROJECT_DIR || process.cwd();
  const harnessDir = process.env.AIDLC_HARNESS_DIR || ".claude";
  const root = join8(projectDir, harnessDir);
  const presenter = new DoctorPresenter({ harnessDir });
  const workspace = new DoctorWorkspaceClientImplementation({
    projectDir,
    root,
    refcheckToolNames: {
      domain: "aidlc-sensor-deep-spec-refcheck-domain.ts",
      contract: "aidlc-sensor-deep-spec-refcheck-contract.ts",
      functional: "aidlc-sensor-deep-spec-refcheck-functional.ts"
    }
  });
  const verdict = HealthVerdict.of([
    ...presenter.installation(new CheckInstallationUseCase(new HarnessFileClientImplementation({ root })).execute()),
    presenter.version(await new CheckVersionAdvisoryUseCase(new InstallationProvenanceClientImplementation({ harnessRoot: root }), new GitHubReleaseTagsClientImplementation({ repository: "j5ik2o/deep-spec-analysis" })).execute()),
    ...presenter.solvers(new CheckSolversUseCase(new SolverProbeClientImplementation({
      projectDir,
      quintBin: process.env.AIDLC_DEEP_SPEC_QUINT_BIN || "quint",
      apalacheDistDeclared: Boolean(process.env.APALACHE_DIST),
      homeDir: process.env.HOME ?? "",
      apalachePort: 8822,
      runtimeBin: process.execPath
    })).execute()),
    ...presenter.verificationCoverage(new CheckVerificationCoverageUseCase(workspace).execute()),
    ...presenter.structuralDebt(new CheckStructuralDebtUseCase(workspace, new ReferenceCheckBackendClientImplementation({ root })).execute()),
    ...presenter.functionalCoverage(new CheckFunctionalCoverageUseCase(workspace).execute())
  ]);
  process.stdout.write(`${JSON.stringify(verdict.document())}
`);
}
await main();
