// @bun
// src/entries/deep-spec-analysis-doctor.ts
import { join as join6 } from "path";

// src/kernel/infrastructure/illegal-argument-exception.ts
class IllegalArgumentException extends Error {
  problem;
  constructor(problem) {
    super(`Illegal argument: ${problem.kind}`);
    this.name = "IllegalArgumentException";
    this.problem = Object.freeze({ ...problem });
  }
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
  if (typeof schema.$ref === "string") {
    return validateSchema(root, resolveRef(root, schema.$ref), value, path, errors);
  }
  if (Array.isArray(schema.oneOf)) {
    let matched = 0;
    for (const branch of schema.oneOf) {
      if (!isObject(branch))
        continue;
      const probe = [];
      if (validateSchema(root, branch, value, path, probe))
        matched++;
    }
    if (matched !== 1) {
      errors.push(`${path}: matches ${matched} oneOf branches (must match exactly 1)`);
    }
    return errors.length === before;
  }
  if (typeof schema.type === "string" && !typeMatches(schema.type, value)) {
    errors.push(`${path}: expected type ${schema.type}`);
    return false;
  }
  if ("const" in schema && JSON.stringify(schema.const) !== JSON.stringify(value)) {
    errors.push(`${path}: expected const ${JSON.stringify(schema.const)}`);
    return false;
  }
  if (Array.isArray(schema.enum)) {
    const hit = schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(value));
    if (!hit) {
      errors.push(`${path}: not one of ${JSON.stringify(schema.enum)}`);
      return false;
    }
  }
  if (typeof value === "string" && typeof schema.pattern === "string") {
    if (!new RegExp(schema.pattern).test(value)) {
      errors.push(`${path}: does not match pattern ${schema.pattern}`);
    }
  }
  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      errors.push(`${path}: fewer than ${schema.minItems} items`);
    }
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
      errors.push(`${path}: more than ${schema.maxItems} items`);
    }
    if (schema.uniqueItems === true) {
      const seen = new Set(value.map((v) => JSON.stringify(v)));
      if (seen.size !== value.length)
        errors.push(`${path}: items are not unique`);
    }
    if (isObject(schema.items)) {
      value.forEach((item, i) => {
        validateSchema(root, schema.items, item, `${path}/${i}`, errors);
      });
    }
  }
  if (isObject(value)) {
    const props = isObject(schema.properties) ? schema.properties : {};
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (typeof key === "string" && !(key in value)) {
          errors.push(`${path}: missing required property "${key}"`);
        }
      }
    }
    if (typeof schema.minProperties === "number" && Object.keys(value).length < schema.minProperties) {
      errors.push(`${path}: fewer than ${schema.minProperties} properties`);
    }
    for (const [key, val] of Object.entries(value)) {
      if (key in props && isObject(props[key])) {
        validateSchema(root, props[key], val, `${path}/${key}`, errors);
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}: unexpected property "${key}"`);
      } else if (isObject(schema.additionalProperties)) {
        validateSchema(root, schema.additionalProperties, val, `${path}/${key}`, errors);
      }
      if (isObject(schema.propertyNames) && typeof schema.propertyNames.pattern === "string") {
        if (!new RegExp(schema.propertyNames.pattern).test(key)) {
          errors.push(`${path}: property name "${key}" does not match required pattern`);
        }
      }
    }
  }
  return errors.length === before;
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
    if (observations.length > 65536)
      throw new IllegalArgumentException({ kind: "too-many-verification-observations", raw: observations.length });
    this.#observations = Object.freeze([...observations]);
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
}
// src/doctor/domain/design-artifacts.ts
class DesignArtifacts {
  #values;
  constructor(values) {
    if (values.length > 65536)
      throw new IllegalArgumentException({ kind: "too-many-design-artifacts", raw: values.length });
    this.#values = Object.freeze([...values]);
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
    return canonicalStringify(this.#value) === canonicalStringify(other.#value);
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
}
// src/kernel/domain/declared-bindings.ts
class DeclaredBindings {
  #values;
  constructor(values) {
    if (values.length > 1e4)
      throw new IllegalArgumentException({ kind: "too-many-binding-declarations", raw: values.length });
    this.#values = Object.freeze([...values]);
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
class EnumerationMembers {
  #values;
  constructor(values) {
    if (values.length > 1e4)
      throw new IllegalArgumentException({ kind: "too-many-enum-members", raw: values.length });
    this.#values = Object.freeze([...values]);
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
}
// src/kernel/domain/error-messages.ts
var MAX_MESSAGES = 65536;

class ErrorMessages {
  #values;
  constructor(values) {
    if (values.length > MAX_MESSAGES)
      throw new IllegalArgumentException({ kind: "too-many-error-messages", raw: values.length });
    this.#values = Object.freeze([...values]);
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
class FunctionalRequirementReferences {
  #values;
  constructor(values) {
    if (values.length > 1e4)
      throw new IllegalArgumentException({ kind: "too-many-functional-requirement-references", raw: values.length });
    this.#values = Object.freeze([...values]);
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
class RequirementIdentifiers {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static extractFrom(text) {
    const ids = [];
    for (const m of text.matchAll(/\b(?:FR|NFR)-?[0-9]+(?:\.[0-9]+)*\b/g)) {
      ids.push(RequirementIdentifier.of(m[0]));
    }
    return new RequirementIdentifiers(KeySet.of(ids));
  }
  static of(values) {
    return new RequirementIdentifiers(KeySet.of(values));
  }
  add(value) {
    return new RequirementIdentifiers(this.#values.with(value));
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
}
// src/kernel/domain/scenario-bindings.ts
class ScenarioBindings {
  #values;
  constructor(values) {
    if (values.length > 1e4)
      throw new IllegalArgumentException({ kind: "too-many-scenario-bindings", raw: values.length });
    const paths = new Set;
    for (const binding of values) {
      const path = binding.path().asString();
      if (paths.has(path))
        throw new IllegalArgumentException({ kind: "duplicate-scenario-binding", raw: path });
      paths.add(path);
    }
    this.#values = Object.freeze([...values]);
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
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/target-identifiers.ts
class TargetIdentifiers {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new TargetIdentifiers(values);
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
  includes(value) {
    return this.#values.some((v) => v.equals(value));
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
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
}
// src/doctor/domain/unit-coverage-problem.ts
class UnitCoverageProblem {
  #location;
  #unit;
  #state;
  constructor(location, unit, state) {
    this.#location = location;
    this.#unit = unit;
    this.#state = state;
  }
  static of(location, unit, state) {
    return new UnitCoverageProblem(location, unit, state);
  }
  location() {
    return this.#location;
  }
  unit() {
    return this.#unit;
  }
  matchState(handlers) {
    return this.#state.match(handlers);
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
    if (props.units.length > 65536 || props.modelUnits.length > 65536 || props.completedUnits.length > 65536)
      throw new IllegalArgumentException({ kind: "too-many-functional-units" });
    this.#location = props.location;
    this.#units = Object.freeze([...props.units]);
    this.#modelModifiedAt = props.modelModifiedAt;
    this.#modelUnits = KeySet.of(props.modelUnits);
    this.#completedUnits = KeySet.of(props.completedUnits);
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
class HealthVerdict {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
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
}

// src/doctor/domain/installation-manifest.ts
var err2 = (rel) => ManifestEntry.error(ArtifactPath.of(rel));

class InstallationManifest {
  #entries;
  constructor(entries) {
    this.#entries = Object.freeze([...entries]);
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
class StableReleases {
  #versions;
  constructor(versions) {
    if (versions.length > 1e4)
      throw new IllegalArgumentException({ kind: "too-many-stable-releases", raw: versions.length });
    this.#versions = Object.freeze([...versions]);
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
class StageScopes {
  #values;
  constructor(values) {
    if (values.length > 1024)
      throw new IllegalArgumentException({ kind: "too-many-stage-scopes", raw: values.length });
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new StageScopes(values);
  }
  static parse(values) {
    return parseConstruction(() => new StageScopes(values));
  }
  includes(scope) {
    return this.#values.some((value) => value.equals(scope));
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
}
// src/doctor/domain/structural-debt.ts
class StructuralDebt {
  #observations;
  constructor(observations) {
    if (observations.length > 65536)
      throw new IllegalArgumentException({ kind: "too-many-structural-observations", raw: observations.length });
    this.#observations = Object.freeze([...observations]);
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
  scannedCount() {
    return this.#observations.filter((observation) => observation.wasScanned()).length;
  }
  totalFindings() {
    return this.#observations.reduce((sum, observation) => sum + observation.findingCount(), 0);
  }
  rows() {
    return this.#observations.filter((observation) => observation.hasDebt());
  }
}
// src/doctor/domain/structural-observation.ts
class StructuralObservation {
  #artifact;
  #findings;
  constructor(artifact, findings) {
    this.#artifact = artifact;
    this.#findings = findings;
  }
  static of(artifact, findings) {
    return new StructuralObservation(artifact, findings);
  }
  wasScanned() {
    return this.#findings !== null;
  }
  hasDebt() {
    return this.#findings !== null && !this.#findings.isEmpty();
  }
  findingCount() {
    return this.#findings?.asNumber() ?? 0;
  }
  artifact() {
    return this.#artifact;
  }
}
// src/doctor/domain/unit-coverage.ts
class UnitCoverage {
  #observations;
  #scopes;
  constructor(observations, scopes) {
    if (observations.length > 65536)
      throw new IllegalArgumentException({ kind: "too-many-functional-observations", raw: observations.length });
    let units = 0;
    for (const observation of observations) {
      units += observation.eligibleCount();
      if (units > 65536)
        throw new IllegalArgumentException({ kind: "too-many-covered-units", raw: units });
    }
    this.#observations = Object.freeze([...observations]);
    this.#scopes = scopes;
  }
  static of(observations, scopes) {
    return new UnitCoverage(observations, scopes);
  }
  static parse(observations, scopes) {
    return parseConstruction(() => new UnitCoverage(observations, scopes));
  }
  hasEligible() {
    return this.eligibleCount() > 0;
  }
  isClean() {
    return this.problems().length === 0;
  }
  verifiedCount() {
    return this.eligibleCount() - this.problems().length;
  }
  eligibleCount() {
    return this.#observations.reduce((sum, observation) => sum + observation.eligibleCount(), 0);
  }
  problems() {
    return this.#observations.flatMap((observation) => observation.problems());
  }
  refinementStale() {
    return this.#observations.filter((observation) => observation.refinementIsStale()).map((observation) => observation.location());
  }
  scopes() {
    return this.#scopes;
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
// src/doctor/adapter/doctor-presenter.ts
class DoctorPresenter {
  #harnessDir;
  constructor(config) {
    this.#harnessDir = config.harnessDir;
  }
  installation(statuses) {
    return statuses.map((s) => Check.of({
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
  solvers(availability) {
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
  verificationCoverage(assessment) {
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
  structuralDebt(debt) {
    const rows = debt.rows().map((row) => Check.of({
      pass: false,
      label: `deep-spec-analysis: ${row.artifact().location().space().asString()}/${row.artifact().location().intent().asString()} ${row.artifact().relativePath().asString()} has ${row.findingCount()} reference-integrity finding(s)`,
      fix: "Open the artifact and fix (or record as an accepted risk) each finding; " + "the deep-spec-refcheck sensors re-check on every write and write the detail next to the artifact under deep-spec-refcheck/.",
      severity: CheckSeverity.advisory()
    }));
    if (debt.hasScans()) {
      rows.push(Check.of({
        pass: debt.totalFindings() === 0,
        label: `deep-spec-analysis: design refcheck \u2014 ${debt.totalFindings()} structural finding(s) across ${debt.scannedCount()} design artifact(s) scanned (report-only)`,
        fix: "See the per-artifact rows above.",
        severity: CheckSeverity.advisory()
      }));
    }
    return rows;
  }
  functionalCoverage(coverage) {
    const rows = coverage.refinementStale().map((row) => Check.of({
      pass: false,
      label: `deep-spec-analysis: intent ${row.space().asString()}/${row.intent().asString()} re-verified its requirements after the last design verification (refinement evidence is stale)`,
      fix: `Make it the active intent (\`bun ${this.#harnessDir}/tools/aidlc-utility.ts intent ${row.intent().asString()}\`), ` + "then run `/aidlc --stage deep-spec-analysis-functional-verify --single` to re-check the design against the current requirements.",
      severity: CheckSeverity.advisory()
    }));
    for (const row of coverage.problems()) {
      const noun = row.matchState({
        unverified: () => "has functional-design artifacts with no deep-spec design verification",
        stale: () => "changed its functional-design artifacts after the last design verification"
      });
      rows.push(Check.of({
        pass: false,
        label: `deep-spec-analysis: unit ${row.location().space().asString()}/${row.location().intent().asString()}/${row.unit().asString()} ${noun}`,
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
}
// src/doctor/adapter/doctor-workspace-client-implementation.ts
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
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
  #scopesOfStage(...stagePath) {
    const stageFile = join(this.#root, "aidlc-common", "stages", ...stagePath);
    let items = null;
    try {
      const frontmatter = readFileSync(stageFile, "utf-8").split(`
---`)[0];
      const m = frontmatter.match(/^scopes:\n((?:\s+- .+\n)+)/m);
      items = m?.[1]?.match(/- (\S+)/g)?.map((item) => item.slice(2)) ?? null;
    } catch {}
    if (items === null)
      return DoctorWorkspaceClientImplementation.#FALLBACK_STAGE_SCOPES;
    const scopes = [];
    for (const item of items) {
      const parsed2 = StageScope.parse(item);
      if (!parsed2.ok)
        return DoctorWorkspaceClientImplementation.#FALLBACK_STAGE_SCOPES;
      scopes.push(parsed2.value);
    }
    const parsed = StageScopes.parse(scopes);
    return parsed.ok ? parsed.value : DoctorWorkspaceClientImplementation.#FALLBACK_STAGE_SCOPES;
  }
  #verificationScopes() {
    return this.#scopesOfStage("inception", "deep-spec-analysis-verify.md");
  }
  #functionalScopes() {
    return this.#scopesOfStage("construction", "deep-spec-analysis-functional-verify.md");
  }
  #spaces() {
    try {
      return readdirSync(join(this.#projectDir, "aidlc", "spaces"), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return [];
    }
  }
  #intents(space) {
    try {
      return readdirSync(join(this.#projectDir, "aidlc", "spaces", space, "intents"), { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name);
    } catch {
      return [];
    }
  }
  #record(space, intent) {
    return join(this.#projectDir, "aidlc", "spaces", space, "intents", intent);
  }
  #scopeOf(record) {
    let state = "";
    try {
      state = readFileSync(join(record, "aidlc-state.md"), "utf-8");
    } catch {
      return null;
    }
    return state.match(/^- \*\*Scope\*\*: (\S+)/m)?.[1] ?? null;
  }
  verificationCoverage() {
    const scopes = this.#verificationScopes();
    const out = [];
    for (const space of this.#spaces()) {
      for (const intent of this.#intents(space)) {
        const record = this.#record(space, intent);
        const scope = this.#scopeOf(record);
        if (!scope)
          continue;
        const parsedScope = StageScope.parse(scope);
        if (!parsedScope.ok || !scopes.includes(parsedScope.value))
          continue;
        const requirements = join(record, "inception", "requirements-analysis", "requirements.md");
        if (!existsSync(requirements))
          continue;
        const model = join(record, "inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md");
        const verifyDir = join(record, "inception", "deep-spec-analysis-verify", "deep-spec-verify");
        let hasFindings = false;
        try {
          hasFindings = readdirSync(verifyDir).some((f) => f.endsWith(".json"));
        } catch {
          hasFindings = false;
        }
        const hasModel = existsSync(model);
        if (!hasModel || !hasFindings) {
          out.push(VerificationObservation.of({
            location: IntentLocation.of(ArtifactPath.of(space), ArtifactPath.of(intent)),
            hasModel,
            hasFindings,
            anchor: null
          }));
          continue;
        }
        const anchored = readFileSync(model, "utf-8").match(/```json\n([\s\S]*?)```/)?.[1]?.match(/"sourceDigest"\s*:\s*"([0-9a-f]{64})"/)?.[1];
        out.push(VerificationObservation.of({
          location: IntentLocation.of(ArtifactPath.of(space), ArtifactPath.of(intent)),
          hasModel,
          hasFindings,
          anchor: anchored ? DigestAnchor.of(ContentHash.of(anchored), ContentHash.ofBytes(readFileSync(requirements))) : null
        }));
      }
    }
    return CoverageAssessment.of(out, scopes);
  }
  designArtifacts() {
    const out = [];
    for (const space of this.#spaces()) {
      for (const intent of this.#intents(space)) {
        const record = this.#record(space, intent);
        const ref = (tool, artifactPath, label) => {
          if (!existsSync(artifactPath))
            return;
          out.push(DesignArtifactReference.of({
            location: IntentLocation.of(ArtifactPath.of(space), ArtifactPath.of(intent)),
            tool: ArtifactPath.of(tool),
            artifactPath: ArtifactPath.of(artifactPath),
            relativePath: ArtifactPath.of(label)
          }));
        };
        ref(this.#refcheckToolNames.domain, join(record, "inception", "domain-design", "components.md"), "inception/domain-design/components.md");
        ref(this.#refcheckToolNames.contract, join(record, "inception", "contract-design", "contract-summary.md"), "inception/contract-design/contract-summary.md");
        const constructionDir = join(record, "construction");
        let units = [];
        try {
          units = readdirSync(constructionDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
        } catch {
          units = [];
        }
        for (const unit of units) {
          const fdDir = join(constructionDir, unit, "functional-design");
          const trigger = ["entities.md", "rules.md", "functional-spec.md"].map((f) => join(fdDir, f)).find((p) => existsSync(p));
          if (trigger !== undefined) {
            ref(this.#refcheckToolNames.functional, trigger, `construction/${unit}/functional-design`);
          }
        }
      }
    }
    return DesignArtifacts.of(out);
  }
  functionalCoverage() {
    const scopes = this.#functionalScopes();
    const out = [];
    for (const space of this.#spaces()) {
      for (const intent of this.#intents(space)) {
        const record = this.#record(space, intent);
        const scope = this.#scopeOf(record);
        if (!scope)
          continue;
        const parsedScope = StageScope.parse(scope);
        if (!parsedScope.ok || !scopes.includes(parsedScope.value))
          continue;
        const constructionDir = join(record, "construction");
        let unitDirs = [];
        try {
          unitDirs = readdirSync(constructionDir, { withFileTypes: true }).filter((e) => e.isDirectory() && existsSync(join(constructionDir, e.name, "functional-design"))).map((e) => e.name).sort();
        } catch {
          continue;
        }
        if (unitDirs.length === 0)
          continue;
        const stageDir = join(constructionDir, "deep-spec-analysis-functional-verify");
        const modelPath = join(stageDir, "deep-spec-analysis-functional-formal-model.md");
        let modelUnits = [];
        let modelMtime = null;
        const completedUnits = new Set;
        let hasFindings = false;
        if (existsSync(modelPath)) {
          try {
            modelMtime = statSync(modelPath).mtimeMs;
            const fence = readFileSync(modelPath, "utf-8").match(/```json\n([\s\S]*?)```/);
            const ir = fence ? JSON.parse(fence[1] ?? "{}") : {};
            for (const u of Array.isArray(ir.units) ? ir.units : []) {
              if (u && typeof u.unit === "string")
                modelUnits.push(u.unit);
            }
          } catch {
            modelUnits = [];
          }
          try {
            const verifyDir = join(stageDir, "deep-spec-design-verify");
            for (const f of readdirSync(verifyDir)) {
              if (!f.endsWith(".json") || f === "cross-check.json")
                continue;
              try {
                const doc = JSON.parse(readFileSync(join(verifyDir, f), "utf-8"));
                if (doc && typeof doc === "object" && !doc.unavailable) {
                  hasFindings = true;
                  for (const t of Array.isArray(doc.checked) ? doc.checked : []) {
                    if (typeof t === "string" && t.startsWith("unit:"))
                      completedUnits.add(t.slice(5));
                  }
                }
              } catch {}
            }
          } catch {
            hasFindings = false;
          }
        }
        const units = unitDirs.map((unit) => {
          const fdDir = join(constructionDir, unit, "functional-design");
          let newest = 0;
          for (const f of ["entities.md", "rules.md", "functional-spec.md"]) {
            const p = join(fdDir, f);
            if (existsSync(p))
              newest = Math.max(newest, statSync(p).mtimeMs);
          }
          return FunctionalUnitObservation.of(UnitName.of(unit), ArtifactModifiedAt.of(newest));
        });
        const reqModel = join(record, "inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md");
        out.push(FunctionalObservation.of({
          location: IntentLocation.of(ArtifactPath.of(space), ArtifactPath.of(intent)),
          units,
          modelModifiedAt: modelMtime === null ? null : ArtifactModifiedAt.of(modelMtime),
          modelUnits: modelUnits.flatMap((name) => {
            const parsed = UnitName.parse(name);
            return parsed.ok ? [parsed.value] : [];
          }),
          completedUnits: [...completedUnits].flatMap((name) => {
            const parsed = UnitName.parse(name);
            return parsed.ok ? [parsed.value] : [];
          }),
          hasFindings,
          requirementsModelModifiedAt: existsSync(reqModel) ? ArtifactModifiedAt.of(statSync(reqModel).mtimeMs) : null
        }));
      }
    }
    return UnitCoverage.of(out, scopes);
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
import { existsSync as existsSync2 } from "fs";
import { join as join2 } from "path";

class HarnessFileClientImplementation {
  #root;
  constructor(config) {
    this.#root = config.root;
  }
  isInstalled(entry) {
    return existsSync2(join2(this.#root, entry.rel()));
  }
}
// src/doctor/adapter/installation-provenance-client-implementation.ts
import { existsSync as existsSync3, readFileSync as readFileSync2 } from "fs";
import { join as join3 } from "path";
class InstallationProvenanceClientImplementation {
  #path;
  constructor(config) {
    this.#path = join3(config.harnessRoot, "tools", "data", "deep-spec-analysis-install.json");
  }
  read() {
    if (!existsSync3(this.#path))
      return InstallationProvenance.missing();
    let value;
    try {
      value = JSON.parse(readFileSync2(this.#path, "utf-8"));
    } catch {
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
import { existsSync as existsSync4 } from "fs";
import { join as join4 } from "path";
class ReferenceCheckBackendClientImplementation {
  #root;
  constructor(config) {
    this.#root = config.root;
  }
  observe(artifact) {
    const findings = this.#readFindings(artifact);
    if (findings === null)
      return StructuralObservation.of(artifact, null);
    const parsed = FindingCount.parse(findings);
    return StructuralObservation.of(artifact, parsed.ok ? parsed.value : null);
  }
  #readFindings(artifact) {
    const script = join4(this.#root, "tools", artifact.tool().asString());
    if (!existsSync4(script))
      return null;
    const res = spawnSync("bun", [script, "--stage", "doctor", "--output-path", artifact.artifactPath().asString(), "--report-only"], {
      encoding: "utf-8",
      timeout: 15000
    });
    if (res.error || res.status !== 0)
      return null;
    try {
      const lines = (res.stdout ?? "").trim().split(`
`);
      const verdict = JSON.parse(lines[lines.length - 1] ?? "{}");
      return typeof verdict.findings_count === "number" ? verdict.findings_count : null;
    } catch {
      return null;
    }
  }
}
// src/doctor/adapter/solver-probe-client-implementation.ts
import { spawnSync as spawnSync2 } from "child_process";
import { existsSync as existsSync5, mkdtempSync, readdirSync as readdirSync2, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join as join5 } from "path";
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
    const work = mkdtempSync(join5(tmpdir(), "deep-spec-doctor-probe-"));
    try {
      const spec = join5(work, "probe.qnt");
      writeFileSync(spec, PROBE_MODULE, "utf-8");
      const res = spawnSync2(this.#config.quintBin, ["verify", spec, "--main=probe", "--invariant=inv", "--max-steps=1"], {
        encoding: "utf-8",
        timeout: 30000,
        cwd: work,
        killSignal: "SIGINT"
      });
      return Boolean(res.error) || res.status !== 0;
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
  availability() {
    let apalacheDist = this.#config.apalacheDistDeclared;
    if (!apalacheDist) {
      try {
        apalacheDist = readdirSync2(join5(this.#config.homeDir, ".quint")).some((f) => f.startsWith("apalache-dist-"));
      } catch {
        apalacheDist = false;
      }
    }
    const quintCli = this.#probe(this.#config.quintBin, ["--version"]);
    const apalache = this.#probe("java", ["-version"]) && apalacheDist;
    return SolverAvailability.of({
      z3Package: existsSync5(join5(this.#config.projectDir, "node_modules", "z3-solver", "package.json")),
      nodeRuntime: this.#probe("node", ["--version"]),
      quintCli,
      apalache,
      apalacheServerStale: apalache && quintCli && this.#apalacheServerIsStale()
    });
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
    const out = [];
    for (const entry of InstallationManifest.standard()) {
      out.push(InstalledStatus.of(entry, this.#files.isInstalled(entry)));
    }
    return out;
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
    const observations = [];
    for (const artifact of this.#workspace.designArtifacts())
      observations.push(this.#backend.observe(artifact));
    return StructuralDebt.of(observations);
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
  const root = join6(projectDir, harnessDir);
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
