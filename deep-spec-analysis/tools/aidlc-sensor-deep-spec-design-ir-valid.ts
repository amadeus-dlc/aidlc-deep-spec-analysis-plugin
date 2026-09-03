// @bun
// src/entries/aidlc-sensor-deep-spec-design-ir-valid.ts
import { dirname as dirname5, join as join7 } from "path";
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
// src/kernel/adapter/contract-schema.ts
function readContractSchema(path) {
  try {
    return ok(JSON.parse(readFileSync2(path, "utf-8")));
  } catch (e) {
    return err({ cause: e instanceof Error ? e.message : String(e) });
  }
}
// src/kernel/adapter/json.ts
function isObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
var strArr = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
// src/kernel/adapter/canonical-json.ts
function canonicalStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  if (isObject(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(value[k] ?? null)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
// src/kernel/adapter/schema.ts
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
// src/kernel/domain/expression-tree.ts
function canonicalKeyOf(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalKeyOf).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const record = value;
    const keys = Object.keys(record).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalKeyOf(record[k] ?? null)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

class ExpressionTree {
  #root;
  constructor(root) {
    this.#root = root;
  }
  static of(root) {
    return new ExpressionTree(root);
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
    return canonicalKeyOf(this.#root) === canonicalKeyOf(other.#root);
  }
}
// src/kernel/domain/content-hash.ts
import { createHash } from "crypto";
class ContentHash {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (!/^[0-9a-f]{64}$/.test(raw))
      return err({ kind: "not-a-sha256-hex", raw });
    return ok(new ContentHash(raw));
  }
  static reconstitute(raw) {
    return new ContentHash(raw);
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
// src/kernel/domain/ir-version.ts
class IrVersion {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (!/^\d+\.\d+\.\d+$/.test(raw))
      return err({ kind: "not-a-semver", raw });
    return ok(new IrVersion(raw));
  }
  static reconstitute(raw) {
    return new IrVersion(raw);
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
// src/kernel/domain/canonical-order.ts
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

// src/kernel/domain/target-id.ts
var TARGET_ID_PATTERNS = [
  /^(OB|SC)-[0-9]+$/,
  /^BR[0-9]+\.[0-9]+$/,
  /^(DOB|DSC|DBG|SM|TR)-[0-9]+$/,
  /^(component|entity|attr|unit|contract|state|check):[A-Za-z0-9_./-]+$/
];

class TargetId {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (!TARGET_ID_PATTERNS.some((pattern) => pattern.test(raw)))
      return err({ kind: "malformed-target-id", raw });
    return ok(new TargetId(raw));
  }
  static reconstitute(raw) {
    return new TargetId(raw);
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
// src/kernel/domain/target-ids.ts
class TargetIds {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new TargetIds([...values]);
  }
  static reconstitute(values) {
    return new TargetIds(values.map((v) => TargetId.reconstitute(v)));
  }
  static safe(prefix, raw) {
    const token = raw.replace(/[^A-Za-z0-9_./-]/g, "-");
    return `${prefix}:${token === "" ? "unknown" : token}`;
  }
  add(value) {
    return new TargetIds([...this.#values, value]);
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
    return new TargetIds(this.#values.filter((v) => !v.equals(value)));
  }
  sortedCanonically() {
    return new TargetIds([...this.#values].sort((a, b) => a.compareTo(b)));
  }
  sortedUniqueCanonically() {
    return TargetIds.reconstitute(sortedUniqueCanonically(this.toStrings()));
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
// src/kernel/domain/requirement-id.ts
class RequirementId {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static reconstitute(raw) {
    return new RequirementId(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  compareTo(other) {
    return TargetId.reconstitute(this.#value).compareTo(TargetId.reconstitute(other.#value));
  }
  asString() {
    return this.#value;
  }
}

// src/kernel/domain/fr-refs.ts
class FrRefs {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new FrRefs([...values]);
  }
  static reconstitute(raws) {
    return new FrRefs(raws.map((raw) => RequirementId.reconstitute(raw)));
  }
  add(value) {
    return new FrRefs([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  isEmpty() {
    return this.#values.length === 0;
  }
  sortedUnique() {
    return FrRefs.reconstitute(sortedUniqueCanonically(this.toStrings()));
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
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (raw === "")
      return err({ kind: "empty-backend-name", raw });
    return ok(new BackendName(raw));
  }
  static reconstitute(raw) {
    return new BackendName(raw);
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

// src/kernel/domain/requirement-ids.ts
class RequirementIds {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static extractFrom(text) {
    const ids = [];
    for (const m of text.matchAll(/\b(?:FR|NFR)-?[0-9]+(?:\.[0-9]+)*\b/g)) {
      ids.push(RequirementId.reconstitute(m[0]));
    }
    return new RequirementIds(KeySet.of(ids));
  }
  static of(values) {
    return new RequirementIds(KeySet.of(values));
  }
  static reconstitute(raws) {
    return new RequirementIds(KeySet.of(raws.map((raw) => RequirementId.reconstitute(raw))));
  }
  add(value) {
    return new RequirementIds(this.#values.with(value));
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
    this.#value = value;
  }
  static of(raw) {
    return new NormalizedName(raw.toLowerCase().replace(/[^a-z0-9]/g, ""));
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
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (raw === "")
      return err({ kind: "empty-path" });
    return ok(new ArtifactPath(raw));
  }
  static reconstitute(raw) {
    return new ArtifactPath(raw);
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
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (!Number.isInteger(raw))
      return err({ kind: "non-integer-bound", raw });
    if (!Number.isSafeInteger(raw))
      return err({ kind: "unsafe-bound", raw });
    return ok(new AttributeBound(raw));
  }
  static reconstitute(raw) {
    return new AttributeBound(raw);
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
// src/kernel/domain/error-messages.ts
class ErrorMessages {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new ErrorMessages([...values]);
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
// src/kernel/domain/trigger-name.ts
class TriggerName {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (raw === "")
      return err({ kind: "empty-trigger-name", raw });
    return ok(new TriggerName(raw));
  }
  static reconstitute(raw) {
    return new TriggerName(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
  isEmpty() {
    return this.#value === "";
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
    this.#value = value;
  }
  static reconstitute(raw) {
    return new QueryLabel(raw);
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
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (raw === "")
      return err({ kind: "empty-attribute-path", raw });
    return ok(new AttributePath(raw));
  }
  static reconstitute(raw) {
    return new AttributePath(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  compareTo(other) {
    return TargetId.reconstitute(this.#value).compareTo(TargetId.reconstitute(other.#value));
  }
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/unit-name.ts
class UnitName {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (raw === "")
      return err({ kind: "empty-unit-name", raw });
    return ok(new UnitName(raw));
  }
  static reconstitute(raw) {
    return new UnitName(raw);
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
    this.#value = value;
  }
  static reconstitute(raw) {
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
function rankOf(kind) {
  return Object.hasOwn(KIND_RANK, kind) ? KIND_RANK[kind] : 99;
}

class FindingKind {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (!Object.hasOwn(KIND_RANK, raw))
      return err({ kind: "unknown-finding-kind", raw });
    return ok(new FindingKind(raw));
  }
  static reconstitute(raw) {
    return new FindingKind(raw);
  }
  static canonicalOrder() {
    return Object.keys(KIND_RANK);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  compareTo(other) {
    return rankOf(this.#value) - rankOf(other.#value);
  }
  isConflict() {
    return this.#value === "conflict";
  }
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/verification-method.ts
class VerificationMethod {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static reconstitute(raw) {
    return new VerificationMethod(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/attribute-kind.ts
class AttributeKind {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static reconstitute(raw) {
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
// src/design/domain/design-witness.ts
class DesignWitness {
  #document;
  constructor(document) {
    this.#document = document;
  }
  static core(labels) {
    return new DesignWitness({ core: [...labels] });
  }
  static model(values) {
    return new DesignWitness({ model: { ...values } });
  }
  static verdicts(byBackend) {
    return new DesignWitness({ verdicts: { ...byBackend } });
  }
  static trace(states) {
    return new DesignWitness({ trace: states.map((state) => ({ ...state })) });
  }
  static refs(entries) {
    return new DesignWitness({ refs: entries.map((entry) => ({ artifact: entry.artifact, element: entry.element })) });
  }
  static fromDocument(raw) {
    return new DesignWitness(raw ?? null);
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
  toDocument() {
    return this.#document;
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
  #brRefs;
  constructor(props) {
    this.#id = props.id;
    this.#from = props.from;
    this.#to = props.to;
    this.#trigger = props.trigger;
    this.#guard = props.guard;
    this.#effect = props.effect;
    this.#brRefs = props.brRefs;
  }
  static reconstitute(props) {
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
  brRefs() {
    return this.#brRefs;
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
  stateAssignment(attrPath) {
    return [attrPath, { op: "enum", value: this.#to }];
  }
}
// src/design/domain/design-transition-id.ts
class DesignTransitionId {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (raw === "")
      return err({ kind: "empty-design-transition-id", raw });
    return ok(new DesignTransitionId(raw));
  }
  static reconstitute(raw) {
    return new DesignTransitionId(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  compareTo(other) {
    return TargetId.reconstitute(this.#value).compareTo(TargetId.reconstitute(other.#value));
  }
  asString() {
    return this.#value;
  }
}
// src/design/domain/design-transitions.ts
class DesignTransitions {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new DesignTransitions([...values]);
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
  static reconstitute(props) {
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
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (raw === "")
      return err({ kind: "empty-machine-token", raw });
    return ok(new DesignAttributeName(raw));
  }
  static reconstitute(raw) {
    return new DesignAttributeName(raw);
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
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (raw === "")
      return err({ kind: "empty-machine-token", raw });
    return ok(new DesignEntityName(raw));
  }
  static reconstitute(raw) {
    return new DesignEntityName(raw);
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
  static reconstitute(props) {
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
}
// src/design/domain/design-ignores.ts
class DesignIgnores {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new DesignIgnores([...values]);
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
// src/design/domain/design-machine-id.ts
class DesignMachineId {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (raw === "")
      return err({ kind: "empty-machine-token", raw });
    return ok(new DesignMachineId(raw));
  }
  static reconstitute(raw) {
    return new DesignMachineId(raw);
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
    return TargetId.reconstitute(this.#value);
  }
}
// src/design/domain/design-machines.ts
class DesignMachines {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new DesignMachines([...values]);
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
  #brRefs;
  #frRefs;
  #assert;
  #trigger;
  #guard;
  #effect;
  #temporal;
  constructor(props) {
    this.#id = props.id;
    this.#nature = props.nature;
    this.#origin = props.origin;
    this.#brRefs = props.brRefs;
    this.#frRefs = props.frRefs;
    this.#assert = props.assert;
    this.#trigger = props.trigger;
    this.#guard = props.guard;
    this.#effect = props.effect;
    this.#temporal = props.temporal === undefined ? undefined : { ...props.temporal };
  }
  static reconstitute(props) {
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
  brRefs() {
    return this.#brRefs;
  }
  frRefs() {
    return this.#frRefs;
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
    if (behavior === null || this.#trigger === undefined || this.#trigger.isEmpty())
      return null;
    return { trigger: this.#trigger, ...behavior };
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
// src/design/domain/design-obligation-id.ts
class DesignObligationId {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (raw === "")
      return err({ kind: "empty-design-obligation-id", raw });
    return ok(new DesignObligationId(raw));
  }
  static reconstitute(raw) {
    return new DesignObligationId(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  compareTo(other) {
    return TargetId.reconstitute(this.#value).compareTo(TargetId.reconstitute(other.#value));
  }
  asString() {
    return this.#value;
  }
}
// src/design/domain/design-obligation-nature.ts
class DesignObligationNature {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static reconstitute(raw) {
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
    this.#value = value;
  }
  static reconstitute(raw) {
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
    this.#values = values;
  }
  static of(values) {
    return new DesignObligations([...values]);
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
// src/design/domain/design-scenario.ts
class DesignScenario {
  #id;
  #kind;
  #brRefs;
  #frRefs;
  #bindings;
  #eventTrigger;
  #expect;
  constructor(props) {
    this.#id = props.id;
    this.#kind = props.kind;
    this.#brRefs = props.brRefs;
    this.#frRefs = props.frRefs;
    this.#bindings = { ...props.bindings };
    this.#eventTrigger = props.event?.trigger;
    this.#expect = props.expect;
  }
  static reconstitute(props) {
    return new DesignScenario(props);
  }
  id() {
    return this.#id;
  }
  kind() {
    return this.#kind;
  }
  brRefs() {
    return this.#brRefs;
  }
  frRefs() {
    return this.#frRefs;
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
  bindingEntriesCanonically() {
    return Object.entries(this.#bindings).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  }
  bindings() {
    return { ...this.#bindings };
  }
}
// src/design/domain/design-scenario-id.ts
class DesignScenarioId {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (raw === "")
      return err({ kind: "empty-design-scenario-id", raw });
    return ok(new DesignScenarioId(raw));
  }
  static reconstitute(raw) {
    return new DesignScenarioId(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  compareTo(other) {
    return TargetId.reconstitute(this.#value).compareTo(TargetId.reconstitute(other.#value));
  }
  asString() {
    return this.#value;
  }
}
// src/design/domain/design-scenarios.ts
class DesignScenarios {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new DesignScenarios([...values]);
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
// src/design/domain/design-unit-id.ts
class DesignUnitId {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static of(value) {
    return new DesignUnitId(value);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
}

// src/design/domain/attr-paths.ts
class AttrPaths {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new AttrPaths(new Set(values));
  }
  add(value) {
    return new AttrPaths(new Set([...this.#values, value]));
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
    this.#unit = UnitName.reconstitute(seed.unit);
    this.#entities = seed.entities;
    const coordinates = new Set;
    for (const ent of seed.entities) {
      for (const attr of ent.attributes())
        coordinates.add(`${ent.name().asString()}.${attr.name().asString()}`);
    }
    this.#attrPaths = AttrPaths.of([...coordinates]);
    this.#obligations = seed.obligations;
    this.#machines = seed.machines;
    this.#scenarios = seed.scenarios;
    this.#background = seed.background;
  }
  static reconstitute(seed) {
    return new DesignUnit(seed);
  }
  id() {
    return DesignUnitId.of(this.#unit.asString());
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
    return TargetIds.reconstitute([...this.#obligations.ids(), ...this.#machines.transitionIds(), ...this.#scenarios.ids()]).sortedUniqueCanonically();
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
    return values === null ? null : [...values.toArray()];
  }
  enumValuesOf(attrPath) {
    return this.declaredEnumValuesOf(attrPath) ?? [];
  }
}
// src/design/domain/design-background-assumption.ts
class DesignBackgroundAssumption {
  #id;
  #assert;
  constructor(id, assert) {
    this.#id = id;
    this.#assert = assert;
  }
  static reconstitute(props) {
    return new DesignBackgroundAssumption(props.id, props.assert);
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
}
// src/design/domain/design-background-assumptions.ts
class DesignBackgroundAssumptions {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new DesignBackgroundAssumptions([...values]);
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
// src/design/domain/design-background-id.ts
class DesignBackgroundId {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (raw === "")
      return err({ kind: "empty-design-background-id", raw });
    return ok(new DesignBackgroundId(raw));
  }
  static reconstitute(raw) {
    return new DesignBackgroundId(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  compareTo(other) {
    return TargetId.reconstitute(this.#value).compareTo(TargetId.reconstitute(other.#value));
  }
  asString() {
    return this.#value;
  }
}
// src/design/domain/design-units.ts
class DesignUnits {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new DesignUnits([...values]);
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
  #frRefs;
  #targets;
  #witness;
  #unit;
  #detail;
  constructor(props) {
    this.#kind = FindingKind.reconstitute(props.kind);
    this.#frRefs = props.frRefs;
    this.#targets = props.targets;
    this.#witness = props.witness;
    this.#unit = UnitName.reconstitute(props.unit);
    this.#detail = props.detail;
  }
  static reconstitute(props) {
    return new DesignFinding(props);
  }
  kind() {
    return this.#kind.asString();
  }
  frRefs() {
    return this.#frRefs;
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
      kind: "refinement-violation",
      frRefs: this.#frRefs,
      targets: TargetIds.of(reqHits),
      witness: this.#witness,
      unit,
      detail: `The design machine of unit ${unit} reaches a state that violates requirements obligation ${reqHits.map((t) => t.asString()).join(", ")} under the refinement map (step trace attached): the design can execute its way out of the verified requirements.`
    });
  }
  compareKindTo(other) {
    return this.#kind.compareTo(other.#kind);
  }
  withDetail(detail) {
    return new DesignFinding({
      kind: this.#kind.asString(),
      frRefs: this.#frRefs,
      targets: this.#targets,
      witness: this.#witness,
      unit: this.#unit.asString(),
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
    this.#values = values;
  }
  static of(values) {
    return new DesignFindings([...values]);
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
    this.#unit = UnitName.reconstitute(props.unit);
    this.#detail = props.detail;
  }
  static reconstitute(props) {
    return new DesignSkipped(props);
  }
  target() {
    return this.#target;
  }
  reason() {
    return this.#reason;
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
    return this.#reason < other.#reason ? -1 : this.#reason > other.#reason ? 1 : 0;
  }
}
// src/design/domain/design-skips.ts
function sortDesignSkipped(skipped) {
  return [...skipped].sort((a, b) => a.compareTo(b));
}

class DesignSkips {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new DesignSkips([...values]);
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
// src/design/domain/lowered-background.ts
class LoweredBackground {
  #id;
  #assert;
  constructor(props) {
    this.#id = props.id;
    this.#assert = props.assert;
  }
  static reconstitute(props) {
    return new LoweredBackground(props);
  }
  id() {
    return this.#id;
  }
  assertion() {
    return this.#assert;
  }
}
// src/design/domain/lowered-backgrounds.ts
class LoweredBackgrounds {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new LoweredBackgrounds([...values]);
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
// src/design/domain/lowered-id.ts
class LoweredId {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (raw === "")
      return err({ kind: "empty-lowered-token", raw });
    return ok(new LoweredId(raw));
  }
  static reconstitute(raw) {
    return new LoweredId(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
}
// src/design/domain/lowered-obligation.ts
class LoweredObligation {
  #id;
  #nature;
  #frRefs;
  #assert;
  #trigger;
  #guard;
  #effect;
  #temporal;
  constructor(props) {
    this.#id = props.id;
    this.#nature = ObligationNature.reconstitute(props.nature);
    this.#frRefs = props.frRefs;
    this.#assert = props.assert;
    this.#trigger = props.trigger === undefined ? undefined : TriggerName.reconstitute(props.trigger);
    this.#guard = props.guard;
    this.#effect = props.effect;
    this.#temporal = props.temporal;
  }
  static reconstitute(props) {
    return new LoweredObligation(props);
  }
  id() {
    return this.#id;
  }
  nature() {
    return this.#nature.asString();
  }
  frRefs() {
    return this.#frRefs;
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
    return this.#temporal;
  }
  isEvent() {
    return this.#trigger !== undefined;
  }
}
// src/design/domain/lowered-obligations.ts
class LoweredObligations {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new LoweredObligations([...values]);
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
// src/design/domain/lowered-origin-ref.ts
class LoweredOriginRef {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (raw === "")
      return err({ kind: "empty-lowered-token", raw });
    return ok(new LoweredOriginRef(raw));
  }
  static reconstitute(raw) {
    return new LoweredOriginRef(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
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
  static reconstitute(props) {
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
// src/design/domain/lowered-scenario.ts
class LoweredScenario {
  #id;
  #kind;
  #frRefs;
  #bindings;
  #event;
  #expect;
  constructor(props) {
    this.#id = props.id;
    this.#kind = props.kind;
    this.#frRefs = props.frRefs;
    this.#bindings = { ...props.bindings };
    this.#event = props.event;
    this.#expect = props.expect;
  }
  static reconstitute(props) {
    return new LoweredScenario(props);
  }
  id() {
    return this.#id;
  }
  kind() {
    return this.#kind;
  }
  frRefs() {
    return this.#frRefs;
  }
  bindings() {
    return { ...this.#bindings };
  }
  event() {
    return this.#event;
  }
  expectation() {
    return this.#expect;
  }
  isAccept() {
    return this.#kind === "accept";
  }
}
// src/design/domain/lowered-scenarios.ts
class LoweredScenarios {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new LoweredScenarios([...values]);
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
    return this.#origins.get(LoweredId.reconstitute(loweredId)) ?? null;
  }
  resolveDesignTarget(loweredId) {
    const entry = this.#origins.get(LoweredId.reconstitute(loweredId)) ?? null;
    if (entry)
      return { design: entry.design().asString(), entry };
    const dsc = this.#scenarioDesignIds.get(LoweredId.reconstitute(loweredId));
    if (dsc)
      return { design: dsc.asString(), entry: null };
    return { design: loweredId, entry: null };
  }
  rewriteLoweredIds(text) {
    return text.replace(/\bOB-([0-9]+)\b/g, (m, num) => this.#origins.get(LoweredId.reconstitute(`OB-${num}`))?.design().asString() ?? m);
  }
  rewriteLoweredIdTokens(label) {
    return label.replace(/OB_([0-9]+)/g, (m, num) => {
      const entry = this.#origins.get(LoweredId.reconstitute(`OB-${num}`));
      return entry ? designToken(entry.design().asString()) : m;
    });
  }
  isTransition(designId) {
    return this.#machinesByTransition.has(DesignTransitionId.reconstitute(designId));
  }
  machineOfTransition(designId) {
    return this.#machinesByTransition.get(DesignTransitionId.reconstitute(designId)) ?? null;
  }
  attrPathOfMachine(machineId) {
    return this.#attrPathsByMachine.get(DesignMachineId.reconstitute(machineId))?.asString() ?? null;
  }
  withPassthrough(loweredId, designId) {
    return new LoweringIndex({
      origins: this.#origins.with(LoweredId.reconstitute(loweredId), LoweredOrigin.reconstitute({ design: LoweredOriginRef.reconstitute(designId), kind: "passthrough" })),
      scenarioDesignIds: this.#scenarioDesignIds,
      machinesByTransition: this.#machinesByTransition,
      attrPathsByMachine: this.#attrPathsByMachine
    });
  }
  toOriginEntries() {
    return [...this.#origins].map(([id, origin]) => [id.asString(), origin]);
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
  static of(u, opts) {
    return new LoweredUnit(buildLowering(u, opts));
  }
  remapVerdicts(u, doc) {
    return doc.match({
      unreadable: () => ({ findings: DesignFindings.of([]), skipped: DesignSkips.of([]), unavailable: "sibling backend produced no findings document", method: null }),
      unavailable: (reason, method) => ({ findings: DesignFindings.of([]), skipped: DesignSkips.of([]), unavailable: reason, method }),
      readable: (method, findings, skipped) => this.#remapReadable(u, method, findings, skipped)
    });
  }
  #remapReadable(u, method, docFindings, docSkipped) {
    const mapTarget = (t) => this.#index.resolveDesignTarget(t);
    const rewriteLabel = (label) => this.#index.rewriteLoweredIdTokens(label);
    const remapDetail = (detail) => this.#index.rewriteLoweredIds(detail);
    const findings = [];
    const skipped = [];
    const waived = new Set;
    const deadDesignIds = new Set;
    const shadowFindings = [];
    for (const f of docFindings) {
      const mapped = f.targets().map((t) => mapTarget(t.asString()));
      const frRefs = f.frRefs();
      const detail = remapDetail(f.detail());
      const witness = f.witnessRemappedBy(rewriteLabel);
      const synth = mapped.find((m) => m.entry?.isSyntheticProbe());
      if (synth?.entry?.isKind("vac-dead") && f.isKind("conflict")) {
        const design = synth.entry.design().asString();
        const isTransition = this.#index.isTransition(design);
        deadDesignIds.add(design);
        findings.push(DesignFinding.reconstitute({
          kind: "unreachable",
          frRefs,
          targets: TargetIds.reconstitute([design]),
          witness,
          unit: u.name(),
          detail: `The guard of ${design} can never hold under the entity constraints and invariants (witness core attached): the ${isTransition ? "transition" : "rule"} is dead.`
        }));
        continue;
      }
      if (synth?.entry?.isKind("vac-shadow") && f.isKind("conflict")) {
        const pairRefs = synth.entry.pairRefs();
        const pair = [pairRefs[0].asString(), pairRefs[1].asString()];
        shadowFindings.push({
          finding: DesignFinding.reconstitute({
            kind: "redundancy",
            frRefs,
            targets: TargetIds.reconstitute([pair[0], pair[1]]).sortedUniqueCanonically(),
            witness,
            unit: u.name(),
            detail: `${pair[1]} is subsumed by ${pair[0]}: same trigger, a provably narrower guard, and an identical effect \u2014 it can never apply where ${pair[0]} does not.`
          }),
          subsumer: pair[0],
          subsumed: pair[1]
        });
        continue;
      }
      if (synth)
        continue;
      const targets = TargetIds.reconstitute(mapped.map((m) => m.design)).sortedUniqueCanonically().toStrings();
      if (f.isKind("conflict") && targets.length > 0) {
        const machines = targets.map((t) => this.#index.machineOfTransition(t));
        const first = machines[0];
        if (first !== null && first !== undefined && first.waivesOverlapOf(machines)) {
          for (const t of targets) {
            if (!waived.has(t)) {
              waived.add(t);
              skipped.push(DesignSkipped.reconstitute({
                target: TargetId.reconstitute(t),
                reason: "waived",
                unit: u.name(),
                detail: `machine ${first.id().asString()} declares deterministic: false \u2014 the same-(state,trigger) overlap check is waived by the model`
              }));
            }
          }
          continue;
        }
      }
      findings.push(DesignFinding.reconstitute({ kind: f.kind(), frRefs, targets: TargetIds.reconstitute(targets), witness, unit: u.name(), detail }));
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
      skipped.push(DesignSkipped.reconstitute({
        target: TargetId.reconstitute(design),
        reason: s.reason(),
        unit: u.name(),
        ...detail !== undefined ? { detail: remapDetail(detail) } : {}
      }));
    }
    return { findings: DesignFindings.of(findings), skipped: DesignSkips.of(skipped), unavailable: null, method };
  }
}
function buildLowering(u, opts) {
  const map = new Map;
  const scenarioMap = new Map;
  const machineOfTransition = new Map;
  const attrPathOfMachine = new Map;
  const obligations = [];
  let n = 0;
  const nextId = () => {
    n += 1;
    return LoweredId.reconstitute(`OB-${n}`);
  };
  const push = (ob, entry) => {
    const id = nextId();
    obligations.push(LoweredObligation.reconstitute({ id, ...ob }));
    map.set(id.asString(), entry);
    return id;
  };
  const candidates = [];
  for (const ob of u.obligations().sortedCanonically()) {
    const lowered = {
      nature: ob.nature().asString(),
      frRefs: ob.frRefs()
    };
    const assertion = ob.assertion();
    const trigger = ob.trigger();
    const guard = ob.guard();
    const effect = ob.effect();
    const temporal = ob.temporal();
    if (assertion !== undefined)
      lowered.assert = assertion;
    if (trigger !== undefined)
      lowered.trigger = trigger.asString();
    if (guard !== undefined)
      lowered.guard = guard;
    if (effect !== undefined)
      lowered.effect = effect;
    if (temporal !== undefined)
      lowered.temporal = temporal;
    const lowId = push(lowered, LoweredOrigin.reconstitute({ design: LoweredOriginRef.reconstitute(ob.id().asString()), kind: "passthrough" }));
    const event = ob.eventDefinition();
    if (event !== null) {
      candidates.push({ lowId, design: ob.id().asString(), trigger: event.trigger.asString(), guard: event.guard, effect: event.effect });
    }
  }
  for (const sm of u.machines().sortedCanonically()) {
    const attrPath = DesignMachines.attrPathOf(sm);
    attrPathOfMachine.set(sm.id().asString(), attrPath);
    for (const tr of sm.transitions().sortedCanonically()) {
      const guard = tr.loweredGuard(attrPath);
      const effect = tr.loweredEffect(attrPath);
      const lowId = push({ nature: "event", frRefs: FrRefs.of([]), trigger: tr.trigger().asString(), guard, effect }, LoweredOrigin.reconstitute({ design: LoweredOriginRef.reconstitute(tr.id().asString()), kind: "transition" }));
      machineOfTransition.set(tr.id().asString(), sm);
      candidates.push({ lowId, design: tr.id().asString(), trigger: tr.trigger().asString(), guard, effect });
    }
    const sortedIgnores = sm.ignores().sortedByStateTrigger();
    for (const ig of sortedIgnores) {
      push({ nature: "event", frRefs: FrRefs.of([]), trigger: ig.trigger().asString(), guard: ig.loweredGuard(attrPath), effect: ig.loweredEffect(attrPath) }, LoweredOrigin.reconstitute({ design: LoweredOriginRef.reconstitute(sm.id().asString()), kind: "ignore" }));
    }
  }
  if (opts.synthetics) {
    for (const c of candidates) {
      push({ nature: "invariant", frRefs: FrRefs.of([]), assert: { op: "implies", args: [c.guard, { op: "bool", value: true }] } }, LoweredOrigin.reconstitute({ design: LoweredOriginRef.reconstitute(c.design), kind: "vac-dead" }));
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
          push({
            nature: "invariant",
            frRefs: FrRefs.of([]),
            assert: {
              op: "implies",
              args: [{ op: "and", args: [b.guard, { op: "not", args: [a.guard] }] }, { op: "bool", value: true }]
            }
          }, LoweredOrigin.reconstitute({
            design: LoweredOriginRef.reconstitute(`${a.design}|${b.design}`),
            kind: "vac-shadow",
            pair: [LoweredOriginRef.reconstitute(a.design), LoweredOriginRef.reconstitute(b.design)]
          }));
        }
      }
    }
  }
  const scenarios = [];
  let scN = 0;
  for (const sc of u.scenarios().sortedCanonically()) {
    scN += 1;
    const lowId = `SC-${scN}`;
    scenarioMap.set(lowId, sc.id().asString());
    const eventTrigger = sc.eventTrigger();
    const expectation = sc.expectation();
    scenarios.push(LoweredScenario.reconstitute({
      id: LoweredId.reconstitute(lowId),
      kind: sc.kind(),
      frRefs: sc.frRefs(),
      bindings: { ...sc.bindings() },
      ...eventTrigger !== undefined ? { event: { trigger: eventTrigger.asString() } } : {},
      ...expectation !== undefined ? { expect: expectation } : {}
    }));
  }
  const background = [];
  let bgN = 0;
  for (const bg of u.background().sortedCanonically()) {
    bgN += 1;
    background.push(LoweredBackground.reconstitute({ id: LoweredId.reconstitute(`BG-${bgN}`), assert: bg.assertion() }));
  }
  return {
    obligations: LoweredObligations.of(obligations),
    scenarios: LoweredScenarios.of(scenarios),
    background: LoweredBackgrounds.of(background),
    index: LoweringIndex.of({
      origins: KeyedIndex.of([...map].map(([id, origin]) => [LoweredId.reconstitute(id), origin])),
      scenarioDesignIds: KeyedIndex.of([...scenarioMap].map(([id, dsc]) => [LoweredId.reconstitute(id), DesignScenarioId.reconstitute(dsc)])),
      machinesByTransition: KeyedIndex.of([...machineOfTransition].map(([id, sm]) => [DesignTransitionId.reconstitute(id), sm])),
      attrPathsByMachine: KeyedIndex.of([...attrPathOfMachine].map(([id, path]) => [DesignMachineId.reconstitute(id), AttributePath.reconstitute(path)]))
    })
  };
}
// src/design/domain/sibling-verdict-document.ts
class SiblingVerdictDocument {
  #kind;
  #reason;
  #method;
  #findings;
  #skipped;
  constructor(props) {
    this.#kind = props.kind;
    this.#reason = props.reason;
    this.#method = props.method === null ? null : VerificationMethod.reconstitute(props.method);
    this.#findings = props.findings;
    this.#skipped = props.skipped;
  }
  static unreadable() {
    return new SiblingVerdictDocument({ kind: "unreadable", reason: null, method: null, findings: null, skipped: null });
  }
  static unavailable(reason, method) {
    return new SiblingVerdictDocument({ kind: "unavailable", reason, method, findings: null, skipped: null });
  }
  static readable(method, findings, skipped) {
    return new SiblingVerdictDocument({ kind: "readable", reason: null, method, findings, skipped });
  }
  unavailableReason() {
    return this.#kind === "unavailable" ? this.#reason : null;
  }
  match(handlers) {
    if (this.#kind === "unreadable")
      return handlers.unreadable();
    if (this.#kind === "unavailable")
      return handlers.unavailable(this.#reason ?? "", this.#method?.asString() ?? null);
    if (this.#findings === null || this.#skipped === null)
      throw new Error("defect: a readable sibling document carries no verdicts");
    return handlers.readable(this.#method?.asString() ?? null, this.#findings, this.#skipped);
  }
}
// src/design/domain/sibling-verdict-finding.ts
class SiblingVerdictFinding {
  #kind;
  #frRefs;
  #targets;
  #witness;
  #detail;
  constructor(props) {
    this.#kind = FindingKind.reconstitute(props.kind);
    this.#frRefs = props.frRefs;
    this.#targets = props.targets;
    this.#witness = props.witness;
    this.#detail = props.detail;
  }
  static reconstitute(props) {
    return new SiblingVerdictFinding(props);
  }
  kind() {
    return this.#kind.asString();
  }
  isKind(kind) {
    return this.#kind.equals(FindingKind.reconstitute(kind));
  }
  frRefs() {
    return this.#frRefs;
  }
  targets() {
    return this.#targets;
  }
  detail() {
    return this.#detail;
  }
  witnessRemappedBy(rewrite) {
    return this.#witness.remapCore(rewrite);
  }
}
// src/design/domain/sibling-verdict-findings.ts
class SiblingVerdictFindings {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new SiblingVerdictFindings([...values]);
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
  static reconstitute(props) {
    return new SiblingVerdictSkip(props);
  }
  target() {
    return this.#target;
  }
  reason() {
    return this.#reason;
  }
  detail() {
    return this.#detail;
  }
}
// src/design/domain/sibling-verdict-skips.ts
class SiblingVerdictSkips {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new SiblingVerdictSkips([...values]);
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
// src/design/domain/design-report-id.ts
class DesignReportId {
  #directory;
  #backend;
  constructor(directory, backend) {
    this.#directory = directory;
    this.#backend = backend;
  }
  static of(directory, backend) {
    return new DesignReportId(directory, BackendName.reconstitute(backend));
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
    this.#method = VerificationMethod.reconstitute(seed.method);
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
      irVersion: IrVersion.reconstitute("0.0.0"),
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
      skipped: DesignSkips.of(model.units().toArray().flatMap((u) => [...u.allTargets()].map((t) => DesignSkipped.reconstitute({
        target: t,
        reason: "ir-version-mismatch",
        unit: u.name(),
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
      skipped: DesignSkips.of(model.units().toArray().flatMap((u) => [...u.allTargets()].map((t) => DesignSkipped.reconstitute({ target: t, reason: "unavailable", unit: u.name(), detail: skipDetail })))),
      unavailableReason: reason
    });
  }
  static compose(input) {
    return new DesignReport({
      id: input.id,
      irVersion: input.irVersion,
      irHash: input.irHash,
      method: input.method,
      findings: input.findings.sortedCanonically(),
      skipped: input.skipped.sortedCanonically(),
      inputs: input.inputs === undefined ? null : input.inputs.sortedByArtifact(),
      checked: input.checked === undefined ? null : input.checked.sortedUniqueCanonically(),
      crossChecked: input.crossChecked ?? null,
      unavailableReason: input.unavailableReason ?? null
    });
  }
  static reconstitute(seed) {
    return new DesignReport(seed);
  }
  degraded(reason) {
    return new DesignReport({
      id: this.#id,
      irVersion: this.#irVersion,
      irHash: this.#irHash,
      method: this.#method.asString(),
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
}
// src/design/domain/checked-units.ts
class CheckedUnits {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new CheckedUnits([...values]);
  }
  static reconstitute(raws) {
    return new CheckedUnits(raws.map((raw) => UnitName.reconstitute(raw)));
  }
  add(value) {
    return new CheckedUnits([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  sortedUniqueCanonically() {
    return CheckedUnits.reconstitute(TargetIds.reconstitute(this.toStrings()).sortedUniqueCanonically().toStrings());
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
    this.#values = values;
  }
  static of(values) {
    return new DesignCrossCheckedEntries([...values]);
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
  static reconstitute(props) {
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
    this.#artifact = ArtifactPath.reconstitute(props.artifact);
    this.#sha256 = props.sha256;
  }
  static reconstitute(props) {
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
    this.#values = values;
  }
  static of(values) {
    return new DesignInputAnchors([...values]);
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
    this.#values = values;
  }
  static of(values) {
    return new DesignReports([...values]);
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
            const verdictOf = (d) => d.findings.some((f) => f.kind() === "scenario-violation" && f.unit() === u.name() && f.targets().includes(TargetId.reconstitute(sc.id().asString())));
            const va = verdictOf(a);
            const vb = verdictOf(b);
            (comparedByBackend.get(a.backend) ?? comparedByBackend.set(a.backend, new Set).get(a.backend))?.add(sc.id().asString());
            (comparedByBackend.get(b.backend) ?? comparedByBackend.set(b.backend, new Set).get(b.backend))?.add(sc.id().asString());
            if (va !== vb) {
              const verdicts = {};
              verdicts[a.backend] = va ? "violated" : "clean";
              verdicts[b.backend] = vb ? "violated" : "clean";
              findings.push(DesignFinding.reconstitute({
                kind: "cross-check-disagreement",
                frRefs: FrRefs.of([...sc.frRefs()]).sortedUnique(),
                targets: TargetIds.reconstitute([sc.id().asString()]),
                witness: DesignWitness.verdicts(verdicts),
                unit: u.name(),
                detail: `Backends "${a.backend}" and "${b.backend}" disagree on scenario ${sc.id().asString()} of unit ${u.name()}. This signals a defect in the formalization or in a backend compiler, not in the design itself.`
              }));
            }
          }
        }
      }
    }
    const crossChecked = [...comparedByBackend.entries()].map(([backend, targets]) => DesignCrossCheckedEntry.reconstitute({ backend: BackendName.reconstitute(backend), targets: TargetIds.reconstitute([...targets]).sortedCanonically() })).sort((x, y) => x.compareByBackend(y));
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
// src/design/domain/binding-pairs.ts
class BindingPairs {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new BindingPairs([...values]);
  }
  add(value) {
    return new BindingPairs([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/br-ref.ts
class BrRef {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static reconstitute(raw) {
    return new BrRef(raw);
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
// src/design/domain/br-refs.ts
class BrRefs {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new BrRefs([...values]);
  }
  static reconstitute(raws) {
    return new BrRefs(raws.map((raw) => BrRef.reconstitute(raw)));
  }
  add(value) {
    return new BrRefs([...this.#values, value]);
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
// src/design/domain/declared-values.ts
class DeclaredValues {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new DeclaredValues([...values]);
  }
  add(value) {
    return new DeclaredValues([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  includes(value) {
    return this.#values.includes(value);
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/design-attribute-decl.ts
class DesignAttributeDecl {
  #name;
  #kind;
  #description;
  #values;
  #min;
  #max;
  constructor(props) {
    this.#name = props.name;
    this.#kind = AttributeKind.reconstitute(props.kind);
    this.#description = props.description;
    this.#values = props.values;
    this.#min = props.min;
    this.#max = props.max;
  }
  static reconstitute(props) {
    return new DesignAttributeDecl(props);
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
    return this.#min !== undefined && !Number.isSafeInteger(this.#min.asNumber()) || this.#max !== undefined && !Number.isSafeInteger(this.#max.asNumber());
  }
  isEnum() {
    return this.#kind.isEnum();
  }
  admitsEnumLiteral(value) {
    return this.#kind.isEnum() && (this.#values?.includes(value) ?? false);
  }
  fitsBinding(value) {
    return this.#kind.isBool() && typeof value === "boolean" || this.#kind.isInt() && typeof value === "number" && Number.isSafeInteger(value) || this.#kind.isEnum() && typeof value === "string" && (this.#values?.includes(value) ?? false);
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
// src/design/domain/design-attribute-decls.ts
class DesignAttributeDecls {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new DesignAttributeDecls([...values]);
  }
  add(value) {
    return new DesignAttributeDecls([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/design-background-decl.ts
class DesignBackgroundDecl {
  #id;
  #assert;
  constructor(props) {
    this.#id = props.id;
    this.#assert = props.assert;
  }
  static reconstitute(props) {
    return new DesignBackgroundDecl(props);
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
// src/design/domain/design-background-decls.ts
class DesignBackgroundDecls {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new DesignBackgroundDecls([...values]);
  }
  add(value) {
    return new DesignBackgroundDecls([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/design-entity-decl.ts
class DesignEntityDecl {
  #name;
  #description;
  #attributes;
  constructor(props) {
    this.#name = props.name;
    this.#description = props.description;
    this.#attributes = props.attributes;
  }
  static reconstitute(props) {
    return new DesignEntityDecl(props);
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
// src/design/domain/design-entity-decls.ts
class DesignEntityDecls {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new DesignEntityDecls([...values]);
  }
  add(value) {
    return new DesignEntityDecls([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/design-ignore-decl.ts
class DesignIgnoreDecl {
  #state;
  #trigger;
  constructor(props) {
    this.#state = props.state;
    this.#trigger = props.trigger;
  }
  static reconstitute(props) {
    return new DesignIgnoreDecl(props);
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
// src/design/domain/design-ignore-decls.ts
class DesignIgnoreDecls {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new DesignIgnoreDecls([...values]);
  }
  add(value) {
    return new DesignIgnoreDecls([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/design-machine-decl.ts
class DesignMachineDecl {
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
  static reconstitute(props) {
    return new DesignMachineDecl(props);
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
    return [...this.#initial].filter((state) => !states.includes(state));
  }
}
// src/design/domain/design-machine-decls.ts
class DesignMachineDecls {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new DesignMachineDecls([...values]);
  }
  add(value) {
    return new DesignMachineDecls([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/design-obligation-decl.ts
class DesignObligationDecl {
  #id;
  #origin;
  #brRefs;
  #assert;
  #guard;
  #effect;
  #temporal;
  constructor(props) {
    this.#id = props.id;
    this.#origin = props.origin;
    this.#brRefs = props.brRefs;
    this.#assert = props.assert;
    this.#guard = props.guard;
    this.#effect = props.effect;
    this.#temporal = props.temporal === undefined ? undefined : { ...props.temporal };
  }
  static reconstitute(props) {
    return new DesignObligationDecl(props);
  }
  id() {
    return this.#id;
  }
  brRefs() {
    return this.#brRefs;
  }
  missesRequiredBrRefs() {
    return this.#origin?.isRules() === true && this.#brRefs === undefined;
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
// src/design/domain/design-obligation-decls.ts
class DesignObligationDecls {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new DesignObligationDecls([...values]);
  }
  add(value) {
    return new DesignObligationDecls([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/design-scenario-decl.ts
class DesignScenarioDecl {
  #id;
  #bindings;
  #hasEvent;
  #expect;
  #brRefs;
  constructor(props) {
    this.#id = props.id;
    this.#bindings = props.bindings;
    this.#hasEvent = props.hasEvent;
    this.#expect = props.expect;
    this.#brRefs = props.brRefs;
  }
  static reconstitute(props) {
    return new DesignScenarioDecl(props);
  }
  id() {
    return this.#id;
  }
  bindings() {
    return this.#bindings;
  }
  brRefs() {
    return this.#brRefs;
  }
  inspectExpectation(visitor) {
    if (this.#expect !== undefined)
      visitor(this.#expect, this.#hasEvent);
  }
}
// src/design/domain/design-scenario-decls.ts
class DesignScenarioDecls {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new DesignScenarioDecls([...values]);
  }
  add(value) {
    return new DesignScenarioDecls([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/design-transition-decl.ts
class DesignTransitionDecl {
  #id;
  #from;
  #to;
  #trigger;
  #brRefs;
  #guard;
  #effect;
  constructor(props) {
    this.#id = props.id;
    this.#from = props.from;
    this.#to = props.to;
    this.#trigger = props.trigger;
    this.#brRefs = props.brRefs;
    this.#guard = props.guard;
    this.#effect = props.effect;
  }
  static reconstitute(props) {
    return new DesignTransitionDecl(props);
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
  brRefs() {
    return this.#brRefs;
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
// src/design/domain/design-transition-decls.ts
class DesignTransitionDecls {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new DesignTransitionDecls([...values]);
  }
  add(value) {
    return new DesignTransitionDecls([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/design/domain/br-reference-index.ts
class BrReferenceIndex {
  #ids;
  constructor(ids) {
    this.#ids = ids;
  }
  static fromRules(rulesMarkdown) {
    const ids = [];
    for (const m of rulesMarkdown.matchAll(/\bBR[0-9]+\.[0-9]+\b/g))
      ids.push(BrRef.reconstitute(m[0]));
    return new BrReferenceIndex(KeySet.of(ids));
  }
  has(br) {
    return this.#ids.has(br);
  }
  sortedIds() {
    return this.#ids.toArray().map((id) => id.asString()).sort();
  }
}

// src/design/domain/design-unit-decl.ts
class DesignUnitDecl {
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
  static reconstitute(props) {
    return new DesignUnitDecl(props);
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
      ExpressionTree.of(e).walk((node) => {
        const args = node.args ?? [];
        if (args.length === 2) {
          const ref = args.find((a) => a.op === "ref" && typeof a.path === "string");
          const en = args.find((a) => a.op === "enum");
          if (ref && en)
            boundEnum.set(en, ref.path);
        }
      });
      ExpressionTree.of(e).walk((node) => {
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
    const brRefsUsed = new Set;
    const collectBr = (refs) => {
      if (refs === undefined)
        return;
      for (const b of refs)
        brRefsUsed.add(b.asString());
    };
    for (const ob of this.#obligations) {
      const ctx = `obligation ${ob.id().asString()}`;
      dup(ob.id().asString(), ctx);
      collectBr(ob.brRefs());
      if (ob.missesRequiredBrRefs()) {
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
        collectBr(tr.brRefs());
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
      collectBr(sc.brRefs());
      for (const [path, val] of sc.bindings()) {
        const t = attrTypes.get(path);
        if (!t) {
          errors.push(where(`${ctx}: binding for unknown attribute "${path}"`));
          continue;
        }
        const ok2 = t.fitsBinding(val);
        if (!ok2)
          errors.push(where(`${ctx}: binding value ${JSON.stringify(val)} does not fit ${t.kindLabel()} attribute "${path}"`));
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
      if (brRefsUsed.size > 0) {
        errors.push(where(`brRefs are used but construction/${unitName}/functional-design/rules.md was not found \u2014 they cannot be reverse-verified`));
      }
    } else {
      const known = BrReferenceIndex.fromRules(rulesMd);
      for (const br of [...brRefsUsed].sort()) {
        if (!known.has(BrRef.reconstitute(br)))
          errors.push(where(`brRef "${br}" does not exist in rules.md`));
      }
      const unformalizedTargets = this.#unformalizedTargets;
      for (const br of known.sortedIds()) {
        if (!brRefsUsed.has(br) && !unformalizedTargets.covers(TargetId.reconstitute(br))) {
          errors.push(where(`BR coverage: rule ${br} in rules.md is neither referenced by any obligation/transition/scenario nor listed in unformalized[] \u2014 silence is a contract violation`));
        }
      }
    }
    return errors;
  }
}
// src/design/domain/design-unit-decls.ts
class DesignUnitDecls {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new DesignUnitDecls([...values]);
  }
  add(value) {
    return new DesignUnitDecls([...this.#values, value]);
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
    this.#values = values;
  }
  static of(values) {
    return new InitialStates([...values]);
  }
  add(value) {
    return new InitialStates([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  includes(value) {
    return this.#values.includes(value);
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
  static reconstitute(raws) {
    return new UnformalizedTargets(KeySet.of(raws.map((raw) => TargetId.reconstitute(raw))));
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
// src/design/domain/design-model-id.ts
class DesignModelId {
  #path;
  constructor(path) {
    this.#path = path;
  }
  static of(path) {
    return new DesignModelId(path);
  }
  equals(other) {
    return this.#path.equals(other.#path);
  }
  artifactPath() {
    return this.#path;
  }
}
// src/design/domain/refinement-materials-id.ts
class RefinementMaterialsId {
  #model;
  constructor(model) {
    this.#model = model;
  }
  static ofModel(model) {
    return new RefinementMaterialsId(model);
  }
  equals(other) {
    return this.#model.equals(other.#model);
  }
  modelArtifactPath() {
    return this.#model.artifactPath();
  }
}
// src/design/domain/design-ir-validation-materials.ts
class DesignIrValidationMaterials {
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
  static reconstitute(seed) {
    return new DesignIrValidationMaterials(seed);
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
// src/design/domain/design-ir-validation-materials-id.ts
class DesignIrValidationMaterialsId {
  #model;
  constructor(model) {
    this.#model = model;
  }
  static ofModel(model) {
    return new DesignIrValidationMaterialsId(model);
  }
  equals(other) {
    return this.#model.equals(other.#model);
  }
  modelId() {
    return this.#model;
  }
}
// src/design/adapter/design-entities-parser.ts
function parseDesignEntities(schema) {
  const entities = [];
  for (const ent of Array.isArray(schema.entities) ? schema.entities : []) {
    if (!isObject(ent) || typeof ent.name !== "string")
      continue;
    const attributes = [];
    for (const attr of Array.isArray(ent.attributes) ? ent.attributes : []) {
      if (!isObject(attr) || typeof attr.name !== "string")
        continue;
      const t = isObject(attr.type) ? attr.type : {};
      attributes.push(DesignAttributeDecl.reconstitute({
        name: DesignAttributeName.reconstitute(attr.name),
        kind: typeof t.kind === "string" ? t.kind : "",
        ...typeof attr.description === "string" ? { description: attr.description } : {},
        ...Array.isArray(t.values) ? { values: DeclaredValues.of(t.values.filter((v) => typeof v === "string")) } : {},
        ...typeof t.min === "number" ? { min: AttributeBound.reconstitute(t.min) } : {},
        ...typeof t.max === "number" ? { max: AttributeBound.reconstitute(t.max) } : {}
      }));
    }
    entities.push(DesignEntityDecl.reconstitute({
      name: DesignEntityName.reconstitute(ent.name),
      ...typeof ent.description === "string" ? { description: ent.description } : {},
      attributes: DesignAttributeDecls.of(attributes)
    }));
  }
  return DesignEntityDecls.of(entities);
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
        type.values = [...values.toArray()];
      a.type = type;
      return a;
    });
    return out;
  });
}
// src/design/adapter/lowered-document-serializer.ts
function renderLoweredDocument(u, low) {
  const obligations = low.obligations().toArray().map((ob) => {
    const out = {
      id: ob.id().asString(),
      nature: ob.nature(),
      frRefs: ob.frRefs().toStrings()
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
      frRefs: sc.frRefs().toStrings(),
      bindings: sc.bindings()
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
// src/design/adapter/sibling-backend-client-impl.ts
import { spawnSync } from "child_process";
import { mkdtempSync, readFileSync as readFileSync3, rmSync as rmSync2, writeFileSync as writeFileSync2 } from "fs";
import { tmpdir } from "os";
import { join as join3 } from "path";

// src/design/adapter/sibling-document-parser.ts
function parseSiblingVerdictDocument(raw) {
  if (!isObject(raw))
    return SiblingVerdictDocument.unreadable();
  if (isObject(raw.unavailable) && typeof raw.unavailable.reason === "string") {
    return SiblingVerdictDocument.unavailable(raw.unavailable.reason, typeof raw.method === "string" ? raw.method : null);
  }
  const findings = [];
  for (const f of Array.isArray(raw.findings) ? raw.findings : []) {
    if (!isObject(f) || typeof f.kind !== "string" || !Array.isArray(f.targets))
      continue;
    findings.push(SiblingVerdictFinding.reconstitute({
      kind: f.kind,
      frRefs: FrRefs.reconstitute(strArr(f.frRefs)),
      targets: f.targets.filter((t) => typeof t === "string").map((t) => LoweredId.reconstitute(t)),
      witness: DesignWitness.fromDocument(f.witness ?? null),
      detail: typeof f.detail === "string" ? f.detail : ""
    }));
  }
  const skipped = [];
  for (const s of Array.isArray(raw.skipped) ? raw.skipped : []) {
    if (!isObject(s) || typeof s.target !== "string" || typeof s.reason !== "string")
      continue;
    skipped.push(SiblingVerdictSkip.reconstitute({
      target: LoweredId.reconstitute(s.target),
      reason: s.reason,
      ...typeof s.detail === "string" ? { detail: s.detail } : {}
    }));
  }
  return SiblingVerdictDocument.readable(typeof raw.method === "string" ? raw.method : null, SiblingVerdictFindings.of(findings), SiblingVerdictSkips.of(skipped));
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
function probeReached(doc, attrPath, state) {
  if (!isObject(doc) || !Array.isArray(doc.findings))
    return false;
  for (const f of doc.findings) {
    if (!isObject(f) || f.kind !== "conflict")
      continue;
    const witness = isObject(f.witness) ? f.witness : {};
    const trace = Array.isArray(witness.trace) ? witness.trace : null;
    if (trace === null)
      return true;
    const last = trace[trace.length - 1];
    if (isObject(last) && last[attrPath] === state)
      return true;
  }
  return false;
}

// src/design/adapter/sibling-backend-client-impl.ts
class SiblingBackendClientImpl {
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
    if (run.exit !== 0 || run.doc === null || isObject(run.doc) && isObject(run.doc.unavailable)) {
      return { kind: "failed" };
    }
    return { kind: "probed", reached: probeReached(run.doc, attrPath, state) };
  }
  #spawn(backend, loweredDoc, wallTimeoutMs) {
    const tool = this.#config.siblingToolPaths[backend];
    const work = mkdtempSync(join3(tmpdir(), "deep-spec-design-lower-"));
    try {
      const modelPath = join3(work, "deep-spec-analysis-formal-model.md");
      writeFileSync2(modelPath, `# Lowered design unit

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
      const findingsPath = join3(work, "deep-spec-verify", `${backend}.json`);
      let doc = null;
      try {
        doc = JSON.parse(readFileSync3(findingsPath, "utf-8"));
      } catch {
        doc = null;
      }
      const note = res.error ? String(res.error) : (res.stdout ?? "").trim().split(`
`).pop() ?? "";
      return { exit: res.status, doc, note };
    } finally {
      rmSync2(work, { recursive: true, force: true });
    }
  }
}
// src/design/adapter/design-report-serializer.ts
function orderedDocument(report) {
  const ordered = {
    backend: report.id().backendName().asString(),
    irVersion: report.irVersion().asString(),
    irHash: report.irHash().asString(),
    method: report.method()
  };
  const reason = report.unavailableReason();
  if (reason !== null)
    ordered.unavailable = { reason };
  const inputs = report.inputs();
  if (inputs !== null)
    ordered.inputs = inputs.toArray().map((i) => ({ artifact: i.artifact(), sha256: i.sha256().asString() }));
  const checked = report.checked();
  if (checked !== null)
    ordered.checked = checked.toStrings();
  ordered.findings = report.findings().toArray().map((f) => {
    const out = {
      kind: f.kind(),
      frRefs: f.frRefs().toStrings(),
      targets: f.targets().toStrings(),
      witness: f.witness().toDocument(),
      unit: f.unit(),
      detail: f.detail()
    };
    return out;
  });
  ordered.skipped = report.skipped().toArray().map((sk) => {
    const out = { target: sk.target().asString(), reason: sk.reason(), unit: sk.unit() };
    const detail = sk.detail();
    if (detail !== undefined)
      out.detail = detail;
    return out;
  });
  const crossChecked = report.crossChecked();
  if (crossChecked !== null) {
    ordered.crossChecked = crossChecked.toArray().map((e) => ({ backend: e.backend().asString(), targets: e.targets().toStrings() }));
  }
  return ordered;
}
function renderDesignReportBytes(report) {
  return `${JSON.stringify(orderedDocument(report), null, 2)}
`;
}
function conformDesignReport(report, findingsSchema) {
  if (!findingsSchema.ok) {
    return report.degraded(`findings schema unreadable: ${findingsSchema.error.cause}`);
  }
  const errors = [];
  validateSchema(findingsSchema.value, findingsSchema.value, orderedDocument(report), "", errors);
  if (errors.length > 0) {
    return report.degraded(`self-validation against deep-spec-findings-schema.json failed: ${errors[0]}`);
  }
  return report;
}
function parseSiblingDesignReportDocument(directory, fileName, raw) {
  if (!isObject(raw))
    return null;
  const backend = typeof raw.backend === "string" ? raw.backend : fileName.replace(/\.json$/, "");
  const skipped = (Array.isArray(raw.skipped) ? raw.skipped : []).filter((s) => isObject(s) && typeof s.target === "string");
  return DesignReport.reconstitute({
    id: DesignReportId.of(directory, backend),
    irVersion: IrVersion.reconstitute(typeof raw.irVersion === "string" ? raw.irVersion : ""),
    irHash: ContentHash.reconstitute(typeof raw.irHash === "string" ? raw.irHash : ""),
    method: typeof raw.method === "string" ? raw.method : "",
    findings: DesignFindings.of((Array.isArray(raw.findings) ? raw.findings.filter(isObject) : []).map((e) => {
      const entry = e;
      return DesignFinding.reconstitute({
        kind: typeof entry.kind === "string" ? entry.kind : "",
        frRefs: FrRefs.reconstitute(Array.isArray(entry.frRefs) ? entry.frRefs.filter((x) => typeof x === "string") : []),
        targets: TargetIds.reconstitute(Array.isArray(entry.targets) ? entry.targets.filter((x) => typeof x === "string") : []),
        witness: DesignWitness.fromDocument(entry.witness ?? null),
        unit: typeof entry.unit === "string" ? entry.unit : "",
        detail: typeof entry.detail === "string" ? entry.detail : ""
      });
    })),
    skipped: DesignSkips.of(skipped.map((entry) => {
      return DesignSkipped.reconstitute({
        target: TargetId.reconstitute(typeof entry.target === "string" ? entry.target : ""),
        reason: typeof entry.reason === "string" ? entry.reason : "",
        unit: typeof entry.unit === "string" ? entry.unit : "",
        ...typeof entry.detail === "string" ? { detail: entry.detail } : {}
      });
    })),
    inputs: Array.isArray(raw.inputs) ? DesignInputAnchors.of(raw.inputs.map((e) => {
      const entry = isObject(e) ? e : {};
      return DesignInputAnchor.reconstitute({
        artifact: typeof entry.artifact === "string" ? entry.artifact : "",
        sha256: ContentHash.reconstitute(typeof entry.sha256 === "string" ? entry.sha256 : "")
      });
    })) : null,
    checked: Array.isArray(raw.checked) ? CheckedUnits.reconstitute(raw.checked.filter((c) => typeof c === "string")) : null,
    crossChecked: Array.isArray(raw.crossChecked) ? DesignCrossCheckedEntries.of(raw.crossChecked.filter(isObject).map((e) => DesignCrossCheckedEntry.reconstitute({
      backend: BackendName.reconstitute(typeof e.backend === "string" ? e.backend : ""),
      targets: TargetIds.reconstitute(Array.isArray(e.targets) ? e.targets.filter((t) => typeof t === "string") : [])
    }))) : null,
    unavailableReason: isObject(raw.unavailable) ? typeof raw.unavailable.reason === "string" ? raw.unavailable.reason : "" : null
  });
}
// src/design/adapter/design-report-repository-impl.ts
import { existsSync as existsSync3, mkdirSync as mkdirSync2, readFileSync as readFileSync4, readdirSync, writeFileSync as writeFileSync3 } from "fs";
import { join as join4 } from "path";
class DesignReportRepositoryImpl {
  #findingsSchemaPath;
  constructor(findingsSchemaPath) {
    this.#findingsSchemaPath = findingsSchemaPath;
  }
  findById(aggregateId) {
    const path = join4(aggregateId.directory().asString(), aggregateId.fileName());
    if (!existsSync3(path)) {
      return err({ kind: "not-found", path });
    }
    let raw;
    try {
      raw = JSON.parse(readFileSync4(path, "utf-8"));
    } catch (e) {
      return err({ kind: "corrupt", path, cause: e instanceof Error ? e.message : String(e) });
    }
    const report = parseSiblingDesignReportDocument(aggregateId.directory(), aggregateId.fileName(), raw);
    if (report === null) {
      return err({ kind: "corrupt", path, cause: "document is not a JSON object" });
    }
    return ok(report);
  }
  findAllByDirectory(directory) {
    let entries;
    try {
      entries = readdirSync(directory.asString()).filter((f) => f.endsWith(".json") && f !== "cross-check.json").sort();
    } catch (e) {
      return err({ kind: "io-failed", operation: "read", path: directory.asString(), cause: e instanceof Error ? e.message : String(e) });
    }
    const reports = [];
    for (const file of entries) {
      try {
        const raw = JSON.parse(readFileSync4(join4(directory.asString(), file), "utf-8"));
        const report = parseSiblingDesignReportDocument(directory, file, raw);
        if (report !== null)
          reports.push(report);
      } catch {}
    }
    return ok(DesignReports.of(reports));
  }
  conformedOf(report) {
    return conformDesignReport(report, readContractSchema(this.#findingsSchemaPath));
  }
  store(report) {
    const conformed = this.conformedOf(report);
    const path = join4(conformed.id().directory().asString(), conformed.id().fileName());
    try {
      mkdirSync2(conformed.id().directory().asString(), { recursive: true });
      writeFileSync3(path, renderDesignReportBytes(conformed), "utf-8");
      return ok(undefined);
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path, cause: e instanceof Error ? e.message : String(e) });
    }
  }
}
// src/refinement/domain/refinement-requirements.ts
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
  static reconstitute(seed) {
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
    return TargetIds.of([...this.#obligations.toArray().map((o) => o.id().asTargetId()), ...this.#scenarios.toArray().map((s) => s.id().asTargetId())]);
  }
  frRefsOf(id) {
    return this.#obligations.byId(id)?.frRefs() ?? this.#scenarios.byId(id)?.frRefs() ?? FrRefs.of([]);
  }
}
// src/refinement/domain/refinement-attribute.ts
class RefinementAttribute {
  #path;
  #kind;
  #values;
  constructor(props) {
    this.#path = props.path;
    this.#kind = props.kind;
    this.#values = props.values;
  }
  static reconstitute(props) {
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
// src/refinement/domain/refinement-attributes.ts
class RefinementAttributes {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new RefinementAttributes([...values]);
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
// src/refinement/domain/refinement-obligation.ts
class RefinementObligation {
  #id;
  #nature;
  #frRefs;
  #assert;
  #trigger;
  #guard;
  #effect;
  constructor(props) {
    this.#id = props.id;
    this.#nature = props.nature;
    this.#frRefs = props.frRefs;
    this.#assert = props.assert;
    this.#trigger = props.trigger;
    this.#guard = props.guard;
    this.#effect = props.effect;
  }
  static reconstitute(props) {
    return new RefinementObligation(props);
  }
  id() {
    return this.#id;
  }
  nature() {
    return this.#nature;
  }
  frRefs() {
    return this.#frRefs;
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
    if (!this.#nature.isEvent() || this.#trigger === undefined || this.#trigger.isEmpty() || this.#guard === undefined || this.#effect === undefined)
      return null;
    return { trigger: this.#trigger, guard: this.#guard, effect: this.#effect };
  }
}
// src/refinement/domain/refinement-obligations.ts
class RefinementObligations {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new RefinementObligations([...values]);
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
// src/refinement/domain/refinement-scenario.ts
class RefinementScenario {
  #id;
  #kind;
  #frRefs;
  #bindings;
  #eventTrigger;
  constructor(props) {
    this.#id = props.id;
    this.#kind = props.kind;
    this.#frRefs = props.frRefs;
    this.#bindings = { ...props.bindings };
    this.#eventTrigger = props.event?.trigger;
  }
  static reconstitute(props) {
    return new RefinementScenario(props);
  }
  id() {
    return this.#id;
  }
  kind() {
    return this.#kind;
  }
  frRefs() {
    return this.#frRefs;
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
    return { ...this.#bindings };
  }
  bindingEntriesCanonically() {
    return Object.entries(this.#bindings).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  }
}
// src/refinement/domain/refinement-scenarios.ts
class RefinementScenarios {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new RefinementScenarios([...values]);
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
// src/refinement/domain/req-attribute-values.ts
class ReqAttributeValues {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new ReqAttributeValues([...values]);
  }
  add(value) {
    return new ReqAttributeValues([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  includes(value) {
    return this.#values.includes(value);
  }
  sortedUniqueCanonically() {
    return new ReqAttributeValues([...new Set(this.#values)].sort((a, b) => TargetId.reconstitute(a).compareTo(TargetId.reconstitute(b))));
  }
  toArray() {
    return this.#values;
  }
}
// src/refinement/domain/refinement-map.ts
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
  static reconstitute(seed) {
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
// src/requirements/domain/attribute-declaration.ts
class AttributeDeclaration {
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
  static reconstitute(props) {
    return new AttributeDeclaration(props);
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
// src/requirements/domain/attribute-declarations.ts
class AttributeDeclarations {
  #values;
  #byPath;
  constructor(values) {
    this.#values = values;
    this.#byPath = KeyedIndex.of(values.map((a) => [a.path(), a]));
  }
  static of(values) {
    return new AttributeDeclarations([...values]);
  }
  add(value) {
    return new AttributeDeclarations([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  byPath(path) {
    return this.#byPath.get(path);
  }
  sortedByPath() {
    return new AttributeDeclarations([...this.#values].sort((a, b) => a.path().asString() < b.path().asString() ? -1 : 1));
  }
  toArray() {
    return this.#values;
  }
}
// src/requirements/domain/attribute-values.ts
class AttributeValues {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new AttributeValues([...values]);
  }
  add(value) {
    return new AttributeValues([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  indexOf(value) {
    return this.#values.indexOf(value);
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
// src/requirements/domain/obligation.ts
class Obligation {
  #id;
  #nature;
  #frRefs;
  #ears;
  #assert;
  #trigger;
  #guard;
  #effect;
  #temporal;
  constructor(props) {
    this.#id = props.id;
    this.#nature = props.nature;
    this.#frRefs = props.frRefs;
    this.#ears = props.ears;
    this.#assert = props.assert;
    this.#trigger = props.trigger;
    this.#guard = props.guard;
    this.#effect = props.effect;
    this.#temporal = props.temporal === undefined ? undefined : { ...props.temporal };
  }
  static reconstitute(props) {
    return new Obligation(props);
  }
  id() {
    return this.#id;
  }
  nature() {
    return this.#nature;
  }
  frRefs() {
    return this.#frRefs;
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
    if (!this.isEvent() || this.#trigger === undefined || this.#trigger.isEmpty() || this.#guard === undefined || this.#effect === undefined)
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
// src/requirements/domain/obligation-id.ts
class ObligationId {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (raw === "")
      return err({ kind: "empty-obligation-id", raw });
    return ok(new ObligationId(raw));
  }
  static reconstitute(raw) {
    return new ObligationId(raw);
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
    return TargetId.reconstitute(this.#value);
  }
}
// src/requirements/domain/obligation-ids.ts
class ObligationIds {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new ObligationIds([...values]);
  }
  add(value) {
    return new ObligationIds([...this.#values, value]);
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
    return TargetIds.of(this.#values.map((v) => v.asTargetId()));
  }
}
// src/requirements/domain/obligations.ts
class Obligations {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new Obligations([...values]);
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
  #frRefs;
  #bindings;
  #eventTrigger;
  #expect;
  constructor(props) {
    this.#id = props.id;
    this.#kind = props.kind;
    this.#frRefs = props.frRefs;
    this.#bindings = { ...props.bindings };
    this.#eventTrigger = props.event?.trigger;
    this.#expect = props.expect;
  }
  static reconstitute(props) {
    return new Scenario(props);
  }
  id() {
    return this.#id;
  }
  kind() {
    return this.#kind;
  }
  frRefs() {
    return this.#frRefs;
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
  bindingEntriesCanonically() {
    return Object.entries(this.#bindings).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  }
  bindings() {
    return { ...this.#bindings };
  }
}
// src/requirements/domain/scenario-id.ts
class ScenarioId {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (raw === "")
      return err({ kind: "empty-scenario-id", raw });
    return ok(new ScenarioId(raw));
  }
  static reconstitute(raw) {
    return new ScenarioId(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
  asTargetId() {
    return TargetId.reconstitute(this.#value);
  }
}
// src/requirements/domain/scenarios.ts
class Scenarios {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new Scenarios([...values]);
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
  static reconstitute(seed) {
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
    return this.#attributes.byPath(AttributePath.reconstitute(path));
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
    return TargetIds.reconstitute([...this.#obligations.ids(), ...this.#scenarios.ids()]).sortedCanonically();
  }
  frRefsOf(targets) {
    const refs = [];
    for (const t of targets) {
      const ob = this.#obligations.byId(t.asString());
      if (ob)
        refs.push(...ob.frRefs());
      const sc = this.#scenarios.byId(t.asString());
      if (sc)
        refs.push(...sc.frRefs());
    }
    return FrRefs.of(refs).sortedUnique();
  }
}
// src/requirements/domain/background-assumption-id.ts
class BackgroundAssumptionId {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (raw === "")
      return err({ kind: "empty-background-id", raw });
    return ok(new BackgroundAssumptionId(raw));
  }
  static reconstitute(raw) {
    return new BackgroundAssumptionId(raw);
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
  constructor(id, assert) {
    this.#id = id;
    this.#assert = assert;
  }
  static reconstitute(props) {
    return new BackgroundAssumption(props.id, props.assert);
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
    this.#values = values;
  }
  static of(values) {
    return new BackgroundAssumptions([...values]);
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
  #frRefs;
  #targets;
  #witness;
  #detail;
  constructor(props) {
    this.#kind = FindingKind.reconstitute(props.kind);
    this.#frRefs = props.frRefs;
    this.#targets = props.targets;
    this.#witness = props.witness;
    this.#detail = props.detail;
  }
  static reconstitute(props) {
    return new VerificationFinding(props);
  }
  kind() {
    return this.#kind.asString();
  }
  frRefs() {
    return this.#frRefs;
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
    return this.#kind.equals(FindingKind.reconstitute(kind));
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
    this.#values = values;
  }
  static of(values) {
    return new VerificationFindings([...values]);
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
  static reconstitute(props) {
    return new VerificationSkipped(props);
  }
  target() {
    return this.#target;
  }
  reason() {
    return this.#reason;
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
    return this.#reason < other.#reason ? -1 : this.#reason > other.#reason ? 1 : 0;
  }
}
// src/requirements/domain/verification-skips.ts
function sortVerificationSkipped(skipped) {
  return [...skipped].sort((a, b) => a.compareTo(b));
}

class VerificationSkips {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new VerificationSkips([...values]);
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
  constructor(document) {
    this.#document = document;
  }
  static core(labels) {
    return new VerificationWitness({ core: [...labels] });
  }
  static model(values) {
    return new VerificationWitness({ model: values });
  }
  static verdicts(byBackend) {
    return new VerificationWitness({ verdicts: byBackend });
  }
  static trace(states) {
    return new VerificationWitness({ trace: states.map((state) => state.toDocument()) });
  }
  static fromDocument(raw) {
    return new VerificationWitness(raw ?? { core: [] });
  }
  toDocument() {
    return this.#document;
  }
}
// src/requirements/domain/verification-report-id.ts
class VerificationReportId {
  #directory;
  #backend;
  constructor(directory, backend) {
    this.#directory = directory;
    this.#backend = backend;
  }
  static of(directory, backend) {
    return new VerificationReportId(directory, BackendName.reconstitute(backend));
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
    this.#method = VerificationMethod.reconstitute(seed.method);
    this.#findings = seed.findings;
    this.#skipped = seed.skipped;
    this.#crossChecked = seed.crossChecked;
    this.#unavailableReason = seed.unavailableReason;
  }
  static irUnreadable(id, method, cause) {
    return VerificationReport.compose({
      id,
      irVersion: IrVersion.reconstitute("0.0.0"),
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
      skipped: VerificationSkips.of([...model.allTargets()].map((t) => VerificationSkipped.reconstitute({
        target: t,
        reason: "ir-version-mismatch",
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
        ...[...model.allTargets()].filter((t) => !planSkipped.toArray().some((s) => s.isFor(t))).map((t) => VerificationSkipped.reconstitute({ target: t, reason: "unavailable", detail: "z3 could not be executed" }))
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
      skipped: VerificationSkips.of([...model.allTargets()].map((t) => VerificationSkipped.reconstitute({ target: t, reason: "unavailable", detail: "quint CLI missing" }))),
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
        ...model.obligations().toArray().map((ob) => VerificationSkipped.reconstitute({ target: ob.id().asTargetId(), reason: "compile-error", detail: machineError })),
        ...model.scenarios().toArray().map((sc) => VerificationSkipped.reconstitute({ target: sc.id().asTargetId(), reason: "compile-error", detail: machineError }))
      ])
    });
  }
  static compose(input) {
    return new VerificationReport({
      id: input.id,
      irVersion: input.irVersion,
      irHash: input.irHash,
      method: input.method,
      findings: input.findings.sortedCanonically(),
      skipped: input.skipped.sortedCanonically(),
      crossChecked: input.crossChecked ?? null,
      unavailableReason: input.unavailableReason ?? null
    });
  }
  static reconstitute(seed) {
    return new VerificationReport(seed);
  }
  degraded(reason) {
    return new VerificationReport({
      id: this.#id,
      irVersion: this.#irVersion,
      irHash: this.#irHash,
      method: this.#method.asString(),
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
}
// src/requirements/domain/cross-checked-entries.ts
class CrossCheckedEntries {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new CrossCheckedEntries([...values]);
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
  static reconstitute(props) {
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
    this.#values = values;
  }
  static of(values) {
    return new VerificationReports([...values]);
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
            findings.push(VerificationFinding.reconstitute({
              kind: "cross-check-disagreement",
              frRefs: FrRefs.of([...scenarioById.get(sc.id().asString())?.frRefs().toArray() ?? []]).sortedUnique(),
              targets: TargetIds.of([sc.id().asTargetId()]),
              witness: VerificationWitness.verdicts(verdicts),
              detail: `Backends "${a.backend}" and "${b.backend}" disagree on scenario ${sc.id().asString()}. This signals a defect in the formalization or in a backend compiler, not in the requirements themselves.`
            }));
          }
        }
      }
    }
    const crossChecked = [...comparedByBackend.entries()].map(([backend, targets]) => CrossCheckedEntry.reconstitute({ backend: BackendName.reconstitute(backend), targets: TargetIds.reconstitute([...targets]).sortedCanonically() })).sort((x, y) => x.compareByBackend(y));
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
// src/requirements/domain/smt-query-verdict.ts
class SmtQueryVerdict {
  #status;
  #decodedModel;
  #core;
  constructor(props) {
    this.#status = props.status;
    this.#decodedModel = props.decodedModel === undefined ? undefined : { ...props.decodedModel };
    this.#core = props.core === undefined ? undefined : props.core.map((label) => QueryLabel.reconstitute(label));
  }
  static reconstitute(props) {
    return new SmtQueryVerdict(props);
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
// src/requirements/domain/smt-query-verdicts.ts
class SmtQueryVerdicts {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new SmtQueryVerdicts(values);
  }
  verdictOf(queryId) {
    return this.#values.get(queryId);
  }
}
// src/requirements/domain/smt-verification-plan.ts
class SmtVerificationPlan {
  #compiled;
  #skipped;
  #labelToTarget;
  #eventPairs;
  #gapTriggers;
  #scenarioQueries;
  constructor(seed) {
    this.#compiled = seed.compiled;
    this.#skipped = seed.skipped;
    this.#labelToTarget = seed.labelToTarget;
    this.#eventPairs = seed.eventPairs;
    this.#gapTriggers = seed.gapTriggers;
    this.#scenarioQueries = seed.scenarioQueries;
  }
  static of(seed) {
    return new SmtVerificationPlan({
      compiled: seed.compiled,
      skipped: seed.skipped,
      labelToTarget: seed.labelToTarget,
      eventPairs: seed.eventPairs,
      gapTriggers: seed.gapTriggers,
      scenarioQueries: seed.scenarioQueries
    });
  }
  planSkipped() {
    return this.#skipped;
  }
  interpret(model, results) {
    const findings = [];
    const skipped = [...this.#skipped.toArray()];
    const conflictKeys = new Set;
    const invariantIds = TargetIds.of(model.obligations().toArray().filter((o) => o.isInvariantLike() && this.#compiled.has(o.id())).map((o) => o.id().asTargetId()));
    const coreToTargets = (core) => {
      const targets = core.map((label) => this.#labelToTarget.get(label)).filter((t) => t !== undefined && t.asString().startsWith("OB-"));
      return TargetIds.of(targets).sortedUniqueCanonically();
    };
    const addConflict = (targets, core, detail) => {
      const effective = targets.count() > 0 ? targets : invariantIds;
      if (effective.count() === 0)
        return;
      const key = effective.joined(",");
      if (conflictKeys.has(key))
        return;
      conflictKeys.add(key);
      findings.push(VerificationFinding.reconstitute({
        kind: "conflict",
        frRefs: model.frRefsOf(effective),
        targets: effective,
        witness: VerificationWitness.core(core.map((label) => label.asString()).sort()),
        detail
      }));
    };
    const timeoutSkip = (targets, what) => {
      for (const t of targets) {
        skipped.push(VerificationSkipped.reconstitute({ target: t, reason: "timeout", detail: `${what} exceeded the solver budget` }));
      }
    };
    const global = results.verdictOf(QueryLabel.reconstitute("global"));
    let globallyUnsat = false;
    if (global?.isUnsat()) {
      globallyUnsat = true;
      addConflict(coreToTargets([...global.coreLabels()]), [...global.coreLabels()], "These obligations (with the background and type bounds in the witness core) are jointly unsatisfiable: no state can satisfy all of them.");
    } else if (global?.isUndecided()) {
      timeoutSkip(invariantIds, "global consistency check");
    }
    if (!globallyUnsat) {
      for (const ob of model.obligations()) {
        const r = results.verdictOf(QueryLabel.reconstitute(`vac:${ob.id().asString()}`));
        if (!r)
          continue;
        if (r.isUnsat()) {
          const targets = TargetIds.of([...coreToTargets([...r.coreLabels()]), ob.id().asTargetId()]).sortedUniqueCanonically();
          addConflict(targets, [...r.coreLabels()], `The condition of obligation ${ob.id().asString()} can never hold: the obligations in the witness core annihilate it. Rules that conflict on a shared condition, or a dead requirement branch.`);
        } else if (r.isUndecided()) {
          timeoutSkip(TargetIds.of([ob.id().asTargetId()]), `vacuity check for ${ob.id().asString()}`);
        }
      }
    }
    for (const pair of this.#eventPairs) {
      const overlap = pair.overlapVerdictIn(results);
      const joint = pair.jointVerdictIn(results);
      if (!overlap || !joint)
        continue;
      if (overlap.isSat() && joint.isUnsat()) {
        addConflict(pair.targets().sortedUniqueCanonically(), [...joint.coreLabels()], `Events ${pair.a().asString()} and ${pair.b().asString()} for trigger "${pair.trigger().asString()}" have overlapping guards but contradictory effects: some state matches both rules, and no post-state satisfies both.`);
      } else if (overlap.isUndecided() || joint.isUndecided()) {
        timeoutSkip(pair.targets(), `event-pair check for trigger "${pair.trigger().asString()}"`);
      }
    }
    for (const [triggerName, eventIds] of [...this.#gapTriggers].sort((a, b) => a[0].asString() < b[0].asString() ? -1 : a[0].asString() > b[0].asString() ? 1 : 0)) {
      const trigger = triggerName.asString();
      const r = results.verdictOf(QueryLabel.reconstitute(`gap:${trigger}`));
      if (!r)
        continue;
      if (r.isSat()) {
        findings.push(VerificationFinding.reconstitute({
          kind: "completeness-gap",
          frRefs: model.frRefsOf(eventIds),
          targets: eventIds,
          witness: VerificationWitness.model(r.witnessModel()),
          detail: `No rule for trigger "${trigger}" applies to the witness state: the behavior of this input region is unspecified.`
        }));
      } else if (r.isUndecided()) {
        timeoutSkip(eventIds, `completeness check for trigger "${trigger}"`);
      }
    }
    for (const sc of model.scenarios()) {
      const qid = this.#scenarioQueries.get(sc.id());
      if (!qid)
        continue;
      const r = results.verdictOf(qid);
      if (!r)
        continue;
      if (r.isUndecided()) {
        timeoutSkip(TargetIds.of([sc.id().asTargetId()]), `scenario check for ${sc.id().asString()}`);
        continue;
      }
      if (sc.isAccept() && r.isUnsat()) {
        const targets = TargetIds.of([sc.id().asTargetId(), ...coreToTargets([...r.coreLabels()])]).sortedUniqueCanonically();
        findings.push(VerificationFinding.reconstitute({
          kind: "scenario-violation",
          frRefs: model.frRefsOf(targets),
          targets,
          witness: VerificationWitness.core(r.sortedCore()),
          detail: `Accept scenario ${sc.id().asString()} describes a state the obligations in the witness core rule out \u2014 the requirements reject an example that should be accepted.`
        }));
      }
      if (sc.isReject() && r.isSat()) {
        findings.push(VerificationFinding.reconstitute({
          kind: "scenario-violation",
          frRefs: model.frRefsOf(TargetIds.of([sc.id().asTargetId()])),
          targets: TargetIds.of([sc.id().asTargetId()]),
          witness: VerificationWitness.model(r.witnessModel()),
          detail: `Reject scenario ${sc.id().asString()} is still satisfiable \u2014 the requirements do not exclude an example that should be rejected (witness state attached).`
        }));
      }
    }
    return { findings: VerificationFindings.of(findings), skipped: VerificationSkips.of(skipped) };
  }
}
// src/requirements/domain/smt-event-pair-probe.ts
class SmtEventPairProbe {
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
    return new SmtEventPairProbe(props);
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
    return TargetIds.of([this.#a.asTargetId(), this.#b.asTargetId()]);
  }
  overlapVerdictIn(results) {
    return results.verdictOf(this.#qOverlap);
  }
  jointVerdictIn(results) {
    return results.verdictOf(this.#qJoint);
  }
}
// src/requirements/domain/smt-event-pair-probes.ts
class SmtEventPairProbes {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new SmtEventPairProbes([...values]);
  }
  add(value) {
    return new SmtEventPairProbes([...this.#values, value]);
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
    this.#value = value;
  }
  static of(value) {
    return new TraceValue(value);
  }
  static ofLiteral(value) {
    return new TraceValue(value ?? null);
  }
  static ofBoolean(value) {
    return new TraceValue(value);
  }
  static ofNumber(value) {
    return new TraceValue(value);
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
    return this.#value;
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
    this.#values = values;
  }
  static of(values) {
    return new TraceStates([...values]);
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
    return TargetIds.of([...this.#invariantComponents.ids().toTargetIds(), ...this.#eventIds.toTargetIds()]).sortedUniqueCanonically();
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
        skipped.push(VerificationSkipped.reconstitute({
          target,
          reason: "unavailable",
          detail: "quint returned no machine run: the event machine was not decided"
        }));
      }
    }
    if (machineRun !== null) {
      skipped.push(...machineRun.skipsFor(machineTargets, bounded));
      if (machineRun.isDeadlock()) {
        findings.push(VerificationFinding.reconstitute({
          kind: "completeness-gap",
          frRefs: model.frRefsOf(eventTargets),
          targets: this.#eventIds.isEmpty() ? machineTargets : eventTargets.sortedCanonically(),
          witness: machineRun.witness(),
          detail: "The event machine reaches a legal state where no event rule applies (deadlock): the behavior of that state is unspecified."
        }));
      } else if (machineRun.isViolation()) {
        const violatedComponents = this.#invariantComponents.violatedBy(machineRun.finalState());
        const targets = violatedComponents.isEmpty() ? eventTargets.sortedCanonically() : violatedComponents.ids().toTargetIds().sortedUniqueCanonically();
        findings.push(VerificationFinding.reconstitute({
          kind: "conflict",
          frRefs: model.frRefsOf(TargetIds.of([...targets, ...eventTargets]).sortedUniqueCanonically()),
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
        skipped.push(VerificationSkipped.reconstitute({
          target,
          reason: "capability",
          detail: "leads-to temporal properties require bounded mode (quint verify with Apalache); simulation cannot decide them"
        }));
        continue;
      }
      const r = runs.temporalOf(ob.id());
      if (!r) {
        skipped.push(VerificationSkipped.reconstitute({
          target,
          reason: "unavailable",
          detail: "quint returned no run for this temporal obligation"
        }));
        continue;
      }
      const skip = r.skipFor(target);
      if (skip !== null) {
        skipped.push(skip);
      } else if (r.isViolation()) {
        findings.push(VerificationFinding.reconstitute({
          kind: "conflict",
          frRefs: model.frRefsOf(TargetIds.of([target])),
          targets: TargetIds.of([target]),
          witness: r.witness(),
          detail: `Temporal obligation ${ob.id().asString()} (leads-to) is violated: the attached trace reaches the "from" condition but never the "to" condition.`
        }));
      }
    }
    for (const sc of model.scenarios()) {
      const target = sc.id().asTargetId();
      if (sc.hasEvent()) {
        skipped.push(VerificationSkipped.reconstitute({ target, reason: "capability", detail: "scenarios with a When-event are not checked by the quint backend in v1" }));
        continue;
      }
      if (!this.#hasInitFor(sc.id())) {
        skipped.push(VerificationSkipped.reconstitute({
          target,
          reason: "capability",
          detail: "quint scenario evaluation requires bindings for every declared attribute"
        }));
        continue;
      }
      const r = runs.scenarioOf(sc.id());
      if (!r) {
        skipped.push(VerificationSkipped.reconstitute({
          target,
          reason: "unavailable",
          detail: "quint returned no run for this scenario"
        }));
        continue;
      }
      const skip = r.skipFor(target);
      if (skip !== null) {
        skipped.push(skip);
        continue;
      }
      const bindings = sc.bindingEntriesCanonically();
      const state = TraceState.of(bindings.map(([path, value]) => [AttributePath.reconstitute(path), TraceValue.of(value)]));
      const boundModel = {};
      for (const [path, value] of bindings)
        boundModel[path] = value;
      if (sc.isAccept() && r.isViolated()) {
        const violatedComponents = this.#invariantComponents.violatedBy(state);
        const targets = TargetIds.of([target, ...violatedComponents.ids().toTargetIds()]).sortedUniqueCanonically();
        findings.push(VerificationFinding.reconstitute({
          kind: "scenario-violation",
          frRefs: model.frRefsOf(targets),
          targets,
          witness: VerificationWitness.model(boundModel),
          detail: `Accept scenario ${sc.id().asString()} describes a state the obligations rule out \u2014 the requirements reject an example that should be accepted.`
        }));
      }
      if (sc.isReject() && !r.isViolated()) {
        findings.push(VerificationFinding.reconstitute({
          kind: "scenario-violation",
          frRefs: model.frRefsOf(TargetIds.of([target])),
          targets: TargetIds.of([target]),
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
      return TraceValue.ofBoolean((e.args ?? []).every((a) => evaluate(a, state).isTrue()));
    case "or":
      return TraceValue.ofBoolean((e.args ?? []).some((a) => evaluate(a, state).isTrue()));
    case "not":
      return TraceValue.ofBoolean(!arg(0).isTrue());
    case "implies":
      return TraceValue.ofBoolean(!arg(0).isTrue() || arg(1).isTrue());
    case "iff":
      return TraceValue.ofBoolean(arg(0).isTrue() === arg(1).isTrue());
    case "eq":
      return TraceValue.ofBoolean(arg(0).equals(arg(1)));
    case "ne":
      return TraceValue.ofBoolean(!arg(0).equals(arg(1)));
    case "lt":
      return TraceValue.ofBoolean(arg(0).asNumber() < arg(1).asNumber());
    case "le":
      return TraceValue.ofBoolean(arg(0).asNumber() <= arg(1).asNumber());
    case "gt":
      return TraceValue.ofBoolean(arg(0).asNumber() > arg(1).asNumber());
    case "ge":
      return TraceValue.ofBoolean(arg(0).asNumber() >= arg(1).asNumber());
    case "add":
      return TraceValue.ofNumber(arg(0).asNumber() + arg(1).asNumber());
    case "sub":
      return TraceValue.ofNumber(arg(0).asNumber() - arg(1).asNumber());
    case "mul":
      return TraceValue.ofNumber(arg(0).asNumber() * arg(1).asNumber());
    case "ref":
      return state.valueAt(AttributePath.reconstitute(e.path ?? ""));
    case "bool":
    case "int":
    case "enum":
      return TraceValue.ofLiteral(e.value);
    default:
      return TraceValue.absent();
  }
}

class QuintMachineComponent {
  #id;
  #expression;
  constructor(props) {
    this.#id = props.id;
    this.#expression = props.expression;
  }
  static reconstitute(props) {
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
    this.#values = values;
  }
  static of(values) {
    return new QuintMachineComponents([...values]);
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
    return ObligationIds.of(this.#values.map((c) => c.id()));
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
      return [...targets].map((target) => VerificationSkipped.reconstitute({ target, reason: "timeout", detail: "machine invariant check exceeded its budget" }));
    }
    if (kind === "run-failed") {
      const outputTail = this.#outputTail;
      return [...targets].map((target) => VerificationSkipped.reconstitute({
        target,
        reason: "unavailable",
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
      return VerificationSkipped.reconstitute({ target, reason: "timeout", detail: "scenario evaluation exceeded its budget" });
    if (kind === "run-failed")
      return VerificationSkipped.reconstitute({ target, reason: "unavailable", detail: `quint run failed unexpectedly: ${this.#outputTail}` });
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
  constructor(props) {
    this.#kind = props.kind;
    this.#trace = props.trace;
  }
  static timeout() {
    return new QuintTemporalVerdict({ kind: "timeout", trace: null });
  }
  static violation(trace) {
    return new QuintTemporalVerdict({ kind: "violation", trace });
  }
  static clean() {
    return new QuintTemporalVerdict({ kind: "clean", trace: null });
  }
  skipFor(target) {
    if (this.#kind !== "timeout")
      return null;
    return VerificationSkipped.reconstitute({ target, reason: "timeout", detail: "temporal check exceeded its budget" });
  }
  isViolation() {
    return this.#kind === "violation";
  }
  witness() {
    const trace = this.#trace;
    return trace !== null ? VerificationWitness.trace(trace.toArray()) : VerificationWitness.model({});
  }
}
// src/requirements/domain/ir-model-decl.ts
class IrModelDecl {
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
  static reconstitute(seed) {
    return new IrModelDecl(seed);
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
      for (const [path, val] of sc.bindings()) {
        const t = attrTypes.get(path);
        if (!t) {
          errors.push(`${where}: binding for unknown attribute "${path}"`);
          continue;
        }
        if (!t.fitsBinding(val)) {
          errors.push(`${where}: binding value ${JSON.stringify(val)} does not fit ${t.kindLabel()} attribute "${path}"`);
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
// src/requirements/domain/ir-attribute-decl.ts
class IrAttributeDecl {
  #name;
  #kind;
  #values;
  #min;
  #max;
  constructor(props) {
    this.#name = props.name;
    this.#kind = AttributeKind.reconstitute(props.kind);
    this.#values = props.values;
    this.#min = props.min;
    this.#max = props.max;
  }
  static reconstitute(props) {
    return new IrAttributeDecl(props);
  }
  name() {
    return this.#name;
  }
  boundsInverted() {
    return this.#kind.isInt() && this.#min !== undefined && this.#max !== undefined && this.#min.exceeds(this.#max);
  }
  boundsOutsideSafeRange() {
    return this.#min !== undefined && !Number.isSafeInteger(this.#min.asNumber()) || this.#max !== undefined && !Number.isSafeInteger(this.#max.asNumber());
  }
  admitsEnumLiteral(value) {
    return this.#kind.isEnum() && (this.#values?.includes(value) ?? false);
  }
  fitsBinding(value) {
    return this.#kind.isBool() && typeof value === "boolean" || this.#kind.isInt() && typeof value === "number" && Number.isSafeInteger(value) || this.#kind.isEnum() && typeof value === "string" && (this.#values?.includes(value) ?? false);
  }
  kindLabel() {
    return this.#kind.asString();
  }
}
// src/requirements/domain/ir-attribute-decls.ts
class IrAttributeDecls {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new IrAttributeDecls([...values]);
  }
  add(value) {
    return new IrAttributeDecls([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/requirements/domain/ir-attribute-name.ts
class IrAttributeName {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (raw === "")
      return err({ kind: "empty-ir-decl-token", raw });
    return ok(new IrAttributeName(raw));
  }
  static reconstitute(raw) {
    return new IrAttributeName(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
}
// src/requirements/domain/ir-background-decl.ts
class IrBackgroundDecl {
  #id;
  #assert;
  constructor(props) {
    this.#id = props.id;
    this.#assert = props.assert;
  }
  static reconstitute(props) {
    return new IrBackgroundDecl(props);
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
// src/requirements/domain/ir-background-decls.ts
class IrBackgroundDecls {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new IrBackgroundDecls([...values]);
  }
  add(value) {
    return new IrBackgroundDecls([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/requirements/domain/ir-binding-pairs.ts
class IrBindingPairs {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new IrBindingPairs([...values]);
  }
  add(value) {
    return new IrBindingPairs([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/requirements/domain/ir-declared-values.ts
class IrDeclaredValues {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new IrDeclaredValues([...values]);
  }
  add(value) {
    return new IrDeclaredValues([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  includes(value) {
    return this.#values.includes(value);
  }
  toArray() {
    return this.#values;
  }
}
// src/requirements/domain/ir-entity-decl.ts
class IrEntityDecl {
  #name;
  #attributes;
  constructor(props) {
    this.#name = props.name;
    this.#attributes = props.attributes;
  }
  static reconstitute(props) {
    return new IrEntityDecl(props);
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
// src/requirements/domain/ir-entity-decls.ts
class IrEntityDecls {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new IrEntityDecls([...values]);
  }
  add(value) {
    return new IrEntityDecls([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/requirements/domain/ir-entity-name.ts
class IrEntityName {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (raw === "")
      return err({ kind: "empty-ir-decl-token", raw });
    return ok(new IrEntityName(raw));
  }
  static reconstitute(raw) {
    return new IrEntityName(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
}
// src/requirements/domain/ir-obligation-decl.ts
class IrObligationDecl {
  #id;
  #assert;
  #guard;
  #effect;
  #temporal;
  constructor(props) {
    this.#id = props.id;
    this.#assert = props.assert;
    this.#guard = props.guard;
    this.#effect = props.effect;
    this.#temporal = props.temporal;
  }
  static reconstitute(props) {
    return new IrObligationDecl(props);
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
// src/requirements/domain/ir-obligation-decls.ts
class IrObligationDecls {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new IrObligationDecls([...values]);
  }
  add(value) {
    return new IrObligationDecls([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/requirements/domain/ir-scenario-decl.ts
class IrScenarioDecl {
  #id;
  #bindings;
  #hasEvent;
  #expect;
  constructor(props) {
    this.#id = props.id;
    this.#bindings = props.bindings;
    this.#hasEvent = props.hasEvent;
    this.#expect = props.expect;
  }
  static reconstitute(props) {
    return new IrScenarioDecl(props);
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
// src/requirements/domain/ir-scenario-decls.ts
class IrScenarioDecls {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new IrScenarioDecls([...values]);
  }
  add(value) {
    return new IrScenarioDecls([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/requirements/domain/ir-temporal-decl.ts
class IrTemporalDecl {
  #assert;
  #from;
  #to;
  constructor(props) {
    this.#assert = props.assert;
    this.#from = props.from;
    this.#to = props.to;
  }
  static reconstitute(props) {
    return new IrTemporalDecl(props);
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
// src/requirements/domain/fr-reference-index.ts
class FrReferenceIndex {
  #ownersByRef;
  constructor(ownersByRef) {
    this.#ownersByRef = ownersByRef;
  }
  static of(claims) {
    const ownersByRef = new Map;
    for (const claim of claims)
      claim.claimInto(ownersByRef);
    return new FrReferenceIndex(KeyedIndex.of([...ownersByRef].map(([ref, owners]) => [RequirementId.reconstitute(ref), TargetIds.reconstitute(owners)])));
  }
  referencedIds() {
    return [...this.#ownersByRef.keys()].map((ref) => ref.asString());
  }
  missingErrors(known) {
    const missing = [...this.#ownersByRef.keys()].filter((ref) => !known.has(ref)).map((ref) => ref.asString()).sort();
    return missing.map((id) => {
      const owners = [...this.#ownersByRef.get(RequirementId.reconstitute(id))?.toStrings() ?? []].sort().join(", ");
      return `frRef "${id}" (used by ${owners}) does not exist in requirements.md`;
    });
  }
}
// src/requirements/domain/fr-ref-claim.ts
class FrRefClaim {
  #owner;
  #frRefs;
  constructor(owner, frRefs) {
    this.#owner = owner;
    this.#frRefs = frRefs;
  }
  static of(owner, frRefs) {
    return new FrRefClaim(owner, frRefs);
  }
  claimInto(ownersByRef) {
    for (const ref of this.#frRefs) {
      const owners = ownersByRef.get(ref.asString()) ?? [];
      owners.push(this.#owner);
      ownersByRef.set(ref.asString(), owners);
    }
  }
}
// src/requirements/domain/fr-ref-claims.ts
class FrRefClaims {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new FrRefClaims([...values]);
  }
  add(value) {
    return new FrRefClaims([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/requirements/domain/source-anchor.ts
class SourceAnchor {
  #declared;
  #actual;
  constructor(declared, actual) {
    this.#declared = declared === null ? null : ContentHash.reconstitute(declared);
    this.#actual = ContentHash.reconstitute(actual);
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
    if (!this.#declared.equals(this.#actual)) {
      return [
        `sourceDigest ${this.#declared.asString()} does not match requirements.md (sha256 ${this.#actual.asString()}) \u2014 the requirements changed since formalization; re-formalize against the current text and restamp the digest`
      ];
    }
    return [];
  }
}
// src/requirements/domain/requirements-source-id.ts
class RequirementsSourceId {
  #recordRoot;
  constructor(recordRoot) {
    this.#recordRoot = recordRoot;
  }
  static of(recordRoot) {
    return new RequirementsSourceId(recordRoot);
  }
  equals(other) {
    return this.#recordRoot.equals(other.#recordRoot);
  }
  recordRoot() {
    return this.#recordRoot;
  }
}
// src/requirements/domain/formal-model-id.ts
class FormalModelId {
  #path;
  constructor(path) {
    this.#path = path;
  }
  static of(path) {
    return new FormalModelId(path);
  }
  equals(other) {
    return this.#path.equals(other.#path);
  }
  artifactPath() {
    return this.#path;
  }
}
// src/requirements/domain/ir-validation-materials.ts
class IrValidationMaterials {
  #id;
  #irVersion;
  #schemaErrors;
  #view;
  #frClaims;
  #declaredDigest;
  #sourceId;
  #sourceDocument;
  constructor(seed) {
    this.#id = seed.id;
    this.#irVersion = seed.irVersion;
    this.#schemaErrors = seed.schemaErrors;
    this.#view = seed.view;
    this.#frClaims = seed.frClaims;
    this.#declaredDigest = seed.declaredDigest === null ? null : ContentHash.reconstitute(seed.declaredDigest);
    this.#sourceId = seed.sourceId;
    this.#sourceDocument = new Uint8Array(seed.sourceDocument);
  }
  static reconstitute(seed) {
    return new IrValidationMaterials(seed);
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
  frReferenceIndex() {
    return FrReferenceIndex.of(this.#frClaims.toArray());
  }
  declaredDigest() {
    return this.#declaredDigest?.asString() ?? null;
  }
  sourceId() {
    return this.#sourceId;
  }
  sourceDocument() {
    return new Uint8Array(this.#sourceDocument);
  }
}
// src/requirements/domain/ir-validation-materials-id.ts
class IrValidationMaterialsId {
  #model;
  constructor(model) {
    this.#model = model;
  }
  static ofModel(model) {
    return new IrValidationMaterialsId(model);
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
    this.#digest = ContentHash.reconstitute(seed.digest);
    this.#sourceDocument = new Uint8Array(seed.sourceDocument);
  }
  static reconstitute(seed) {
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
    return this.#digest.asString();
  }
  sourceDocument() {
    return new Uint8Array(this.#sourceDocument);
  }
}
// src/refinement/domain/refinement-map-defect.ts
class RefinementMapDefect {
  #kind;
  #reqPath;
  constructor(kind, reqPath) {
    this.#kind = kind;
    this.#reqPath = reqPath;
  }
  static uncoveredAttribute(reqPath) {
    return new RefinementMapDefect("uncovered-attribute", AttributePath.reconstitute(reqPath));
  }
  static enumMappingOutsideEquality(reqPath) {
    return new RefinementMapDefect("enum-mapping-outside-equality", AttributePath.reconstitute(reqPath));
  }
  static unspecifiedMapping(reqPath) {
    return new RefinementMapDefect("unspecified-mapping", AttributePath.reconstitute(reqPath));
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
    return DesignSkipped.reconstitute({ target, reason: "compile-error", unit, detail: `alpha substitution failed: ${this.message()}` });
  }
}

// src/refinement/domain/attribute-mapping.ts
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
    this.#variant = variant;
  }
  static expression(req, expr) {
    return new AttributeMapping(req, { kind: "expression", expr });
  }
  static enumCases(req, from, cases) {
    return new AttributeMapping(req, { kind: "enum-cases", from, cases: { ...cases } });
  }
  static unspecified(req) {
    return new AttributeMapping(req, { kind: "unspecified" });
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
    return this.#variant.kind === "enum-cases" ? this.#variant.from : undefined;
  }
  expandComparison(op, reqValue, primed) {
    const variant = this.#variant;
    if (variant.kind !== "enum-cases")
      return null;
    const from = { op: "ref", path: variant.from, ...primed ? { prime: true } : {} };
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
      const values = ReqAttributeValues.of(Object.values(variant.cases)).sortedUniqueCanonically().toArray();
      const classes = values.map((reqValue) => {
        const members = Object.entries(variant.cases).filter(([, rv]) => rv === reqValue).map(([d]) => d).sort();
        const inClass = (primed) => {
          const refNode = { op: "ref", path: variant.from, ...primed ? { prime: true } : {} };
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
    return ReqAttributeValues.of(Object.values(variant.cases).filter((rv) => !(reqValues?.includes(rv) ?? false))).sortedUniqueCanonically().toArray();
  }
  referencedPaths() {
    const variant = this.#variant;
    if (variant.kind !== "expression")
      return [];
    return ExpressionTree.of(variant.expr).referencedPaths();
  }
}
// src/refinement/domain/attribute-mappings.ts
class AttributeMappings {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new AttributeMappings([...values]);
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
// src/refinement/domain/event-mapping.ts
class EventMapping {
  #reqTrigger;
  #transitions;
  #reason;
  constructor(props) {
    this.#reqTrigger = props.reqTrigger;
    this.#transitions = props.transitions;
    this.#reason = props.reason;
  }
  static reconstitute(props) {
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
// src/refinement/domain/event-mappings.ts
class EventMappings {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new EventMappings([...values]);
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
// src/refinement/domain/refinement-unit-map.ts
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
  static reconstitute(props) {
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
// src/refinement/domain/refinement-unit-maps.ts
class RefinementUnitMaps {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new RefinementUnitMaps([...values]);
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
// src/refinement/domain/transition-ref.ts
class TransitionRef {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (raw === "")
      return err({ kind: "empty-refinement-map-token", raw });
    return ok(new TransitionRef(raw));
  }
  static reconstitute(raw) {
    return new TransitionRef(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  compareTo(other) {
    return TargetId.reconstitute(this.#value).compareTo(TargetId.reconstitute(other.#value));
  }
  asString() {
    return this.#value;
  }
}
// src/refinement/domain/transition-refs.ts
class TransitionRefs {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new TransitionRefs([...values]);
  }
  add(value) {
    return new TransitionRefs([...this.#values, value]);
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
// src/refinement/domain/unmapped-declarations.ts
function tokenOf(carrier) {
  return typeof carrier === "string" ? carrier : carrier.asString();
}

class UnmappedDeclarations {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new UnmappedDeclarations([...values]);
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
// src/refinement/domain/unmapped-target-ref.ts
class UnmappedTargetRef {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (raw === "")
      return err({ kind: "empty-refinement-map-token", raw });
    return ok(new UnmappedTargetRef(raw));
  }
  static reconstitute(raw) {
    return new UnmappedTargetRef(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
}
// src/refinement/domain/unmapped-target.ts
class UnmappedTarget {
  #target;
  #reason;
  constructor(target, reason) {
    this.#target = target;
    this.#reason = reason;
  }
  static reconstitute(props) {
    return new UnmappedTarget(props.target, props.reason);
  }
  isFor(token) {
    return this.#target.asString() === token;
  }
  reason() {
    return this.#reason;
  }
}
// src/refinement/domain/refinement-quint-invariants.ts
class RefinementQuintInvariants {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new RefinementQuintInvariants([...values]);
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
  toArray() {
    return this.#values;
  }
}

// src/refinement/domain/refinement-quint-invariant.ts
class RefinementQuintInvariant {
  #reqId;
  #frRefs;
  #expr;
  constructor(reqId, frRefs, expr) {
    this.#reqId = reqId;
    this.#frRefs = frRefs;
    this.#expr = expr;
  }
  static of(reqId, frRefs, expr) {
    return new RefinementQuintInvariant(reqId, frRefs, expr);
  }
  reqId() {
    return this.#reqId;
  }
  reqTarget() {
    return this.#reqId.asTargetId();
  }
  loweredAs(id) {
    return LoweredObligation.reconstitute({ id, nature: "invariant", frRefs: this.#frRefs, assert: this.#expr });
  }
}

// src/refinement/domain/refinement-status.ts
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
      return DesignSkipped.reconstitute({ target, reason: "waived", unit, detail: this.#text });
    if (this.#kind === "capability")
      return DesignSkipped.reconstitute({ target, reason: "capability", unit, detail: this.#text });
    return null;
  }
}

// src/refinement/domain/unit-refinement-plan.ts
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
    const gap = (targets, detail, frRefs = FrRefs.of([])) => {
      gaps.push(DesignFinding.reconstitute({
        kind: "mapping-gap",
        frRefs: frRefs.sortedUnique(),
        targets: TargetIds.reconstitute(targets).sortedUniqueCanonically(),
        witness: DesignWitness.refs([{ artifact: mapArtifact.asString(), element: `units[${unitMap.unit().asString()}]` }]),
        unit: u.name(),
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
      const reqAttr = req.attributes().byPath(AttributePath.reconstitute(reqPath));
      if (!reqAttr) {
        gap(gapTarget, `attrMap entry "${reqPath}" names no attribute of the requirements IR`);
        continue;
      }
      if (m.isEnumCases()) {
        const from = m.enumFrom() ?? "";
        if (!reqAttr.isEnum()) {
          gap(gapTarget, `attrMap entry "${reqPath}" uses enumMap but the requirements attribute is ${reqAttr.kind()}`);
        }
        if (!u.attrPaths().has(from)) {
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
          if (!u.attrPaths().has(r)) {
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
        const missing = [...new Set([...covG.missing, ...covE.missing])].sort((a, b) => AttributePath.reconstitute(a).compareTo(AttributePath.reconstitute(b)));
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
      const missing = Object.keys(sc.bindings()).filter((p) => !byReq.has(p)).sort();
      if (missing.length === 0)
        scenarioStatus.set(sc.id().asString(), RefinementStatus.checkable());
      else if (unmapped.coversAll(missing)) {
        scenarioStatus.set(sc.id().asString(), RefinementStatus.waived(`binds unmapped attribute(s) ${missing.join(", ")}`));
      } else {
        scenarioStatus.set(sc.id().asString(), RefinementStatus.gap(`binds attribute(s) ${missing.join(", ")} that are neither mapped nor in unmapped[]`));
      }
    }
    for (const [id, st] of [...obligationStatus.entries()].sort((a, b) => TargetId.reconstitute(a[0]).compareTo(TargetId.reconstitute(b[0])))) {
      const gapDetail = st.gapDetail();
      if (gapDetail !== null) {
        gap([id], `${id}: ${gapDetail}`, req.obligationById(id)?.frRefs() ?? FrRefs.of([]));
      }
    }
    for (const [id, st] of [...scenarioStatus.entries()].sort((a, b) => TargetId.reconstitute(a[0]).compareTo(TargetId.reconstitute(b[0])))) {
      const gapDetail = st.gapDetail();
      if (gapDetail !== null) {
        gap([id], `${id}: ${gapDetail}`, req.scenarioById(id)?.frRefs() ?? FrRefs.of([]));
      }
    }
    return new UnitRefinementPlan({
      mappings: unitMap.attrMap(),
      obligationStatus: KeyedIndex.of([...obligationStatus].map(([id, st]) => [ObligationId.reconstitute(id), st])),
      scenarioStatus: KeyedIndex.of([...scenarioStatus].map(([id, st]) => [ScenarioId.reconstitute(id), st])),
      eventTransitions: KeyedIndex.of([...eventTransitions].map(([id, trs]) => [ObligationId.reconstitute(id), trs])),
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
    return [...this.#obligationStatus].map(([id, st]) => [id.asString(), st]).sort((a, b) => TargetId.reconstitute(a[0]).compareTo(TargetId.reconstitute(b[0])));
  }
  sortedScenarioStatuses() {
    return [...this.#scenarioStatus].map(([id, st]) => [id.asString(), st]).sort((a, b) => TargetId.reconstitute(a[0]).compareTo(TargetId.reconstitute(b[0])));
  }
  statusOfObligation(id) {
    return this.#obligationStatus.get(ObligationId.reconstitute(id));
  }
  statusOfScenario(id) {
    return this.#scenarioStatus.get(ScenarioId.reconstitute(id));
  }
  mappedTransitionsOf(reqId) {
    return this.#eventTransitions.get(ObligationId.reconstitute(reqId)) ?? [];
  }
  smtStatusSkips(unitName) {
    const skipped = [];
    for (const [id, st] of this.sortedObligationStatuses()) {
      const s = st.skipFor(TargetId.reconstitute(id), unitName);
      if (s !== null)
        skipped.push(s);
    }
    for (const [id, st] of this.sortedScenarioStatuses()) {
      const s = st.skipFor(TargetId.reconstitute(id), unitName);
      if (s !== null)
        skipped.push(s);
    }
    return DesignSkips.of(skipped);
  }
  quintStatusSkips(req, unitName) {
    const skipped = [];
    for (const [rid, st] of [...this.#obligationStatus].map(([id, status]) => [id.asString(), status]).sort((a, b) => a[0] < b[0] ? -1 : 1)) {
      const s = st.skipFor(TargetId.reconstitute(rid), unitName);
      if (s !== null)
        skipped.push(s);
      else if (st.isCheckable()) {
        const ob = req.obligationById(rid);
        if (ob !== undefined && ob.isEvent()) {
          skipped.push(DesignSkipped.reconstitute({ target: TargetId.reconstitute(rid), reason: "capability", unit: unitName, detail: "event simulation and enabledness are checked by the SMT refinement pass only in v1" }));
        } else if (ob !== undefined && ob.isInvariantLike()) {
          const assertion = ob.assertion();
          if (assertion === undefined)
            continue;
          const substituted = this.#mappings.substitute(assertion, false);
          if (!substituted.ok)
            skipped.push(substituted.error.asCompileErrorSkip(TargetId.reconstitute(rid), unitName));
        }
      }
    }
    for (const [rid, st] of [...this.#scenarioStatus].map(([id, status]) => [id.asString(), status]).sort((a, b) => a[0] < b[0] ? -1 : 1)) {
      const s = st.skipFor(TargetId.reconstitute(rid), unitName);
      if (s !== null)
        skipped.push(s);
      else if (st.isCheckable()) {
        skipped.push(DesignSkipped.reconstitute({ target: TargetId.reconstitute(rid), reason: "capability", unit: unitName, detail: "scenario replay is checked by the SMT refinement pass only in v1 (abstract constraints do not determine a concrete init)" }));
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
        out.push(RefinementQuintInvariant.of(ob.id(), ob.frRefs(), substituted.value));
    }
    return RefinementQuintInvariants.of(out);
  }
}
// src/refinement/domain/effect-assignments.ts
class EffectAssignments {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static ofEffect(effect) {
    const assignments = [];
    const terms = [];
    const flatten = (e) => {
      if (e.op === "and")
        for (const a of e.args ?? [])
          flatten(a);
      else
        terms.push(e);
    };
    flatten(effect);
    for (const term of terms) {
      if (term.op !== "eq")
        return err(RefinementMapDefect.effectNotAssignmentConjunction());
      const [a, b] = term.args ?? [];
      const target = a?.op === "ref" && a.prime === true ? a : b?.op === "ref" && b.prime === true ? b : null;
      if (!target || typeof target.path !== "string")
        return err(RefinementMapDefect.effectNotAssignmentConjunction());
      assignments.push([AttributePath.reconstitute(target.path), term]);
    }
    return ok(new EffectAssignments(KeyedIndex.of(assignments)));
  }
  covers(path) {
    return this.#values.has(path);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
}
// src/refinement/domain/design-assignments.ts
class DesignAssignments {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new DesignAssignments(values);
  }
  rhsOf(path) {
    return this.#values.get(path);
  }
}

// src/refinement/domain/design-event.ts
class DesignEvent {
  #guard;
  #effectAssign;
  constructor(guard, effectAssign) {
    this.#guard = guard;
    this.#effectAssign = effectAssign;
  }
  static of(guard, effectAssign) {
    return new DesignEvent(guard, effectAssign);
  }
  guard() {
    return this.#guard;
  }
  assignedRhsOf(path) {
    return this.#effectAssign.rhsOf(AttributePath.reconstitute(path));
  }
}

// src/refinement/domain/design-event-catalog.ts
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
        effectAssign.push([AttributePath.reconstitute(statePath), stateRhs]);
        const explicitEffect = tr.effect();
        if (explicitEffect !== undefined) {
          const assigned = EffectAssignments.ofEffect(explicitEffect);
          if (assigned.ok) {
            for (const [path, term] of assigned.value) {
              const rhs = rhsOf(term);
              if (rhs)
                effectAssign.push([path, rhs]);
            }
          }
        }
        out.push([TargetId.reconstitute(tr.id().asString()), DesignEvent.of(guard, DesignAssignments.of(KeyedIndex.of(effectAssign)))]);
      }
    }
    for (const ob of u.obligations()) {
      const event = ob.guardedEffect();
      if (event === null)
        continue;
      const effectAssign = [];
      const assigned = EffectAssignments.ofEffect(event.effect);
      if (!assigned.ok)
        continue;
      for (const [path, term] of assigned.value) {
        const rhs = rhsOf(term);
        if (rhs)
          effectAssign.push([path, rhs]);
      }
      out.push([TargetId.reconstitute(ob.id().asString()), DesignEvent.of(event.guard, DesignAssignments.of(KeyedIndex.of(effectAssign)))]);
    }
    return new DesignEventCatalog(KeyedIndex.of(out));
  }
  eventOf(id) {
    return this.#events.get(id) ?? null;
  }
}
// src/refinement/domain/refinement-solver-plan.ts
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
    const frOf = (reqId) => req.frRefsOf(reqId).sortedUnique();
    for (const [queryId, p] of this.#pending) {
      const r = results.verdictOf(queryId);
      if (!r || r.isUndecided()) {
        skipped.push(DesignSkipped.reconstitute({ target: p.reqTarget(), reason: "timeout", unit: unitName, detail: `refinement query ${queryId.asString()} exceeded the solver budget or errored` }));
        continue;
      }
      p.match({
        invariant: (reqId) => {
          if (r.isSat()) {
            findings.push(DesignFinding.reconstitute({
              kind: "refinement-violation",
              frRefs: frOf(reqId.asString()),
              targets: TargetIds.reconstitute([reqId.asString()]),
              witness: DesignWitness.model(r.witnessModel()),
              unit: unitName,
              detail: `A design-legal state of unit ${unitName} violates requirements obligation ${reqId.asString()} under the refinement map (witness design state attached). The design admits what the verified requirements forbid.`
            }));
          }
        },
        scenario: (reqId) => {
          const sc = req.scenarioById(reqId.asString());
          if (sc?.isAccept() === true && r.isUnsat()) {
            findings.push(DesignFinding.reconstitute({
              kind: "refinement-violation",
              frRefs: frOf(reqId.asString()),
              targets: TargetIds.reconstitute([reqId.asString()]),
              witness: DesignWitness.core(r.sortedCore()),
              unit: unitName,
              detail: `Accept scenario ${reqId.asString()} has no design-legal counterpart in unit ${unitName} under the refinement map: the design excludes an example the requirements accept (witness core attached).`
            }));
          }
          if (sc?.isReject() === true && r.isSat()) {
            findings.push(DesignFinding.reconstitute({
              kind: "refinement-violation",
              frRefs: frOf(reqId.asString()),
              targets: TargetIds.reconstitute([reqId.asString()]),
              witness: DesignWitness.model(r.witnessModel()),
              unit: unitName,
              detail: `Reject scenario ${reqId.asString()} is still admitted by unit ${unitName} under the refinement map: the design does not exclude an example the requirements reject (witness design state attached).`
            }));
          }
        },
        enabledness: (reqId) => {
          if (r.isSat()) {
            findings.push(DesignFinding.reconstitute({
              kind: "completeness-gap",
              frRefs: frOf(reqId.asString()),
              targets: TargetIds.reconstitute([reqId.asString(), ...plan.mappedTransitionsOf(reqId.asString()).map((t) => t.asString())]).sortedUniqueCanonically(),
              witness: DesignWitness.model(r.witnessModel()),
              unit: unitName,
              detail: `The requirements event ${reqId.asString()} applies in the witness design state, but none of its mapped design transitions is enabled there: the design has no answer in a region the requirement covers.`
            }));
          }
        },
        simulation: (reqId, designId) => {
          if (r.isSat()) {
            findings.push(DesignFinding.reconstitute({
              kind: "refinement-violation",
              frRefs: frOf(reqId.asString()),
              targets: TargetIds.reconstitute([reqId.asString(), designId.asString()].filter((t) => t !== "")).sortedUniqueCanonically(),
              witness: DesignWitness.trace(r.witnessTrace()),
              unit: unitName,
              detail: `Design step ${designId.asString()} of unit ${unitName}, taken where requirements event ${reqId.asString()} applies, produces an abstract post-state that violates the requirements effect or the abstract frame (pre/post design states attached).`
            }));
          }
        }
      });
    }
    return { findings: DesignFindings.of(findings), skipped: DesignSkips.of(skipped) };
  }
}
// src/refinement/domain/refinement-probe.ts
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
// src/refinement/domain/refinement-query-verdict.ts
class RefinementQueryVerdict {
  #status;
  #decodedModel;
  #decodedPostModel;
  #core;
  constructor(props) {
    this.#status = props.status;
    this.#decodedModel = props.decodedModel === undefined ? undefined : { ...props.decodedModel };
    this.#decodedPostModel = props.decodedPostModel === undefined ? undefined : { ...props.decodedPostModel };
    this.#core = props.core === undefined ? undefined : props.core.map((label) => QueryLabel.reconstitute(label));
  }
  static reconstitute(props) {
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
// src/refinement/domain/refinement-query-verdicts.ts
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
// src/refinement/domain/refinement-map-id.ts
class RefinementMapId {
  #path;
  constructor(path) {
    this.#path = path;
  }
  static of(path) {
    return new RefinementMapId(path);
  }
  equals(other) {
    return this.#path.equals(other.#path);
  }
  artifactPath() {
    return this.#path;
  }
}
// src/refinement/domain/refinement-materials.ts
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
// src/refinement/domain/refinement-map-acquisition.ts
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
// src/design/adapter/refinement-query-plan.ts
class SmtCompileError extends Error {
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
        ...values !== null ? { values: [...values.toArray()] } : {}
      });
    }
  }
  return { attrs, byPath: new Map(attrs.map((a) => [a.path, a])) };
}
function enumCode(ctx, attrPath, value) {
  const attr = ctx.byPath.get(attrPath);
  if (!attr || attr.kind !== "enum" || !attr.values)
    throw new SmtCompileError(`"${attrPath}" is not an enum attribute`);
  const idx = attr.values.indexOf(value);
  if (idx < 0)
    throw new SmtCompileError(`enum value "${value}" is not declared on "${attrPath}"`);
  return idx;
}
function smtOfExpr(ctx, e) {
  const bin = (op) => {
    const [a, b] = e.args ?? [];
    if (!a || !b)
      throw new SmtCompileError(`operator "${e.op}" needs two arguments`);
    const refArg = a.op === "ref" ? a : b.op === "ref" ? b : null;
    const enumArg = a.op === "enum" ? a : b.op === "enum" ? b : null;
    if (enumArg && refArg && typeof refArg.path === "string" && typeof enumArg.value === "string") {
      const code = String(enumCode(ctx, refArg.path, enumArg.value));
      const left = a === enumArg ? code : smtOfExpr(ctx, a);
      const right = b === enumArg ? code : smtOfExpr(ctx, b);
      return `(${op} ${left} ${right})`;
    }
    if (enumArg)
      throw new SmtCompileError("enum literal without a ref sibling has no resolvable encoding");
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
        throw new SmtCompileError(`unresolvable reference "${e.path ?? ""}"`);
      return smtVar(e.path, e.prime === true);
    }
    case "bool":
      return e.value === true ? "true" : "false";
    case "int": {
      const n = typeof e.value === "number" ? e.value : Number.NaN;
      if (!Number.isInteger(n))
        throw new SmtCompileError("int literal is not an integer");
      return smtLit(n);
    }
    default:
      throw new SmtCompileError(`unknown operator "${e.op}"`);
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
      } catch {}
    }
    for (const ob of u.obligations()) {
      const assertion = ob.assertion();
      if (ob.isInvariantLike() && assertion !== undefined) {
        try {
          constraints.push({ name: smtName("inv", ob.id().asString()), smt: smtOfExpr(ctx, assertion) });
        } catch {}
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
    compileSkips.push(DesignSkipped.reconstitute({ target: TargetId.reconstitute(target), reason: "compile-error", unit: u.name(), detail: `alpha substitution failed: ${message}` }));
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
        pending.set(q.id, RefinementProbe.invariant(ObligationId.reconstitute(obId)));
      } catch (err2) {
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
        const designGuards = mapped.map((id) => catalog.eventOf(TargetId.reconstitute(id.asString()))).filter((d) => d !== null).map((d) => smtOfExpr(ctx, d.guard()));
        const notEnabled = designGuards.length === 0 ? "true" : `(not (or ${designGuards.join(" ")}))`;
        const qe = assembleQuery(`re:${obId}`, pre.decls, [
          ...pre.constraints,
          { name: smtName("ag", obId), smt: smtOfExpr(ctx, alphaG.value) },
          { name: smtName("ne", obId), smt: notEnabled }
        ], modelVars);
        queries.push(qe);
        pending.set(qe.id, RefinementProbe.enabledness(ObligationId.reconstitute(obId)));
        const decomposed = EffectAssignments.ofEffect(event.effect);
        if (!decomposed.ok) {
          alphaFail(obId, decomposed.error.message());
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
          const ev = catalog.eventOf(TargetId.reconstitute(designId.asString()));
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
          pending.set(qs.id, RefinementProbe.simulation(ObligationId.reconstitute(obId), designId));
        }
      } catch (err2) {
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
      for (const [path, value] of sc.bindingEntriesCanonically()) {
        const lit = typeof value === "boolean" ? { op: "bool", value } : typeof value === "number" ? { op: "int", value } : { op: "enum", value };
        const constraint = { op: "eq", args: [{ op: "ref", path }, lit] };
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
      pending.set(q.id, RefinementProbe.scenario(ScenarioId.reconstitute(scId)));
    } catch (err2) {
      alphaFail(scId, failureMessage(err2));
    }
  }
  return {
    queries,
    plan: RefinementSolverPlan.of({ pending: KeyedIndex.of([...pending].map(([id, probe]) => [QueryLabel.reconstitute(id), probe])), compileSkips: DesignSkips.of(compileSkips) }),
    context: ctx
  };
}
// src/design/adapter/refinement-materials-repository-impl.ts
import { existsSync as existsSync4, readFileSync as readFileSync5 } from "fs";
import { dirname as dirname3, join as join5 } from "path";
var REFINEMENT_MAP_BASENAME = "deep-spec-analysis-refinement-map.md";
var REQUIREMENTS_MODEL_RELPATH = ["inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md"];
function extractSingleJsonFence(md) {
  const fences = extractFences(md, "json");
  return fences.length === 1 ? fences[0]?.body ?? null : null;
}

class RefinementMaterialsRepositoryImpl {
  #mapSchemaPath;
  constructor(mapSchemaPath) {
    this.#mapSchemaPath = mapSchemaPath;
  }
  findById(id) {
    const modelPath = id.modelArtifactPath().asString();
    const recordRoot = findRecordRoot(dirname3(modelPath));
    const requirements = recordRoot === null ? null : this.#loadRequirements(recordRoot);
    if (recordRoot === null || requirements === null)
      return RefinementMaterials.inactive(id);
    const stageDir = dirname3(modelPath);
    return RefinementMaterials.active(id, requirements, this.#loadMap(recordRoot, stageDir, modelPath));
  }
  #loadRequirements(recordRoot) {
    const path = join5(recordRoot, ...REQUIREMENTS_MODEL_RELPATH);
    const idPath = ArtifactPath.parse(path);
    if (!idPath.ok)
      return null;
    if (!existsSync4(path))
      return null;
    const fence = extractSingleJsonFence(readFileSync5(path, "utf-8"));
    if (fence === null)
      return null;
    let raw;
    try {
      raw = JSON.parse(fence);
    } catch {
      return null;
    }
    if (!isObject(raw))
      return null;
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
        attributes.push(RefinementAttribute.reconstitute({
          path: AttributePath.reconstitute(`${ent.name}.${attr.name}`),
          kind: t.kind,
          values: Array.isArray(t.values) ? ReqAttributeValues.of(t.values.filter((v) => typeof v === "string")) : undefined
        }));
      }
    }
    const obligations = [];
    for (const ob of Array.isArray(raw.obligations) ? raw.obligations : []) {
      if (!isObject(ob) || typeof ob.id !== "string" || typeof ob.nature !== "string")
        continue;
      obligations.push(RefinementObligation.reconstitute({
        id: ObligationId.reconstitute(ob.id),
        nature: ObligationNature.reconstitute(ob.nature),
        frRefs: FrRefs.reconstitute(strArr(ob.frRefs)),
        assert: isObject(ob.assert) ? ob.assert : undefined,
        trigger: typeof ob.trigger === "string" ? TriggerName.reconstitute(ob.trigger) : undefined,
        guard: isObject(ob.guard) ? ob.guard : undefined,
        effect: isObject(ob.effect) ? ob.effect : undefined
      }));
    }
    const scenarios = [];
    for (const sc of Array.isArray(raw.scenarios) ? raw.scenarios : []) {
      if (!isObject(sc) || typeof sc.id !== "string" || !isObject(sc.bindings))
        continue;
      if (sc.kind !== "accept" && sc.kind !== "reject")
        continue;
      const bindings = {};
      for (const [k, v] of Object.entries(sc.bindings)) {
        if (typeof v === "boolean" || typeof v === "number" || typeof v === "string")
          bindings[k] = v;
      }
      scenarios.push(RefinementScenario.reconstitute({
        id: ScenarioId.reconstitute(sc.id),
        kind: sc.kind,
        frRefs: FrRefs.reconstitute(strArr(sc.frRefs)),
        bindings,
        event: isObject(sc.event) && typeof sc.event.trigger === "string" ? { trigger: TriggerName.reconstitute(sc.event.trigger) } : undefined
      }));
    }
    return RefinementRequirements.reconstitute({
      id: FormalModelId.of(idPath.value),
      hash: ContentHash.ofText(canonicalStringify(raw)),
      attributes: RefinementAttributes.of(attributes),
      obligations: RefinementObligations.of(obligations),
      scenarios: RefinementScenarios.of(scenarios)
    });
  }
  #loadMap(recordRoot, stageDir, modelPath) {
    const path = join5(stageDir, REFINEMENT_MAP_BASENAME);
    if (!existsSync4(path))
      return RefinementMapAcquisition.absent(null);
    const mapPath = ArtifactPath.parse(path);
    if (!mapPath.ok)
      return RefinementMapAcquisition.absent("defect: refinement map path derivation produced an empty path");
    const parsed = parseRefinementMapDocument(new Uint8Array(readFileSync5(path)), RefinementMapId.of(mapPath.value), this.#mapSchemaPath);
    if (parsed.kind === "malformed")
      return RefinementMapAcquisition.absent(parsed.error);
    const map = parsed.map;
    const reqModelPath = join5(recordRoot, ...REQUIREMENTS_MODEL_RELPATH);
    const mapArtifact = relArtifact(recordRoot, path);
    const inputs = [
      DesignInputAnchor.reconstitute({ artifact: relArtifact(recordRoot, modelPath), sha256: ContentHash.ofText(readFileSync5(modelPath, "utf-8")) }),
      DesignInputAnchor.reconstitute({ artifact: mapArtifact, sha256: ContentHash.ofText(readFileSync5(path, "utf-8")) }),
      DesignInputAnchor.reconstitute({ artifact: relArtifact(recordRoot, reqModelPath), sha256: ContentHash.ofText(readFileSync5(reqModelPath, "utf-8")) })
    ];
    return RefinementMapAcquisition.loaded(map, ArtifactPath.reconstitute(mapArtifact), inputs);
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
    const schemaDoc = JSON.parse(readFileSync5(mapSchemaPath, "utf-8"));
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
      if (isObject(m.enumMap) && typeof m.enumMap.from === "string" && isObject(m.enumMap.cases)) {
        const cases = {};
        for (const [k, v] of Object.entries(m.enumMap.cases)) {
          if (typeof v === "string")
            cases[k] = v;
        }
        attrMap.push(AttributeMapping.enumCases(AttributePath.reconstitute(m.req), m.enumMap.from, cases));
      } else if (isObject(m.expr)) {
        attrMap.push(AttributeMapping.expression(AttributePath.reconstitute(m.req), m.expr));
      } else {
        attrMap.push(AttributeMapping.unspecified(AttributePath.reconstitute(m.req)));
      }
    }
    const eventMap = [];
    for (const e of Array.isArray(u.eventMap) ? u.eventMap : []) {
      if (!isObject(e) || typeof e.reqTrigger !== "string")
        continue;
      eventMap.push(EventMapping.reconstitute({
        reqTrigger: TriggerName.reconstitute(e.reqTrigger),
        transitions: TransitionRefs.of(strArr(e.transitions).map((t) => TransitionRef.reconstitute(t))),
        waived: isObject(e.waived) && typeof e.waived.reason === "string" ? { reason: e.waived.reason } : undefined
      }));
    }
    const unmapped = [];
    for (const un of Array.isArray(u.unmapped) ? u.unmapped : []) {
      if (isObject(un) && typeof un.target === "string") {
        unmapped.push(UnmappedTarget.reconstitute({ target: UnmappedTargetRef.reconstitute(un.target), reason: typeof un.reason === "string" ? un.reason : "" }));
      }
    }
    units.push(RefinementUnitMap.reconstitute({
      unit: DesignUnitId.of(u.unit),
      attrMap: AttributeMappings.of(attrMap),
      eventMap: EventMappings.of(eventMap),
      unmapped: UnmappedDeclarations.of(unmapped)
    }));
  }
  return {
    kind: "parsed",
    map: RefinementMap.reconstitute({
      id,
      requirementsIrHash: ContentHash.reconstitute(typeof doc.requirementsIrHash === "string" ? doc.requirementsIrHash : ""),
      designIrHash: ContentHash.reconstitute(typeof doc.designIrHash === "string" ? doc.designIrHash : ""),
      units: RefinementUnitMaps.of(units),
      sourceDocument: bytes
    })
  };
}
// src/design/adapter/refinement-solver-client-impl.ts
import { spawnSync as spawnSync2 } from "child_process";
class RefinementSolverClientImpl {
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
      verdicts.push([QueryLabel.reconstitute(queryId), RefinementQueryVerdict.reconstitute({
        status: r.status,
        decodedModel: r.status === "sat" ? decodeDesignModel(built.context, r.model ?? {}, false) : undefined,
        decodedPostModel: r.status === "sat" ? decodeDesignModel(built.context, r.model ?? {}, true) : undefined,
        core: r.core
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
// src/design/adapter/design-ir-validation-materials-repository-impl.ts
import { existsSync as existsSync5, readFileSync as readFileSync6 } from "fs";
import { basename as basename2, dirname as dirname4, join as join6 } from "path";
var DESIGN_MODEL_BASENAME = "deep-spec-analysis-functional-formal-model.md";
function asExpression(v) {
  return isObject(v) ? v : undefined;
}
function strArrayOrUndefined(v) {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : undefined;
}
function brRefsOrUndefined(v) {
  const arr = strArrayOrUndefined(v);
  return arr === undefined ? undefined : BrRefs.reconstitute(arr);
}
function buildUnitView(rawUnit, unitName, recordRoot) {
  const entities = parseDesignEntities(isObject(rawUnit.schema) ? rawUnit.schema : {});
  const obligations = [];
  for (const ob of Array.isArray(rawUnit.obligations) ? rawUnit.obligations : []) {
    if (!isObject(ob) || typeof ob.id !== "string")
      continue;
    const temporal = isObject(ob.temporal) ? ob.temporal : null;
    obligations.push(DesignObligationDecl.reconstitute({
      id: DesignObligationId.reconstitute(ob.id),
      origin: typeof ob.origin === "string" ? DesignObligationOrigin.reconstitute(ob.origin) : undefined,
      brRefs: brRefsOrUndefined(ob.brRefs ?? null),
      assert: asExpression(ob.assert ?? null),
      guard: asExpression(ob.guard ?? null),
      effect: asExpression(ob.effect ?? null),
      temporal: temporal === null ? undefined : {
        assert: asExpression(temporal.assert ?? null),
        from: asExpression(temporal.from ?? null),
        to: asExpression(temporal.to ?? null)
      }
    }));
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
      transitions.push(DesignTransitionDecl.reconstitute({
        id: DesignTransitionId.reconstitute(tr.id),
        from: typeof tr.from === "string" ? tr.from : undefined,
        to: typeof tr.to === "string" ? tr.to : undefined,
        trigger: typeof tr.trigger === "string" ? TriggerName.reconstitute(tr.trigger) : undefined,
        brRefs: brRefsOrUndefined(tr.brRefs ?? null),
        guard: asExpression(tr.guard ?? null),
        effect: asExpression(tr.effect ?? null)
      }));
    }
    const ignores = [];
    for (const ig of Array.isArray(sm.ignores) ? sm.ignores : []) {
      if (!isObject(ig) || typeof ig.state !== "string" || typeof ig.trigger !== "string")
        continue;
      ignores.push(DesignIgnoreDecl.reconstitute({ state: ig.state, trigger: TriggerName.reconstitute(ig.trigger) }));
    }
    stateMachines.push(DesignMachineDecl.reconstitute({ id: DesignMachineId.reconstitute(sm.id), attrPath, initial: InitialStates.of(initial), transitions: DesignTransitionDecls.of(transitions), ignores: DesignIgnoreDecls.of(ignores) }));
  }
  const scenarios = [];
  for (const sc of Array.isArray(rawUnit.scenarios) ? rawUnit.scenarios : []) {
    if (!isObject(sc) || typeof sc.id !== "string")
      continue;
    const bindings = isObject(sc.bindings) ? sc.bindings : {};
    scenarios.push(DesignScenarioDecl.reconstitute({
      id: DesignScenarioId.reconstitute(sc.id),
      bindings: BindingPairs.of(Object.entries(bindings)),
      hasEvent: isObject(sc.event ?? null),
      expect: asExpression(sc.expect ?? null),
      brRefs: brRefsOrUndefined(sc.brRefs ?? null)
    }));
  }
  const background = [];
  for (const bg of Array.isArray(rawUnit.background) ? rawUnit.background : []) {
    if (!isObject(bg) || typeof bg.id !== "string")
      continue;
    background.push(DesignBackgroundDecl.reconstitute({ id: DesignBackgroundId.reconstitute(bg.id), assert: asExpression(bg.assert ?? null) }));
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
  const directoryExists = recordRoot === null ? true : existsSync5(join6(recordRoot, "construction", unitName));
  const rulesPath = recordRoot === null ? null : join6(recordRoot, "construction", unitName, "functional-design", "rules.md");
  const rulesMarkdown = rulesPath === null ? null : readIfExists(rulesPath);
  return DesignUnitDecl.reconstitute({
    unit: DesignUnitId.of(unitName),
    entities,
    obligations: DesignObligationDecls.of(obligations),
    stateMachines: DesignMachineDecls.of(stateMachines),
    scenarios: DesignScenarioDecls.of(scenarios),
    background: DesignBackgroundDecls.of(background),
    unformalizedTargets: UnformalizedTargets.reconstitute(unformalizedTargets),
    directoryExists,
    rulesMarkdown
  });
}

class DesignIrValidationMaterialsRepositoryImpl {
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
      bytes = readFileSync6(outputPath);
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
    const irVersion = typeof ir.irVersion === "string" ? ir.irVersion : "";
    const major = Number.parseInt(irVersion.split(".")[0] ?? "", 10);
    const semanticGateOpen = schemaErrors.length === 0 && !(Number.isInteger(major) && major !== SUPPORTED_DESIGN_IR_MAJOR);
    const units = [];
    if (semanticGateOpen) {
      const recordRoot = findRecordRoot(dirname4(outputPath));
      for (const rawUnit of Array.isArray(ir.units) ? ir.units : []) {
        if (!isObject(rawUnit) || typeof rawUnit.unit !== "string")
          continue;
        units.push(buildUnitView(rawUnit, rawUnit.unit, recordRoot));
      }
    }
    return ok(DesignIrValidationMaterials.reconstitute({
      id,
      irVersion: IrVersion.reconstitute(irVersion),
      schemaErrors: ErrorMessages.of(schemaErrors),
      units: DesignUnitDecls.of(units),
      sourceDocument: new Uint8Array(bytes)
    }));
  }
  store(materials) {
    const outputPath = materials.id().modelId().artifactPath().asString();
    try {
      writeFileAtomically(outputPath, materials.sourceDocument());
      return ok(undefined);
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path: outputPath, cause: e instanceof Error ? e.message : String(e) });
    }
  }
}
// src/design/adapter/refinement-map-repository-impl.ts
import { existsSync as existsSync6, readFileSync as readFileSync7 } from "fs";
class RefinementMapRepositoryImpl {
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
      bytes = readFileSync7(path);
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
    try {
      writeFileAtomically(path, map.sourceDocument());
      return ok(undefined);
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path, cause: e instanceof Error ? e.message : String(e) });
    }
  }
}
// src/design/usecase/verify-design-smt-usecase.ts
var BACKEND = "smt";
var CROSS_CHECK_BACKEND = "cross-check";
var UNIT_WALL_TIMEOUT_MS = 55000;
var RUN_BUDGET_MS = 60000;
var REFINEMENT_DEADLINE_MS = 65000;

class VerifyDesignSmtUseCase {
  #designModelRepository;
  #designReportRepository;
  #siblingBackendClient;
  #refinementMaterialsRepository;
  #refinementSolverClient;
  #clock;
  constructor(designModelRepository, designReportRepository, siblingBackendClient, refinementMaterialsRepository, refinementSolverClient, clock) {
    this.#designModelRepository = designModelRepository;
    this.#designReportRepository = designReportRepository;
    this.#siblingBackendClient = siblingBackendClient;
    this.#refinementMaterialsRepository = refinementMaterialsRepository;
    this.#refinementSolverClient = refinementSolverClient;
    this.#clock = clock;
  }
  execute(input) {
    const id = DesignReportId.of(input.verifyDirectory, BACKEND);
    const acquired = this.#designModelRepository.findById(input.modelId);
    if (!acquired.ok) {
      if (acquired.error.kind === "not-found")
        return { kind: "not-applicable" };
      if (acquired.error.kind === "io-failed")
        return { kind: "acquisition-failed", error: acquired.error };
      const saved = this.#persist(DesignReport.irUnreadable(id, "exhaustive", acquired.error.cause));
      if (!saved.ok)
        return { kind: "save-failed", error: saved.error };
      return { kind: "model-unreadable" };
    }
    const model = acquired.value;
    const irHash = model.irHash();
    if (!model.supportsMajor(SUPPORTED_DESIGN_IR_MAJOR)) {
      const mismatch = DesignReport.versionMismatch(id, model, irHash, "exhaustive");
      const saved = this.#persist(mismatch);
      if (!saved.ok)
        return { kind: "save-failed", error: saved.error };
      const cross2 = this.#recomputeCrossCheck(model, irHash, input.verifyDirectory);
      if (!cross2.ok)
        return { kind: "save-failed", error: cross2.error };
      return { kind: "version-mismatch", skippedCount: mismatch.skippedCount() };
    }
    const findings = [];
    const skipped = [];
    const checkedUnits = [];
    const started = this.#clock.now();
    for (const u of model.units()) {
      if (this.#clock.now() - started > RUN_BUDGET_MS) {
        for (const t of u.allTargets()) {
          skipped.push(DesignSkipped.reconstitute({ target: t, reason: "timeout", unit: u.name(), detail: "the per-run solver budget was exhausted before this unit" }));
        }
        continue;
      }
      const lowered = LoweredUnit.of(u, { synthetics: true });
      const remaining = Math.min(UNIT_WALL_TIMEOUT_MS, RUN_BUDGET_MS - (this.#clock.now() - started));
      if (remaining < 3000) {
        for (const t of u.allTargets()) {
          skipped.push(DesignSkipped.reconstitute({ target: t, reason: "timeout", unit: u.name(), detail: "the per-run solver budget was exhausted before this unit" }));
        }
        continue;
      }
      const run = this.#siblingBackendClient.runLowered("smt", u, lowered, remaining);
      if (run.exit === 127) {
        const reason = run.doc?.unavailableReason() ?? "z3 could not be executed by the lowered v1 backend";
        const saved = this.#persist(DesignReport.backendUnavailable(id, model, irHash, "exhaustive", reason, "z3 could not be executed"));
        if (!saved.ok)
          return { kind: "save-failed", error: saved.error };
        const cross2 = this.#recomputeCrossCheck(model, irHash, input.verifyDirectory);
        if (!cross2.ok)
          return { kind: "save-failed", error: cross2.error };
        return { kind: "backend-unavailable" };
      }
      if (run.doc === null) {
        for (const t of u.allTargets()) {
          skipped.push(DesignSkipped.reconstitute({ target: t, reason: "unavailable", unit: u.name(), detail: `lowered v1 backend produced no findings document (${run.note.slice(0, 160)})` }));
        }
        continue;
      }
      const remapped = lowered.remapVerdicts(u, run.doc);
      if (remapped.unavailable !== null) {
        for (const t of u.allTargets()) {
          skipped.push(DesignSkipped.reconstitute({ target: t, reason: "unavailable", unit: u.name(), detail: remapped.unavailable }));
        }
        continue;
      }
      findings.push(...remapped.findings);
      skipped.push(...remapped.skipped);
      checkedUnits.push(`unit:${u.name()}`);
    }
    const context = this.#refinementMaterialsRepository.findById(RefinementMaterialsId.ofModel(input.modelId));
    let inputs;
    if (context.isActive()) {
      const req = context.requirements();
      const acq = context.mapAcquisition();
      const reqTargets = req.allTargetIds();
      const skipAll = (reason, detail) => {
        for (const u of model.units()) {
          for (const t of reqTargets)
            skipped.push(DesignSkipped.reconstitute({ target: t, reason, unit: u.name(), detail }));
        }
      };
      acq.match({
        absent: (error) => {
          skipAll("absent-input", error ?? "no refinement map (deep-spec-analysis-refinement-map.md) was authored for this record");
        },
        loaded: (map, mapArtifact, mapInputs) => {
          if (!map.requirementsIrHash().equals(req.hash())) {
            skipAll("stale-input", "the refinement map's requirementsIrHash no longer matches the requirements formal model \u2014 re-author the map");
            return;
          }
          if (!map.designIrHash().equals(irHash)) {
            skipAll("stale-input", "the refinement map's designIrHash no longer matches this design IR \u2014 re-author the map");
            return;
          }
          inputs = mapInputs;
          for (const u of model.units()) {
            const unitMap = map.unitMapOf(u.id());
            if (!unitMap) {
              for (const t of reqTargets) {
                skipped.push(DesignSkipped.reconstitute({ target: t, reason: "absent-input", unit: u.name(), detail: `the refinement map has no entry for unit ${u.name()}` }));
              }
              continue;
            }
            const refRemaining = REFINEMENT_DEADLINE_MS - (this.#clock.now() - started);
            if (refRemaining < 5000) {
              for (const t of reqTargets) {
                skipped.push(DesignSkipped.reconstitute({ target: t, reason: "timeout", unit: u.name(), detail: "the per-run solver budget was exhausted before the refinement pass" }));
              }
              continue;
            }
            const plan = UnitRefinementPlan.of(u, unitMap, req, mapArtifact);
            const check = this.#refinementSolverClient.check(u, req, plan, Math.min(30000, refRemaining));
            if (check.result.kind === "unavailable") {
              for (const t of reqTargets) {
                skipped.push(DesignSkipped.reconstitute({ target: t, reason: "unavailable", unit: u.name(), detail: check.result.reason }));
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
      method: "exhaustive",
      findings: DesignFindings.of(findings),
      skipped: DesignSkips.of(skipped),
      ...inputs !== undefined ? { inputs: DesignInputAnchors.of(inputs) } : {},
      checked: CheckedUnits.reconstitute(checkedUnits)
    });
    const conformed = this.#designReportRepository.conformedOf(report);
    const stored = this.#designReportRepository.store(report);
    if (!stored.ok)
      return { kind: "save-failed", error: stored.error };
    const cross = this.#recomputeCrossCheck(model, irHash, input.verifyDirectory);
    if (!cross.ok)
      return { kind: "save-failed", error: cross.error };
    return {
      kind: "verified",
      pass: conformed.passes(),
      findingsCount: conformed.findingsCount(),
      skippedCount: conformed.skippedCount(),
      method: "exhaustive"
    };
  }
  #persist(report) {
    return this.#designReportRepository.store(report);
  }
  #recomputeCrossCheck(model, irHash, directory) {
    const siblings = this.#designReportRepository.findAllByDirectory(directory);
    if (!siblings.ok)
      return ok(undefined);
    const stored = this.#persist(siblings.value.crossChecked(DesignReportId.of(directory, CROSS_CHECK_BACKEND), model, irHash));
    return stored.ok ? ok(undefined) : stored;
  }
}
// src/design/usecase/verify-design-quint-usecase.ts
var BACKEND2 = "quint";
var CROSS_CHECK_BACKEND2 = "cross-check";
var UNIT_WALL_TIMEOUT_MS2 = 50000;
var RUN_BUDGET_MS2 = 50000;
var UNREACH_BUDGET_MS = 70000;
var BOUND_STEPS = 8;

class VerifyDesignQuintUseCase {
  #designModelRepository;
  #designReportRepository;
  #siblingBackendClient;
  #refinementMaterialsRepository;
  #clock;
  #unreachCap;
  constructor(designModelRepository, designReportRepository, siblingBackendClient, refinementMaterialsRepository, clock, unreachCap) {
    this.#designModelRepository = designModelRepository;
    this.#designReportRepository = designReportRepository;
    this.#siblingBackendClient = siblingBackendClient;
    this.#refinementMaterialsRepository = refinementMaterialsRepository;
    this.#clock = clock;
    this.#unreachCap = unreachCap;
  }
  execute(input) {
    const id = DesignReportId.of(input.verifyDirectory, BACKEND2);
    const acquired = this.#designModelRepository.findById(input.modelId);
    if (!acquired.ok) {
      if (acquired.error.kind === "not-found")
        return { kind: "not-applicable" };
      if (acquired.error.kind === "io-failed")
        return { kind: "acquisition-failed", error: acquired.error };
      const saved = this.#persist(DesignReport.irUnreadable(id, "simulation", acquired.error.cause));
      if (!saved.ok)
        return { kind: "save-failed", error: saved.error };
      return { kind: "model-unreadable" };
    }
    const model = acquired.value;
    const irHash = model.irHash();
    if (!model.supportsMajor(SUPPORTED_DESIGN_IR_MAJOR)) {
      const mismatch = DesignReport.versionMismatch(id, model, irHash, "simulation");
      const saved = this.#persist(mismatch);
      if (!saved.ok)
        return { kind: "save-failed", error: saved.error };
      const cross2 = this.#recomputeCrossCheck(model, irHash, input.verifyDirectory);
      if (!cross2.ok)
        return { kind: "save-failed", error: cross2.error };
      return { kind: "version-mismatch", skippedCount: mismatch.skippedCount() };
    }
    const findings = [];
    const skipped = [];
    const checkedUnits = [];
    let method = null;
    const started = this.#clock.now();
    let probesUsed = 0;
    for (const u of model.units()) {
      if (this.#clock.now() - started > RUN_BUDGET_MS2) {
        for (const t of u.allTargets()) {
          skipped.push(DesignSkipped.reconstitute({ target: t, reason: "timeout", unit: u.name(), detail: "the per-run backend budget was exhausted before this unit" }));
        }
        continue;
      }
      const lowered = LoweredUnit.of(u, { synthetics: false });
      const mainRemaining = Math.min(UNIT_WALL_TIMEOUT_MS2, RUN_BUDGET_MS2 - (this.#clock.now() - started));
      if (mainRemaining < 3000) {
        for (const t of u.allTargets()) {
          skipped.push(DesignSkipped.reconstitute({ target: t, reason: "timeout", unit: u.name(), detail: "the per-run backend budget was exhausted before this unit" }));
        }
        continue;
      }
      const run = this.#siblingBackendClient.runLowered("quint", u, lowered, mainRemaining);
      if (run.exit === 127) {
        const reason = run.doc?.unavailableReason() ?? "quint CLI could not be executed by the lowered v1 backend";
        const saved = this.#persist(DesignReport.backendUnavailable(id, model, irHash, method ?? "simulation", reason, "quint CLI missing"));
        if (!saved.ok)
          return { kind: "save-failed", error: saved.error };
        const cross2 = this.#recomputeCrossCheck(model, irHash, input.verifyDirectory);
        if (!cross2.ok)
          return { kind: "save-failed", error: cross2.error };
        return { kind: "backend-unavailable" };
      }
      if (run.doc === null) {
        for (const t of u.allTargets()) {
          skipped.push(DesignSkipped.reconstitute({ target: t, reason: "unavailable", unit: u.name(), detail: `lowered v1 backend produced no findings document (${run.note.slice(0, 160)})` }));
        }
        continue;
      }
      const remapped = lowered.remapVerdicts(u, run.doc);
      if (remapped.unavailable !== null) {
        for (const t of u.allTargets()) {
          skipped.push(DesignSkipped.reconstitute({ target: t, reason: "unavailable", unit: u.name(), detail: remapped.unavailable }));
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
          skipped.push(DesignSkipped.reconstitute({
            target: sm.id().asTargetId(),
            reason: "capability",
            unit: u.name(),
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
          if (probe.kind === "failed") {
            leftover.push(state);
            continue;
          }
          if (!probe.reached) {
            findings.push(DesignFinding.reconstitute({
              kind: "unreachable",
              frRefs: FrRefs.reconstitute([]),
              targets: TargetIds.reconstitute([sm.id().asString()]),
              witness: DesignWitness.model({ [attrPath]: state }),
              unit: u.name(),
              detail: `State "${state}" of ${sm.id().asString()} (${attrPath}) is not reached by any execution within ${BOUND_STEPS} steps from any legal state \u2014 it may be dead.`
            }));
          }
        }
        if (leftover.length > 0) {
          skipped.push(DesignSkipped.reconstitute({
            target: sm.id().asTargetId(),
            reason: probesUsed >= this.#unreachCap ? "timeout" : "unavailable",
            unit: u.name(),
            detail: `unreachable-state detection skipped for state(s) ${leftover.join(", ")} of ${sm.id().asString()} (per-run cap ${this.#unreachCap} / budget reached, or the probe run failed)`
          }));
        }
      }
    }
    const context = this.#refinementMaterialsRepository.findById(RefinementMaterialsId.ofModel(input.modelId));
    let inputs;
    if (context.isActive()) {
      const req = context.requirements();
      const acq = context.mapAcquisition();
      const reqTargets = req.allTargetIds();
      const skipAll = (reason, detail) => {
        for (const u of model.units()) {
          for (const t of reqTargets)
            skipped.push(DesignSkipped.reconstitute({ target: t, reason, unit: u.name(), detail }));
        }
      };
      acq.match({
        absent: (error) => {
          skipAll("absent-input", error ?? "no refinement map (deep-spec-analysis-refinement-map.md) was authored for this record");
        },
        loaded: (map, mapArtifact, mapInputs) => {
          if (!map.requirementsIrHash().equals(req.hash())) {
            skipAll("stale-input", "the refinement map's requirementsIrHash no longer matches the requirements formal model \u2014 re-author the map");
            return;
          }
          if (!map.designIrHash().equals(irHash)) {
            skipAll("stale-input", "the refinement map's designIrHash no longer matches this design IR \u2014 re-author the map");
            return;
          }
          inputs = mapInputs;
          for (const u of model.units()) {
            const unitMap = map.unitMapOf(u.id());
            if (!unitMap) {
              for (const t of reqTargets) {
                skipped.push(DesignSkipped.reconstitute({ target: t, reason: "absent-input", unit: u.name(), detail: `the refinement map has no entry for unit ${u.name()}` }));
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
                skipped.push(DesignSkipped.reconstitute({ target: e.reqTarget(), reason: "timeout", unit: u.name(), detail: "the per-run backend budget was exhausted before the refinement pass" }));
              }
              continue;
            }
            const base = LoweredUnit.of(u, { synthetics: false });
            let refinementObligations = base.obligations();
            let refinementIndex = base.index();
            let n = refinementObligations.count();
            for (const e of extras) {
              n += 1;
              const lowId = LoweredId.reconstitute(`OB-${n}`);
              refinementObligations = refinementObligations.add(e.loweredAs(lowId));
              refinementIndex = refinementIndex.withPassthrough(lowId.asString(), e.reqId().asString());
            }
            const lowered = base.extendedWith(refinementObligations, refinementIndex);
            const run = this.#siblingBackendClient.runLowered("quint", u, lowered, remaining);
            if (run.exit !== 0 || run.doc === null) {
              for (const e of extras) {
                skipped.push(DesignSkipped.reconstitute({ target: e.reqTarget(), reason: "unavailable", unit: u.name(), detail: `refinement pass could not run (${run.note.slice(0, 120)})` }));
              }
              continue;
            }
            const remapped = lowered.remapVerdicts(u, run.doc);
            if (remapped.unavailable !== null) {
              for (const e of extras) {
                skipped.push(DesignSkipped.reconstitute({ target: e.reqTarget(), reason: "unavailable", unit: u.name(), detail: `refinement pass degraded: ${remapped.unavailable}` }));
              }
              continue;
            }
            const reqIdSet = extras.reqIds();
            let hitExtra = false;
            let designConflict = false;
            for (const f of remapped.findings) {
              if (!f.isConflict())
                continue;
              const violation = f.asRefinementViolation(reqIdSet, u.name());
              if (violation !== null) {
                hitExtra = true;
                findings.push(violation);
              } else {
                designConflict = true;
              }
            }
            if (!hitExtra && designConflict) {
              for (const e of extras) {
                skipped.push(DesignSkipped.reconstitute({
                  target: e.reqTarget(),
                  reason: "capability",
                  unit: u.name(),
                  detail: "the machine reachably violates its own design invariants first (see the design conflict findings) \u2014 refinement reachability is masked until those are resolved"
                }));
              }
            }
          }
        }
      });
    }
    const finalMethod = method ?? "simulation";
    const report = DesignReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method: finalMethod,
      findings: DesignFindings.of(findings),
      skipped: DesignSkips.of(skipped),
      ...inputs !== undefined ? { inputs: DesignInputAnchors.of(inputs) } : {},
      checked: CheckedUnits.reconstitute(checkedUnits)
    });
    const conformed = this.#designReportRepository.conformedOf(report);
    const stored = this.#designReportRepository.store(report);
    if (!stored.ok)
      return { kind: "save-failed", error: stored.error };
    const cross = this.#recomputeCrossCheck(model, irHash, input.verifyDirectory);
    if (!cross.ok)
      return { kind: "save-failed", error: cross.error };
    return {
      kind: "verified",
      pass: conformed.passes(),
      findingsCount: conformed.findingsCount(),
      skippedCount: conformed.skippedCount(),
      method: finalMethod
    };
  }
  #persist(report) {
    return this.#designReportRepository.store(report);
  }
  #recomputeCrossCheck(model, irHash, directory) {
    const siblings = this.#designReportRepository.findAllByDirectory(directory);
    if (!siblings.ok)
      return ok(undefined);
    const stored = this.#persist(siblings.value.crossChecked(DesignReportId.of(directory, CROSS_CHECK_BACKEND2), model, irHash));
    return stored.ok ? ok(undefined) : stored;
  }
}
// src/design/usecase/validate-design-ir-usecase.ts
class ValidateDesignIrUseCase {
  #designIrValidationMaterialsRepository;
  constructor(designIrValidationMaterialsRepository) {
    this.#designIrValidationMaterialsRepository = designIrValidationMaterialsRepository;
  }
  execute(modelId) {
    const found = this.#designIrValidationMaterialsRepository.findById(DesignIrValidationMaterialsId.ofModel(modelId));
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
    errors.push(...materials.schemaErrors());
    if (errors.length === 0) {
      errors.push(...materials.units().wellFormednessErrors());
    }
    return { kind: "verdict", pass: errors.length === 0, errors };
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
  const schemaPath = join7(dirname5(fileURLToPath(import.meta.url)), "data", "deep-spec-design-ir-schema.json");
  const useCase = new ValidateDesignIrUseCase(new DesignIrValidationMaterialsRepositoryImpl({ schemaPath }));
  const outcome = useCase.execute(DesignModelId.of(target.value));
  if (outcome.kind === "not-applicable") {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, errors: [], note: "not-applicable" })}
`);
    process.exit(0);
  }
  process.stdout.write(`${JSON.stringify({
    pass: outcome.pass,
    findings_count: outcome.errors.length,
    errors: outcome.errors.slice(0, MAX_REPORTED_ERRORS)
  })}
`);
  process.exit(0);
}
main();
