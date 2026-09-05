// @bun
// src/entries/aidlc-sensor-deep-spec-design-verify-smt.ts
import { basename as basename3, dirname as dirname5, join as join8 } from "path";
import { fileURLToPath } from "url";

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
// src/kernel/adapter/record-root.ts
import { existsSync } from "fs";
import { dirname, join } from "path";
function findRecordRoot(startDir) {
  let d = startDir;
  for (let i = 0;i < 8; i++) {
    if (existsSync(join(d, "inception")) || existsSync(join(d, "aidlc-state.md")))
      return d;
    const parent = dirname(d);
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
// src/kernel/adapter/read-if-exists.ts
import { existsSync as existsSync2, readFileSync } from "fs";
function readIfExists(path) {
  return existsSync2(path) ? readFileSync(path, "utf-8") : null;
}
// src/kernel/adapter/contract-schema.ts
import { readFileSync as readFileSync2 } from "fs";

// src/kernel/infrastructure/result.ts
function ok(value) {
  return { ok: true, value };
}
function err(error) {
  return { ok: false, error };
}
function unreachable(x) {
  throw new Error(`defect: unreachable variant ${JSON.stringify(x)}`);
}
// src/kernel/infrastructure/json.ts
function isObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
var strArr = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
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
// src/kernel/infrastructure/illegal-argument-exception.ts
class IllegalArgumentException extends Error {
  problem;
  constructor(problem) {
    super(`Illegal argument: ${problem.kind}`);
    this.name = "IllegalArgumentException";
    this.problem = Object.freeze({ ...problem });
  }
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
// src/kernel/infrastructure/result-composition.ts
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
// src/kernel/domain/error-messages.ts
class ErrorMessages {
  #values;
  constructor(values) {
    if (values.length > 65536)
      throw new IllegalArgumentException({ kind: "too-many-error-messages", raw: values.length });
    this.#values = Object.freeze([...values]);
  }
  static parse(values) {
    return parseConstruction(() => new ErrorMessages(values));
  }
  static of(values) {
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
// src/kernel/adapter/contract-schema.ts
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
function readFindingsSchema(path) {
  const document = readContractSchema(path);
  if (!document.ok)
    return FindingsSchema.unreadable(document.error.cause);
  const parsed = FindingsSchema.parse(document.value);
  return parsed.ok ? parsed.value : FindingsSchema.unreadable(JSON.stringify(parsed.error));
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
  if (!Array.isArray(raw.findings) || !raw.findings.every((f) => isObject(f) && typeof f.kind === "string" && strings(f.frRefs) && strings(f.targets) && isObject(f.witness) && typeof f.detail === "string" && optionalString(f.unit))) {
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
  if (raw.crossChecked !== undefined && (!Array.isArray(raw.crossChecked) || !raw.crossChecked.every((c) => isObject(c) && typeof c.backend === "string" && strings(c.targets)))) {
    return err("crossChecked must be an array of backend comparisons");
  }
  return ok(raw);
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
// src/kernel/adapter/system-clock.ts
class SystemClock {
  now() {
    return Date.now();
  }
}
// src/kernel/adapter/atomic-write.ts
import { mkdirSync, renameSync, rmSync, writeFileSync } from "fs";
import { basename, dirname as dirname2, join as join2 } from "path";
var sequence = 0;
function writeFileAtomically(path, data) {
  const dir = dirname2(path);
  mkdirSync(dir, { recursive: true });
  sequence += 1;
  const tmp = join2(dir, `.${basename(path)}.tmp-${Date.now().toString(36)}-${sequence.toString(36)}`);
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
// src/kernel/adapter/directory-finalization-lock.ts
import { randomBytes } from "crypto";
import { mkdirSync as mkdirSync2, readFileSync as readFileSync3, renameSync as renameSync2, rmSync as rmSync2, writeFileSync as writeFileSync2 } from "fs";
import { join as join3 } from "path";
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
    return join3(directory.asString(), this.#lockBasename);
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
      writeFileSync2(join3(canonical, METADATA_BASENAME), `${JSON.stringify(metadata)}
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
      raw = JSON.parse(readFileSync3(join3(canonical, METADATA_BASENAME), "utf-8"));
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
        targets: traverseResult(entry.targets, TargetIdentifier.parse),
        unit: entry.unit === undefined ? ok(undefined) : UnitName.parse(entry.unit)
      });
      if (!fields.ok)
        return fields;
      return ok({ ...fields.value, functionalRequirementReferences: fields.value.functionalRequirementReferences, targets: TargetIdentifiers.of(fields.value.targets), witness: entry.witness, detail: entry.detail });
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
      const fields = combineResults({ backend: BackendName.parse(entry.backend), targets: traverseResult(entry.targets, TargetIdentifier.parse) });
      if (!fields.ok)
        return fields;
      return ok({ backend: fields.value.backend, targets: TargetIdentifiers.of(fields.value.targets) });
    })
  });
  if (!parsed.ok)
    return err(JSON.stringify(parsed.error));
  return ok({ ...parsed.value, checked: doc.checked, unavailable: doc.unavailable });
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
// src/design/domain/design-witness.ts
class DesignWitness {
  #document;
  constructor(document) {
    this.#document = boundedValueSnapshot(document, { string: 65536, nodes: 1e5, depth: 128, total: 16777216 });
  }
  static core(labels) {
    return new DesignWitness({ core: labels });
  }
  static model(values) {
    return new DesignWitness({ model: values });
  }
  static verdicts(byBackend) {
    return new DesignWitness({ verdicts: byBackend });
  }
  static trace(states) {
    return new DesignWitness({ trace: states });
  }
  static refs(entries) {
    return new DesignWitness({ refs: entries });
  }
  static parse(value) {
    return parseConstruction(() => new DesignWitness(value));
  }
  static of(raw) {
    return new DesignWitness(raw);
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
// src/design/domain/lowered-obligation.ts
class LoweredObligation {
  #id;
  #nature;
  #functionalRequirementReferences;
  #assert;
  #trigger;
  #guard;
  #effect;
  #temporal;
  constructor(props) {
    this.#id = props.id;
    this.#nature = ObligationNature.of(props.nature);
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#assert = props.assert === undefined ? undefined : ExpressionTree.of(props.assert).asExpression();
    this.#trigger = props.trigger === undefined ? undefined : TriggerName.of(props.trigger);
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
  #design;
  #kind;
  #pair;
  constructor(props) {
    this.#design = props.design;
    this.#kind = props.kind;
    this.#pair = props.pair;
  }
  static of(props) {
    return new LoweredOrigin(props);
  }
  design() {
    return this.#design;
  }
  isKind(kind) {
    return this.#kind === kind;
  }
  isSyntheticProbe() {
    return this.#kind === "vac-dead" || this.#kind === "vac-shadow";
  }
  pairRefs() {
    return this.#pair ?? [this.#design, this.#design];
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
  asString() {
    return this.#value;
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
    return { op: "eq", args: [prime ? { op: "ref", path: attrPath, prime: true } : { op: "ref", path: attrPath }, { op: "enum", value: state }] };
  }
  loweredGuard(attrPath) {
    const base = this.#stateEquality(attrPath, this.#from, false);
    return this.#guard === undefined ? base : { op: "and", args: [base, this.#guard] };
  }
  loweredEffect(attrPath) {
    const base = this.#stateEquality(attrPath, this.#to, true);
    return this.#effect === undefined ? base : { op: "and", args: [base, this.#effect] };
  }
  loweredAs(id, attrPath) {
    return LoweredObligation.of({
      id,
      nature: "event",
      functionalRequirementReferences: FunctionalRequirementReferences.of([]),
      trigger: this.#trigger.asString(),
      guard: this.loweredGuard(attrPath),
      effect: this.loweredEffect(attrPath)
    });
  }
  loweredOrigin() {
    return LoweredOrigin.of({ design: LoweredOriginReference.of(this.#id.asString()), kind: "transition" });
  }
  stateAssignment(attrPath) {
    return [attrPath, { op: "enum", value: this.#to }];
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
  compareTo(other) {
    return compareCanonically(this.#value, other.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/design/domain/design-transitions.ts
class DesignTransitions {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new DesignTransitions(values);
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
    return values.filter((s) => !this.#initial.includes(s)).sort();
  }
  waivesOverlapOf(machines) {
    return machines.every((m) => m === this) && !this.#deterministic;
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
  asString() {
    return this.#value;
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
  asString() {
    return this.#value;
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
  state() {
    return this.#state;
  }
  trigger() {
    return this.#trigger;
  }
  loweredGuard(attrPath) {
    return { op: "eq", args: [{ op: "ref", path: attrPath }, { op: "enum", value: this.#state }] };
  }
  loweredEffect(attrPath) {
    return { op: "eq", args: [{ op: "ref", path: attrPath, prime: true }, { op: "ref", path: attrPath }] };
  }
  loweredAs(id, attrPath) {
    return LoweredObligation.of({
      id,
      nature: "event",
      functionalRequirementReferences: FunctionalRequirementReferences.of([]),
      trigger: this.#trigger.asString(),
      guard: this.loweredGuard(attrPath),
      effect: this.loweredEffect(attrPath)
    });
  }
}
// src/design/domain/design-ignores.ts
class DesignIgnores {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new DesignIgnores(values);
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
// src/design/domain/design-machines.ts
class DesignMachines {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new DesignMachines(values);
  }
  add(value) {
    return new DesignMachines([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
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
  eventDefinition() {
    const behavior = this.guardedEffect();
    if (behavior === null || this.#trigger === undefined)
      return null;
    return { trigger: this.#trigger, ...behavior };
  }
  loweredAs(id) {
    const lowered = { id, nature: this.#nature.asString(), functionalRequirementReferences: this.#functionalRequirementReferences };
    const temporal = this.temporal();
    if (this.#assert !== undefined)
      lowered.assert = this.#assert;
    if (this.#trigger !== undefined)
      lowered.trigger = this.#trigger.asString();
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
  compareTo(other) {
    return compareCanonically(this.#value, other.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/design/domain/design-obligation-nature.ts
class DesignObligationNature {
  #value;
  constructor(value) {
    if (value.length > 128)
      throw new IllegalArgumentException({ kind: "design-obligation-nature-too-long", raw: value.length });
    this.#value = value;
  }
  static parse(value) {
    return parseConstruction(() => new DesignObligationNature(value));
  }
  static of(raw) {
    return new DesignObligationNature(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
  isEvent() {
    return this.#value === "event";
  }
  isInvariant() {
    return this.#value === "invariant";
  }
  isNumeric() {
    return this.#value === "numeric";
  }
  isStateTemporal() {
    return this.#value === "state-temporal";
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
  asString() {
    return this.#value;
  }
  isRules() {
    return this.#value === "rules";
  }
}
// src/design/domain/design-obligations.ts
class DesignObligations {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new DesignObligations(values);
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
// src/design/domain/lowered-scenario.ts
class LoweredScenario {
  #id;
  #kind;
  #functionalRequirementReferences;
  #bindings;
  #eventTrigger;
  #expect;
  constructor(props) {
    this.#id = props.id;
    this.#kind = props.kind;
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
  id() {
    return this.#id;
  }
  kind() {
    return this.#kind;
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
  expectation() {
    return this.#expect;
  }
  isAccept() {
    return this.#kind === "accept";
  }
}

// src/design/domain/design-scenario.ts
class DesignScenario {
  #id;
  #kind;
  #businessRuleReferences;
  #functionalRequirementReferences;
  #bindings;
  #eventTrigger;
  #expect;
  constructor(props) {
    this.#id = props.id;
    this.#kind = props.kind;
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
  id() {
    return this.#id;
  }
  kind() {
    return this.#kind;
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
  expectation() {
    return this.#expect;
  }
  isAccept() {
    return this.#kind === "accept";
  }
  isReject() {
    return this.#kind === "reject";
  }
  hasEvent() {
    return this.#eventTrigger !== undefined;
  }
  isViolatedBySatisfiability(satisfiable) {
    return this.isAccept() && !satisfiable || this.isReject() && satisfiable;
  }
  bindings() {
    return this.#bindings;
  }
  loweredAs(id) {
    return LoweredScenario.of({
      id,
      kind: this.#kind,
      functionalRequirementReferences: this.#functionalRequirementReferences,
      bindings: this.#bindings,
      ...this.#eventTrigger !== undefined ? { event: { trigger: this.#eventTrigger } } : {},
      ...this.#expect !== undefined ? { expect: this.#expect } : {}
    });
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
  compareTo(other) {
    return compareCanonically(this.#value, other.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/design/domain/design-scenarios.ts
class DesignScenarios {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new DesignScenarios(values);
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
  asString() {
    return this.#value;
  }
}

// src/design/domain/attribute-paths.ts
class AttributePaths {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new AttributePaths(KeySet.of(values));
  }
  add(value) {
    return new AttributePaths(this.#values.with(value));
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  has(value) {
    return this.#values.has(value);
  }
  toArray() {
    return [...this.#values];
  }
}

// src/design/domain/lowered-backgrounds.ts
class LoweredBackgrounds {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new LoweredBackgrounds(values);
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
    this.#value = raw;
  }
  static of(raw) {
    return new LoweredIdentifier(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new LoweredIdentifier(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
}

// src/design/domain/lowered-obligations.ts
class LoweredObligations {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new LoweredObligations(values);
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
class LoweredScenarios {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new LoweredScenarios(values);
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

// src/design/domain/lowered-unit.ts
class LoweredUnit {
  #obligations;
  #scenarios;
  #background;
  #index;
  constructor(props) {
    this.#obligations = props.obligations;
    this.#scenarios = props.scenarios;
    this.#background = props.background;
    this.#index = props.index;
  }
  static of(props) {
    return new LoweredUnit(props);
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
  extendedWith(obligations, index) {
    return new LoweredUnit({ obligations, scenarios: this.#scenarios, background: this.#background, index });
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
  constructor(props) {
    this.#origins = props.origins;
    this.#scenarioDesignIds = props.scenarioDesignIds;
    this.#machinesByTransition = props.machinesByTransition;
    this.#attrPathsByMachine = props.attrPathsByMachine;
  }
  static of(props) {
    return new LoweringIndex(props);
  }
  originOf(loweredId) {
    return this.#origins.get(LoweredIdentifier.of(loweredId)) ?? null;
  }
  resolveDesignTarget(loweredId) {
    const entry = this.#origins.get(LoweredIdentifier.of(loweredId)) ?? null;
    if (entry)
      return { design: entry.design().asString(), entry };
    const dsc = this.#scenarioDesignIds.get(LoweredIdentifier.of(loweredId));
    if (dsc)
      return { design: dsc.asString(), entry: null };
    return { design: loweredId, entry: null };
  }
  rewriteLoweredIds(text) {
    return text.replace(/\bOB-([0-9]+)\b/g, (m, num) => this.#origins.get(LoweredIdentifier.of(`OB-${num}`))?.design().asString() ?? m);
  }
  rewriteLoweredIdTokens(label) {
    return label.replace(/OB_([0-9]+)/g, (m, num) => {
      const entry = this.#origins.get(LoweredIdentifier.of(`OB-${num}`));
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
  withPassthrough(loweredId, designId) {
    return new LoweringIndex({
      origins: this.#origins.with(LoweredIdentifier.of(loweredId), LoweredOrigin.of({ design: LoweredOriginReference.of(designId), kind: "passthrough" })),
      scenarioDesignIds: this.#scenarioDesignIds,
      machinesByTransition: this.#machinesByTransition,
      attrPathsByMachine: this.#attrPathsByMachine
    });
  }
  toOriginEntries() {
    return [...this.#origins].map(([id, origin]) => [id.asString(), origin]);
  }
}

// src/design/domain/design-unit.ts
class DesignUnit {
  #unit;
  #entities;
  #attrPaths;
  #obligations;
  #machines;
  #scenarios;
  #background;
  constructor(seed) {
    this.#unit = UnitName.of(seed.unit);
    this.#entities = seed.entities;
    const coordinates = new Set;
    for (const ent of seed.entities) {
      for (const attr of ent.attributes())
        coordinates.add(`${ent.name().asString()}.${attr.name().asString()}`);
    }
    this.#attrPaths = AttributePaths.of([...coordinates].map((path) => AttributePath.of(path)));
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
  id() {
    return DesignUnitIdentifier.of(this.#unit.asString());
  }
  name() {
    return this.#unit.asString();
  }
  entities() {
    return this.#entities;
  }
  attrPaths() {
    return this.#attrPaths;
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
  lowered(opts) {
    const obligations = [];
    const origins = [];
    const machinesByTransition = [];
    const attrPathsByMachine = [];
    const candidates = [];
    let n = 0;
    const nextId = () => {
      n += 1;
      return LoweredIdentifier.of(`OB-${n}`);
    };
    for (const ob of this.#obligations.sortedCanonically()) {
      const id = nextId();
      obligations.push(ob.loweredAs(id));
      origins.push([id, ob.loweredOrigin()]);
      const event = ob.eventDefinition();
      if (event !== null) {
        candidates.push({ design: ob.id().asString(), trigger: event.trigger.asString(), guard: event.guard, effect: event.effect });
      }
    }
    for (const sm of this.#machines.sortedCanonically()) {
      const attrPath = DesignMachines.attrPathOf(sm);
      attrPathsByMachine.push([sm.id(), AttributePath.of(attrPath)]);
      for (const tr of sm.transitions().sortedCanonically()) {
        const id = nextId();
        obligations.push(tr.loweredAs(id, attrPath));
        origins.push([id, tr.loweredOrigin()]);
        machinesByTransition.push([tr.id(), sm]);
        candidates.push({ design: tr.id().asString(), trigger: tr.trigger().asString(), guard: tr.loweredGuard(attrPath), effect: tr.loweredEffect(attrPath) });
      }
      for (const ig of sm.ignores().sortedByStateTrigger()) {
        const id = nextId();
        obligations.push(ig.loweredAs(id, attrPath));
        origins.push([id, sm.loweredIgnoreOrigin()]);
      }
    }
    if (opts.synthetics) {
      for (const c of candidates) {
        const id = nextId();
        obligations.push(LoweredObligation.of({ id, nature: "invariant", functionalRequirementReferences: FunctionalRequirementReferences.of([]), assert: { op: "implies", args: [c.guard, { op: "bool", value: true }] } }));
        origins.push([id, LoweredOrigin.of({ design: LoweredOriginReference.of(c.design), kind: "vac-dead" })]);
      }
      const byTrigger = new Map;
      for (const c of candidates) {
        const list = byTrigger.get(c.trigger) ?? [];
        list.push(c);
        byTrigger.set(c.trigger, list);
      }
      for (const trigger of [...byTrigger.keys()].sort()) {
        const list = byTrigger.get(trigger) ?? [];
        for (const a of list) {
          for (const b of list) {
            if (a === b)
              continue;
            if (!ExpressionTree.of(a.effect).isCanonicallyEqual(ExpressionTree.of(b.effect)))
              continue;
            const id = nextId();
            obligations.push(LoweredObligation.of({
              id,
              nature: "invariant",
              functionalRequirementReferences: FunctionalRequirementReferences.of([]),
              assert: {
                op: "implies",
                args: [{ op: "and", args: [b.guard, { op: "not", args: [a.guard] }] }, { op: "bool", value: true }]
              }
            }));
            origins.push([id, LoweredOrigin.of({
              design: LoweredOriginReference.of(`${a.design}|${b.design}`),
              kind: "vac-shadow",
              pair: [LoweredOriginReference.of(a.design), LoweredOriginReference.of(b.design)]
            })]);
          }
        }
      }
    }
    const scenarios = [];
    const scenarioDesignIds = [];
    let scN = 0;
    for (const sc of this.#scenarios.sortedCanonically()) {
      scN += 1;
      const id = LoweredIdentifier.of(`SC-${scN}`);
      scenarios.push(sc.loweredAs(id));
      scenarioDesignIds.push([id, sc.id()]);
    }
    const background = [];
    let bgN = 0;
    for (const bg of this.#background.sortedCanonically()) {
      bgN += 1;
      background.push(bg.loweredAs(LoweredIdentifier.of(`BG-${bgN}`)));
    }
    return LoweredUnit.of({
      obligations: LoweredObligations.of(obligations),
      scenarios: LoweredScenarios.of(scenarios),
      background: LoweredBackgrounds.of(background),
      index: LoweringIndex.of({
        origins: KeyedIndex.of(origins),
        scenarioDesignIds: KeyedIndex.of(scenarioDesignIds),
        machinesByTransition: KeyedIndex.of(machinesByTransition),
        attrPathsByMachine: KeyedIndex.of(attrPathsByMachine)
      })
    });
  }
  #attributeAt(attrPath) {
    for (const ent of this.#entities) {
      for (const attr of ent.attributes()) {
        if (`${ent.name().asString()}.${attr.name().asString()}` === attrPath)
          return attr;
      }
    }
    return null;
  }
  declaredEnumValuesOf(attrPath) {
    const values = this.#attributeAt(attrPath)?.enumStates() ?? null;
    return values === null ? null : values.toArray().map((member) => member.asString());
  }
  enumValuesOf(attrPath) {
    return this.declaredEnumValuesOf(attrPath) ?? [];
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
class DesignBackgroundAssumptions {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new DesignBackgroundAssumptions(values);
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
  compareTo(other) {
    return compareCanonically(this.#value, other.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/design/domain/design-units.ts
class DesignUnits {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new DesignUnits(values);
  }
  add(value) {
    return new DesignUnits([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  sortedByName() {
    return new DesignUnits([...this.#values].sort((a, b) => a.name() < b.name() ? -1 : a.name() > b.name() ? 1 : 0));
  }
  isEmpty() {
    return this.#values.length === 0;
  }
  toArray() {
    return this.#values;
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
  isConflict() {
    return this.#kind.isConflict();
  }
  asRefinementViolation(reqIds, unit) {
    if (!this.#kind.isConflict())
      return null;
    const reqHits = this.#targets.toArray().filter((t) => reqIds.has(t.asString()));
    if (reqHits.length === 0)
      return null;
    return new DesignFinding({
      kind: FindingKind.refinementViolation(),
      functionalRequirementReferences: this.#functionalRequirementReferences,
      targets: TargetIdentifiers.of(reqHits),
      witness: this.#witness,
      unit,
      detail: `The design machine of unit ${unit.asString()} reaches a state that violates requirements obligation ${reqHits.map((t) => t.asString()).join(", ")} under the refinement map (step trace attached): the design can execute its way out of the verified requirements.`
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

class DesignFindings {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new DesignFindings(values);
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
  isEmpty() {
    return this.#values.length === 0;
  }
  toArray() {
    return this.#values;
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
// src/design/domain/design-skips.ts
function sortDesignSkipped(skipped) {
  return [...skipped].sort((a, b) => a.compareTo(b));
}

class DesignSkips {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new DesignSkips(values);
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
  toArray() {
    return this.#values;
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
  unavailableReason() {
    return this.#state.kind === "unavailable" ? this.#state.reason : null;
  }
  reachabilityOf(attrPath, state) {
    return this.match({
      unreadable: () => ReachabilityVerdict.unverified(),
      unavailable: () => ReachabilityVerdict.unverified(),
      readable: (method, findings, skipped) => {
        for (const finding of findings) {
          if (finding.provesReachabilityOf(attrPath, state))
            return ReachabilityVerdict.reached();
        }
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
      unreadable: (reason) => ({ findings: DesignFindings.of([]), skipped: DesignSkips.of([]), unavailable: reason, method: null }),
      unavailable: (reason, method) => ({ findings: DesignFindings.of([]), skipped: DesignSkips.of([]), unavailable: reason, method }),
      readable: (method, findings, skipped) => this.#remapReadable(unit, index, method, findings, skipped)
    });
  }
  #remapReadable(u, index, method, docFindings, docSkipped) {
    const mapTarget = (t) => index.resolveDesignTarget(t);
    const rewriteLabel = (label) => index.rewriteLoweredIdTokens(label);
    const remapDetail = (detail) => index.rewriteLoweredIds(detail);
    const findings = [];
    const skipped = [];
    const waived = new Set;
    const deadDesignIds = new Set;
    const shadowFindings = [];
    for (const f of docFindings) {
      const mapped = f.targets().map((t) => mapTarget(t.asString()));
      const functionalRequirementReferences = f.functionalRequirementReferences();
      const detail = remapDetail(f.detail());
      const witness = f.witnessRemappedBy(rewriteLabel);
      const synth = mapped.find((m) => m.entry?.isSyntheticProbe());
      if (synth?.entry?.isKind("vac-dead") && f.isKind("conflict")) {
        const design = synth.entry.design().asString();
        const isTransition = index.isTransition(design);
        deadDesignIds.add(design);
        findings.push(DesignFinding.of({
          kind: FindingKind.unreachable(),
          functionalRequirementReferences,
          targets: TargetIdentifiers.of(Array.from([design], (raw) => TargetIdentifier.of(raw))),
          witness,
          unit: UnitName.of(u.name()),
          detail: `The guard of ${design} can never hold under the entity constraints and invariants (witness core attached): the ${isTransition ? "transition" : "rule"} is dead.`
        }));
        continue;
      }
      if (synth?.entry?.isKind("vac-shadow") && f.isKind("conflict")) {
        const pairRefs = synth.entry.pairRefs();
        const pair = [pairRefs[0].asString(), pairRefs[1].asString()];
        shadowFindings.push({
          finding: DesignFinding.of({
            kind: FindingKind.redundancy(),
            functionalRequirementReferences,
            targets: TargetIdentifiers.of(Array.from([pair[0], pair[1]], (raw) => TargetIdentifier.of(raw))).sortedUniqueCanonically(),
            witness,
            unit: UnitName.of(u.name()),
            detail: `${pair[1]} is subsumed by ${pair[0]}: same trigger, a provably narrower guard, and an identical effect \u2014 it can never apply where ${pair[0]} does not.`
          }),
          subsumer: pair[0],
          subsumed: pair[1]
        });
        continue;
      }
      if (synth)
        continue;
      const targets = TargetIdentifiers.of(Array.from(mapped.map((m) => m.design), (raw) => TargetIdentifier.of(raw))).sortedUniqueCanonically().toStrings();
      if (f.isKind("conflict") && targets.length > 0) {
        const machines = targets.map((t) => index.machineOfTransition(t));
        const first = machines[0];
        if (first !== null && first !== undefined && first.waivesOverlapOf(machines)) {
          for (const t of targets) {
            if (!waived.has(t)) {
              waived.add(t);
              skipped.push(DesignSkipped.of({
                target: TargetIdentifier.of(t),
                reason: SkipReason.waived(),
                unit: UnitName.of(u.name()),
                detail: `machine ${first.id().asString()} declares deterministic: false \u2014 the same-(state,trigger) overlap check is waived by the model`
              }));
            }
          }
          continue;
        }
      }
      findings.push(DesignFinding.of({ kind: FindingKind.of(f.kind()), functionalRequirementReferences, targets: TargetIdentifiers.of(Array.from(targets, (raw) => TargetIdentifier.of(raw))), witness, unit: UnitName.of(u.name()), detail }));
    }
    const liveShadows = shadowFindings.filter((s) => !deadDesignIds.has(s.subsumed) && !deadDesignIds.has(s.subsumer));
    const byPair = new Map;
    for (const s of liveShadows) {
      const key = s.finding.targets().joined(",");
      const list = byPair.get(key) ?? [];
      list.push(s);
      byPair.set(key, list);
    }
    for (const key of [...byPair.keys()].sort()) {
      const list = byPair.get(key) ?? [];
      const directions = new Set(list.map((s) => `${s.subsumer}>${s.subsumed}`));
      const first = list[0];
      if (!first)
        continue;
      if (list.length >= 2 && directions.size >= 2) {
        const [a, b] = first.finding.targets().toStrings();
        findings.push(first.finding.withDetail(`${a} and ${b} are mutually redundant: same trigger, provably equivalent guards (under the entity constraints), and an identical effect \u2014 one of them can be removed.`));
      } else {
        findings.push(first.finding);
      }
    }
    const seenSkip = new Set;
    for (const s of docSkipped) {
      const { design, entry } = mapTarget(s.target().asString());
      if (entry?.isSyntheticProbe())
        continue;
      const detail = s.detail();
      const key = `${design}|${s.reason()}`;
      if (seenSkip.has(key))
        continue;
      seenSkip.add(key);
      skipped.push(DesignSkipped.of({
        target: TargetIdentifier.of(design),
        reason: SkipReason.of(s.reason()),
        unit: UnitName.of(u.name()),
        ...detail !== undefined ? { detail: remapDetail(detail) } : {}
      }));
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
class SiblingVerdictFindings {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new SiblingVerdictFindings(values);
  }
  add(value) {
    return new SiblingVerdictFindings([...this.#values, value]);
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
  target() {
    return this.#target;
  }
  reason() {
    return this.#reason.asString();
  }
  detail() {
    return this.#detail;
  }
}
// src/design/domain/sibling-verdict-skips.ts
class SiblingVerdictSkips {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new SiblingVerdictSkips(values);
  }
  add(value) {
    return new SiblingVerdictSkips([...this.#values, value]);
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
  static irUnreadable(id, method, cause) {
    return DesignReport.compose({
      id,
      irVersion: IntermediateRepresentationVersion.of("0.0.0"),
      irHash: ContentHash.ofText(""),
      method,
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
      skipped: DesignSkips.of(model.units().toArray().flatMap((u) => [...u.allTargets()].map((t) => DesignSkipped.of({
        target: t,
        reason: SkipReason.irVersionMismatch(),
        unit: UnitName.of(u.name()),
        detail: `design IR major version ${model.majorVersion()} is not supported by this backend (supports ${SUPPORTED_DESIGN_IR_MAJOR}.x.x)`
      }))))
    });
  }
  static backendUnavailable(id, model, irHash, method, reason, skipDetail) {
    return DesignReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method,
      findings: DesignFindings.of([]),
      skipped: DesignSkips.of(model.units().toArray().flatMap((u) => [...u.allTargets()].map((t) => DesignSkipped.of({ target: t, reason: SkipReason.unavailable(), unit: UnitName.of(u.name()), detail: skipDetail })))),
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
      ordered.inputs = inputs.toArray().map((i) => ({ artifact: i.artifact(), sha256: i.sha256().asString() }));
    const checked = this.#checked;
    if (checked !== null)
      ordered.checked = checked.toStrings();
    ordered.findings = this.#findings.toArray().map((f) => {
      const out = {
        kind: f.kind(),
        frRefs: f.functionalRequirementReferences().toStrings(),
        targets: f.targets().toStrings(),
        witness: f.witness().toDocument(),
        unit: f.unit(),
        detail: f.detail()
      };
      return out;
    });
    ordered.skipped = this.#skipped.toArray().map((sk) => {
      const out = { target: sk.target().asString(), reason: sk.reason(), unit: sk.unit() };
      const detail = sk.detail();
      if (detail !== undefined)
        out.detail = detail;
      return out;
    });
    const crossChecked = this.#crossChecked;
    if (crossChecked !== null) {
      ordered.crossChecked = crossChecked.toArray().map((e) => ({ backend: e.backend().asString(), targets: e.targets().toStrings() }));
    }
    return ordered;
  }
  conformedTo(schema) {
    const reason = schema.degradationReasonFor(this.toDocument());
    return reason === null ? this : this.degraded(reason);
  }
}
// src/design/domain/checked-units.ts
class CheckedUnits {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new CheckedUnits(values);
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
// src/design/domain/design-cross-checked-entries.ts
class DesignCrossCheckedEntries {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new DesignCrossCheckedEntries(values);
  }
  add(value) {
    return new DesignCrossCheckedEntries([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/design-cross-checked-entry.ts
class DesignCrossCheckedEntry {
  #backend;
  #targets;
  constructor(props) {
    this.#backend = props.backend;
    this.#targets = props.targets;
  }
  static of(props) {
    return new DesignCrossCheckedEntry(props);
  }
  backend() {
    return this.#backend;
  }
  targets() {
    return this.#targets;
  }
  compareByBackend(other) {
    const a = this.#backend.asString();
    const b = other.#backend.asString();
    return a < b ? -1 : a > b ? 1 : 0;
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
class DesignInputAnchors {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new DesignInputAnchors(values);
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
  toArray() {
    return this.#values;
  }
}
// src/design/domain/design-reports.ts
class DesignReports {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new DesignReports(values);
  }
  add(value) {
    return new DesignReports([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
  crossChecked(id, model, irHash) {
    const docs = this.toArray().filter((s) => s.irHash().equals(irHash) && !s.isUnavailable()).map((s) => ({
      backend: s.id().backendName().asString(),
      findings: s.findings().toArray(),
      skipped: new Set(s.skipped().toArray().map((e) => `${e.unit()}|${e.target().asString()}`))
    }));
    const findings = [];
    const comparedByBackend = new Map;
    for (let i = 0;i < docs.length; i++) {
      for (let j = i + 1;j < docs.length; j++) {
        const a = docs[i];
        const b = docs[j];
        if (!a || !b)
          continue;
        for (const u of model.units()) {
          for (const sc of u.scenarios()) {
            const key = `${u.name()}|${sc.id().asString()}`;
            if (a.skipped.has(key) || b.skipped.has(key))
              continue;
            const verdictOf = (d) => d.findings.some((f) => f.kind() === "scenario-violation" && f.unit() === u.name() && f.targets().includes(TargetIdentifier.of(sc.id().asString())));
            const va = verdictOf(a);
            const vb = verdictOf(b);
            (comparedByBackend.get(a.backend) ?? comparedByBackend.set(a.backend, new Set).get(a.backend))?.add(sc.id().asString());
            (comparedByBackend.get(b.backend) ?? comparedByBackend.set(b.backend, new Set).get(b.backend))?.add(sc.id().asString());
            if (va !== vb) {
              const verdicts = {};
              verdicts[a.backend] = va ? "violated" : "clean";
              verdicts[b.backend] = vb ? "violated" : "clean";
              findings.push(DesignFinding.of({
                kind: FindingKind.crossCheckDisagreement(),
                functionalRequirementReferences: FunctionalRequirementReferences.of([...sc.functionalRequirementReferences()]).sortedUnique(),
                targets: TargetIdentifiers.of(Array.from([sc.id().asString()], (raw) => TargetIdentifier.of(raw))),
                witness: DesignWitness.verdicts(verdicts),
                unit: UnitName.of(u.name()),
                detail: `Backends "${a.backend}" and "${b.backend}" disagree on scenario ${sc.id().asString()} of unit ${u.name()}. This signals a defect in the formalization or in a backend compiler, not in the design itself.`
              }));
            }
          }
        }
      }
    }
    const crossChecked = [...comparedByBackend.entries()].map(([backend, targets]) => DesignCrossCheckedEntry.of({ backend: BackendName.of(backend), targets: TargetIdentifiers.of(Array.from([...targets], (raw) => TargetIdentifier.of(raw))).sortedCanonically() })).sort((x, y) => x.compareByBackend(y));
    return DesignReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method: "exhaustive",
      findings: DesignFindings.of(findings),
      skipped: DesignSkips.of([]),
      crossChecked: DesignCrossCheckedEntries.of(crossChecked)
    });
  }
}
// src/design/domain/design-verify-directory.ts
var CROSS_CHECK_BACKEND = "cross-check";

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
    return new DesignVerifyDirectory(directory, reports, null, crossCheck);
  }
  finalizing(candidate) {
    const fileName = candidate.id().fileName();
    const merged = [];
    let replaced = false;
    for (const sibling of this.#reports.toArray()) {
      if (sibling.id().fileName() === fileName) {
        merged.push(candidate);
        replaced = true;
      } else {
        merged.push(sibling);
      }
    }
    if (!replaced) {
      const at = merged.findIndex((s) => s.id().fileName() > fileName);
      if (at < 0)
        merged.push(candidate);
      else
        merged.splice(at, 0, candidate);
    }
    return new DesignVerifyDirectory(this.#directory, DesignReports.of(merged), candidate, null);
  }
  finalizedWith(candidate, model, schema) {
    const staged = this.finalizing(candidate.conformedTo(schema));
    if (model === null)
      return staged;
    const derived = staged.#reports.crossChecked(DesignReportIdentifier.of(this.#directory, CROSS_CHECK_BACKEND), model, candidate.irHash());
    return new DesignVerifyDirectory(this.#directory, staged.#reports, staged.#candidate, derived.conformedTo(schema));
  }
  crossChecked(model, irHash) {
    const derived = this.#reports.crossChecked(DesignReportIdentifier.of(this.#directory, CROSS_CHECK_BACKEND), model, irHash);
    return new DesignVerifyDirectory(this.#directory, this.#reports, this.#candidate, derived);
  }
  withoutCrossCheck() {
    return new DesignVerifyDirectory(this.#directory, this.#reports, this.#candidate, null);
  }
  conformedTo(schema) {
    const candidate = this.#candidate;
    const crossCheck = this.#crossCheck;
    const conformedCandidate = candidate === null ? null : candidate.conformedTo(schema);
    const conformedCrossCheck = conformedCandidate !== candidate || crossCheck === null ? null : crossCheck.conformedTo(schema);
    const reports = conformedCandidate === null ? this.#reports : DesignReports.of(this.#reports.toArray().map((r) => r.id().fileName() === conformedCandidate.id().fileName() ? conformedCandidate : r));
    return new DesignVerifyDirectory(this.#directory, reports, conformedCandidate, conformedCrossCheck);
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
  crossCheck() {
    return this.#crossCheck;
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
  compareTo(other) {
    return this.#value < other.#value ? -1 : this.#value > other.#value ? 1 : 0;
  }
  asString() {
    return this.#value;
  }
}
// src/design/domain/business-rule-references.ts
class BusinessRuleReferences {
  #values;
  constructor(values) {
    if (values.length > 1e4)
      throw new IllegalArgumentException({ kind: "too-many-business-rule-references", raw: values.length });
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new BusinessRuleReferences(values);
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
    return this.#kind.isEnum() && (this.#values?.includes(value) ?? false);
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
// src/design/domain/design-attribute-declarations.ts
class DesignAttributeDeclarations {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new DesignAttributeDeclarations(values);
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
  id() {
    return this.#id;
  }
  assertion() {
    return this.#assert;
  }
  inspectExpressions(visitor) {
    if (this.#assert !== undefined)
      visitor(this.#assert, false);
  }
}
// src/design/domain/design-background-declarations.ts
class DesignBackgroundDeclarations {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new DesignBackgroundDeclarations(values);
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
    const seen = new Set;
    for (const attribute of this.#attributes) {
      const attributeName = attribute.name().asString();
      visitor(`${this.#name.asString()}.${attributeName}`, attribute, seen.has(attributeName));
      seen.add(attributeName);
    }
  }
}
// src/design/domain/design-entity-declarations.ts
class DesignEntityDeclarations {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new DesignEntityDeclarations(values);
  }
  add(value) {
    return new DesignEntityDeclarations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
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
  state() {
    return this.#state;
  }
  trigger() {
    return this.#trigger;
  }
  isStateAmong(states) {
    return states.includes(this.#state);
  }
  cellKey() {
    return `${this.#state}|${this.#trigger.asString()}`;
  }
}
// src/design/domain/design-ignore-declarations.ts
class DesignIgnoreDeclarations {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new DesignIgnoreDeclarations(values);
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
  initialStatesOutside(states) {
    return [...this.#initial].filter((state) => !states.includes(state.asString())).map((state) => state.asString());
  }
}
// src/design/domain/design-machine-declarations.ts
class DesignMachineDeclarations {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new DesignMachineDeclarations(values);
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
  id() {
    return this.#id;
  }
  businessRuleReferences() {
    return this.#businessRuleReferences;
  }
  missesRequiredBusinessRuleReferences() {
    return this.#origin?.isRules() === true && this.#businessRuleReferences === undefined;
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
// src/design/domain/design-obligation-declarations.ts
class DesignObligationDeclarations {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new DesignObligationDeclarations(values);
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
  id() {
    return this.#id;
  }
  bindings() {
    return this.#bindings;
  }
  businessRuleReferences() {
    return this.#businessRuleReferences;
  }
  inspectExpectation(visitor) {
    if (this.#expect !== undefined)
      visitor(this.#expect, this.#hasEvent);
  }
}
// src/design/domain/design-scenario-declarations.ts
class DesignScenarioDeclarations {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new DesignScenarioDeclarations(values);
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
    return [["from", this.#from], ["to", this.#to]];
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
class DesignTransitionDeclarations {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new DesignTransitionDeclarations(values);
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
// src/design/domain/business-rule-reference-index.ts
class BusinessRuleReferenceIndex {
  #ids;
  constructor(ids) {
    this.#ids = ids;
  }
  static fromRules(rulesMarkdown) {
    const ids = [];
    for (const m of rulesMarkdown.matchAll(/\bBR[0-9]+\.[0-9]+\b/g))
      ids.push(BusinessRuleReference.of(m[0]));
    return new BusinessRuleReferenceIndex(KeySet.of(ids));
  }
  has(br) {
    return this.#ids.has(br);
  }
  sortedIds() {
    return this.#ids.toArray().map((id) => id.asString()).sort();
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
  #rulesMarkdown;
  constructor(props) {
    this.#unit = props.unit;
    this.#entities = props.entities;
    this.#obligations = props.obligations;
    this.#stateMachines = props.stateMachines;
    this.#scenarios = props.scenarios;
    this.#background = props.background;
    this.#unformalizedTargets = props.unformalizedTargets;
    this.#directoryExists = props.directoryExists;
    this.#rulesMarkdown = props.rulesMarkdown;
  }
  static of(props) {
    return new DesignUnitDeclaration(props);
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
  rulesMarkdown() {
    return this.#rulesMarkdown;
  }
  wellFormednessErrors() {
    const errors = [];
    const unitName = this.#unit.asString();
    const where = (s) => `unit ${unitName}: ${s}`;
    const attrTypes = new Map;
    for (const ent of this.#entities) {
      ent.inspectAttributes((coord, attr, duplicated) => {
        if (duplicated)
          errors.push(where(`duplicate attribute "${coord}"`));
        if (attr.lacksIntBounds()) {
          errors.push(where(`${coord}: int attributes require min and max \u2014 the Quint backend needs bounded domains`));
        }
        if (attr.boundsInverted()) {
          errors.push(where(`${coord}: min > max`));
        }
        if (attr.boundsOutsideSafeRange()) {
          errors.push(where(`${coord}: bounds must be safe integers`));
        }
        attrTypes.set(coord, attr);
      });
    }
    const encoded = new Map;
    for (const path of attrTypes.keys()) {
      const key = path.replace(/\./g, "_");
      const prior = encoded.get(key);
      if (prior !== undefined) {
        errors.push(where(`attribute paths "${prior}" and "${path}" collide under the solver variable encoding (dots become underscores)`));
      } else {
        encoded.set(key, path);
      }
    }
    const checkExpr = (e, ctx, primesAllowed) => {
      const boundEnum = new Map;
      const tree = ExpressionTree.of(e);
      tree.walk((node) => {
        const args = node.args ?? [];
        if (args.length === 2) {
          const ref = args.find((a) => a.op === "ref" && typeof a.path === "string");
          const en = args.find((a) => a.op === "enum");
          if (ref && en)
            boundEnum.set(en, ref.path);
        }
      });
      tree.walk((node) => {
        if (node.op === "ref" && typeof node.path === "string") {
          if (!attrTypes.has(node.path))
            errors.push(where(`${ctx}: unresolvable reference "${node.path}"`));
          if (node.prime === true && !primesAllowed) {
            errors.push(where(`${ctx}: primed reference "${node.path}" is only legal in effects and event-scenario expectations`));
          }
        }
        if (node.op === "enum" && typeof node.value === "string") {
          const sibling = boundEnum.get(node);
          const siblingType = sibling === undefined ? undefined : attrTypes.get(sibling);
          if (siblingType !== undefined) {
            if (!siblingType.isEnum()) {
              errors.push(where(`${ctx}: enum literal "${node.value}" is compared against non-enum attribute "${sibling}"`));
            } else if (!siblingType.admitsEnumLiteral(node.value)) {
              errors.push(where(`${ctx}: enum literal "${node.value}" is not a value of "${sibling}"`));
            }
          } else if (sibling === undefined) {
            const known = [...attrTypes.values()].some((t) => t.admitsEnumLiteral(node.value));
            if (!known)
              errors.push(where(`${ctx}: enum literal "${node.value}" is not a value of any declared enum attribute`));
          }
        }
      });
    };
    const seenIds = new Set;
    const dup = (id, ctx) => {
      if (seenIds.has(id))
        errors.push(where(`${ctx}: duplicate id "${id}"`));
      seenIds.add(id);
    };
    const businessRuleReferencesUsed = new Set;
    const collectBr = (refs) => {
      if (refs === undefined)
        return;
      for (const b of refs)
        businessRuleReferencesUsed.add(b.asString());
    };
    for (const ob of this.#obligations) {
      const ctx = `obligation ${ob.id().asString()}`;
      dup(ob.id().asString(), ctx);
      collectBr(ob.businessRuleReferences());
      if (ob.missesRequiredBusinessRuleReferences()) {
        errors.push(where(`${ctx}: origin "rules" requires brRefs`));
      }
      ob.inspectExpressions((expression, primesAllowed) => checkExpr(expression, ctx, primesAllowed));
    }
    for (const sm of this.#stateMachines) {
      const ctx = `machine ${sm.id().asString()}`;
      dup(sm.id().asString(), ctx);
      const attrPath = sm.attrPath();
      const attr = attrTypes.get(attrPath);
      if (!attr) {
        errors.push(where(`${ctx}: lifecycle attribute "${attrPath}" is not declared`));
        continue;
      }
      const states = attr.enumStates();
      if (states === null) {
        errors.push(where(`${ctx}: lifecycle attribute "${attrPath}" is not an enum \u2014 its values are the state set`));
        continue;
      }
      for (const s of sm.initialStatesOutside(states)) {
        errors.push(where(`${ctx}: initial state "${s}" is not a value of ${attrPath}`));
      }
      const transitionCells = new Set;
      for (const tr of sm.transitions()) {
        const tctx = `transition ${tr.id().asString()}`;
        dup(tr.id().asString(), tctx);
        collectBr(tr.businessRuleReferences());
        for (const [k, v] of tr.stateEntries()) {
          if (v !== undefined && !states.includes(v)) {
            errors.push(where(`${tctx}: ${k} state "${v}" is not a value of ${attrPath}`));
          }
        }
        const cellKey = tr.cellKey();
        if (cellKey !== null)
          transitionCells.add(cellKey);
        tr.inspectExpressions((expression, primesAllowed) => checkExpr(expression, tctx, primesAllowed));
        if (tr.assignsPrimedReferenceTo(attrPath)) {
          errors.push(where(`${tctx}: the effect assigns the machine's own attribute "${attrPath}" \u2014 state' = to is implicit`));
        }
      }
      for (const ig of sm.ignores()) {
        if (!ig.isStateAmong(states)) {
          errors.push(where(`${ctx}: ignores state "${ig.state()}" is not a value of ${attrPath}`));
        }
        if (transitionCells.has(ig.cellKey())) {
          errors.push(where(`${ctx}: ignores (${ig.state()}, ${ig.trigger().asString()}) collides with a declared transition for the same (state, trigger)`));
        }
      }
    }
    for (const sc of this.#scenarios) {
      const ctx = `scenario ${sc.id().asString()}`;
      dup(sc.id().asString(), ctx);
      collectBr(sc.businessRuleReferences());
      for (const binding of sc.bindings()) {
        const path = binding.path();
        const val = binding.value();
        const t = attrTypes.get(path.asString());
        if (!t) {
          errors.push(where(`${ctx}: binding for unknown attribute "${path.asString()}"`));
          continue;
        }
        const ok2 = t.fitsBinding(val);
        if (!ok2)
          errors.push(where(`${ctx}: binding value ${val.describe()} does not fit ${t.kindLabel()} attribute "${path.asString()}"`));
      }
      sc.inspectExpectation((expression, primesAllowed) => checkExpr(expression, ctx, primesAllowed));
    }
    for (const bg of this.#background) {
      const ctx = `background ${bg.id().asString()}`;
      dup(bg.id().asString(), ctx);
      bg.inspectExpressions((expression, primesAllowed) => checkExpr(expression, ctx, primesAllowed));
    }
    if (this.lacksConstructionDirectory()) {
      errors.push(where(`no construction/${unitName}/ directory exists under this record \u2014 the unit name matches no unit-of-work, so BR coverage cannot be verified`));
    }
    const rulesMd = this.#rulesMarkdown;
    if (rulesMd === null) {
      if (businessRuleReferencesUsed.size > 0) {
        errors.push(where(`brRefs are used but construction/${unitName}/functional-design/rules.md was not found \u2014 they cannot be reverse-verified`));
      }
    } else {
      const known = BusinessRuleReferenceIndex.fromRules(rulesMd);
      for (const br of [...businessRuleReferencesUsed].sort()) {
        if (!known.has(BusinessRuleReference.of(br)))
          errors.push(where(`brRef "${br}" does not exist in rules.md`));
      }
      const unformalizedTargets = this.#unformalizedTargets;
      for (const br of known.sortedIds()) {
        if (!businessRuleReferencesUsed.has(br) && !unformalizedTargets.covers(TargetIdentifier.of(br))) {
          errors.push(where(`BR coverage: rule ${br} in rules.md is neither referenced by any obligation/transition/scenario nor listed in unformalized[] \u2014 silence is a contract violation`));
        }
      }
    }
    return errors;
  }
}
// src/design/domain/design-unit-declarations.ts
class DesignUnitDeclarations {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new DesignUnitDeclarations(values);
  }
  add(value) {
    return new DesignUnitDeclarations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  wellFormednessErrors() {
    const errors = [];
    const unitNames = new Set;
    for (const unit of this.#values) {
      const unitName = unit.unit().asString();
      if (unitNames.has(unitName))
        errors.push(`duplicate unit "${unitName}"`);
      unitNames.add(unitName);
      errors.push(...unit.wellFormednessErrors());
    }
    return errors;
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/initial-states.ts
class InitialStates {
  #values;
  constructor(values) {
    if (values.length > 1e4)
      throw new IllegalArgumentException({ kind: "too-many-initial-states", raw: values.length });
    this.#values = Object.freeze([...values]);
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
  includes(value) {
    return this.#values.some((state) => state.matchesName(value));
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/unformalized-targets.ts
class UnformalizedTargets {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new UnformalizedTargets(KeySet.of(values));
  }
  add(value) {
    return new UnformalizedTargets(this.#values.with(value));
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
  artifactPath() {
    return this.#path;
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
  equals(other) {
    return this.#model.equals(other.#model);
  }
  modelArtifactPath() {
    return this.#model.artifactPath();
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
  irVersion() {
    return this.#irVersion;
  }
  schemaErrors() {
    return this.#schemaErrors;
  }
  units() {
    return this.#units;
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
  modelId() {
    return this.#model;
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
    return TargetIdentifiers.of([...this.#obligations.toArray().map((o) => o.id().asTargetId()), ...this.#scenarios.toArray().map((s) => s.id().asTargetId())]);
  }
  functionalRequirementReferencesOf(id) {
    return this.#obligations.byId(id)?.functionalRequirementReferences() ?? this.#scenarios.byId(id)?.functionalRequirementReferences() ?? FunctionalRequirementReferences.of([]);
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
class RefinementAttributes {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new RefinementAttributes(values);
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
  id() {
    return this.#id;
  }
  nature() {
    return this.#nature;
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
class RefinementObligations {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new RefinementObligations(values);
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
  toArray() {
    return this.#values;
  }
}
// src/design/domain/refinement-scenario.ts
class RefinementScenario {
  #id;
  #kind;
  #functionalRequirementReferences;
  #bindings;
  #eventTrigger;
  constructor(props) {
    this.#id = props.id;
    this.#kind = props.kind;
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#bindings = props.bindings;
    this.#eventTrigger = props.event?.trigger;
  }
  static of(props) {
    return new RefinementScenario(props);
  }
  id() {
    return this.#id;
  }
  kind() {
    return this.#kind;
  }
  functionalRequirementReferences() {
    return this.#functionalRequirementReferences;
  }
  eventTrigger() {
    return this.#eventTrigger;
  }
  isAccept() {
    return this.#kind === "accept";
  }
  isReject() {
    return this.#kind === "reject";
  }
  hasEvent() {
    return this.#eventTrigger !== undefined;
  }
  bindings() {
    return this.#bindings;
  }
}
// src/design/domain/refinement-scenarios.ts
class RefinementScenarios {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new RefinementScenarios(values);
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
  toArray() {
    return this.#values;
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
  match(handlers) {
    if (this.#kind === "bool")
      return handlers.bool();
    if (this.#kind === "int")
      return handlers.int(this.#min, this.#max);
    return handlers.enum(this.#values);
  }
}
// src/requirements/domain/requirement-attribute-declarations.ts
class RequirementAttributeDeclarations {
  #values;
  #byPath;
  constructor(values) {
    this.#values = Object.freeze([...values]);
    this.#byPath = KeyedIndex.of(values.map((a) => [a.path(), a]));
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
  id() {
    return this.#id;
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
class ObligationIdentifiers {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
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
  isEmpty() {
    return this.#values.length === 0;
  }
  toStrings() {
    return this.#values.map((v) => v.asString());
  }
  toTargetIds() {
    return TargetIdentifiers.of(this.#values.map((v) => v.asTargetId()));
  }
}
// src/requirements/domain/obligations.ts
class Obligations {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
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
// src/requirements/domain/scenario.ts
class Scenario {
  #id;
  #kind;
  #functionalRequirementReferences;
  #bindings;
  #eventTrigger;
  #expect;
  constructor(props) {
    this.#id = props.id;
    this.#kind = props.kind;
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
  id() {
    return this.#id;
  }
  kind() {
    return this.#kind;
  }
  functionalRequirementReferences() {
    return this.#functionalRequirementReferences;
  }
  eventTrigger() {
    return this.#eventTrigger;
  }
  expectation() {
    return this.#expect;
  }
  isAccept() {
    return this.#kind === "accept";
  }
  isReject() {
    return this.#kind === "reject";
  }
  hasEvent() {
    return this.#eventTrigger !== undefined;
  }
  isViolatedBySatisfiability(satisfiable) {
    return this.isAccept() && !satisfiable || this.isReject() && satisfiable;
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
  asString() {
    return this.#value;
  }
  asTargetId() {
    return TargetIdentifier.of(this.#value);
  }
}
// src/requirements/domain/scenarios.ts
class Scenarios {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
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
    const refs = [];
    for (const t of targets) {
      const ob = this.#obligations.byId(t.asString());
      if (ob)
        refs.push(...ob.functionalRequirementReferences());
      const sc = this.#scenarios.byId(t.asString());
      if (sc)
        refs.push(...sc.functionalRequirementReferences());
    }
    return FunctionalRequirementReferences.of(refs).sortedUnique();
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
  assertion() {
    return this.#assert;
  }
}
// src/requirements/domain/background-assumptions.ts
class BackgroundAssumptions {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
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
  isKind(kind) {
    const parsed = FindingKind.parse(kind);
    return parsed.ok && this.#kind.equals(parsed.value);
  }
  implicates(target) {
    return this.#targets.includes(target);
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
// src/requirements/domain/verification-findings.ts
function sortVerificationFindings(findings) {
  return [...findings].sort((a, b) => a.compareTo(b));
}

class VerificationFindings {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
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
  isEmpty() {
    return this.#values.length === 0;
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

class VerificationSkips {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new VerificationSkips(values);
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
  toArray() {
    return this.#values;
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
  static parse(value) {
    return parseConstruction(() => new VerificationWitness(value));
  }
  static of(document) {
    return new VerificationWitness(document);
  }
  toDocument() {
    return structuredClone(this.#document);
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
  static versionMismatch(id, model, irHash, method) {
    return VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method,
      findings: VerificationFindings.of([]),
      skipped: VerificationSkips.of([...model.allTargets()].map((t) => VerificationSkipped.of({
        target: t,
        reason: SkipReason.of("ir-version-mismatch"),
        detail: `IR major version ${model.majorVersion()} is not supported by this backend (supports ${SUPPORTED_IR_MAJOR}.x.x)`
      })))
    });
  }
  static solverUnavailable(id, model, irHash, planSkipped, reason) {
    return VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method: "exhaustive",
      findings: VerificationFindings.of([]),
      skipped: VerificationSkips.of([
        ...planSkipped.toArray(),
        ...[...model.allTargets()].filter((t) => !planSkipped.toArray().some((s) => s.isFor(t))).map((t) => VerificationSkipped.of({ target: t, reason: SkipReason.of("unavailable"), detail: "z3 could not be executed" }))
      ]),
      unavailableReason: reason
    });
  }
  static quintUnavailable(id, model, irHash) {
    return VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method: "simulation",
      findings: VerificationFindings.of([]),
      skipped: VerificationSkips.of([...model.allTargets()].map((t) => VerificationSkipped.of({ target: t, reason: SkipReason.of("unavailable"), detail: "quint CLI missing" }))),
      unavailableReason: "quint CLI is not available (install: npm i -g @informalsystems/quint)"
    });
  }
  static machineUncompilable(id, model, irHash, method, machineError) {
    return VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method,
      findings: VerificationFindings.of([]),
      skipped: VerificationSkips.of([
        ...model.obligations().toArray().map((ob) => VerificationSkipped.of({ target: ob.id().asTargetId(), reason: SkipReason.of("compile-error"), detail: machineError })),
        ...model.scenarios().toArray().map((sc) => VerificationSkipped.of({ target: sc.id().asTargetId(), reason: SkipReason.of("compile-error"), detail: machineError }))
      ])
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
  unavailableReason() {
    return this.#unavailableReason;
  }
  isUnavailable() {
    return this.#unavailableReason !== null;
  }
  passes() {
    return this.#findings.isEmpty();
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
    ordered.findings = this.#findings.toArray().map((f) => {
      const out = {
        kind: f.kind(),
        frRefs: f.functionalRequirementReferences().toStrings(),
        targets: f.targets().toStrings(),
        witness: f.witness().toDocument(),
        detail: f.detail()
      };
      return out;
    });
    ordered.skipped = this.#skipped.toArray().map((sk) => {
      const out = { target: sk.target().asString(), reason: sk.reason() };
      const detail = sk.detail();
      if (detail !== undefined)
        out.detail = detail;
      return out;
    });
    const crossChecked = this.#crossChecked;
    if (crossChecked !== null) {
      ordered.crossChecked = crossChecked.toArray().map((e) => ({ backend: e.backend().asString(), targets: e.targets().toStrings() }));
    }
    return ordered;
  }
  conformedTo(schema) {
    const reason = schema.degradationReasonFor(this.toDocument());
    return reason === null ? this : this.degraded(reason);
  }
}
// src/requirements/domain/cross-checked-entries.ts
class CrossCheckedEntries {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
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
    this.#targets = props.targets;
  }
  static of(props) {
    return new CrossCheckedEntry(props);
  }
  backend() {
    return this.#backend;
  }
  targets() {
    return this.#targets;
  }
  compareByBackend(other) {
    const a = this.#backend.asString();
    const b = other.#backend.asString();
    return a < b ? -1 : a > b ? 1 : 0;
  }
}
// src/requirements/domain/verification-reports.ts
class VerificationReports {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new VerificationReports(values);
  }
  add(value) {
    return new VerificationReports([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
  crossChecked(id, model, irHash) {
    const docs = this.toArray().filter((s) => s.irHash().equals(irHash) && !s.isUnavailable()).map((s) => ({
      backend: s.id().backendName().asString(),
      findings: s.findings().toArray(),
      skippedTargets: new Set(s.skipped().toArray().map((e) => e.target().asString()))
    }));
    const scenarioById = new Map(model.scenarios().toArray().map((s) => [s.id().asString(), s]));
    const findings = [];
    const comparedByBackend = new Map;
    for (let i = 0;i < docs.length; i++) {
      for (let j = i + 1;j < docs.length; j++) {
        const a = docs[i];
        const b = docs[j];
        if (!a || !b)
          continue;
        for (const sc of model.scenarios()) {
          if (a.skippedTargets.has(sc.id().asString()) || b.skippedTargets.has(sc.id().asString()))
            continue;
          const va = a.findings.some((f) => f.isKind("scenario-violation") && f.implicates(sc.id().asTargetId()));
          const vb = b.findings.some((f) => f.isKind("scenario-violation") && f.implicates(sc.id().asTargetId()));
          (comparedByBackend.get(a.backend) ?? comparedByBackend.set(a.backend, new Set).get(a.backend))?.add(sc.id().asString());
          (comparedByBackend.get(b.backend) ?? comparedByBackend.set(b.backend, new Set).get(b.backend))?.add(sc.id().asString());
          if (va !== vb) {
            const verdicts = {};
            verdicts[a.backend] = va ? "violated" : "clean";
            verdicts[b.backend] = vb ? "violated" : "clean";
            findings.push(VerificationFinding.of({
              kind: FindingKind.crossCheckDisagreement(),
              functionalRequirementReferences: FunctionalRequirementReferences.of([...scenarioById.get(sc.id().asString())?.functionalRequirementReferences().toArray() ?? []]).sortedUnique(),
              targets: TargetIdentifiers.of([sc.id().asTargetId()]),
              witness: VerificationWitness.verdicts(verdicts),
              detail: `Backends "${a.backend}" and "${b.backend}" disagree on scenario ${sc.id().asString()}. This signals a defect in the formalization or in a backend compiler, not in the requirements themselves.`
            }));
          }
        }
      }
    }
    const crossChecked = [...comparedByBackend.entries()].map(([backend, targets]) => CrossCheckedEntry.of({ backend: BackendName.of(backend), targets: TargetIdentifiers.of(Array.from([...targets], (raw) => TargetIdentifier.of(raw))).sortedCanonically() })).sort((x, y) => x.compareByBackend(y));
    return VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method: "exhaustive",
      findings: VerificationFindings.of(findings),
      skipped: VerificationSkips.of([]),
      crossChecked: CrossCheckedEntries.of(crossChecked)
    });
  }
}
// src/requirements/domain/verification-directory.ts
var CROSS_CHECK_BACKEND2 = "cross-check";

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
    return new VerificationDirectory(directory, reports, null, crossCheck);
  }
  finalizing(candidate) {
    const fileName = candidate.id().fileName();
    const merged = [];
    let replaced = false;
    for (const sibling of this.#reports.toArray()) {
      if (sibling.id().fileName() === fileName) {
        merged.push(candidate);
        replaced = true;
      } else {
        merged.push(sibling);
      }
    }
    if (!replaced) {
      const at = merged.findIndex((s) => s.id().fileName() > fileName);
      if (at < 0)
        merged.push(candidate);
      else
        merged.splice(at, 0, candidate);
    }
    return new VerificationDirectory(this.#directory, VerificationReports.of(merged), candidate, null);
  }
  finalizedWith(candidate, model, schema) {
    const staged = this.finalizing(candidate.conformedTo(schema));
    if (model === null)
      return staged;
    const derived = staged.#reports.crossChecked(VerificationReportIdentifier.of(this.#directory, CROSS_CHECK_BACKEND2), model, candidate.irHash());
    return new VerificationDirectory(this.#directory, staged.#reports, staged.#candidate, derived.conformedTo(schema));
  }
  crossChecked(model, irHash) {
    const derived = this.#reports.crossChecked(VerificationReportIdentifier.of(this.#directory, CROSS_CHECK_BACKEND2), model, irHash);
    return new VerificationDirectory(this.#directory, this.#reports, this.#candidate, derived);
  }
  withoutCrossCheck() {
    return new VerificationDirectory(this.#directory, this.#reports, this.#candidate, null);
  }
  conformedTo(schema) {
    const candidate = this.#candidate;
    const crossCheck = this.#crossCheck;
    const conformedCandidate = candidate === null ? null : candidate.conformedTo(schema);
    const conformedCrossCheck = conformedCandidate !== candidate || crossCheck === null ? null : crossCheck.conformedTo(schema);
    const reports = conformedCandidate === null ? this.#reports : VerificationReports.of(this.#reports.toArray().map((r) => r.id().fileName() === conformedCandidate.id().fileName() ? conformedCandidate : r));
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
  crossCheck() {
    return this.#crossCheck;
  }
}
// src/requirements/domain/satisfiability-modulo-theories-query-verdict.ts
class SatisfiabilityModuloTheoriesQueryVerdict {
  #status;
  #decodedModel;
  #core;
  constructor(props) {
    this.#status = props.status;
    this.#decodedModel = props.decodedModel === undefined ? undefined : { ...props.decodedModel };
    this.#core = props.core === undefined ? undefined : props.core.map((label) => QueryLabel.of(label));
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
    return VerificationSkips.of([...targets].map((target) => VerificationSkipped.of({ target, reason, detail })));
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
}
// src/requirements/domain/satisfiability-modulo-theories-query-verdicts.ts
class SatisfiabilityModuloTheoriesQueryVerdicts {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new SatisfiabilityModuloTheoriesQueryVerdicts(values);
  }
  verdictOf(queryId) {
    return this.#values.get(queryId) ?? SatisfiabilityModuloTheoriesQueryVerdict.missing();
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
    const findings = [];
    const skipped = [...this.#skipped.toArray()];
    const conflictKeys = new Set;
    const invariantIds = TargetIdentifiers.of(model.obligations().toArray().filter((o) => o.isInvariantLike() && this.#compiled.has(o.id())).map((o) => o.id().asTargetId()));
    const coreToTargets = (core) => {
      const targets = core.map((label) => this.#labelToTarget.get(label)).filter((t) => t !== undefined && t.asString().startsWith("OB-"));
      return TargetIdentifiers.of(targets).sortedUniqueCanonically();
    };
    const addConflict = (targets, core, detail) => {
      const effective = targets.count() > 0 ? targets : invariantIds;
      if (effective.count() === 0)
        return;
      const key = effective.joined(",");
      if (conflictKeys.has(key))
        return;
      conflictKeys.add(key);
      findings.push(VerificationFinding.of({
        kind: FindingKind.conflict(),
        functionalRequirementReferences: model.functionalRequirementReferencesOf(effective),
        targets: effective,
        witness: VerificationWitness.core(core.map((label) => label.asString()).sort()),
        detail
      }));
    };
    const global = results.verdictOf(QueryLabel.of("global"));
    let globallyUnsat = false;
    if (global.isUnsat()) {
      globallyUnsat = true;
      addConflict(coreToTargets([...global.coreLabels()]), [...global.coreLabels()], "These obligations (with the background and type bounds in the witness core) are jointly unsatisfiable: no state can satisfy all of them.");
    } else if (global.isUndecided()) {
      skipped.push(...global.skipsFor(invariantIds, "global consistency check"));
    }
    if (!globallyUnsat) {
      for (const [obligationId, queryId] of this.#vacuityQueries) {
        const r = results.verdictOf(queryId);
        if (r.isUnsat()) {
          const targets = TargetIdentifiers.of([...coreToTargets([...r.coreLabels()]), obligationId.asTargetId()]).sortedUniqueCanonically();
          addConflict(targets, [...r.coreLabels()], `The condition of obligation ${obligationId.asString()} can never hold: the obligations in the witness core annihilate it. Rules that conflict on a shared condition, or a dead requirement branch.`);
        } else if (r.isUndecided()) {
          skipped.push(...r.skipsFor(TargetIdentifiers.of([obligationId.asTargetId()]), `vacuity check for ${obligationId.asString()}`));
        }
      }
    }
    for (const pair of this.#eventPairs) {
      const overlap = pair.overlapVerdictIn(results);
      const joint = pair.jointVerdictIn(results);
      if (overlap.isSat() && joint.isUnsat()) {
        addConflict(pair.targets().sortedUniqueCanonically(), [...joint.coreLabels()], `Events ${pair.a().asString()} and ${pair.b().asString()} for trigger "${pair.trigger().asString()}" have overlapping guards but contradictory effects: some state matches both rules, and no post-state satisfies both.`);
      } else if (overlap.isUndecided() || joint.isUndecided()) {
        const pending = [overlap, joint].find((v) => v.isMissing()) ?? (overlap.isUndecided() ? overlap : joint);
        skipped.push(...pending.skipsFor(pair.targets(), `event-pair check for trigger "${pair.trigger().asString()}"`));
      }
    }
    for (const [triggerName, eventIds] of [...this.#gapTriggers].sort((a, b) => a[0].asString() < b[0].asString() ? -1 : a[0].asString() > b[0].asString() ? 1 : 0)) {
      const trigger = triggerName.asString();
      const r = results.verdictOf(QueryLabel.of(`gap:${trigger}`));
      if (r.isSat()) {
        findings.push(VerificationFinding.of({
          kind: FindingKind.completenessGap(),
          functionalRequirementReferences: model.functionalRequirementReferencesOf(eventIds),
          targets: eventIds,
          witness: VerificationWitness.model(r.witnessModel()),
          detail: `No rule for trigger "${trigger}" applies to the witness state: the behavior of this input region is unspecified.`
        }));
      } else if (r.isUndecided()) {
        skipped.push(...r.skipsFor(eventIds, `completeness check for trigger "${trigger}"`));
      }
    }
    for (const sc of model.scenarios()) {
      const qid = this.#scenarioQueries.get(sc.id());
      if (!qid)
        continue;
      const r = results.verdictOf(qid);
      if (r.isUndecided()) {
        skipped.push(...r.skipsFor(TargetIdentifiers.of([sc.id().asTargetId()]), `scenario check for ${sc.id().asString()}`));
        continue;
      }
      if (sc.isAccept() && r.isUnsat()) {
        const targets = TargetIdentifiers.of([sc.id().asTargetId(), ...coreToTargets([...r.coreLabels()])]).sortedUniqueCanonically();
        findings.push(VerificationFinding.of({
          kind: FindingKind.scenarioViolation(),
          functionalRequirementReferences: model.functionalRequirementReferencesOf(targets),
          targets,
          witness: VerificationWitness.core(r.sortedCore()),
          detail: `Accept scenario ${sc.id().asString()} describes a state the obligations in the witness core rule out \u2014 the requirements reject an example that should be accepted.`
        }));
      }
      if (sc.isReject() && r.isSat()) {
        findings.push(VerificationFinding.of({
          kind: FindingKind.scenarioViolation(),
          functionalRequirementReferences: model.functionalRequirementReferencesOf(TargetIdentifiers.of([sc.id().asTargetId()])),
          targets: TargetIdentifiers.of([sc.id().asTargetId()]),
          witness: VerificationWitness.model(r.witnessModel()),
          detail: `Reject scenario ${sc.id().asString()} is still satisfiable \u2014 the requirements do not exclude an example that should be rejected (witness state attached).`
        }));
      }
    }
    return { findings: VerificationFindings.of(findings), skipped: VerificationSkips.of(skipped) };
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
  a() {
    return this.#a;
  }
  b() {
    return this.#b;
  }
  trigger() {
    return this.#trigger;
  }
  targets() {
    return TargetIdentifiers.of([this.#a.asTargetId(), this.#b.asTargetId()]);
  }
  overlapVerdictIn(results) {
    return results.verdictOf(this.#qOverlap);
  }
  jointVerdictIn(results) {
    return results.verdictOf(this.#qJoint);
  }
}
// src/requirements/domain/satisfiability-modulo-theories-event-pair-probes.ts
class SatisfiabilityModuloTheoriesEventPairProbes {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
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
  toArray() {
    return this.#values;
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
  toDocument() {
    return structuredClone(this.#value);
  }
}

// src/requirements/domain/trace-state.ts
class TraceState {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static empty() {
    return new TraceState(KeyedIndex.empty());
  }
  static of(entries) {
    return new TraceState(KeyedIndex.of(entries));
  }
  valueAt(path) {
    return this.#values.get(path) ?? TraceValue.absent();
  }
  toDocument() {
    const out = {};
    for (const [path, value] of this.#values)
      out[path.asString()] = value.toDocument();
    return out;
  }
}
// src/requirements/domain/trace-states.ts
class TraceStates {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
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
  finalState() {
    return this.#values[this.#values.length - 1] ?? TraceState.empty();
  }
  toArray() {
    return [...this.#values];
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
    return TargetIdentifiers.of([...this.#invariantComponents.ids().toTargetIds(), ...this.#eventIds.toTargetIds()]).sortedUniqueCanonically();
  }
  #hasInitFor(id) {
    return this.#scenariosWithInit.has(id);
  }
  interpret(model, compileSkips, method, runs) {
    const bounded = method === "bounded";
    const findings = [];
    const skipped = [...compileSkips.toArray()];
    const machineTargets = this.machineTargets();
    const eventTargets = this.#eventIds.toTargetIds();
    const machineRun = runs.machineRun();
    if (machineRun === null) {
      for (const target of machineTargets) {
        skipped.push(VerificationSkipped.of({
          target,
          reason: SkipReason.of("unavailable"),
          detail: "quint returned no machine run: the event machine was not decided"
        }));
      }
    }
    if (machineRun !== null) {
      skipped.push(...machineRun.skipsFor(machineTargets, bounded));
      if (machineRun.isDeadlock()) {
        findings.push(VerificationFinding.of({
          kind: FindingKind.completenessGap(),
          functionalRequirementReferences: model.functionalRequirementReferencesOf(eventTargets),
          targets: this.#eventIds.isEmpty() ? machineTargets : eventTargets.sortedCanonically(),
          witness: machineRun.witness(),
          detail: "The event machine reaches a legal state where no event rule applies (deadlock): the behavior of that state is unspecified."
        }));
      } else if (machineRun.isViolation()) {
        const violatedComponents = this.#invariantComponents.violatedBy(machineRun.finalState());
        const targets = violatedComponents.isEmpty() ? eventTargets.sortedCanonically() : violatedComponents.ids().toTargetIds().sortedUniqueCanonically();
        findings.push(VerificationFinding.of({
          kind: FindingKind.conflict(),
          functionalRequirementReferences: model.functionalRequirementReferencesOf(TargetIdentifiers.of([...targets, ...eventTargets]).sortedUniqueCanonically()),
          targets,
          witness: machineRun.witness(),
          detail: `The event machine can reach a state that violates ${targets.joined(", ")} (step trace attached): the event rules do not preserve the obligation.`
        }));
      }
    }
    for (const ob of model.obligations()) {
      if (!ob.isStateTemporal() || ob.temporal()?.pattern !== "leads-to")
        continue;
      const target = ob.id().asTargetId();
      if (skipped.some((s) => s.isFor(target)))
        continue;
      if (!bounded) {
        skipped.push(VerificationSkipped.of({
          target,
          reason: SkipReason.of("capability"),
          detail: "leads-to temporal properties require bounded mode (quint verify with Apalache); simulation cannot decide them"
        }));
        continue;
      }
      const r = runs.temporalOf(ob.id());
      if (!r) {
        skipped.push(VerificationSkipped.of({
          target,
          reason: SkipReason.of("unavailable"),
          detail: "quint returned no run for this temporal obligation"
        }));
        continue;
      }
      const skip = r.skipFor(target);
      if (skip !== null) {
        skipped.push(skip);
      } else if (r.isViolation()) {
        findings.push(VerificationFinding.of({
          kind: FindingKind.conflict(),
          functionalRequirementReferences: model.functionalRequirementReferencesOf(TargetIdentifiers.of([target])),
          targets: TargetIdentifiers.of([target]),
          witness: r.witness(),
          detail: `Temporal obligation ${ob.id().asString()} (leads-to) is violated: the attached trace reaches the "from" condition but never the "to" condition.`
        }));
      }
    }
    for (const sc of model.scenarios()) {
      const target = sc.id().asTargetId();
      if (sc.hasEvent()) {
        skipped.push(VerificationSkipped.of({ target, reason: SkipReason.of("capability"), detail: "scenarios with a When-event are not checked by the quint backend in v1" }));
        continue;
      }
      if (!this.#hasInitFor(sc.id())) {
        skipped.push(VerificationSkipped.of({
          target,
          reason: SkipReason.of("capability"),
          detail: "quint scenario evaluation requires bindings for every declared attribute"
        }));
        continue;
      }
      const r = runs.scenarioOf(sc.id());
      if (!r) {
        skipped.push(VerificationSkipped.of({
          target,
          reason: SkipReason.of("unavailable"),
          detail: "quint returned no run for this scenario"
        }));
        continue;
      }
      const skip = r.skipFor(target);
      if (skip !== null) {
        skipped.push(skip);
        continue;
      }
      const bindings = sc.bindings().entriesCanonically();
      const state = TraceState.of(bindings.map((binding) => [binding.path(), TraceValue.of(binding.value().toDocument())]));
      const boundModel = sc.bindings().toDocument();
      if (sc.isAccept() && r.isViolated()) {
        const violatedComponents = this.#invariantComponents.violatedBy(state);
        const targets = TargetIdentifiers.of([target, ...violatedComponents.ids().toTargetIds()]).sortedUniqueCanonically();
        findings.push(VerificationFinding.of({
          kind: FindingKind.scenarioViolation(),
          functionalRequirementReferences: model.functionalRequirementReferencesOf(targets),
          targets,
          witness: VerificationWitness.model(boundModel),
          detail: `Accept scenario ${sc.id().asString()} describes a state the obligations rule out \u2014 the requirements reject an example that should be accepted.`
        }));
      }
      if (sc.isReject() && !r.isViolated()) {
        findings.push(VerificationFinding.of({
          kind: FindingKind.scenarioViolation(),
          functionalRequirementReferences: model.functionalRequirementReferencesOf(TargetIdentifiers.of([target])),
          targets: TargetIdentifiers.of([target]),
          witness: VerificationWitness.model(boundModel),
          detail: `Reject scenario ${sc.id().asString()} is accepted by every obligation \u2014 the requirements do not exclude an example that should be rejected.`
        }));
      }
    }
    return { findings: VerificationFindings.of(findings), skipped: VerificationSkips.of(skipped) };
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
  isViolatedIn(state) {
    return !evaluate(this.#expression, state).isTrue();
  }
}
// src/requirements/domain/quint-machine-components.ts
class QuintMachineComponents {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
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
  isEmpty() {
    return this.#values.length === 0;
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
    if (kind === "timeout") {
      return [...targets].map((target) => VerificationSkipped.of({ target, reason: SkipReason.of("timeout"), detail: "machine invariant check exceeded its budget" }));
    }
    if (kind === "run-failed") {
      const outputTail = this.#outputTail;
      return [...targets].map((target) => VerificationSkipped.of({
        target,
        reason: SkipReason.of("unavailable"),
        detail: `quint ${bounded ? "verify" : "run"} failed unexpectedly: ${outputTail}`
      }));
    }
    return [];
  }
  isDeadlock() {
    return this.#kind === "deadlock";
  }
  isViolation() {
    return this.#kind === "violation";
  }
  witness() {
    const trace = this.#trace;
    return trace !== null ? VerificationWitness.trace(trace.toArray()) : VerificationWitness.model({});
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
    this.#machine = seed.machine;
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
      return VerificationSkipped.of({ target, reason: SkipReason.of("timeout"), detail: "scenario evaluation exceeded its budget" });
    if (kind === "run-failed")
      return VerificationSkipped.of({ target, reason: SkipReason.of("unavailable"), detail: `quint run failed unexpectedly: ${this.#outputTail}` });
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
      return VerificationSkipped.of({ target, reason: SkipReason.of("timeout"), detail: "temporal check exceeded its budget" });
    if (kind === "run-failed")
      return VerificationSkipped.of({ target, reason: SkipReason.of("unavailable"), detail: `quint verify failed unexpectedly: ${this.#outputTail}` });
    return null;
  }
  isViolation() {
    return this.#kind === "violation";
  }
  witness() {
    const trace = this.#trace;
    return trace !== null ? VerificationWitness.trace(trace.toArray()) : VerificationWitness.model({});
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
  wellFormednessErrors() {
    const errors = [];
    const attrTypes = new Map;
    const entityNames = new Set;
    for (const ent of this.#entities) {
      const entName = ent.name().asString();
      if (entityNames.has(entName))
        errors.push(`schema: duplicate entity "${entName}"`);
      entityNames.add(entName);
      ent.inspectAttributes((coord, attr, duplicated) => {
        if (duplicated) {
          errors.push(`schema: duplicate attribute "${coord}"`);
        }
        if (attr.boundsInverted()) {
          errors.push(`schema: ${coord}: min > max`);
        }
        if (attr.boundsOutsideSafeRange()) {
          errors.push(`schema: ${coord}: bounds must be safe integers`);
        }
        attrTypes.set(coord, attr);
      });
    }
    const encoded = new Map;
    for (const path of attrTypes.keys()) {
      const key = path.replace(/\./g, "_");
      const prior = encoded.get(key);
      if (prior !== undefined) {
        errors.push(`schema: attribute paths "${prior}" and "${path}" collide under the solver variable encoding (dots become underscores)`);
      } else {
        encoded.set(key, path);
      }
    }
    const checkExpr = (e, where, primesAllowed) => {
      ExpressionTree.of(e).walk((node) => {
        if (node.op === "ref" && typeof node.path === "string") {
          if (!attrTypes.has(node.path)) {
            errors.push(`${where}: unresolvable reference "${node.path}"`);
          }
          if (node.prime === true && !primesAllowed) {
            errors.push(`${where}: primed reference "${node.path}" is only legal in event effects and event-scenario expectations`);
          }
        }
        if (node.op === "enum" && typeof node.value === "string") {
          const known = [...attrTypes.values()].some((t) => t.admitsEnumLiteral(node.value));
          if (!known) {
            errors.push(`${where}: enum literal "${node.value}" is not a value of any declared enum attribute`);
          }
        }
      });
    };
    const seenIds = new Set;
    const dupCheck = (id, where) => {
      if (seenIds.has(id))
        errors.push(`${where}: duplicate id "${id}"`);
      seenIds.add(id);
    };
    for (const ob of this.#obligations) {
      const where = `obligation ${ob.id().asString()}`;
      dupCheck(ob.id().asString(), where);
      ob.inspectExpressions((expression, primesAllowed) => checkExpr(expression, where, primesAllowed));
    }
    for (const sc of this.#scenarios) {
      const where = `scenario ${sc.id().asString()}`;
      dupCheck(sc.id().asString(), where);
      for (const binding of sc.bindings()) {
        const path = binding.path();
        const val = binding.value();
        const t = attrTypes.get(path.asString());
        if (!t) {
          errors.push(`${where}: binding for unknown attribute "${path.asString()}"`);
          continue;
        }
        if (!t.fitsBinding(val)) {
          errors.push(`${where}: binding value ${val.describe()} does not fit ${t.kindLabel()} attribute "${path.asString()}"`);
        }
      }
      sc.inspectExpectation((expression, primesAllowed) => checkExpr(expression, where, primesAllowed));
    }
    for (const bg of this.#background) {
      const where = `background ${bg.id().asString()}`;
      dupCheck(bg.id().asString(), where);
      bg.inspectExpressions((expression, primesAllowed) => checkExpr(expression, where, primesAllowed));
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
}
// src/requirements/domain/intermediate-representation-attribute-declarations.ts
class IntermediateRepresentationAttributeDeclarations {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
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
  id() {
    return this.#id;
  }
  assertion() {
    return this.#assert;
  }
  inspectExpressions(visitor) {
    if (this.#assert !== undefined)
      visitor(this.#assert, false);
  }
}
// src/requirements/domain/intermediate-representation-background-declarations.ts
class IntermediateRepresentationBackgroundDeclarations {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
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
  attributes() {
    return this.#attributes;
  }
  inspectAttributes(visitor) {
    const seen = new Set;
    for (const attribute of this.#attributes) {
      const attributeName = attribute.name().asString();
      visitor(`${this.#name.asString()}.${attributeName}`, attribute, seen.has(attributeName));
      seen.add(attributeName);
    }
  }
}
// src/requirements/domain/intermediate-representation-entity-declarations.ts
class IntermediateRepresentationEntityDeclarations {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
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
  asString() {
    return this.#value;
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
  id() {
    return this.#id;
  }
  inspectExpressions(visitor) {
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
class IntermediateRepresentationObligationDeclarations {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
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
  id() {
    return this.#id;
  }
  bindings() {
    return this.#bindings;
  }
  inspectExpectation(visitor) {
    if (this.#expect !== undefined)
      visitor(this.#expect, this.#hasEvent);
  }
}
// src/requirements/domain/intermediate-representation-scenario-declarations.ts
class IntermediateRepresentationScenarioDeclarations {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new IntermediateRepresentationScenarioDeclarations(values);
  }
  add(value) {
    return new IntermediateRepresentationScenarioDeclarations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
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
  inspectExpressions(visitor) {
    if (this.#assert !== undefined)
      visitor(this.#assert, false);
    if (this.#from !== undefined)
      visitor(this.#from, false);
    if (this.#to !== undefined)
      visitor(this.#to, false);
  }
}
// src/requirements/domain/functional-requirement-reference-claims.ts
class FunctionalRequirementReferenceClaims {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new FunctionalRequirementReferenceClaims(values);
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
class FunctionalRequirementReferenceIndex {
  #ownersByRef;
  constructor(ownersByRef) {
    this.#ownersByRef = ownersByRef;
  }
  static of(claims) {
    const ownersByRef = new Map;
    for (const claim of claims)
      claim.claimInto(ownersByRef);
    return new FunctionalRequirementReferenceIndex(KeyedIndex.of([...ownersByRef].map(([ref, owners]) => [RequirementIdentifier.of(ref), FunctionalRequirementReferenceClaims.of(owners)])));
  }
  referencedIds() {
    return [...this.#ownersByRef.keys()].map((ref) => ref.asString());
  }
  missingErrors(known) {
    const missing = [...this.#ownersByRef.keys()].filter((ref) => !known.has(ref)).map((ref) => ref.asString()).sort();
    return missing.map((id) => {
      const owners = [...this.#ownersByRef.get(RequirementIdentifier.of(id))?.ownerDescriptions() ?? []].sort().join(", ");
      return `frRef "${id}" (used by ${owners}) does not exist in requirements.md`;
    });
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
  claimInto(ownersByRef) {
    for (const ref of this.#functionalRequirementReferences) {
      const owners = ownersByRef.get(ref.asString()) ?? [];
      owners.push(this);
      ownersByRef.set(ref.asString(), owners);
    }
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
  recordRoot() {
    return this.#recordRoot;
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
  artifactPath() {
    return this.#path;
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
  id() {
    return this.#id;
  }
  irVersion() {
    return this.#irVersion;
  }
  schemaErrors() {
    return this.#schemaErrors;
  }
  view() {
    return this.#view;
  }
  functionalRequirementReferenceIndex() {
    return FunctionalRequirementReferenceIndex.of(this.#functionalRequirementReferenceClaims.toArray());
  }
  declaredDigest() {
    return this.#declaredDigest;
  }
  sourceId() {
    return this.#sourceId;
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
  modelId() {
    return this.#model;
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
// src/design/domain/refinement-map-defect.ts
class RefinementMapDefect {
  #kind;
  #reqPath;
  constructor(kind, reqPath) {
    this.#kind = kind;
    this.#reqPath = reqPath;
  }
  static uncoveredAttribute(reqPath) {
    return new RefinementMapDefect("uncovered-attribute", AttributePath.of(reqPath));
  }
  static enumMappingOutsideEquality(reqPath) {
    return new RefinementMapDefect("enum-mapping-outside-equality", AttributePath.of(reqPath));
  }
  static unspecifiedMapping(reqPath) {
    return new RefinementMapDefect("unspecified-mapping", AttributePath.of(reqPath));
  }
  static effectNotAssignmentConjunction() {
    return new RefinementMapDefect("effect-not-assignment-conjunction", null);
  }
  message() {
    const path = this.#reqPath?.asString() ?? "";
    switch (this.#kind) {
      case "uncovered-attribute":
        return `requirements attribute "${path}" is not covered by the attrMap`;
      case "enum-mapping-outside-equality":
        return `enum-mapped requirements attribute "${path}" is only legal inside eq/ne against an enum literal`;
      case "unspecified-mapping":
        return `attrMap entry for "${path}" declares neither an expression nor enum cases`;
      default:
        return "requirements effect is not a conjunction of primed assignments";
    }
  }
  asCompileErrorSkip(target, unit) {
    return DesignSkipped.of({ target, reason: SkipReason.compileError(), unit: UnitName.of(unit), detail: `alpha substitution failed: ${this.message()}` });
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
    this.#variant = variant.kind === "expression" ? { kind: "expression", expr: ExpressionTree.of(variant.expr).asExpression() } : variant.kind === "enum-cases" ? { kind: "enum-cases", from: variant.from, cases: boundedValueSnapshot(variant.cases, { string: 4096, nodes: 10001, depth: 1, total: 16777216 }) } : { kind: "unspecified" };
  }
  static of(req, value) {
    return new AttributeMapping(req, value);
  }
  static parse(req, value) {
    return parseConstruction(() => new AttributeMapping(req, value));
  }
  isFor(reqPath) {
    return this.#req.asString() === reqPath;
  }
  req() {
    return this.#req;
  }
  isEnumCases() {
    return this.#variant.kind === "enum-cases";
  }
  isExpression() {
    return this.#variant.kind === "expression";
  }
  enumFrom() {
    return this.#variant.kind === "enum-cases" ? this.#variant.from.asString() : undefined;
  }
  expandComparison(op, reqValue, primed) {
    const variant = this.#variant;
    if (variant.kind !== "enum-cases")
      return null;
    const from = { op: "ref", path: variant.from.asString(), ...primed ? { prime: true } : {} };
    const matching = Object.entries(variant.cases).filter(([, rv]) => rv === reqValue).map(([designValue]) => designValue).sort();
    const disjunction = matching.length === 0 ? { op: "bool", value: false } : matching.length === 1 ? { op: "eq", args: [from, { op: "enum", value: matching[0] }] } : { op: "or", args: matching.map((d) => ({ op: "eq", args: [from, { op: "enum", value: d }] })) };
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
      const values = EnumerationMembers.of(Object.values(variant.cases).map((value) => EnumerationMember.of(value))).sortedUniqueCanonically().toArray();
      const classes = values.map((reqValue) => {
        const members = Object.entries(variant.cases).filter(([, rv]) => reqValue.matchesLiteral(rv)).map(([d]) => d).sort();
        const inClass = (primed) => {
          const refNode = { op: "ref", path: variant.from.asString(), ...primed ? { prime: true } : {} };
          const eqs = members.map((d) => ({ op: "eq", args: [refNode, { op: "enum", value: d }] }));
          return eqs.length === 1 ? eqs[0] : { op: "or", args: eqs };
        };
        return { op: "iff", args: [inClass(false), inClass(true)] };
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
    return EnumerationMembers.of(Object.values(variant.cases).filter((rv) => !(reqValues?.includes(rv) ?? false)).map((value) => EnumerationMember.of(value))).sortedUniqueCanonically().toArray().map((member) => member.asString());
  }
  referencedPaths() {
    const variant = this.#variant;
    if (variant.kind !== "expression")
      return [];
    return ExpressionTree.of(variant.expr).referencedPaths();
  }
}
// src/design/domain/attribute-mappings.ts
class AttributeMappings {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new AttributeMappings(values);
  }
  add(value) {
    return new AttributeMappings([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  byRequirementPath(reqPath) {
    let found;
    for (const m of this.#values) {
      if (m.isFor(reqPath))
        found = m;
    }
    return found;
  }
  covers(reqPath) {
    return this.byRequirementPath(reqPath) !== undefined;
  }
  substitute(e, post) {
    if (e.op === "eq" || e.op === "ne") {
      const [a, b] = e.args ?? [];
      const refArg = a?.op === "ref" ? a : b?.op === "ref" ? b : null;
      const enumArg = a?.op === "enum" ? a : b?.op === "enum" ? b : null;
      if (refArg && enumArg && typeof refArg.path === "string" && typeof enumArg.value === "string") {
        const expanded = this.byRequirementPath(refArg.path)?.expandComparison(e.op, enumArg.value, post || refArg.prime === true);
        if (expanded !== null && expanded !== undefined)
          return ok(expanded);
      }
    }
    if (e.op === "ref" && typeof e.path === "string") {
      const mapping = this.byRequirementPath(e.path);
      if (!mapping)
        return err(RefinementMapDefect.uncoveredAttribute(e.path));
      return mapping.substituteForReference(e.path, post || e.prime === true);
    }
    if (e.args) {
      const args = [];
      for (const a of e.args) {
        const sub = this.substitute(a, post);
        if (!sub.ok)
          return sub;
        args.push(sub.value);
      }
      return ok({ ...e, args });
    }
    return ok(e);
  }
  equalityFor(reqPath) {
    return this.byRequirementPath(reqPath)?.abstractFrameEquality() ?? null;
  }
  toArray() {
    return this.#values;
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
    return new EventMapping({ reqTrigger: props.reqTrigger, transitions: props.transitions, reason: props.waived?.reason ?? null });
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
class EventMappings {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new EventMappings(values);
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
  unit() {
    return this.#unit;
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
class RefinementUnitMaps {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new RefinementUnitMaps(values);
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
  compareTo(other) {
    return compareCanonically(this.#value, other.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/design/domain/transition-references.ts
class TransitionReferences {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new TransitionReferences(values);
  }
  add(value) {
    return new TransitionReferences([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  isEmpty() {
    return this.#values.length === 0;
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
// src/design/domain/unmapped-declarations.ts
function tokenOf(carrier) {
  return typeof carrier === "string" ? carrier : carrier.asString();
}

class UnmappedDeclarations {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new UnmappedDeclarations(values);
  }
  add(value) {
    return new UnmappedDeclarations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  covers(target) {
    const t = tokenOf(target);
    return this.#values.some((x) => x.isFor(t));
  }
  coversAll(targets) {
    return targets.every((t) => this.covers(t));
  }
  reasonOf(target) {
    const t = tokenOf(target);
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
  asString() {
    return this.#value;
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
  isFor(token) {
    return this.#target.asString() === token;
  }
  reason() {
    return this.#reason;
  }
}
// src/design/domain/refinement-quint-invariants.ts
class RefinementQuintInvariants {
  #values;
  constructor(values) {
    this.#values = Object.freeze([...values]);
  }
  static of(values) {
    return new RefinementQuintInvariants(values);
  }
  add(value) {
    return new RefinementQuintInvariants([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  isEmpty() {
    return this.#values.length === 0;
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
  reqId() {
    return this.#reqId;
  }
  reqTarget() {
    return this.#reqId.asTargetId();
  }
  loweredAs(id) {
    return LoweredObligation.of({ id, nature: "invariant", functionalRequirementReferences: this.#functionalRequirementReferences, assert: this.#expr });
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
  skipFor(target, unit) {
    if (this.#kind === "waived")
      return DesignSkipped.of({ target, reason: SkipReason.waived(), unit: UnitName.of(unit), detail: this.#text });
    if (this.#kind === "capability")
      return DesignSkipped.of({ target, reason: SkipReason.capability(), unit: UnitName.of(unit), detail: this.#text });
    return null;
  }
}

// src/design/domain/unit-refinement-plan.ts
function exprRefs(e, out) {
  if (e.op === "ref" && typeof e.path === "string")
    out.add(e.path);
  for (const a of e.args ?? [])
    exprRefs(a, out);
}

class UnitRefinementPlan {
  #mappings;
  #obligationStatus;
  #scenarioStatus;
  #eventTransitions;
  #gaps;
  constructor(props) {
    this.#mappings = props.mappings;
    this.#obligationStatus = props.obligationStatus;
    this.#scenarioStatus = props.scenarioStatus;
    this.#eventTransitions = props.eventTransitions;
    this.#gaps = props.gaps;
  }
  static of(u, unitMap, req, mapArtifact) {
    const gaps = [];
    const gap = (targets, detail, functionalRequirementReferences = FunctionalRequirementReferences.of([])) => {
      gaps.push(DesignFinding.of({
        kind: FindingKind.mappingGap(),
        functionalRequirementReferences: functionalRequirementReferences.sortedUnique(),
        targets: TargetIdentifiers.of(Array.from(targets, (raw) => TargetIdentifier.of(raw))).sortedUniqueCanonically(),
        witness: DesignWitness.refs([{ artifact: mapArtifact.asString(), element: `units[${unitMap.unit().asString()}]` }]),
        unit: UnitName.of(u.name()),
        detail
      }));
    };
    const byReq = new Map;
    const unmapped = unitMap.unmapped();
    for (const m of unitMap.attrMap()) {
      const reqPath = m.req().asString();
      const gapTarget = [`attr:${reqPath.replace(/[^A-Za-z0-9_./-]/g, "-")}`];
      if (byReq.has(reqPath))
        gap(gapTarget, `attrMap maps "${reqPath}" more than once`);
      byReq.set(reqPath, m);
      const reqAttr = req.attributes().byPath(AttributePath.of(reqPath));
      if (!reqAttr) {
        gap(gapTarget, `attrMap entry "${reqPath}" names no attribute of the requirements IR`);
        continue;
      }
      if (m.isEnumCases()) {
        const from = m.enumFrom() ?? "";
        if (!reqAttr.isEnum()) {
          gap(gapTarget, `attrMap entry "${reqPath}" uses enumMap but the requirements attribute is ${reqAttr.kind()}`);
        }
        if (!u.attrPaths().has(AttributePath.of(from))) {
          gap(gapTarget, `enumMap.from "${from}" is not a design attribute of unit ${u.name()}`);
          continue;
        }
        const fromValues = u.declaredEnumValuesOf(from);
        if (fromValues === null) {
          gap(gapTarget, `enumMap.from "${from}" is not an enum design attribute`);
          continue;
        }
        const missing = m.missingCasesOver(fromValues);
        if (missing.length > 0) {
          gap(gapTarget, `enumMap for "${reqPath}" is not total over "${from}": missing case(s) ${missing.join(", ")}`);
        }
        const badResults = m.producedValuesOutside(reqAttr.declaredValues());
        if (badResults.length > 0) {
          gap(gapTarget, `enumMap for "${reqPath}" produces value(s) ${badResults.join(", ")} outside the requirements attribute's values`);
        }
      } else if (m.isExpression()) {
        for (const r of m.referencedPaths()) {
          if (!u.attrPaths().has(AttributePath.of(r))) {
            gap(gapTarget, `attrMap expression for "${reqPath}" references "${r}", which is not a design attribute of unit ${u.name()}`);
          }
        }
      }
    }
    for (const a of req.attributes().sortedByPath()) {
      if (!byReq.has(a.path().asString()) && !unmapped.covers(a.path())) {
        gap([`attr:${a.path().asString().replace(/[^A-Za-z0-9_./-]/g, "-")}`], `requirements attribute "${a.path().asString()}" is neither mapped by attrMap nor listed in unmapped[] \u2014 silence is a contract violation`);
      }
    }
    const designIds = new Set([...u.obligations().ids(), ...u.machines().transitionIds()]);
    const attrsCovered = (e) => {
      if (!e)
        return { ok: true, missing: [] };
      const refs = new Set;
      exprRefs(e, refs);
      const missing = [...refs].filter((r) => !byReq.has(r)).sort();
      return { ok: missing.length === 0, missing };
    };
    const obligationStatus = new Map;
    const eventTransitions = new Map;
    for (const ob of req.obligations()) {
      if (unmapped.covers(ob.id())) {
        obligationStatus.set(ob.id().asString(), RefinementStatus.waived(unmapped.reasonOf(ob.id()) ?? "listed in unmapped[]"));
        continue;
      }
      if (ob.isStateTemporal()) {
        obligationStatus.set(ob.id().asString(), RefinementStatus.capability("temporal refinement is outside v1 scope"));
        continue;
      }
      if (ob.isInvariantLike()) {
        const cov = attrsCovered(ob.assertion());
        if (cov.ok)
          obligationStatus.set(ob.id().asString(), RefinementStatus.checkable());
        else if (unmapped.coversAll(cov.missing)) {
          obligationStatus.set(ob.id().asString(), RefinementStatus.waived(`depends on unmapped attribute(s) ${cov.missing.join(", ")}`));
        } else {
          obligationStatus.set(ob.id().asString(), RefinementStatus.gap(`depends on attribute(s) ${cov.missing.join(", ")} that are neither mapped nor in unmapped[]`));
        }
        continue;
      }
      if (ob.isEvent()) {
        const trigger = ob.trigger();
        const entry = trigger === undefined ? undefined : unitMap.eventMappingOf(trigger);
        const waiver = entry?.waiverReason() ?? null;
        if (waiver !== null) {
          obligationStatus.set(ob.id().asString(), RefinementStatus.waived(waiver));
          continue;
        }
        const covG = attrsCovered(ob.guard());
        const covE = attrsCovered(ob.effect());
        const missing = [...new Set([...covG.missing, ...covE.missing])].sort((a, b) => AttributePath.of(a).compareTo(AttributePath.of(b)));
        if (!entry || entry.transitions().isEmpty()) {
          obligationStatus.set(ob.id().asString(), RefinementStatus.gap(`requirements event trigger "${trigger === undefined ? "?" : trigger.asString()}" has no eventMap entry (map it to design transitions or waive it)`));
          continue;
        }
        const badIds = entry.transitions().unknownAmong(designIds);
        if (badIds.length > 0) {
          obligationStatus.set(ob.id().asString(), RefinementStatus.gap(`eventMap for "${trigger?.asString()}" names unknown design id(s) ${badIds.join(", ")}`));
          continue;
        }
        if (missing.length > 0) {
          if (unmapped.coversAll(missing)) {
            obligationStatus.set(ob.id().asString(), RefinementStatus.waived(`depends on unmapped attribute(s) ${missing.join(", ")}`));
          } else {
            obligationStatus.set(ob.id().asString(), RefinementStatus.gap(`depends on attribute(s) ${missing.join(", ")} that are neither mapped nor in unmapped[]`));
          }
          continue;
        }
        obligationStatus.set(ob.id().asString(), RefinementStatus.checkable());
        eventTransitions.set(ob.id().asString(), entry.transitions().sortedCanonically());
        continue;
      }
      obligationStatus.set(ob.id().asString(), RefinementStatus.capability(`nature "${ob.nature().asString()}" has no refinement check`));
    }
    const scenarioStatus = new Map;
    for (const sc of req.scenarios()) {
      if (unmapped.covers(sc.id())) {
        scenarioStatus.set(sc.id().asString(), RefinementStatus.waived(unmapped.reasonOf(sc.id()) ?? "listed in unmapped[]"));
        continue;
      }
      if (sc.hasEvent()) {
        scenarioStatus.set(sc.id().asString(), RefinementStatus.capability("event scenarios are not replayed in v1"));
        continue;
      }
      const missing = sc.bindings().entriesCanonically().map((binding) => binding.path().asString()).filter((p) => !byReq.has(p)).sort();
      if (missing.length === 0)
        scenarioStatus.set(sc.id().asString(), RefinementStatus.checkable());
      else if (unmapped.coversAll(missing)) {
        scenarioStatus.set(sc.id().asString(), RefinementStatus.waived(`binds unmapped attribute(s) ${missing.join(", ")}`));
      } else {
        scenarioStatus.set(sc.id().asString(), RefinementStatus.gap(`binds attribute(s) ${missing.join(", ")} that are neither mapped nor in unmapped[]`));
      }
    }
    for (const [id, st] of [...obligationStatus.entries()].sort((a, b) => TargetIdentifier.of(a[0]).compareTo(TargetIdentifier.of(b[0])))) {
      const gapDetail = st.gapDetail();
      if (gapDetail !== null) {
        gap([id], `${id}: ${gapDetail}`, req.obligationById(id)?.functionalRequirementReferences() ?? FunctionalRequirementReferences.of([]));
      }
    }
    for (const [id, st] of [...scenarioStatus.entries()].sort((a, b) => TargetIdentifier.of(a[0]).compareTo(TargetIdentifier.of(b[0])))) {
      const gapDetail = st.gapDetail();
      if (gapDetail !== null) {
        gap([id], `${id}: ${gapDetail}`, req.scenarioById(id)?.functionalRequirementReferences() ?? FunctionalRequirementReferences.of([]));
      }
    }
    return new UnitRefinementPlan({
      mappings: unitMap.attrMap(),
      obligationStatus: KeyedIndex.of([...obligationStatus].map(([id, st]) => [ObligationIdentifier.of(id), st])),
      scenarioStatus: KeyedIndex.of([...scenarioStatus].map(([id, st]) => [ScenarioIdentifier.of(id), st])),
      eventTransitions: KeyedIndex.of([...eventTransitions].map(([id, trs]) => [ObligationIdentifier.of(id), trs])),
      gaps: DesignFindings.of(gaps)
    });
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
        if (ob !== undefined && ob.isEvent()) {
          skipped.push(DesignSkipped.of({ target: TargetIdentifier.of(rid), reason: SkipReason.capability(), unit: UnitName.of(unitName), detail: "event simulation and enabledness are checked by the SMT refinement pass only in v1" }));
        } else if (ob !== undefined && ob.isInvariantLike()) {
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
        skipped.push(DesignSkipped.of({ target: TargetIdentifier.of(rid), reason: SkipReason.capability(), unit: UnitName.of(unitName), detail: "scenario replay is checked by the SMT refinement pass only in v1 (abstract constraints do not determine a concrete init)" }));
      }
    }
    return DesignSkips.of(skipped);
  }
  quintInvariants(req) {
    const out = [];
    for (const ob of req.obligations().sortedCanonically()) {
      if (!this.#obligationStatus.get(ob.id())?.isCheckable())
        continue;
      const assertion = ob.assertion();
      if (!ob.isInvariantLike() || assertion === undefined)
        continue;
      const substituted = this.#mappings.substitute(assertion, false);
      if (substituted.ok)
        out.push(RefinementQuintInvariant.of(ob.id(), ob.functionalRequirementReferences(), substituted.value));
    }
    return RefinementQuintInvariants.of(out);
  }
}
// src/design/domain/effect-assignments.ts
class EffectAssignments {
  #values;
  constructor(effect) {
    const snapshot = ExpressionTree.of(effect).asExpression();
    const assignments = [];
    const terms = [];
    const flatten = (e) => {
      if (e.op === "and")
        for (const a of e.args ?? [])
          flatten(a);
      else
        terms.push(e);
    };
    flatten(snapshot);
    for (const term of terms) {
      if (term.op !== "eq" || term.args?.length !== 2)
        throw new IllegalArgumentException({ kind: "effect-not-assignment-conjunction" });
      const [a, b] = term.args ?? [];
      const target = a?.op === "ref" && a.prime === true ? a : b?.op === "ref" && b.prime === true ? b : null;
      if (!target || target.path === undefined)
        throw new IllegalArgumentException({ kind: "effect-not-assignment-conjunction" });
      assignments.push([AttributePath.of(target.path), term]);
    }
    this.#values = KeyedIndex.of(assignments);
  }
  static of(effect) {
    return new EffectAssignments(effect);
  }
  static parse(effect) {
    return parseConstruction(() => new EffectAssignments(effect));
  }
  covers(path) {
    return this.#values.has(path);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
}
// src/design/domain/design-assignments.ts
class DesignAssignments {
  #values;
  constructor(values) {
    this.#values = KeyedIndex.of([...values].map(([path, expression]) => [path, ExpressionTree.of(expression).asExpression()]));
  }
  static parse(values) {
    return parseConstruction(() => new DesignAssignments(values));
  }
  static of(values) {
    return new DesignAssignments(values);
  }
  rhsOf(path) {
    return this.#values.get(path);
  }
}

// src/design/domain/design-event.ts
class DesignEvent {
  #guard;
  #effectAssign;
  constructor(guard, effectAssign) {
    this.#guard = ExpressionTree.of(guard).asExpression();
    this.#effectAssign = effectAssign;
  }
  static parse(guard, effectAssign) {
    return parseConstruction(() => new DesignEvent(guard, effectAssign));
  }
  static of(guard, effectAssign) {
    return new DesignEvent(guard, effectAssign);
  }
  guard() {
    return this.#guard;
  }
  assignedRhsOf(path) {
    return this.#effectAssign.rhsOf(AttributePath.of(path));
  }
}

// src/design/domain/design-event-catalog.ts
function rhsOf(term) {
  const [a, b] = term.args ?? [];
  return a?.op === "ref" && a.prime === true ? b : a;
}

class DesignEventCatalog {
  #events;
  constructor(events) {
    this.#events = events;
  }
  static of(u) {
    const out = [];
    for (const sm of u.machines()) {
      const attrPath = DesignMachines.attrPathOf(sm);
      for (const tr of sm.transitions()) {
        const guard = tr.loweredGuard(attrPath);
        const effectAssign = [];
        const [statePath, stateRhs] = tr.stateAssignment(attrPath);
        effectAssign.push([AttributePath.of(statePath), stateRhs]);
        const explicitEffect = tr.effect();
        if (explicitEffect !== undefined) {
          const assigned = EffectAssignments.parse(explicitEffect);
          if (assigned.ok) {
            for (const [path, term] of assigned.value) {
              const rhs = rhsOf(term);
              if (rhs)
                effectAssign.push([path, rhs]);
            }
          }
        }
        out.push([TargetIdentifier.of(tr.id().asString()), DesignEvent.of(guard, DesignAssignments.of(KeyedIndex.of(effectAssign)))]);
      }
    }
    for (const ob of u.obligations()) {
      const event = ob.guardedEffect();
      if (event === null)
        continue;
      const effectAssign = [];
      const assigned = EffectAssignments.parse(event.effect);
      if (!assigned.ok)
        continue;
      for (const [path, term] of assigned.value) {
        const rhs = rhsOf(term);
        if (rhs)
          effectAssign.push([path, rhs]);
      }
      out.push([TargetIdentifier.of(ob.id().asString()), DesignEvent.of(event.guard, DesignAssignments.of(KeyedIndex.of(effectAssign)))]);
    }
    return new DesignEventCatalog(KeyedIndex.of(out));
  }
  eventOf(id) {
    return this.#events.get(id) ?? null;
  }
}
// src/design/domain/refinement-solver-plan.ts
class RefinementSolverPlan {
  #pending;
  #compileSkips;
  constructor(props) {
    this.#pending = props.pending;
    this.#compileSkips = props.compileSkips;
  }
  static of(props) {
    return new RefinementSolverPlan({ pending: props.pending, compileSkips: props.compileSkips });
  }
  compileSkips() {
    return this.#compileSkips;
  }
  *[Symbol.iterator]() {
    yield* this.#pending;
  }
  interpret(results, req, plan, unitName) {
    const findings = [];
    const skipped = [];
    const functionalRequirementReferencesOf = (reqId) => req.functionalRequirementReferencesOf(reqId).sortedUnique();
    for (const [queryId, p] of this.#pending) {
      const r = results.verdictOf(queryId);
      if (!r || r.isUndecided()) {
        skipped.push(DesignSkipped.of({
          target: p.reqTarget(),
          reason: SkipReason.timeout(),
          unit: UnitName.of(unitName),
          detail: `refinement query ${queryId.asString()} exceeded the solver budget or errored`
        }));
        continue;
      }
      p.match({
        invariant: (reqId) => {
          if (r.isSat()) {
            findings.push(DesignFinding.of({
              kind: FindingKind.refinementViolation(),
              functionalRequirementReferences: functionalRequirementReferencesOf(reqId.asString()),
              targets: TargetIdentifiers.of(Array.from([reqId.asString()], (raw) => TargetIdentifier.of(raw))),
              witness: DesignWitness.model(r.witnessModel()),
              unit: UnitName.of(unitName),
              detail: `A design-legal state of unit ${unitName} violates requirements obligation ${reqId.asString()} under the refinement map (witness design state attached). The design admits what the verified requirements forbid.`
            }));
          }
        },
        scenario: (reqId) => {
          const sc = req.scenarioById(reqId.asString());
          if (sc?.isAccept() === true && r.isUnsat()) {
            findings.push(DesignFinding.of({
              kind: FindingKind.refinementViolation(),
              functionalRequirementReferences: functionalRequirementReferencesOf(reqId.asString()),
              targets: TargetIdentifiers.of(Array.from([reqId.asString()], (raw) => TargetIdentifier.of(raw))),
              witness: DesignWitness.core(r.sortedCore()),
              unit: UnitName.of(unitName),
              detail: `Accept scenario ${reqId.asString()} has no design-legal counterpart in unit ${unitName} under the refinement map: the design excludes an example the requirements accept (witness core attached).`
            }));
          }
          if (sc?.isReject() === true && r.isSat()) {
            findings.push(DesignFinding.of({
              kind: FindingKind.refinementViolation(),
              functionalRequirementReferences: functionalRequirementReferencesOf(reqId.asString()),
              targets: TargetIdentifiers.of(Array.from([reqId.asString()], (raw) => TargetIdentifier.of(raw))),
              witness: DesignWitness.model(r.witnessModel()),
              unit: UnitName.of(unitName),
              detail: `Reject scenario ${reqId.asString()} is still admitted by unit ${unitName} under the refinement map: the design does not exclude an example the requirements reject (witness design state attached).`
            }));
          }
        },
        enabledness: (reqId) => {
          if (r.isSat()) {
            findings.push(DesignFinding.of({
              kind: FindingKind.completenessGap(),
              functionalRequirementReferences: functionalRequirementReferencesOf(reqId.asString()),
              targets: TargetIdentifiers.of(Array.from([reqId.asString(), ...plan.mappedTransitionsOf(reqId.asString()).map((t) => t.asString())], (raw) => TargetIdentifier.of(raw))).sortedUniqueCanonically(),
              witness: DesignWitness.model(r.witnessModel()),
              unit: UnitName.of(unitName),
              detail: `The requirements event ${reqId.asString()} applies in the witness design state, but none of its mapped design transitions is enabled there: the design has no answer in a region the requirement covers.`
            }));
          }
        },
        simulation: (reqId, designId) => {
          if (r.isSat()) {
            findings.push(DesignFinding.of({
              kind: FindingKind.refinementViolation(),
              functionalRequirementReferences: functionalRequirementReferencesOf(reqId.asString()),
              targets: TargetIdentifiers.of(Array.from([reqId.asString(), designId.asString()].filter((t) => t !== ""), (raw) => TargetIdentifier.of(raw))).sortedUniqueCanonically(),
              witness: DesignWitness.trace(r.witnessTrace()),
              unit: UnitName.of(unitName),
              detail: `Design step ${designId.asString()} of unit ${unitName}, taken where requirements event ${reqId.asString()} applies, produces an abstract post-state that violates the requirements effect or the abstract frame (pre/post design states attached).`
            }));
          }
        }
      });
    }
    return { findings: DesignFindings.of(findings), skipped: DesignSkips.of(skipped) };
  }
}
// src/design/domain/refinement-probe.ts
class RefinementProbe {
  #kind;
  #reqId;
  #designId;
  constructor(props) {
    this.#kind = props.kind;
    this.#reqId = props.reqId;
    this.#designId = props.designId;
  }
  static invariant(reqId) {
    return new RefinementProbe({ kind: "invariant", reqId, designId: null });
  }
  static enabledness(reqId) {
    return new RefinementProbe({ kind: "enabledness", reqId, designId: null });
  }
  static simulation(reqId, designId) {
    return new RefinementProbe({ kind: "simulation", reqId, designId });
  }
  static scenario(reqId) {
    return new RefinementProbe({ kind: "scenario", reqId, designId: null });
  }
  reqTarget() {
    return this.#reqId.asTargetId();
  }
  match(handlers) {
    const kind = this.#kind;
    if (kind === "invariant")
      return handlers.invariant(this.#reqId);
    if (kind === "enabledness")
      return handlers.enabledness(this.#reqId);
    if (kind === "scenario")
      return handlers.scenario(this.#reqId);
    if (this.#designId === null)
      throw new Error("defect: a simulation probe carries no design transition");
    return handlers.simulation(this.#reqId, this.#designId);
  }
}
// src/design/domain/refinement-query-verdict.ts
class RefinementQueryVerdict {
  #status;
  #decodedModel;
  #decodedPostModel;
  #core;
  constructor(props) {
    this.#status = props.status;
    this.#decodedModel = props.decodedModel === undefined ? undefined : { ...props.decodedModel };
    this.#decodedPostModel = props.decodedPostModel === undefined ? undefined : { ...props.decodedPostModel };
    this.#core = props.core === undefined ? undefined : props.core.map((label) => QueryLabel.of(label));
  }
  static parse(props) {
    return parseConstruction(() => new RefinementQueryVerdict(props));
  }
  static of(props) {
    return new RefinementQueryVerdict(props);
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
// src/design/domain/refinement-query-verdicts.ts
class RefinementQueryVerdicts {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new RefinementQueryVerdicts(values);
  }
  verdictOf(queryId) {
    return this.#values.get(queryId);
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
  artifactPath() {
    return this.#path;
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
// src/design/domain/refinement-map-acquisition.ts
class RefinementMapAcquisition {
  #error;
  #map;
  #mapArtifact;
  #inputs;
  constructor(props) {
    this.#error = props.error;
    this.#map = props.map;
    this.#mapArtifact = props.mapArtifact;
    this.#inputs = props.inputs;
  }
  static absent(error) {
    return new RefinementMapAcquisition({ error, map: null, mapArtifact: null, inputs: [] });
  }
  static loaded(map, mapArtifact, inputs) {
    return new RefinementMapAcquisition({ error: null, map, mapArtifact, inputs });
  }
  match(handlers) {
    if (this.#map === null || this.#mapArtifact === null)
      return handlers.absent(this.#error);
    return handlers.loaded(this.#map, this.#mapArtifact, this.#inputs);
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
  matchesName(value) {
    return this.#value === value;
  }
  asString() {
    return this.#value;
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
  finalize(report, model) {
    return this.#finalizing(report, model);
  }
  finalizeIrUnreadable(report) {
    const finalized = this.#finalizing(report, null);
    if (!finalized.ok)
      return err(finalized.error);
    return ok(undefined);
  }
  #finalizing(report, model) {
    const loaded = this.#repository.findByDirectory(report.id().directory());
    if (!loaded.ok)
      return err(loaded.error);
    const aggregate = loaded.value.finalizedWith(report, model, this.#findingsSchema);
    const stored = this.#repository.store(aggregate);
    if (!stored.ok)
      return err(stored.error);
    const published = aggregate.candidate();
    if (published === null) {
      return err({ kind: "io-failed", operation: "write", path: report.id().fileName(), cause: "no finalization candidate" });
    }
    return ok({
      kind: "verified",
      pass: published.passes(),
      findingsCount: published.findingsCount(),
      skippedCount: published.skippedCount(),
      method: published.method()
    });
  }
}

// src/design/usecase/design-verification-acquirer.ts
class DesignVerificationAcquirer {
  #designModelRepository;
  #finalizer;
  constructor(designModelRepository, finalizer) {
    this.#designModelRepository = designModelRepository;
    this.#finalizer = finalizer;
  }
  acquire(modelId, reportId, method) {
    const acquired = this.#designModelRepository.findById(modelId);
    if (!acquired.ok) {
      if (acquired.error.kind === "not-found")
        return { kind: "terminal", outcome: { kind: "not-applicable" } };
      if (acquired.error.kind === "io-failed") {
        return { kind: "terminal", outcome: { kind: "acquisition-failed", error: acquired.error } };
      }
      const unreadable = DesignReport.irUnreadable(reportId, method.asString(), acquired.error.cause);
      const saved = this.#finalizer.finalizeIrUnreadable(unreadable);
      if (!saved.ok)
        return { kind: "terminal", outcome: { kind: "save-failed", error: saved.error } };
      return { kind: "terminal", outcome: { kind: "model-unreadable" } };
    }
    const model = acquired.value;
    const irHash = model.irHash();
    if (!model.supportsMajor(SUPPORTED_DESIGN_IR_MAJOR)) {
      const mismatch = DesignReport.versionMismatch(reportId, model, irHash, method.asString());
      const skippedCount = mismatch.skippedCount();
      const saved = this.#finalizer.finalize(mismatch, model);
      if (!saved.ok)
        return { kind: "terminal", outcome: { kind: "save-failed", error: saved.error } };
      return { kind: "terminal", outcome: { kind: "version-mismatch", skippedCount } };
    }
    return { kind: "ready", model, irHash };
  }
}

// src/design/usecase/verify-design-satisfiability-modulo-theories-usecase.ts
var BACKEND = "smt";
var METHOD = "exhaustive";
var UNIT_WALL_TIMEOUT_MS = 55000;
var RUN_BUDGET_MS = 60000;
var REFINEMENT_DEADLINE_MS = 65000;
function initialMethod() {
  const parsed = VerificationMethod.parse(METHOD);
  if (!parsed.ok)
    throw new Error(`defect: "${METHOD}" is not a verification method`);
  return parsed.value;
}

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
    const id = DesignReportIdentifier.of(input.verifyDirectory, BACKEND);
    const acquired = this.#acquirer.acquire(input.modelId, id, initialMethod());
    if (acquired.kind === "terminal")
      return acquired.outcome;
    if (acquired.kind !== "ready")
      return unreachable(acquired);
    const model = acquired.model;
    const irHash = acquired.irHash;
    const findings = [];
    const skipped = [];
    const checkedUnits = [];
    const started = this.#clock.now();
    for (const u of model.units()) {
      if (this.#clock.now() - started > RUN_BUDGET_MS) {
        for (const t of u.allTargets()) {
          skipped.push(DesignSkipped.of({ target: t, reason: SkipReason.timeout(), unit: UnitName.of(u.name()), detail: "the per-run solver budget was exhausted before this unit" }));
        }
        continue;
      }
      const lowered = u.lowered({ synthetics: true });
      const remaining = Math.min(UNIT_WALL_TIMEOUT_MS, RUN_BUDGET_MS - (this.#clock.now() - started));
      if (remaining < 3000) {
        for (const t of u.allTargets()) {
          skipped.push(DesignSkipped.of({ target: t, reason: SkipReason.timeout(), unit: UnitName.of(u.name()), detail: "the per-run solver budget was exhausted before this unit" }));
        }
        continue;
      }
      const run = this.#siblingBackendClient.runLowered("smt", u, lowered, remaining);
      if (run.exit === 127) {
        const reason = run.doc?.unavailableReason() ?? "z3 could not be executed by the lowered v1 backend";
        const unavailable = DesignReport.backendUnavailable(id, model, irHash, METHOD, reason, "z3 could not be executed");
        const saved = this.#finalizer.finalize(unavailable, model);
        if (!saved.ok)
          return { kind: "save-failed", error: saved.error };
        return { kind: "backend-unavailable" };
      }
      if (run.doc === null) {
        for (const t of u.allTargets()) {
          skipped.push(DesignSkipped.of({ target: t, reason: SkipReason.unavailable(), unit: UnitName.of(u.name()), detail: `lowered v1 backend produced no findings document (${run.note.slice(0, 160)})` }));
        }
        continue;
      }
      const remapped = run.doc.remapVerdicts(u, lowered.index());
      if (remapped.unavailable !== null) {
        for (const t of u.allTargets()) {
          skipped.push(DesignSkipped.of({ target: t, reason: SkipReason.unavailable(), unit: UnitName.of(u.name()), detail: remapped.unavailable }));
        }
        continue;
      }
      findings.push(...remapped.findings);
      skipped.push(...remapped.skipped);
      checkedUnits.push(`unit:${u.name()}`);
    }
    const materials = this.#refinementMaterialsRepository.findById(RefinementMaterialsIdentifier.of(input.modelId));
    let inputs;
    if (materials.ok && materials.value.isActive()) {
      const context = materials.value;
      const req = context.requirements();
      const acq = context.mapAcquisition();
      const reqTargets = req.allTargetIds();
      const skipAll = (reason, detail) => {
        for (const u of model.units()) {
          for (const t of reqTargets)
            skipped.push(DesignSkipped.of({ target: t, reason, unit: UnitName.of(u.name()), detail }));
        }
      };
      acq.match({
        absent: (error) => {
          skipAll(SkipReason.absentInput(), error ?? "no refinement map (deep-spec-analysis-refinement-map.md) was authored for this record");
        },
        loaded: (map, mapArtifact, mapInputs) => {
          if (!map.requirementsIrHash().equals(req.hash())) {
            skipAll(SkipReason.staleInput(), "the refinement map's requirementsIrHash no longer matches the requirements formal model \u2014 re-author the map");
            return;
          }
          if (!map.designIrHash().equals(irHash)) {
            skipAll(SkipReason.staleInput(), "the refinement map's designIrHash no longer matches this design IR \u2014 re-author the map");
            return;
          }
          inputs = mapInputs;
          for (const u of model.units()) {
            const unitMap = map.unitMapOf(u.id());
            if (!unitMap) {
              for (const t of reqTargets) {
                skipped.push(DesignSkipped.of({ target: t, reason: SkipReason.absentInput(), unit: UnitName.of(u.name()), detail: `the refinement map has no entry for unit ${u.name()}` }));
              }
              continue;
            }
            const refRemaining = REFINEMENT_DEADLINE_MS - (this.#clock.now() - started);
            if (refRemaining < 5000) {
              for (const t of reqTargets) {
                skipped.push(DesignSkipped.of({ target: t, reason: SkipReason.timeout(), unit: UnitName.of(u.name()), detail: "the per-run solver budget was exhausted before the refinement pass" }));
              }
              continue;
            }
            const plan = UnitRefinementPlan.of(u, unitMap, req, mapArtifact);
            const check = this.#refinementSolverClient.check(u, req, plan, Math.min(30000, refRemaining));
            if (check.result.kind === "unavailable") {
              for (const t of reqTargets) {
                skipped.push(DesignSkipped.of({ target: t, reason: SkipReason.unavailable(), unit: UnitName.of(u.name()), detail: check.result.reason }));
              }
              continue;
            }
            findings.push(...plan.gaps());
            skipped.push(...plan.smtStatusSkips(u.name()));
            skipped.push(...check.plan.compileSkips());
            if (check.result.kind === "solved") {
              const interpreted = check.plan.interpret(check.result.verdicts, req, plan, u.name());
              findings.push(...interpreted.findings);
              skipped.push(...interpreted.skipped);
            }
          }
        }
      });
    }
    const report = DesignReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method: METHOD,
      findings: DesignFindings.of(findings),
      skipped: DesignSkips.of(skipped),
      ...inputs !== undefined ? { inputs: DesignInputAnchors.of(inputs) } : {},
      checked: CheckedUnits.of(Array.from(checkedUnits, (raw) => UnitName.of(raw))),
      ...!materials.ok ? { unavailableReason: `refinement input could not be acquired: ${materials.error.path} (${materials.error.kind})` } : {}
    });
    const finalized = this.#finalizer.finalize(report, model);
    if (!finalized.ok)
      return { kind: "save-failed", error: finalized.error };
    if (!materials.ok)
      return { kind: "acquisition-failed", error: materials.error };
    return finalized.value;
  }
}
// src/design/usecase/verify-design-quint-usecase.ts
var BACKEND2 = "quint";
var INITIAL_METHOD_NAME = "simulation";
var UNIT_WALL_TIMEOUT_MS2 = 50000;
var RUN_BUDGET_MS2 = 50000;
var UNREACH_BUDGET_MS = 70000;
var BOUND_STEPS = 8;
function initialMethod2() {
  const parsed = VerificationMethod.parse(INITIAL_METHOD_NAME);
  if (!parsed.ok)
    throw new Error(`defect: "${INITIAL_METHOD_NAME}" is not a verification method`);
  return parsed.value;
}

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
    const id = DesignReportIdentifier.of(input.verifyDirectory, BACKEND2);
    const acquired = this.#acquirer.acquire(input.modelId, id, initialMethod2());
    if (acquired.kind === "terminal")
      return acquired.outcome;
    if (acquired.kind !== "ready")
      return unreachable(acquired);
    const model = acquired.model;
    const irHash = acquired.irHash;
    const findings = [];
    const skipped = [];
    const checkedUnits = [];
    let method = null;
    const started = this.#clock.now();
    let probesUsed = 0;
    for (const u of model.units()) {
      if (this.#clock.now() - started > RUN_BUDGET_MS2) {
        for (const t of u.allTargets()) {
          skipped.push(DesignSkipped.of({ target: t, reason: SkipReason.timeout(), unit: UnitName.of(u.name()), detail: "the per-run backend budget was exhausted before this unit" }));
        }
        continue;
      }
      const lowered = u.lowered({ synthetics: false });
      const mainRemaining = Math.min(UNIT_WALL_TIMEOUT_MS2, RUN_BUDGET_MS2 - (this.#clock.now() - started));
      if (mainRemaining < 3000) {
        for (const t of u.allTargets()) {
          skipped.push(DesignSkipped.of({ target: t, reason: SkipReason.timeout(), unit: UnitName.of(u.name()), detail: "the per-run backend budget was exhausted before this unit" }));
        }
        continue;
      }
      const run = this.#siblingBackendClient.runLowered("quint", u, lowered, mainRemaining);
      if (run.exit === 127) {
        const reason = run.doc?.unavailableReason() ?? "quint CLI could not be executed by the lowered v1 backend";
        const unavailable = DesignReport.backendUnavailable(id, model, irHash, method ?? INITIAL_METHOD_NAME, reason, "quint CLI missing");
        const saved = this.#finalizer.finalize(unavailable, model);
        if (!saved.ok)
          return { kind: "save-failed", error: saved.error };
        return { kind: "backend-unavailable" };
      }
      if (run.doc === null) {
        for (const t of u.allTargets()) {
          skipped.push(DesignSkipped.of({ target: t, reason: SkipReason.unavailable(), unit: UnitName.of(u.name()), detail: `lowered v1 backend produced no findings document (${run.note.slice(0, 160)})` }));
        }
        continue;
      }
      const remapped = run.doc.remapVerdicts(u, lowered.index());
      if (remapped.unavailable !== null) {
        for (const t of u.allTargets()) {
          skipped.push(DesignSkipped.of({ target: t, reason: SkipReason.unavailable(), unit: UnitName.of(u.name()), detail: remapped.unavailable }));
        }
        continue;
      }
      method = method ?? remapped.method;
      findings.push(...remapped.findings);
      skipped.push(...remapped.skipped);
      checkedUnits.push(`unit:${u.name()}`);
      for (const sm of u.machines().sortedById()) {
        const attrPath = lowered.index().attrPathOfMachine(sm.id().asString()) ?? DesignMachines.attrPathOf(sm);
        const candidates = sm.nonInitialCandidates(u.enumValuesOf(attrPath));
        if (candidates.length === 0)
          continue;
        if (method !== "bounded") {
          skipped.push(DesignSkipped.of({
            target: sm.id().asTargetId(),
            reason: SkipReason.capability(),
            unit: UnitName.of(u.name()),
            detail: `unreachable-state detection for ${sm.id().asString()} requires bounded mode (quint verify with Apalache); simulation cannot decide it (states: ${candidates.join(", ")})`
          }));
          continue;
        }
        const leftover = [];
        for (const state of candidates) {
          const probeRemaining = Math.min(UNIT_WALL_TIMEOUT_MS2, UNREACH_BUDGET_MS - (this.#clock.now() - started));
          if (probesUsed >= this.#unreachCap || probeRemaining < 3000) {
            leftover.push(state);
            continue;
          }
          probesUsed += 1;
          const probe = this.#siblingBackendClient.probeState(u, lowered, attrPath, state, probeRemaining);
          probe.match({
            reached: () => {},
            unverified: () => {
              leftover.push(state);
            },
            notReachedWithinBound: () => {
              findings.push(DesignFinding.of({
                kind: FindingKind.unreachable(),
                functionalRequirementReferences: FunctionalRequirementReferences.of([]),
                targets: TargetIdentifiers.of(Array.from([sm.id().asString()], (raw) => TargetIdentifier.of(raw))),
                witness: DesignWitness.model({ [attrPath]: state }),
                unit: UnitName.of(u.name()),
                detail: `State "${state}" of ${sm.id().asString()} (${attrPath}) is not reached by any execution within ${BOUND_STEPS} steps from any legal state \u2014 it may be dead.`
              }));
            }
          });
        }
        if (leftover.length > 0) {
          skipped.push(DesignSkipped.of({
            target: sm.id().asTargetId(),
            reason: probesUsed >= this.#unreachCap ? SkipReason.timeout() : SkipReason.unavailable(),
            unit: UnitName.of(u.name()),
            detail: `unreachable-state detection skipped for state(s) ${leftover.join(", ")} of ${sm.id().asString()} (per-run cap ${this.#unreachCap} / budget reached, or the probe run failed)`
          }));
        }
      }
    }
    const materials = this.#refinementMaterialsRepository.findById(RefinementMaterialsIdentifier.of(input.modelId));
    let inputs;
    if (materials.ok && materials.value.isActive()) {
      const context = materials.value;
      const req = context.requirements();
      const acq = context.mapAcquisition();
      const reqTargets = req.allTargetIds();
      const skipAll = (reason, detail) => {
        for (const u of model.units()) {
          for (const t of reqTargets)
            skipped.push(DesignSkipped.of({ target: t, reason, unit: UnitName.of(u.name()), detail }));
        }
      };
      acq.match({
        absent: (error) => {
          skipAll(SkipReason.absentInput(), error ?? "no refinement map (deep-spec-analysis-refinement-map.md) was authored for this record");
        },
        loaded: (map, mapArtifact, mapInputs) => {
          if (!map.requirementsIrHash().equals(req.hash())) {
            skipAll(SkipReason.staleInput(), "the refinement map's requirementsIrHash no longer matches the requirements formal model \u2014 re-author the map");
            return;
          }
          if (!map.designIrHash().equals(irHash)) {
            skipAll(SkipReason.staleInput(), "the refinement map's designIrHash no longer matches this design IR \u2014 re-author the map");
            return;
          }
          inputs = mapInputs;
          for (const u of model.units()) {
            const unitMap = map.unitMapOf(u.id());
            if (!unitMap) {
              for (const t of reqTargets) {
                skipped.push(DesignSkipped.of({ target: t, reason: SkipReason.absentInput(), unit: UnitName.of(u.name()), detail: `the refinement map has no entry for unit ${u.name()}` }));
              }
              continue;
            }
            const plan = UnitRefinementPlan.of(u, unitMap, req, mapArtifact);
            findings.push(...plan.gaps());
            skipped.push(...plan.quintStatusSkips(req, u.name()));
            const extras = plan.quintInvariants(req);
            if (extras.isEmpty())
              continue;
            const remaining = Math.min(UNIT_WALL_TIMEOUT_MS2, RUN_BUDGET_MS2 + UNREACH_BUDGET_MS - (this.#clock.now() - started));
            if (remaining < 3000) {
              for (const e of extras) {
                skipped.push(DesignSkipped.of({ target: e.reqTarget(), reason: SkipReason.timeout(), unit: UnitName.of(u.name()), detail: "the per-run backend budget was exhausted before the refinement pass" }));
              }
              continue;
            }
            const base = u.lowered({ synthetics: false });
            let refinementObligations = base.obligations();
            let refinementIndex = base.index();
            let n = refinementObligations.count();
            for (const e of extras) {
              n += 1;
              const lowId = LoweredIdentifier.of(`OB-${n}`);
              refinementObligations = refinementObligations.add(e.loweredAs(lowId));
              refinementIndex = refinementIndex.withPassthrough(lowId.asString(), e.reqId().asString());
            }
            const lowered = base.extendedWith(refinementObligations, refinementIndex);
            const run = this.#siblingBackendClient.runLowered("quint", u, lowered, remaining);
            if (run.exit !== 0 || run.doc === null) {
              for (const e of extras) {
                skipped.push(DesignSkipped.of({ target: e.reqTarget(), reason: SkipReason.unavailable(), unit: UnitName.of(u.name()), detail: `refinement pass could not run (${run.note.slice(0, 120)})` }));
              }
              continue;
            }
            const remapped = run.doc.remapVerdicts(u, lowered.index());
            if (remapped.unavailable !== null) {
              for (const e of extras) {
                skipped.push(DesignSkipped.of({ target: e.reqTarget(), reason: SkipReason.unavailable(), unit: UnitName.of(u.name()), detail: `refinement pass degraded: ${remapped.unavailable}` }));
              }
              continue;
            }
            const interpreted = extras.interpret(remapped.findings, remapped.skipped, u.name());
            findings.push(...interpreted.findings);
            skipped.push(...interpreted.skipped);
          }
        }
      });
    }
    const finalMethod = method ?? INITIAL_METHOD_NAME;
    const report = DesignReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method: finalMethod,
      findings: DesignFindings.of(findings),
      skipped: DesignSkips.of(skipped),
      ...inputs !== undefined ? { inputs: DesignInputAnchors.of(inputs) } : {},
      checked: CheckedUnits.of(Array.from(checkedUnits, (raw) => UnitName.of(raw))),
      ...!materials.ok ? { unavailableReason: `refinement input could not be acquired: ${materials.error.path} (${materials.error.kind})` } : {}
    });
    const finalized = this.#finalizer.finalize(report, model);
    if (!finalized.ok)
      return { kind: "save-failed", error: finalized.error };
    if (!materials.ok)
      return { kind: "acquisition-failed", error: materials.error };
    return finalized.value;
  }
}
// src/design/usecase/validate-design-intermediate-representation-usecase.ts
class ValidateDesignIntermediateRepresentationUseCase {
  #designIrValidationMaterialsRepository;
  constructor(designIrValidationMaterialsRepository) {
    this.#designIrValidationMaterialsRepository = designIrValidationMaterialsRepository;
  }
  execute(modelId) {
    const found = this.#designIrValidationMaterialsRepository.findById(DesignIntermediateRepresentationValidationMaterialsIdentifier.of(modelId));
    if (!found.ok) {
      if (found.error.kind === "not-found")
        return { kind: "not-applicable" };
      return { kind: "verdict", pass: false, errors: [found.error.cause] };
    }
    const materials = found.value;
    const errors = [];
    const major = materials.irVersion().majorVersion();
    if (Number.isInteger(major) && major !== SUPPORTED_DESIGN_IR_MAJOR) {
      errors.push(`irVersion ${materials.irVersion().asString()}: unsupported major version (this validator supports ${SUPPORTED_DESIGN_IR_MAJOR}.x.x)`);
    }
    errors.push(...materials.schemaErrors().toArray().map((message) => message.asString()));
    if (errors.length === 0) {
      errors.push(...materials.units().wellFormednessErrors());
    }
    return { kind: "verdict", pass: errors.length === 0, errors };
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
    entities.push(DesignEntityDeclaration.of({
      name: name.value,
      ...typeof ent.description === "string" ? { description: ent.description } : {},
      attributes: DesignAttributeDeclarations.of(attributes)
    }));
  }
  return ok(DesignEntityDeclarations.of(entities));
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

// src/design/adapter/design-model-parser.ts
function parseDesignModel(raw) {
  if (!isObject(raw))
    return err("design IR is not a JSON object");
  if (raw.irKind !== "design")
    return err('document is not a design IR (missing `"irKind": "design"`)');
  const irVersion = IntermediateRepresentationVersion.parse(typeof raw.irVersion === "string" ? raw.irVersion : "");
  if (!irVersion.ok)
    return err("design IR lacks a semver irVersion");
  if (!Array.isArray(raw.units) || raw.units.length === 0)
    return err("design IR carries no units[]");
  const units = [];
  for (const rawUnit of raw.units) {
    if (!isObject(rawUnit) || typeof rawUnit.unit !== "string")
      continue;
    const schema = isObject(rawUnit.schema) ? rawUnit.schema : {};
    const entities = parseDesignEntities(schema);
    if (!entities.ok)
      return err(JSON.stringify(entities.error));
    const unit = UnitName.parse(rawUnit.unit);
    if (!unit.ok)
      return err(JSON.stringify(unit.error));
    const obligations = [];
    for (const ob of Array.isArray(rawUnit.obligations) ? rawUnit.obligations : []) {
      if (!isObject(ob) || typeof ob.id !== "string" || typeof ob.nature !== "string")
        continue;
      const parsed = combineResults({
        id: DesignObligationIdentifier.parse(ob.id),
        origin: DesignObligationOrigin.parse(typeof ob.origin === "string" ? ob.origin : ""),
        nature: DesignObligationNature.parse(ob.nature),
        brRefs: flatMapResult(traverseResult(strArr(ob.brRefs), BusinessRuleReference.parse), BusinessRuleReferences.parse),
        frRefs: flatMapResult(traverseResult(strArr(ob.frRefs), RequirementIdentifier.parse), FunctionalRequirementReferences.parse),
        trigger: typeof ob.trigger === "string" ? TriggerName.parse(ob.trigger) : ok(undefined)
      });
      if (!parsed.ok)
        return err(JSON.stringify(parsed.error));
      const constructed = DesignObligation.parse({
        id: parsed.value.id,
        nature: parsed.value.nature,
        origin: parsed.value.origin,
        businessRuleReferences: parsed.value.brRefs,
        functionalRequirementReferences: parsed.value.frRefs,
        assert: isObject(ob.assert) ? ob.assert : undefined,
        trigger: parsed.value.trigger,
        guard: isObject(ob.guard) ? ob.guard : undefined,
        effect: isObject(ob.effect) ? ob.effect : undefined,
        temporal: isObject(ob.temporal) ? ob.temporal : undefined
      });
      if (!constructed.ok)
        return err(JSON.stringify(constructed.error));
      obligations.push(constructed.value);
    }
    const machines = [];
    for (const sm of Array.isArray(rawUnit.stateMachines) ? rawUnit.stateMachines : []) {
      if (!isObject(sm) || typeof sm.id !== "string" || typeof sm.entity !== "string" || typeof sm.attribute !== "string")
        continue;
      const transitions = [];
      for (const tr of Array.isArray(sm.transitions) ? sm.transitions : []) {
        if (!isObject(tr) || typeof tr.id !== "string")
          continue;
        if (typeof tr.from !== "string" || typeof tr.to !== "string" || typeof tr.trigger !== "string")
          continue;
        const parsed2 = combineResults({
          id: DesignTransitionIdentifier.parse(tr.id),
          trigger: TriggerName.parse(tr.trigger),
          brRefs: flatMapResult(traverseResult(strArr(tr.brRefs), BusinessRuleReference.parse), BusinessRuleReferences.parse)
        });
        if (!parsed2.ok)
          return err(JSON.stringify(parsed2.error));
        const constructed = DesignTransition.parse({
          id: parsed2.value.id,
          from: tr.from,
          to: tr.to,
          trigger: parsed2.value.trigger,
          guard: isObject(tr.guard) ? tr.guard : undefined,
          effect: isObject(tr.effect) ? tr.effect : undefined,
          businessRuleReferences: parsed2.value.brRefs
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
        ignores.push(DesignIgnore.of({ state: ig.state, trigger: trigger.value }));
      }
      const parsed = combineResults({
        id: DesignMachineIdentifier.parse(sm.id),
        initial: flatMapResult(traverseResult(strArr(sm.initial), InitialState.parse), InitialStates.parse),
        entity: DesignEntityName.parse(sm.entity),
        attribute: DesignAttributeName.parse(sm.attribute)
      });
      if (!parsed.ok)
        return err(JSON.stringify(parsed.error));
      machines.push(DesignMachine.of({
        id: parsed.value.id,
        entity: parsed.value.entity,
        attribute: parsed.value.attribute,
        initial: parsed.value.initial,
        transitions: DesignTransitions.of(transitions),
        ignores: DesignIgnores.of(ignores),
        deterministic: sm.deterministic !== false
      }));
    }
    const scenarios = [];
    for (const sc of Array.isArray(rawUnit.scenarios) ? rawUnit.scenarios : []) {
      if (!isObject(sc) || typeof sc.id !== "string")
        continue;
      const kind = sc.kind === "accept" || sc.kind === "reject" ? sc.kind : null;
      if (kind === null || !isObject(sc.bindings))
        continue;
      const parsed = combineResults({
        id: DesignScenarioIdentifier.parse(sc.id),
        bindings: decodeScenarioBindings(sc.bindings),
        brRefs: flatMapResult(traverseResult(strArr(sc.brRefs), BusinessRuleReference.parse), BusinessRuleReferences.parse),
        frRefs: flatMapResult(traverseResult(strArr(sc.frRefs), RequirementIdentifier.parse), FunctionalRequirementReferences.parse),
        trigger: isObject(sc.event) && typeof sc.event.trigger === "string" ? TriggerName.parse(sc.event.trigger) : ok(undefined)
      });
      if (!parsed.ok)
        return err(JSON.stringify(parsed.error));
      const constructed = DesignScenario.parse({
        id: parsed.value.id,
        kind,
        businessRuleReferences: parsed.value.brRefs,
        functionalRequirementReferences: parsed.value.frRefs,
        bindings: parsed.value.bindings,
        event: parsed.value.trigger === undefined ? undefined : { trigger: parsed.value.trigger },
        expect: isObject(sc.expect) ? sc.expect : undefined
      });
      if (!constructed.ok)
        return err(JSON.stringify(constructed.error));
      scenarios.push(constructed.value);
    }
    const background = [];
    for (const bg of Array.isArray(rawUnit.background) ? rawUnit.background : []) {
      if (!isObject(bg) || typeof bg.id !== "string" || !isObject(bg.assert))
        continue;
      const id = DesignBackgroundIdentifier.parse(bg.id);
      if (!id.ok)
        return err(JSON.stringify(id.error));
      const constructed = DesignBackgroundAssumption.parse({ id: id.value, assert: bg.assert });
      if (!constructed.ok)
        return err(JSON.stringify(constructed.error));
      background.push(constructed.value);
    }
    units.push(DesignUnit.of({
      unit: unit.value.asString(),
      entities: entities.value,
      obligations: DesignObligations.of(obligations),
      machines: DesignMachines.of(machines),
      scenarios: DesignScenarios.of(scenarios),
      background: DesignBackgroundAssumptions.of(background)
    }));
  }
  if (units.length === 0)
    return err("design IR carries no parseable units");
  return ok({ irVersion: irVersion.value, units: DesignUnits.of(units) });
}
// src/design/adapter/design-model-repository-implementation.ts
import { existsSync as existsSync3, readFileSync as readFileSync4 } from "fs";
class DesignModelRepositoryImplementation {
  findById(id) {
    const modelPath = id.artifactPath().asString();
    let bytes;
    try {
      bytes = readFileSync4(modelPath);
    } catch (e) {
      if (e.code === "ENOENT" || !existsSync3(modelPath)) {
        return err({ kind: "not-found", path: modelPath });
      }
      return err({ kind: "io-failed", operation: "read", path: modelPath, cause: e instanceof Error ? e.message : String(e) });
    }
    const md = bytes.toString("utf-8");
    const fences = extractFences(md, "json");
    const body = fences.length === 1 ? fences[0]?.body ?? null : null;
    let raw = null;
    try {
      raw = body === null ? null : JSON.parse(body);
    } catch {
      raw = null;
    }
    if (raw === null) {
      return err({ kind: "corrupt", path: modelPath, cause: "formal model does not contain exactly one readable ```json fence" });
    }
    const composition = parseDesignModel(raw);
    if (!composition.ok) {
      return err({ kind: "corrupt", path: modelPath, cause: composition.error });
    }
    return ok(DesignModel.compose({ id, irHash: ContentHash.ofText(canonicalStringify(raw)), sourceDocument: new Uint8Array(bytes), ...composition.value }));
  }
  store(model) {
    const modelPath = model.id().artifactPath().asString();
    const bytes = model.sourceDocument();
    try {
      writeFileAtomically(modelPath, bytes);
      return ok(undefined);
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path: modelPath, cause: e instanceof Error ? e.message : String(e) });
    }
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
    const expectation = sc.expectation();
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
// src/design/adapter/sibling-backend-client-implementation.ts
import { spawnSync } from "child_process";
import { mkdtempSync, readFileSync as readFileSync5, rmSync as rmSync3, writeFileSync as writeFileSync3 } from "fs";
import { tmpdir } from "os";
import { join as join4 } from "path";

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
  return SiblingVerdictDocument.readable(doc.method, SiblingVerdictFindings.of(findings), SiblingVerdictSkips.of(skipped));
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
    assert: { op: "ne", args: [{ op: "ref", path: attrPath }, { op: "enum", value: state }] }
  };
  return {
    irVersion: base.irVersion ?? "1.0.0",
    schema: base.schema ?? { entities: [] },
    obligations: [...events, probe],
    scenarios: [],
    background: Array.isArray(base.background) ? base.background : []
  };
}

// src/design/adapter/sibling-backend-client-implementation.ts
class SiblingBackendClientImplementation {
  #config;
  constructor(config) {
    this.#config = config;
  }
  runLowered(backend, unit, lowered, wallTimeoutMs) {
    const run = this.#spawn(backend, renderLoweredDocument(unit, lowered), wallTimeoutMs);
    return {
      exit: run.exit,
      doc: run.doc === null ? null : parseSiblingVerdictDocument(run.doc),
      note: run.note
    };
  }
  probeState(unit, lowered, attrPath, state, wallTimeoutMs) {
    const variant = reachabilityVariant(renderLoweredDocument(unit, lowered), attrPath, state);
    const run = this.#spawn("quint", variant, wallTimeoutMs);
    if (run.exit !== 0 || run.doc === null) {
      return ReachabilityVerdict.unverified();
    }
    return parseSiblingVerdictDocument(run.doc).reachabilityOf(attrPath, state);
  }
  #spawn(backend, loweredDoc, wallTimeoutMs) {
    const tool = this.#config.siblingToolPaths[backend];
    const work = mkdtempSync(join4(tmpdir(), "deep-spec-design-lower-"));
    try {
      const modelPath = join4(work, "deep-spec-analysis-formal-model.md");
      writeFileSync3(modelPath, `# Lowered design unit

\`\`\`json
${JSON.stringify(loweredDoc, null, 2)}
\`\`\`
`, "utf-8");
      const res = spawnSync("bun", [tool, "--stage", "deep-spec-analysis-functional-verify", "--output-path", modelPath], {
        encoding: "utf-8",
        timeout: wallTimeoutMs,
        cwd: this.#config.workingDirectory,
        ...this.#config.spawnEnvironment ? { env: this.#config.spawnEnvironment } : {}
      });
      const findingsPath = join4(work, "deep-spec-verify", `${backend}.json`);
      let doc = null;
      try {
        doc = JSON.parse(readFileSync5(findingsPath, "utf-8"));
      } catch {
        doc = null;
      }
      const note = res.error ? String(res.error) : (res.stdout ?? "").trim().split(`
`).pop() ?? "";
      return { exit: res.status, doc, note };
    } finally {
      rmSync3(work, { recursive: true, force: true });
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
  return ok(DesignReport.of({
    id: DesignReportIdentifier.of(directory, doc.backend.asString()),
    irVersion: doc.irVersion,
    irHash: doc.irHash,
    method: doc.method,
    findings: DesignFindings.of(findings),
    skipped: DesignSkips.of(skipped),
    inputs: doc.inputs === undefined ? null : DesignInputAnchors.of(doc.inputs.map((entry) => DesignInputAnchor.of({ artifact: entry.artifact.asString(), sha256: entry.sha256 }))),
    checked: checked.value === undefined ? null : CheckedUnits.of(checked.value),
    crossChecked: doc.crossChecked === undefined ? null : DesignCrossCheckedEntries.of(doc.crossChecked.map(DesignCrossCheckedEntry.of)),
    unavailableReason: doc.unavailable?.reason ?? null
  }));
}
// src/design/adapter/design-verify-directory-repository-implementation.ts
import { existsSync as existsSync4, mkdirSync as mkdirSync3, readFileSync as readFileSync6, readdirSync, renameSync as renameSync3, rmSync as rmSync4 } from "fs";
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
    const crossPath = join5(directory.asString(), CROSS_CHECK_BASENAME);
    if (!existsSync4(crossPath)) {
      return ok(DesignVerifyDirectory.of(directory, DesignReports.of(siblings.value), null));
    }
    const crossCheck = this.#readReport(directory, CROSS_CHECK_BASENAME);
    return ok(DesignVerifyDirectory.of(directory, DesignReports.of(siblings.value), crossCheck.ok ? crossCheck.value : null));
  }
  store(aggregate) {
    const directory = aggregate.directory();
    const directoryPath = directory.asString();
    const candidate = aggregate.candidate();
    if (candidate === null) {
      return err({ kind: "io-failed", operation: "write", path: directoryPath, cause: "no finalization candidate" });
    }
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
    const backendBytes = renderDesignReportBytes(candidate);
    const crossBytes = crossCheck === null ? null : renderDesignReportBytes(crossCheck);
    if (!this.#lock.holdsOwnership(directory))
      return this.#fenced(directory, crossPath);
    if (existsSync4(crossPath)) {
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
      rmSync4(stalePath, { force: true });
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
    if (!existsSync4(directory.asString()))
      return ok([]);
    let entries;
    try {
      entries = readdirSync(directory.asString()).filter((f) => f.endsWith(".json") && f !== CROSS_CHECK_BASENAME).sort();
    } catch (e) {
      return err({ kind: "io-failed", operation: "read", path: directory.asString(), cause: causeOf2(e) });
    }
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
    let raw;
    try {
      raw = JSON.parse(readFileSync6(path, "utf-8"));
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
// src/design/adapter/refinement-query-plan.ts
class SatisfiabilityModuloTheoriesCompileError extends Error {
  constructor(message) {
    super(message);
  }
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
  if (!attr || attr.kind !== "enum" || !attr.values)
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
      constraints.push({ name: `${primed ? "typ" : "ty"}_${attr.path.replace(/\./g, "_")}`, smt: `(and (>= ${v} 0) (<= ${v} ${attr.values.length - 1}))` });
    } else if (attr.kind === "int" && (attr.min !== undefined || attr.max !== undefined)) {
      const parts = [];
      if (attr.min !== undefined)
        parts.push(`(>= ${v} ${smtLit(attr.min)})`);
      if (attr.max !== undefined)
        parts.push(`(<= ${v} ${smtLit(attr.max)})`);
      constraints.push({ name: `${primed ? "typ" : "ty"}_${attr.path.replace(/\./g, "_")}`, smt: parts.length === 1 ? parts[0] : `(and ${parts.join(" ")})` });
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
  const out = {};
  for (const attr of [...ctx.attrs].sort((a, b) => a.path < b.path ? -1 : 1)) {
    const raw = model[smtVar(attr.path, primed)];
    if (raw === undefined)
      continue;
    if (attr.kind === "bool")
      out[attr.path] = raw === "true";
    else {
      const n = smtIntOf(raw);
      if (!Number.isSafeInteger(n)) {
        const m = raw.match(/^\(-\s*(\d+)\)$/);
        out[attr.path] = m ? `-${m[1]}` : raw;
      } else if (attr.kind === "enum" && attr.values)
        out[attr.path] = attr.values[n] ?? n;
      else
        out[attr.path] = n;
    }
  }
  return out;
}
function buildRefinementQueries(u, req, plan) {
  const ctx = refinementSmtContext(u);
  const pre = designBase(ctx, u, false);
  const post = designBase(ctx, u, true);
  const modelVars = ctx.attrs.map((a) => ({ name: smtVar(a.path, false), sort: a.kind === "bool" ? "Bool" : "Int" }));
  const modelVarsBoth = [...modelVars, ...ctx.attrs.map((a) => ({ name: smtVar(a.path, true), sort: a.kind === "bool" ? "Bool" : "Int" }))];
  const catalog = DesignEventCatalog.of(u);
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
        pending.set(q.id, RefinementProbe.invariant(ObligationIdentifier.of(obId)));
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
      const alphaG = mappings.substitute(event.guard, false);
      if (!alphaG.ok) {
        alphaFail(obId, alphaG.error.message());
        continue;
      }
      try {
        const designGuards = mapped.map((id) => catalog.eventOf(TargetIdentifier.of(id.asString()))).filter((d) => d !== null).map((d) => smtOfExpr(ctx, d.guard()));
        const notEnabled = designGuards.length === 0 ? "true" : `(not (or ${designGuards.join(" ")}))`;
        const qe = assembleQuery(`re:${obId}`, pre.decls, [
          ...pre.constraints,
          { name: smtName("ag", obId), smt: smtOfExpr(ctx, alphaG.value) },
          { name: smtName("ne", obId), smt: notEnabled }
        ], modelVars);
        queries.push(qe);
        pending.set(qe.id, RefinementProbe.enabledness(ObligationIdentifier.of(obId)));
        const decomposed = EffectAssignments.parse(event.effect);
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
          if (eq !== null)
            frameParts.push(smtOfExpr(ctx, eq));
        }
        const alphaF = mappings.substitute(event.effect, false);
        if (!alphaF.ok) {
          alphaFail(obId, alphaF.error.message());
          continue;
        }
        const fBar = smtOfExpr(ctx, alphaF.value);
        const postCond = frameParts.length === 0 ? fBar : `(and ${fBar} ${frameParts.join(" ")})`;
        for (const designId of mapped) {
          const ev = catalog.eventOf(TargetIdentifier.of(designId.asString()));
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
          pending.set(qs.id, RefinementProbe.simulation(ObligationIdentifier.of(obId), designId));
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
      const q = assembleQuery(`rs:${scId}`, pre.decls, [...pre.constraints, { name: smtName("sc", scId), smt: parts.length === 1 ? parts[0] : `(and ${parts.join(" ")})` }], modelVars);
      queries.push(q);
      pending.set(q.id, RefinementProbe.scenario(ScenarioIdentifier.of(scId)));
    } catch (err2) {
      if (!(err2 instanceof SatisfiabilityModuloTheoriesCompileError))
        throw err2;
      alphaFail(scId, failureMessage(err2));
    }
  }
  return {
    queries,
    plan: RefinementSolverPlan.of({ pending: KeyedIndex.of([...pending].map(([id, probe]) => [QueryLabel.of(id), probe])), compileSkips: DesignSkips.of(compileSkips) }),
    context: ctx
  };
}
// src/design/adapter/refinement-materials-repository-implementation.ts
import { readFileSync as readFileSync7 } from "fs";
import { dirname as dirname3, join as join6 } from "path";
var REFINEMENT_MAP_BASENAME = "deep-spec-analysis-refinement-map.md";
var REQUIREMENTS_MODEL_RELPATH = ["inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md"];
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
    const recordRoot = findRecordRoot(dirname3(modelPath));
    if (recordRoot === null)
      return ok(RefinementMaterials.inactive(id));
    const requirements = this.#loadRequirements(recordRoot);
    if (!requirements.ok) {
      return requirements.error.kind === "not-found" ? ok(RefinementMaterials.inactive(id)) : err(requirements.error);
    }
    const map = this.#loadMap(recordRoot, dirname3(modelPath), modelPath, requirements.value.bytes);
    if (!map.ok)
      return err(map.error);
    return ok(RefinementMaterials.active(id, requirements.value.model, map.value));
  }
  #read(path) {
    try {
      return ok(new Uint8Array(readFileSync7(path)));
    } catch (e) {
      if (e.code === "ENOENT")
        return err({ kind: "not-found", path });
      return err({ kind: "io-failed", operation: "read", path, cause: e instanceof Error ? e.message : String(e) });
    }
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
      return err({ kind: "corrupt", path, cause: "requirements model lacks its version, schema, obligations or scenarios" });
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
        bindings: decodeScenarioBindings(sc.bindings),
        frRefs: flatMapResult(traverseResult(strArr(sc.frRefs), RequirementIdentifier.parse), FunctionalRequirementReferences.parse),
        trigger: isObject(sc.event) && typeof sc.event.trigger === "string" ? TriggerName.parse(sc.event.trigger) : ok(undefined)
      });
      if (!parsed.ok)
        return err({ kind: "corrupt", path, cause: JSON.stringify(parsed.error) });
      scenarios.push(RefinementScenario.of({
        id: parsed.value.id,
        kind: sc.kind,
        functionalRequirementReferences: parsed.value.frRefs,
        bindings: parsed.value.bindings,
        event: parsed.value.trigger === undefined ? undefined : { trigger: parsed.value.trigger }
      }));
    }
    const model = RefinementRequirements.of({
      id: FormalModelIdentifier.of(ArtifactPath.of(path)),
      hash: ContentHash.ofText(canonicalStringify(raw)),
      attributes: RefinementAttributes.of(attributes),
      obligations: RefinementObligations.of(obligations),
      scenarios: RefinementScenarios.of(scenarios)
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
      DesignInputAnchor.of({ artifact: relArtifact(recordRoot, modelPath), sha256: ContentHash.ofText(Buffer.from(modelBytes.value).toString("utf-8")) }),
      DesignInputAnchor.of({ artifact: mapArtifact, sha256: ContentHash.ofText(Buffer.from(bytes.value).toString("utf-8")) }),
      DesignInputAnchor.of({ artifact: relArtifact(recordRoot, reqModelPath), sha256: ContentHash.ofText(Buffer.from(requirementsBytes).toString("utf-8")) })
    ];
    return ok(RefinementMapAcquisition.loaded(parsed.map, ArtifactPath.of(mapArtifact), inputs));
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
    return { kind: "malformed", error: `refinement map fence is not valid JSON: ${err2 instanceof Error ? err2.message : String(err2)}` };
  }
  try {
    const schemaDoc = JSON.parse(readFileSync7(mapSchemaPath, "utf-8"));
    const errors = [];
    validateSchema(schemaDoc, schemaDoc, raw, "", errors);
    if (errors.length > 0)
      return { kind: "malformed", error: `refinement map does not conform to contract 4: ${errors[0]}` };
  } catch (err2) {
    return { kind: "malformed", error: `refinement map schema unreadable: ${err2 instanceof Error ? err2.message : String(err2)}` };
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
        mapping = AttributeMapping.parse(req.value, { kind: "enum-cases", from: from.value, cases: m.enumMap.cases });
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
        transitions: traverseResult(strArr(e.transitions), TransitionReference.parse)
      });
      if (!parsed.ok)
        return { kind: "malformed", error: JSON.stringify(parsed.error) };
      eventMap.push(EventMapping.of({
        reqTrigger: parsed.value.reqTrigger,
        transitions: TransitionReferences.of(parsed.value.transitions),
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
    units.push(RefinementUnitMap.of({
      unit: unit.value,
      attrMap: AttributeMappings.of(attrMap),
      eventMap: EventMappings.of(eventMap),
      unmapped: UnmappedDeclarations.of(unmapped)
    }));
  }
  const hashes = combineResults({
    requirements: ContentHash.parse(typeof doc.requirementsIrHash === "string" ? doc.requirementsIrHash : ""),
    design: ContentHash.parse(typeof doc.designIrHash === "string" ? doc.designIrHash : "")
  });
  if (!hashes.ok)
    return { kind: "malformed", error: JSON.stringify(hashes.error) };
  return {
    kind: "parsed",
    map: RefinementMap.of({
      id,
      requirementsIrHash: hashes.value.requirements,
      designIrHash: hashes.value.design,
      units: RefinementUnitMaps.of(units),
      sourceDocument: bytes
    })
  };
}
// src/design/adapter/refinement-solver-client-implementation.ts
import { spawnSync as spawnSync2 } from "child_process";
class RefinementSolverClientImplementation {
  #config;
  constructor(config) {
    this.#config = config;
  }
  check(unit, requirements, plan, budgetMs) {
    const built = buildRefinementQueries(unit, requirements, plan);
    if (built.queries.length === 0) {
      return { plan: built.plan, result: { kind: "no-queries" } };
    }
    const child = this.#runChild(built.queries, budgetMs);
    if (child.results === null) {
      return { plan: built.plan, result: { kind: "unavailable", reason: child.unavailable ?? "z3 unavailable" } };
    }
    const verdicts = [];
    for (const [queryId, r] of child.results) {
      const parsed = combineResults({
        label: QueryLabel.parse(queryId),
        core: r.core === undefined ? ok(undefined) : traverseResult(r.core, QueryLabel.parse)
      });
      if (!parsed.ok)
        return { plan: built.plan, result: { kind: "unavailable", reason: `invalid solver query label: ${JSON.stringify(parsed.error)}` } };
      verdicts.push([parsed.value.label, RefinementQueryVerdict.of({
        status: r.status,
        decodedModel: r.status === "sat" ? decodeDesignModel(built.context, r.model ?? {}, false) : undefined,
        decodedPostModel: r.status === "sat" ? decodeDesignModel(built.context, r.model ?? {}, true) : undefined,
        core: parsed.value.core?.map((label) => label.asString())
      })]);
    }
    return { plan: built.plan, result: { kind: "solved", verdicts: RefinementQueryVerdicts.of(KeyedIndex.of(verdicts)) } };
  }
  #runChild(queries, budgetMs) {
    const payload = JSON.stringify({ queries, timeoutMs: this.#config.perQueryTimeoutMs, budgetMs });
    const runtimes = this.#config.runtimeOverride ? [this.#config.runtimeOverride] : ["node", "bun"];
    const attempts = [];
    for (const runtime of runtimes) {
      const res = spawnSync2(runtime, [this.#config.childHostPath, "--smt-child"], {
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
      try {
        const parsed = JSON.parse((res.stdout ?? "").trim().split(`
`).pop() ?? "");
        if (typeof parsed.unavailable === "string")
          return { results: null, unavailable: parsed.unavailable };
        const map = new Map;
        for (const r of parsed.results ?? [])
          map.set(r.id, r);
        return { results: map, unavailable: null };
      } catch {
        attempts.push(`${runtime}: solver child produced unreadable output`);
      }
    }
    return { results: null, unavailable: `no runtime could execute the z3 child process (${attempts.join("; ")})` };
  }
}
// src/design/adapter/design-intermediate-representation-validation-materials-repository-implementation.ts
import { existsSync as existsSync5, readFileSync as readFileSync8 } from "fs";
import { basename as basename2, dirname as dirname4, join as join7 } from "path";
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
function buildUnitView(rawUnit, unitName, recordRoot) {
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
    stateMachines.push(DesignMachineDeclaration.of({ id: id.value, attrPath, initial: states.value, transitions: DesignTransitionDeclarations.of(transitions), ignores: DesignIgnoreDeclarations.of(ignores) }));
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
  const directoryExists = recordRoot === null ? true : existsSync5(join7(recordRoot, "construction", unitName));
  const rulesPath = recordRoot === null ? null : join7(recordRoot, "construction", unitName, "functional-design", "rules.md");
  const rulesMarkdown = rulesPath === null ? null : readIfExists(rulesPath);
  const targets = traverseResult(unformalizedTargets, TargetIdentifier.parse);
  if (!targets.ok)
    return err(JSON.stringify(targets.error));
  return ok(DesignUnitDeclaration.of({
    unit: unit.value,
    entities: entities.value,
    obligations: DesignObligationDeclarations.of(obligations),
    stateMachines: DesignMachineDeclarations.of(stateMachines),
    scenarios: DesignScenarioDeclarations.of(scenarios),
    background: DesignBackgroundDeclarations.of(background),
    unformalizedTargets: UnformalizedTargets.of(targets.value),
    directoryExists,
    rulesMarkdown
  }));
}

class DesignIntermediateRepresentationValidationMaterialsRepositoryImplementation {
  #schemaPath;
  constructor(config) {
    this.#schemaPath = config.schemaPath;
  }
  findById(id) {
    const outputPath = id.modelId().artifactPath().asString();
    if (basename2(outputPath) !== DESIGN_MODEL_BASENAME || !existsSync5(outputPath)) {
      return err({ kind: "not-found", path: outputPath });
    }
    const corrupt = (cause) => err({ kind: "corrupt", path: outputPath, cause });
    let bytes;
    try {
      bytes = readFileSync8(outputPath);
    } catch (e) {
      return err({ kind: "io-failed", operation: "read", path: outputPath, cause: e instanceof Error ? e.message : String(e) });
    }
    const md = bytes.toString("utf-8");
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
    if (!existsSync5(this.#schemaPath)) {
      return corrupt(`design IR schema not installed at ${this.#schemaPath} \u2014 run plugin sync`);
    }
    const schema = readContractSchema(this.#schemaPath);
    if (!schema.ok) {
      return corrupt(`design IR schema unreadable: ${schema.error.cause}`);
    }
    const schemaErrors = [];
    validateSchema(schema.value, schema.value, ir, "", schemaErrors);
    const messages = flatMapResult(traverseResult(schemaErrors, ErrorMessage.parse), ErrorMessages.parse);
    if (!messages.ok)
      return corrupt(JSON.stringify(messages.error));
    const irVersion = IntermediateRepresentationVersion.parse(typeof ir.irVersion === "string" ? ir.irVersion : "");
    if (!irVersion.ok)
      return corrupt(JSON.stringify(irVersion.error));
    const major = irVersion.value.majorVersion();
    const semanticGateOpen = schemaErrors.length === 0 && !(Number.isInteger(major) && major !== SUPPORTED_DESIGN_IR_MAJOR);
    const units = [];
    if (semanticGateOpen) {
      const recordRoot = findRecordRoot(dirname4(outputPath));
      for (const rawUnit of Array.isArray(ir.units) ? ir.units : []) {
        if (!isObject(rawUnit) || typeof rawUnit.unit !== "string")
          continue;
        const parsed = buildUnitView(rawUnit, rawUnit.unit, recordRoot);
        if (!parsed.ok)
          return corrupt(parsed.error);
        units.push(parsed.value);
      }
    }
    return ok(DesignIntermediateRepresentationValidationMaterials.of({
      id,
      irVersion: irVersion.value,
      schemaErrors: messages.value,
      units: DesignUnitDeclarations.of(units),
      sourceDocument: new Uint8Array(bytes)
    }));
  }
  store(materials) {
    const outputPath = materials.id().modelId().artifactPath().asString();
    const bytes = materials.sourceDocument();
    try {
      writeFileAtomically(outputPath, bytes);
      return ok(undefined);
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path: outputPath, cause: e instanceof Error ? e.message : String(e) });
    }
  }
}
// src/design/adapter/refinement-map-repository-implementation.ts
import { existsSync as existsSync6, readFileSync as readFileSync9 } from "fs";
class RefinementMapRepositoryImplementation {
  #mapSchemaPath;
  constructor(mapSchemaPath) {
    this.#mapSchemaPath = mapSchemaPath;
  }
  findById(id) {
    const path = id.artifactPath().asString();
    if (!existsSync6(path))
      return err({ kind: "not-found", path });
    let bytes;
    try {
      bytes = readFileSync9(path);
    } catch (e) {
      return err({ kind: "io-failed", operation: "read", path, cause: e instanceof Error ? e.message : String(e) });
    }
    const parsed = parseRefinementMapDocument(new Uint8Array(bytes), id, this.#mapSchemaPath);
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
// src/entries/aidlc-sensor-deep-spec-design-verify-smt.ts
var DESIGN_MODEL_BASENAME2 = "deep-spec-analysis-functional-formal-model.md";
var DESIGN_VERIFY_DIRNAME = "deep-spec-design-verify";
function main() {
  const flags = parseFlags(process.argv.slice(2));
  const target = ArtifactPath.parse(flags.outputPath);
  const reportLocation = ArtifactPath.parse(join8(dirname5(flags.outputPath), DESIGN_VERIFY_DIRNAME));
  if (!target.ok || !reportLocation.ok) {
    process.stderr.write(`deep-spec-design-verify-smt: --output-path is required
`);
    process.exit(1);
  }
  if (basename3(flags.outputPath) !== DESIGN_MODEL_BASENAME2) {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "not-applicable" })}
`);
    process.exit(0);
  }
  const toolsDir = dirname5(fileURLToPath(import.meta.url));
  const findingsSchema = readFindingsSchema(join8(toolsDir, "data", "deep-spec-findings-schema.json"));
  const useCase = new VerifyDesignSatisfiabilityModuloTheoriesUseCase(new DesignModelRepositoryImplementation, new DesignVerifyDirectoryRepositoryImplementation(new DirectoryFinalizationLock(new SystemClock, {
    self: () => process.pid,
    statusOf: (pid) => {
      try {
        process.kill(pid, 0);
        return "alive";
      } catch (e) {
        const code = e.code;
        if (code === "ESRCH")
          return "absent";
        if (code === "EPERM")
          return "alive";
        return "unknown";
      }
    }
  })), findingsSchema, new SiblingBackendClientImplementation({
    siblingToolPaths: {
      smt: join8(toolsDir, "aidlc-sensor-deep-spec-verify-smt.ts"),
      quint: join8(toolsDir, "aidlc-sensor-deep-spec-verify-quint.ts")
    },
    workingDirectory: process.cwd()
  }), new RefinementMaterialsRepositoryImplementation(join8(toolsDir, "data", "deep-spec-refinement-map-schema.json")), new RefinementSolverClientImplementation({
    childHostPath: join8(toolsDir, "aidlc-sensor-deep-spec-verify-smt.ts"),
    perQueryTimeoutMs: Number(process.env.AIDLC_DEEP_SPEC_SMT_TIMEOUT_MS) || 2000,
    runtimeOverride: process.env.AIDLC_DEEP_SPEC_SMT_RUNTIME,
    workingDirectory: process.cwd()
  }), new SystemClock);
  const outcome = useCase.execute({
    modelId: DesignModelIdentifier.of(target.value),
    verifyDirectory: reportLocation.value
  });
  switch (outcome.kind) {
    case "not-applicable":
      process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "not-applicable" })}
`);
      process.exit(0);
      break;
    case "model-unreadable":
      process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "ir-unreadable" })}
`);
      process.exit(0);
      break;
    case "version-mismatch":
      process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: outcome.skippedCount, note: "ir-version-mismatch" })}
`);
      process.exit(0);
      break;
    case "backend-unavailable":
      process.exit(127);
      break;
    case "acquisition-failed":
    case "save-failed":
      process.stderr.write(`deep-spec-design-verify-smt: ${outcome.error.path}: ${outcome.error.kind}${"cause" in outcome.error ? ` (${outcome.error.cause})` : ""}
`);
      process.exit(1);
      break;
    case "verified":
      process.stdout.write(`${JSON.stringify({ pass: outcome.pass, findings_count: outcome.findingsCount, skipped_count: outcome.skippedCount, method: outcome.method })}
`);
      process.exit(0);
      break;
  }
}
main();
