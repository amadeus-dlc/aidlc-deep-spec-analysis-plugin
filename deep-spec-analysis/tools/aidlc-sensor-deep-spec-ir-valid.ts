// @bun
// src/entries/aidlc-sensor-deep-spec-ir-valid.ts
import { dirname as dirname3, join as join6 } from "path";
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
// src/kernel/adapter/contract-schema.ts
import { readFileSync } from "fs";

// src/kernel/infrastructure/result.ts
function ok(value) {
  return { ok: true, value };
}
function err(error) {
  return { ok: false, error };
}
// src/kernel/infrastructure/json.ts
function isObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
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
// src/kernel/adapter/contract-schema.ts
function readContractSchema(path) {
  try {
    return ok(JSON.parse(readFileSync(path, "utf-8")));
  } catch (e) {
    return err({ cause: e instanceof Error ? e.message : String(e) });
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
// src/kernel/adapter/system-clock.ts
class SystemClock {
  now() {
    return Date.now();
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
// src/kernel/domain/findings-schema.ts
var CONTRACT_BASENAME = "deep-spec-findings-schema.json";

class FindingsSchema {
  #schema;
  #reason;
  constructor(schema, reason) {
    this.#schema = schema;
    this.#reason = reason;
  }
  static of(schema) {
    return new FindingsSchema(schema, null);
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
  static conflict() {
    return new FindingKind("conflict");
  }
  static completenessGap() {
    return new FindingKind("completeness-gap");
  }
  static scenarioViolation() {
    return new FindingKind("scenario-violation");
  }
  static unreachable() {
    return new FindingKind("unreachable");
  }
  static redundancy() {
    return new FindingKind("redundancy");
  }
  static refinementViolation() {
    return new FindingKind("refinement-violation");
  }
  static mappingGap() {
    return new FindingKind("mapping-gap");
  }
  static structureInvalid() {
    return new FindingKind("structure-invalid");
  }
  static referenceBroken() {
    return new FindingKind("reference-broken");
  }
  static consistencyMismatch() {
    return new FindingKind("consistency-mismatch");
  }
  static crossCheckDisagreement() {
    return new FindingKind("cross-check-disagreement");
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
var KNOWN_METHODS = new Set(["exhaustive", "bounded", "simulation", "static"]);

class VerificationMethod {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (!KNOWN_METHODS.has(raw))
      return err({ kind: "unknown-verification-method", raw });
    return ok(new VerificationMethod(raw));
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
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (!KNOWN_REASONS.has(raw))
      return err({ kind: "unknown-skip-reason", raw });
    return ok(new SkipReason(raw));
  }
  static reconstitute(raw) {
    return new SkipReason(raw);
  }
  static unavailable() {
    return new SkipReason("unavailable");
  }
  static timeout() {
    return new SkipReason("timeout");
  }
  static capability() {
    return new SkipReason("capability");
  }
  static compileError() {
    return new SkipReason("compile-error");
  }
  static waived() {
    return new SkipReason("waived");
  }
  static absentInput() {
    return new SkipReason("absent-input");
  }
  static staleInput() {
    return new SkipReason("stale-input");
  }
  static irVersionMismatch() {
    return new SkipReason("ir-version-mismatch");
  }
  static unrecognizedFormat() {
    return new SkipReason("unrecognized-format");
  }
  value() {
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
    this.#kind = props.kind;
    this.#frRefs = props.frRefs;
    this.#targets = props.targets;
    this.#witness = props.witness;
    this.#detail = props.detail;
  }
  static of(props) {
    return new VerificationFinding(props);
  }
  static reconstitute(props) {
    return new VerificationFinding({ ...props, kind: FindingKind.reconstitute(props.kind) });
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
        frRefs: f.frRefs().toStrings(),
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
            findings.push(VerificationFinding.of({
              kind: FindingKind.crossCheckDisagreement(),
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
  crossChecked(model, irHash) {
    const derived = this.#reports.crossChecked(VerificationReportId.of(this.#directory, CROSS_CHECK_BACKEND), model, irHash);
    return new VerificationDirectory(this.#directory, this.#reports, this.#candidate, derived);
  }
  withoutCrossCheck() {
    return new VerificationDirectory(this.#directory, this.#reports, this.#candidate, null);
  }
  conformedTo(schema) {
    const candidate = this.#candidate;
    const crossCheck = this.#crossCheck;
    const conformedCandidate = candidate === null ? null : candidate.conformedTo(schema);
    const conformedCrossCheck = crossCheck === null ? null : crossCheck.conformedTo(schema);
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
      findings.push(VerificationFinding.of({
        kind: FindingKind.conflict(),
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
        findings.push(VerificationFinding.of({
          kind: FindingKind.completenessGap(),
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
        findings.push(VerificationFinding.of({
          kind: FindingKind.scenarioViolation(),
          frRefs: model.frRefsOf(targets),
          targets,
          witness: VerificationWitness.core(r.sortedCore()),
          detail: `Accept scenario ${sc.id().asString()} describes a state the obligations in the witness core rule out \u2014 the requirements reject an example that should be accepted.`
        }));
      }
      if (sc.isReject() && r.isSat()) {
        findings.push(VerificationFinding.of({
          kind: FindingKind.scenarioViolation(),
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
        findings.push(VerificationFinding.of({
          kind: FindingKind.completenessGap(),
          frRefs: model.frRefsOf(eventTargets),
          targets: this.#eventIds.isEmpty() ? machineTargets : eventTargets.sortedCanonically(),
          witness: machineRun.witness(),
          detail: "The event machine reaches a legal state where no event rule applies (deadlock): the behavior of that state is unspecified."
        }));
      } else if (machineRun.isViolation()) {
        const violatedComponents = this.#invariantComponents.violatedBy(machineRun.finalState());
        const targets = violatedComponents.isEmpty() ? eventTargets.sortedCanonically() : violatedComponents.ids().toTargetIds().sortedUniqueCanonically();
        findings.push(VerificationFinding.of({
          kind: FindingKind.conflict(),
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
        findings.push(VerificationFinding.of({
          kind: FindingKind.conflict(),
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
        findings.push(VerificationFinding.of({
          kind: FindingKind.scenarioViolation(),
          frRefs: model.frRefsOf(targets),
          targets,
          witness: VerificationWitness.model(boundModel),
          detail: `Accept scenario ${sc.id().asString()} describes a state the obligations rule out \u2014 the requirements reject an example that should be accepted.`
        }));
      }
      if (sc.isReject() && !r.isViolated()) {
        findings.push(VerificationFinding.of({
          kind: FindingKind.scenarioViolation(),
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
      return VerificationSkipped.reconstitute({ target, reason: "timeout", detail: "temporal check exceeded its budget" });
    if (kind === "run-failed")
      return VerificationSkipped.reconstitute({ target, reason: "unavailable", detail: `quint verify failed unexpectedly: ${this.#outputTail}` });
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
// src/requirements/adapter/smt-plan.ts
class CompileError extends Error {
  constructor(message) {
    super(message);
  }
}
function enumCode(model, attrPath, value) {
  const attr = model.attributeAt(attrPath);
  const values = attr?.declaredValues();
  if (!attr || !attr.isEnum() || !values) {
    throw new CompileError(`"${attrPath}" is not an enum attribute`);
  }
  const idx = values.indexOf(value);
  if (idx < 0)
    throw new CompileError(`enum value "${value}" is not declared on "${attrPath}"`);
  return idx;
}
function smtOf(model, e) {
  const bin = (op) => {
    const [a, b] = e.args ?? [];
    if (!a || !b)
      throw new CompileError(`operator "${e.op}" needs two arguments`);
    const refArg = a.op === "ref" ? a : b.op === "ref" ? b : null;
    const enumArg = a.op === "enum" ? a : b.op === "enum" ? b : null;
    if (enumArg && refArg && typeof refArg.path === "string" && typeof enumArg.value === "string") {
      const code = String(enumCode(model, refArg.path, enumArg.value));
      const left = a === enumArg ? code : smtOf(model, a);
      const right = b === enumArg ? code : smtOf(model, b);
      return `(${op} ${left} ${right})`;
    }
    if (enumArg)
      throw new CompileError("enum literal without a ref sibling has no resolvable encoding");
    return `(${op} ${smtOf(model, a)} ${smtOf(model, b)})`;
  };
  switch (e.op) {
    case "and":
    case "or":
      return `(${e.op} ${(e.args ?? []).map((a) => smtOf(model, a)).join(" ")})`;
    case "not":
      return `(not ${smtOf(model, (e.args ?? [])[0])})`;
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
      if (typeof e.path !== "string" || model.attributeAt(e.path) === undefined) {
        throw new CompileError(`unresolvable reference "${e.path ?? ""}"`);
      }
      return smtVar(e.path, e.prime === true);
    }
    case "bool":
      return e.value === true ? "true" : "false";
    case "int": {
      const n = typeof e.value === "number" ? e.value : Number.NaN;
      if (!Number.isInteger(n))
        throw new CompileError("int literal is not an integer");
      return smtLit(n);
    }
    case "enum":
      throw new CompileError("enum literal without a ref sibling has no resolvable encoding");
    default:
      throw new CompileError(`unknown operator "${e.op}"`);
  }
}
function decodeSolverModel(model, values) {
  const out = {};
  for (const attr of model.attributes().sortedByPath()) {
    const raw = values[smtVar(attr.path().asString(), false)];
    if (raw === undefined)
      continue;
    if (attr.isBool()) {
      out[attr.path().asString()] = raw === "true";
    } else {
      const n = smtIntOf(raw);
      if (!Number.isSafeInteger(n)) {
        const m = raw.match(/^\(-\s*(\d+)\)$/);
        out[attr.path().asString()] = m ? `-${m[1]}` : raw;
      } else if (attr.isEnum() && attr.declaredValues())
        out[attr.path().asString()] = attr.declaredValues()?.valueAt(n) ?? n;
      else
        out[attr.path().asString()] = n;
    }
  }
  return out;
}
function buildSmtPlan(model) {
  const skipped = [];
  const compiled = new Map;
  const labelToTarget = new Map;
  const decls = [];
  const primedDecls = [];
  for (const attr of model.attributes()) {
    const sort = attr.isBool() ? "Bool" : "Int";
    decls.push(`(declare-const ${smtVar(attr.path().asString(), false)} ${sort})`);
    primedDecls.push(`(declare-const ${smtVar(attr.path().asString(), true)} ${sort})`);
  }
  const typeBounds = [];
  const primedTypeBounds = [];
  for (const attr of model.attributes()) {
    const bounds = (primed) => {
      const v = smtVar(attr.path().asString(), primed);
      return attr.match({
        enum: (values) => values ? `(and (>= ${v} 0) (<= ${v} ${values.count() - 1}))` : null,
        int: (min, max) => {
          if (min === undefined && max === undefined)
            return null;
          const parts = [];
          if (min !== undefined)
            parts.push(`(>= ${v} ${smtLit(min.asNumber())})`);
          if (max !== undefined)
            parts.push(`(<= ${v} ${smtLit(max.asNumber())})`);
          return parts.length === 1 ? parts[0] ?? null : `(and ${parts.join(" ")})`;
        },
        bool: () => null
      });
    };
    const cur = bounds(false);
    if (cur)
      typeBounds.push({ name: smtName("ty", attr.path().asString()), smt: cur });
    const nxt = bounds(true);
    if (nxt)
      primedTypeBounds.push({ name: smtName("typ", attr.path().asString()), smt: nxt });
  }
  const bg = [];
  for (const b of model.background()) {
    try {
      bg.push({ name: smtName("bg", b.id().asString()), smt: smtOf(model, b.assertion()) });
      labelToTarget.set(smtName("bg", b.id().asString()), b.id().asString());
    } catch (err2) {}
  }
  const invariants = [];
  const invariantObs = [];
  const events = [];
  for (const ob of model.obligations()) {
    if (ob.isInvariantLike()) {
      const assertion = ob.assertion();
      if (assertion === undefined) {
        skipped.push(VerificationSkipped.reconstitute({ target: ob.id().asTargetId(), reason: "compile-error", detail: "invariant obligation lacks an assert expression" }));
        compiled.set(ob.id().asString(), false);
        continue;
      }
      try {
        invariants.push({ name: smtName("ob", ob.id().asString()), smt: smtOf(model, assertion) });
        labelToTarget.set(smtName("ob", ob.id().asString()), ob.id().asString());
        invariantObs.push(ob);
        compiled.set(ob.id().asString(), true);
      } catch (err2) {
        skipped.push(VerificationSkipped.reconstitute({ target: ob.id().asTargetId(), reason: "compile-error", detail: err2 instanceof Error ? err2.message : String(err2) }));
        compiled.set(ob.id().asString(), false);
      }
    } else if (ob.isEvent()) {
      const event = ob.eventDefinition();
      if (event === null) {
        skipped.push(VerificationSkipped.reconstitute({ target: ob.id().asTargetId(), reason: "compile-error", detail: "event obligation lacks trigger/guard/effect" }));
        compiled.set(ob.id().asString(), false);
        continue;
      }
      try {
        if (ExpressionTree.of(event.guard).usesPrime())
          throw new CompileError("guard must not use primed references");
        smtOf(model, event.guard);
        smtOf(model, event.effect);
        events.push(ob);
        compiled.set(ob.id().asString(), true);
      } catch (err2) {
        skipped.push(VerificationSkipped.reconstitute({ target: ob.id().asTargetId(), reason: "compile-error", detail: err2 instanceof Error ? err2.message : String(err2) }));
        compiled.set(ob.id().asString(), false);
      }
    } else {
      skipped.push(VerificationSkipped.reconstitute({ target: ob.id().asTargetId(), reason: "capability", detail: `nature "${ob.nature().asString()}" is checked by a state-machine backend, not the SMT backend` }));
      compiled.set(ob.id().asString(), false);
    }
  }
  const baseScript = [
    ...decls,
    ...[...typeBounds, ...bg, ...invariants].flatMap((c) => [
      `(declare-const ${c.name} Bool)`,
      `(assert (=> ${c.name} ${c.smt}))`
    ])
  ].join(`
`);
  const baseAssumptions = [...typeBounds, ...bg, ...invariants].map((c) => c.name);
  const modelVars = model.attributes().toArray().map((a) => ({
    name: smtVar(a.path().asString(), false),
    sort: a.isBool() ? "Bool" : "Int"
  }));
  const queries = [];
  queries.push({ id: "global", script: baseScript, assumptions: baseAssumptions, model: modelVars });
  for (const ob of invariantObs) {
    const ant = ob.vacuityAntecedent();
    if (!ant)
      continue;
    try {
      const name = smtName("ant", ob.id().asString());
      const script = [baseScript, `(declare-const ${name} Bool)`, `(assert (=> ${name} ${smtOf(model, ant)}))`].join(`
`);
      queries.push({ id: `vac:${ob.id().asString()}`, script, assumptions: [...baseAssumptions, name], model: [] });
    } catch {}
  }
  const eventPairs = [];
  const byTrigger = new Map;
  for (const ev of events) {
    const definition = ev.eventDefinition();
    if (definition === null)
      continue;
    const key = definition.trigger.asString();
    const list = byTrigger.get(key) ?? [];
    list.push(ev);
    byTrigger.set(key, list);
  }
  for (const trigger of [...byTrigger.keys()].sort()) {
    const list = byTrigger.get(trigger) ?? [];
    for (let i = 0;i < list.length; i++) {
      for (let j = i + 1;j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (!a || !b)
          continue;
        const eventA = a.eventDefinition();
        const eventB = b.eventDefinition();
        if (eventA === null || eventB === null)
          continue;
        const ga = { name: smtName("g", a.id().asString()), smt: smtOf(model, eventA.guard) };
        const gb = { name: smtName("g", b.id().asString()), smt: smtOf(model, eventB.guard) };
        const ea = { name: smtName("e", a.id().asString()), smt: smtOf(model, eventA.effect) };
        const eb = { name: smtName("e", b.id().asString()), smt: smtOf(model, eventB.effect) };
        labelToTarget.set(ga.name, a.id().asString());
        labelToTarget.set(gb.name, b.id().asString());
        labelToTarget.set(ea.name, a.id().asString());
        labelToTarget.set(eb.name, b.id().asString());
        const overlapScript = [
          baseScript,
          ...[ga, gb].flatMap((c) => [`(declare-const ${c.name} Bool)`, `(assert (=> ${c.name} ${c.smt}))`])
        ].join(`
`);
        const jointScript = [
          baseScript,
          ...primedDecls,
          ...[...primedTypeBounds, ga, gb, ea, eb].flatMap((c) => [
            `(declare-const ${c.name} Bool)`,
            `(assert (=> ${c.name} ${c.smt}))`
          ])
        ].join(`
`);
        const qOverlap = `evo:${a.id().asString()}:${b.id().asString()}`;
        const qJoint = `evj:${a.id().asString()}:${b.id().asString()}`;
        queries.push({ id: qOverlap, script: overlapScript, assumptions: [...baseAssumptions, ga.name, gb.name], model: [] });
        queries.push({
          id: qJoint,
          script: jointScript,
          assumptions: [...baseAssumptions, ...primedTypeBounds.map((c) => c.name), ga.name, gb.name, ea.name, eb.name],
          model: []
        });
        eventPairs.push(SmtEventPairProbe.of({ qOverlap: QueryLabel.reconstitute(qOverlap), qJoint: QueryLabel.reconstitute(qJoint), a: a.id(), b: b.id(), trigger: TriggerName.reconstitute(trigger) }));
      }
    }
  }
  const gapTriggers = new Map;
  for (const trigger of [...byTrigger.keys()].sort()) {
    const list = byTrigger.get(trigger) ?? [];
    const guards = list.flatMap((ev) => {
      const definition = ev.eventDefinition();
      return definition === null ? [] : [smtOf(model, definition.guard)];
    });
    const name = smtName("ng", trigger);
    const noGuard = guards.length === 1 ? `(not ${guards[0]})` : `(not (or ${guards.join(" ")}))`;
    const script = [baseScript, `(declare-const ${name} Bool)`, `(assert (=> ${name} ${noGuard}))`].join(`
`);
    queries.push({ id: `gap:${trigger}`, script, assumptions: [...baseAssumptions, name], model: modelVars });
    gapTriggers.set(trigger, list.map((ev) => ev.id()).sort((a, b) => a.compareTo(b)).map((id) => id.asString()));
  }
  const scenarioQueries = new Map;
  for (const sc of model.scenarios()) {
    if (sc.hasEvent()) {
      skipped.push(VerificationSkipped.reconstitute({ target: sc.id().asTargetId(), reason: "capability", detail: "scenarios with a When-event are not checked by the SMT backend in v1" }));
      continue;
    }
    try {
      const name = smtName("sc", sc.id().asString());
      const parts = [];
      for (const [path, value] of sc.bindingEntriesCanonically()) {
        const attr = model.attributeAt(path);
        if (!attr)
          throw new CompileError(`binding references unknown attribute "${path}"`);
        const v = smtVar(path, false);
        if (attr.isBool())
          parts.push(`(= ${v} ${value === true})`);
        else if (attr.isInt()) {
          const n = typeof value === "number" ? value : Number.NaN;
          if (!Number.isInteger(n))
            throw new CompileError(`binding for int attribute "${path}" is not an integer`);
          parts.push(`(= ${v} ${smtLit(n)})`);
        } else
          parts.push(`(= ${v} ${enumCode(model, path, String(value))})`);
      }
      const conj = parts.length === 1 ? parts[0] ?? "true" : `(and ${parts.join(" ")})`;
      const script = [baseScript, `(declare-const ${name} Bool)`, `(assert (=> ${name} ${conj}))`].join(`
`);
      const qid = `sc:${sc.id().asString()}`;
      queries.push({ id: qid, script, assumptions: [...baseAssumptions, name], model: modelVars });
      scenarioQueries.set(sc.id().asString(), qid);
    } catch (err2) {
      skipped.push(VerificationSkipped.reconstitute({ target: sc.id().asTargetId(), reason: "compile-error", detail: err2 instanceof Error ? err2.message : String(err2) }));
    }
  }
  return {
    queries,
    plan: SmtVerificationPlan.of({
      compiled: KeySet.of([...compiled].filter(([, ok2]) => ok2).map(([id]) => ObligationId.reconstitute(id))),
      skipped: VerificationSkips.of(skipped),
      labelToTarget: KeyedIndex.of([...labelToTarget].map(([label, target]) => [QueryLabel.reconstitute(label), TargetId.reconstitute(target)])),
      eventPairs: SmtEventPairProbes.of(eventPairs),
      gapTriggers: KeyedIndex.of([...gapTriggers].map(([trigger, ids]) => [TriggerName.reconstitute(trigger), TargetIds.reconstitute(ids)])),
      scenarioQueries: KeyedIndex.of([...scenarioQueries].map(([sc, qid]) => [ScenarioId.reconstitute(sc), QueryLabel.reconstitute(qid)]))
    })
  };
}
// src/requirements/adapter/z3-solver-client-impl.ts
import { spawnSync } from "child_process";
var CHILD_BUDGET_MS = 45000;
var CHILD_WALL_TIMEOUT_MS = 55000;

class Z3SolverClientImpl {
  #config;
  constructor(config) {
    this.#config = config;
  }
  check(model) {
    const plan = buildSmtPlan(model);
    const outcome = this.#runChild(plan.queries);
    if (outcome.unavailable !== undefined || !outcome.results) {
      return {
        plan: plan.plan,
        result: { kind: "unavailable", reason: outcome.unavailable ?? "solver child produced no results" }
      };
    }
    const verdicts = [];
    for (const [id, r] of outcome.results) {
      verdicts.push([QueryLabel.reconstitute(id), SmtQueryVerdict.reconstitute({
        status: r.status,
        decodedModel: r.status === "sat" ? decodeSolverModel(model, r.model ?? {}) : undefined,
        core: r.core
      })]);
    }
    return { plan: plan.plan, result: { kind: "solved", verdicts: SmtQueryVerdicts.of(KeyedIndex.of(verdicts)) } };
  }
  #runChild(queries) {
    const payload = JSON.stringify({ queries, timeoutMs: this.#config.perQueryTimeoutMs, budgetMs: CHILD_BUDGET_MS });
    const runtimes = this.#config.runtimeOverride ? [this.#config.runtimeOverride] : ["node", "bun"];
    const attempts = [];
    for (const runtime of runtimes) {
      const res = spawnSync(runtime, [this.#config.selfPath, "--smt-child"], {
        input: payload,
        encoding: "utf-8",
        timeout: CHILD_WALL_TIMEOUT_MS,
        cwd: this.#config.workingDirectory
      });
      if (res.error && res.error.code === "ENOENT") {
        attempts.push(`${runtime}: not on PATH`);
        continue;
      }
      if (res.error || res.status !== 0) {
        const stderrTail = (res.stderr ?? "").trim().split(`
`).slice(-2).join(" ").slice(0, 200);
        attempts.push(`${runtime}: ${res.error ? String(res.error) : `exit ${res.status}`}${stderrTail ? ` (${stderrTail})` : ""}`);
        continue;
      }
      try {
        const parsed = JSON.parse((res.stdout ?? "").trim().split(`
`).pop() ?? "");
        if (typeof parsed.unavailable === "string")
          return { unavailable: parsed.unavailable };
        const map = new Map;
        for (const r of parsed.results ?? [])
          map.set(r.id, r);
        return { results: map };
      } catch {
        attempts.push(`${runtime}: solver child produced unreadable output`);
      }
    }
    return { unavailable: `no runtime could execute the z3 child process (${attempts.join("; ")})` };
  }
}
// src/requirements/adapter/verification-report-serializer.ts
function renderVerificationReportBytes(report) {
  return `${JSON.stringify(report.toDocument(), null, 2)}
`;
}
function parseSiblingReportDocument(directory, fileName, raw) {
  if (!isObject(raw))
    return null;
  const backend = typeof raw.backend === "string" ? raw.backend : fileName.replace(/\.json$/, "");
  return reconstituteFromRaw(VerificationReportId.of(directory, backend), raw);
}
function reconstituteFromRaw(id, raw) {
  const skipped = (Array.isArray(raw.skipped) ? raw.skipped : []).filter((s) => isObject(s) && typeof s.target === "string");
  return VerificationReport.reconstitute({
    id,
    irVersion: IrVersion.reconstitute(typeof raw.irVersion === "string" ? raw.irVersion : ""),
    irHash: ContentHash.reconstitute(typeof raw.irHash === "string" ? raw.irHash : ""),
    method: typeof raw.method === "string" ? raw.method : "",
    findings: VerificationFindings.of((Array.isArray(raw.findings) ? raw.findings.filter(isObject) : []).map((e) => {
      const entry = e;
      return VerificationFinding.reconstitute({
        kind: typeof entry.kind === "string" ? entry.kind : "",
        frRefs: FrRefs.reconstitute(Array.isArray(entry.frRefs) ? entry.frRefs.filter((x) => typeof x === "string") : []),
        targets: TargetIds.reconstitute(Array.isArray(entry.targets) ? entry.targets.filter((x) => typeof x === "string") : []),
        witness: VerificationWitness.fromDocument(entry.witness),
        detail: typeof entry.detail === "string" ? entry.detail : ""
      });
    })),
    skipped: VerificationSkips.of(skipped.map((entry) => {
      return VerificationSkipped.reconstitute({
        target: TargetId.reconstitute(typeof entry.target === "string" ? entry.target : ""),
        reason: typeof entry.reason === "string" ? entry.reason : "",
        ...typeof entry.detail === "string" ? { detail: entry.detail } : {}
      });
    })),
    crossChecked: Array.isArray(raw.crossChecked) ? CrossCheckedEntries.of(raw.crossChecked.filter(isObject).map((e) => CrossCheckedEntry.reconstitute({
      backend: BackendName.reconstitute(typeof e.backend === "string" ? e.backend : ""),
      targets: TargetIds.reconstitute(Array.isArray(e.targets) ? e.targets.filter((t) => typeof t === "string") : [])
    }))) : null,
    unavailableReason: isObject(raw.unavailable) ? typeof raw.unavailable.reason === "string" ? raw.unavailable.reason : "" : null
  });
}
// src/requirements/adapter/verification-directory-repository-impl.ts
import { existsSync, mkdirSync as mkdirSync3, readFileSync as readFileSync3, readdirSync, renameSync as renameSync3, rmSync as rmSync3 } from "fs";
import { join as join3 } from "path";
var CROSS_CHECK_BASENAME = "cross-check.json";
var STALE_CROSS_CHECK_BASENAME = ".cross-check.stale";
var VERIFICATION_LOCK_BASENAME = ".deep-spec-finalization.lock";
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

class VerificationDirectoryRepositoryImpl {
  #lock;
  constructor(lock = new DirectoryFinalizationLock(new SystemClock, UNPROBED_LIVENESS, VERIFICATION_LOCK_BASENAME)) {
    this.#lock = lock;
  }
  findByDirectory(directory) {
    const siblings = this.#siblingsOf(directory);
    if (!siblings.ok)
      return err(siblings.error);
    const crossPath = join3(directory.asString(), CROSS_CHECK_BASENAME);
    if (!existsSync(crossPath)) {
      return ok(VerificationDirectory.of(directory, VerificationReports.of(siblings.value), null));
    }
    const crossCheck = this.#readReport(directory, CROSS_CHECK_BASENAME);
    return ok(VerificationDirectory.of(directory, VerificationReports.of(siblings.value), crossCheck.ok ? crossCheck.value : null));
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
    try {
      outcome = this.#publish(aggregate, candidate, directory);
    } catch (e) {
      outcome = err({ kind: "io-failed", operation: "write", path: directoryPath, cause: causeOf2(e) });
    }
    const released = this.#lock.release(directory);
    if (released.kind !== "released" && outcome.ok) {
      return err({ kind: "io-failed", operation: "write", path: lockPath, cause: lockCauseOf(released) });
    }
    return outcome;
  }
  #publish(aggregate, candidate, directory) {
    const directoryPath = directory.asString();
    const backendPath = join3(directoryPath, candidate.id().fileName());
    const crossPath = join3(directoryPath, CROSS_CHECK_BASENAME);
    const stalePath = join3(directoryPath, STALE_CROSS_CHECK_BASENAME);
    const unchanged = this.#siblingsUnchanged(aggregate, candidate, directory);
    if (!unchanged.ok)
      return err(unchanged.error);
    const crossCheck = aggregate.crossCheck();
    let backendBytes;
    let crossBytes;
    try {
      backendBytes = renderVerificationReportBytes(candidate);
      crossBytes = crossCheck === null ? null : renderVerificationReportBytes(crossCheck);
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path: crossPath, cause: causeOf2(e) });
    }
    if (!this.#lock.holdsOwnership(directory))
      return this.#fenced(directory, crossPath);
    if (existsSync(crossPath)) {
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
    if (!existsSync(directory.asString()))
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
      if (report.value !== null)
        reports.push(report.value);
    }
    return ok(reports);
  }
  #readReport(directory, fileName) {
    const path = join3(directory.asString(), fileName);
    let raw;
    try {
      raw = JSON.parse(readFileSync3(path, "utf-8"));
    } catch (e) {
      return err({ kind: "corrupt", path, cause: causeOf2(e) });
    }
    return ok(parseSiblingReportDocument(directory, fileName, raw));
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
// src/requirements/adapter/quint-compilation.ts
class CompileError2 extends Error {
  constructor(message) {
    super(message);
  }
}
function qVar(path) {
  return path.replace(/\./g, "_");
}
function qId(prefix, id) {
  return `${prefix}_${id.replace(/[^A-Za-z0-9_]/g, "_")}`;
}
function qLit(value) {
  if (typeof value === "boolean")
    return value ? "true" : "false";
  if (typeof value === "number")
    return String(value);
  return JSON.stringify(value);
}
function quintOf(e, name) {
  const args = (e.args ?? []).map((a) => quintOf(a, name));
  const two = () => {
    if (args.length !== 2)
      throw new CompileError2(`operator "${e.op}" needs two arguments`);
    return [args[0] ?? "", args[1] ?? ""];
  };
  switch (e.op) {
    case "and":
      return `and(${args.join(", ")})`;
    case "or":
      return `or(${args.join(", ")})`;
    case "not":
      return `not(${args[0] ?? ""})`;
    case "implies": {
      const [a, b] = two();
      return `(${a} implies ${b})`;
    }
    case "iff": {
      const [a, b] = two();
      return `(${a} iff ${b})`;
    }
    case "eq": {
      const [a, b] = two();
      return `(${a} == ${b})`;
    }
    case "ne": {
      const [a, b] = two();
      return `(${a} != ${b})`;
    }
    case "lt": {
      const [a, b] = two();
      return `(${a} < ${b})`;
    }
    case "le": {
      const [a, b] = two();
      return `(${a} <= ${b})`;
    }
    case "gt": {
      const [a, b] = two();
      return `(${a} > ${b})`;
    }
    case "ge": {
      const [a, b] = two();
      return `(${a} >= ${b})`;
    }
    case "add": {
      const [a, b] = two();
      return `(${a} + ${b})`;
    }
    case "sub": {
      const [a, b] = two();
      return `(${a} - ${b})`;
    }
    case "mul": {
      const [a, b] = two();
      return `(${a} * ${b})`;
    }
    case "ref":
      if (typeof e.path !== "string")
        throw new CompileError2("ref without path");
      return name(e.path, e.prime === true);
    case "bool":
    case "int":
    case "enum":
      if (e.value === undefined)
        throw new CompileError2(`${e.op} literal without value`);
      return qLit(e.value);
    default:
      throw new CompileError2(`unknown operator "${e.op}"`);
  }
}
function decomposeEffect(effect) {
  const assignments = new Map;
  const terms = [];
  const flatten = (e) => {
    if (e.op === "and") {
      for (const a of e.args ?? [])
        flatten(a);
    } else {
      terms.push(e);
    }
  };
  flatten(effect);
  for (const term of terms) {
    if (term.op !== "eq")
      throw new CompileError2("effect must be a conjunction of primed assignments (eq(prime-ref, expr))");
    const [a, b] = term.args ?? [];
    const target = a?.op === "ref" && a.prime === true ? a : b?.op === "ref" && b.prime === true ? b : null;
    const rhs = target === a ? b : a;
    if (!target || !rhs || typeof target.path !== "string") {
      throw new CompileError2("effect must be a conjunction of primed assignments (eq(prime-ref, expr))");
    }
    if (ExpressionTree.of(rhs).usesPrime())
      throw new CompileError2("assignment right-hand side must not use primed references");
    if (assignments.has(target.path))
      throw new CompileError2(`attribute "${target.path}" assigned twice in one effect`);
    assignments.set(target.path, rhs);
  }
  return assignments;
}
function domainOf(attr) {
  return attr.match({
    bool: () => "Set(true, false)",
    enum: (values) => `Set(${(values?.toArray() ?? []).map((v) => JSON.stringify(v)).join(", ")})`,
    int: (min, max) => {
      if (min === undefined || max === undefined) {
        throw new CompileError2(`int attribute "${attr.path().asString()}" lacks min/max \u2014 bounded domains are required by the quint backend`);
      }
      return `(${min.asNumber()}).to(${max.asNumber()})`;
    }
  });
}
function quintType(attr) {
  return attr.match({ bool: () => "bool", int: () => "int", enum: () => "str" });
}
function compileQuintMachine(model) {
  try {
    return { kind: "compiled", machine: compile(model) };
  } catch (err2) {
    return { kind: "uncompilable", error: err2 instanceof Error ? err2.message : String(err2) };
  }
}
function compile(model) {
  const compileSkips = [];
  const attrs = model.attributes().toArray();
  const varToPath = new Map;
  for (const attr of attrs) {
    const v = qVar(attr.path().asString());
    if (varToPath.has(v))
      throw new CompileError2(`state variable name collision: "${v}"`);
    varToPath.set(v, attr.path().asString());
  }
  const stateName = (path, primed) => {
    if (model.attributeAt(path) === undefined)
      throw new CompileError2(`unresolvable reference "${path}"`);
    if (primed)
      throw new CompileError2("primed reference outside an effect");
    return qVar(path);
  };
  for (const attr of attrs)
    domainOf(attr);
  const lines = ["module main {"];
  for (const attr of attrs)
    lines.push(`  var ${qVar(attr.path().asString())}: ${quintType(attr)}`);
  lines.push("");
  const invariantComponents = [];
  const propDefs = [];
  for (const ob of model.obligations()) {
    const assertion = ob.assertion();
    if (ob.isInvariantLike() && assertion !== undefined) {
      invariantComponents.push(QuintMachineComponent.reconstitute({ id: ob.id(), expression: assertion }));
      propDefs.push({ id: ob.id().asString(), expr: assertion });
    }
    const temporal = ob.temporal();
    if (ob.isStateTemporal() && temporal?.pattern === "always" && temporal.assert !== undefined) {
      invariantComponents.push(QuintMachineComponent.reconstitute({ id: ob.id(), expression: temporal.assert }));
      propDefs.push({ id: ob.id().asString(), expr: temporal.assert });
    }
  }
  for (const b of model.background().toArray())
    propDefs.push({ id: b.id().asString(), expr: b.assertion() });
  const invExprs = [];
  for (const c of propDefs) {
    const def = qId("prop", c.id);
    lines.push(`  val ${def} = ${quintOf(c.expr, stateName)}`);
    invExprs.push(def);
  }
  const boundExprs = [];
  for (const attr of attrs) {
    attr.match({
      int: (min, max) => {
        boundExprs.push(`(${qVar(attr.path().asString())} >= ${min?.asNumber()} and ${qVar(attr.path().asString())} <= ${max?.asNumber()})`);
      },
      enum: () => {
        boundExprs.push(`${domainOf(attr)}.contains(${qVar(attr.path().asString())})`);
      },
      bool: () => {}
    });
  }
  const invAllParts = [...invExprs, ...boundExprs];
  lines.push(`  val invAll = ${invAllParts.length > 0 ? `and(${invAllParts.join(", ")})` : "true"}`);
  lines.push("");
  lines.push("  action init = {");
  for (const attr of attrs) {
    lines.push(`    nondet n_${qVar(attr.path().asString())} = ${domainOf(attr)}.oneOf()`);
  }
  const initName = (path, primed) => {
    if (primed)
      throw new CompileError2("primed reference outside an effect");
    if (model.attributeAt(path) === undefined)
      throw new CompileError2(`unresolvable reference "${path}"`);
    return `n_${qVar(path)}`;
  };
  const initConds = propDefs.map((c) => quintOf(c.expr, initName));
  lines.push("    all {");
  for (const cond of initConds)
    lines.push(`      ${cond},`);
  for (const attr of attrs)
    lines.push(`      ${qVar(attr.path().asString())}' = n_${qVar(attr.path().asString())},`);
  lines.push("      true");
  lines.push("    }");
  lines.push("  }");
  lines.push("");
  const eventIds = [];
  const actionNames = [];
  for (const ob of model.obligations()) {
    if (!ob.isEvent())
      continue;
    const event = ob.eventDefinition();
    if (event === null) {
      compileSkips.push(VerificationSkipped.reconstitute({ target: ob.id().asTargetId(), reason: "compile-error", detail: "event obligation lacks trigger/guard/effect" }));
      continue;
    }
    try {
      if (ExpressionTree.of(event.guard).usesPrime())
        throw new CompileError2("guard must not use primed references");
      const guard = quintOf(event.guard, stateName);
      const assignments = decomposeEffect(event.effect);
      const action = qId("ev", ob.id().asString());
      const parts = [guard];
      for (const attr of attrs) {
        const rhs = assignments.get(attr.path().asString());
        parts.push(`${qVar(attr.path().asString())}' = ${rhs ? quintOf(rhs, stateName) : qVar(attr.path().asString())}`);
      }
      lines.push(`  action ${action} = all { ${parts.join(", ")} }`);
      actionNames.push(action);
      eventIds.push(ob.id());
    } catch (err2) {
      compileSkips.push(VerificationSkipped.reconstitute({ target: ob.id().asTargetId(), reason: "compile-error", detail: err2 instanceof Error ? err2.message : String(err2) }));
    }
  }
  const idleParts = attrs.map((a) => `${qVar(a.path().asString())}' = ${qVar(a.path().asString())}`);
  lines.push(`  action idle = all { ${idleParts.join(", ")} }`);
  lines.push(`  action step = any { ${actionNames.length > 0 ? actionNames.join(", ") : "idle"} }`);
  lines.push("");
  const temporalNames = new Map;
  for (const ob of model.obligations()) {
    const temporal = ob.temporal();
    if (!ob.isStateTemporal() || temporal?.pattern !== "leads-to")
      continue;
    if (temporal.from === undefined || temporal.to === undefined)
      continue;
    try {
      const from = quintOf(temporal.from, stateName);
      const to = quintOf(temporal.to, stateName);
      lines.push(`  temporal ${qId("temp", ob.id().asString())} = always(${from} implies eventually(${to}))`);
      temporalNames.set(ob.id().asString(), qId("temp", ob.id().asString()));
    } catch (err2) {
      compileSkips.push(VerificationSkipped.reconstitute({ target: ob.id().asTargetId(), reason: "compile-error", detail: err2 instanceof Error ? err2.message : String(err2) }));
    }
  }
  lines.push("");
  const scenarioInitActions = new Map;
  const scenariosWithInit = [];
  for (const sc of model.scenarios()) {
    if (sc.hasEvent())
      continue;
    const bindings = sc.bindings();
    const boundPaths = new Set(Object.keys(bindings));
    if (attrs.some((a) => !boundPaths.has(a.path().asString())))
      continue;
    const parts = [];
    let okAll = true;
    for (const attr of attrs) {
      const value = bindings[attr.path().asString()];
      if (value === undefined) {
        okAll = false;
        break;
      }
      parts.push(`${qVar(attr.path().asString())}' = ${qLit(value)}`);
    }
    if (!okAll)
      continue;
    const initAction = qId("scInit", sc.id().asString());
    lines.push(`  action ${initAction} = all { ${parts.join(", ")} }`);
    scenarioInitActions.set(sc.id().asString(), initAction);
    scenariosWithInit.push(sc.id());
  }
  lines.push("}");
  return {
    moduleText: `${lines.join(`
`)}
`,
    plan: QuintMachinePlan.of({
      invariantComponents: QuintMachineComponents.of(invariantComponents),
      eventIds: ObligationIds.of(eventIds),
      scenariosWithInit
    }),
    compileSkips,
    varToPath,
    scenarioInitActions,
    temporalNames
  };
}
// src/requirements/adapter/itf-decoder.ts
function decodeItfValue(v) {
  if (isObject(v) && typeof v["#bigint"] === "string")
    return Number.parseInt(v["#bigint"], 10);
  return v;
}
function decodeItfTrace(itfText, varToPath) {
  const doc = JSON.parse(itfText);
  if (!isObject(doc) || !Array.isArray(doc.states))
    return [];
  const trace = [];
  for (const state of doc.states) {
    if (!isObject(state))
      continue;
    const entries = [];
    for (const key of Object.keys(state).sort()) {
      if (key.startsWith("#"))
        continue;
      const path = varToPath.get(key) ?? key;
      entries.push([AttributePath.reconstitute(path), TraceValue.of(decodeItfValue(state[key] ?? null))]);
    }
    trace.push(TraceState.of(entries));
  }
  return trace;
}
function itfStatus(itfText) {
  try {
    const doc = JSON.parse(itfText);
    if (isObject(doc) && isObject(doc["#meta"]) && typeof doc["#meta"].status === "string") {
      return doc["#meta"].status;
    }
  } catch {}
  return "";
}
// src/requirements/adapter/quint-client-impl.ts
import { spawnSync as spawnSync2 } from "child_process";
import { existsSync as existsSync2, mkdtempSync, readFileSync as readFileSync4, readdirSync as readdirSync2, rmSync as rmSync4, writeFileSync as writeFileSync3 } from "fs";
import { tmpdir } from "os";
import { join as join4 } from "path";
var SEED = "0x2a";
var MAX_STEPS = 8;
var MAX_SAMPLES = 200;
var RUN_TIMEOUT_MS = 30000;
var VERIFY_TIMEOUT_MS = 45000;
var SCENARIO_TIMEOUT_MS = 15000;

class QuintClientImpl {
  #config;
  constructor(config) {
    this.#config = config;
  }
  check(model) {
    const probe = spawnSync2(this.#config.quintBin, ["--version"], { encoding: "utf-8", timeout: 15000 });
    if (probe.error || probe.status !== 0) {
      return { kind: "cli-unavailable" };
    }
    const bounded = this.#detectBoundedMode();
    const method = bounded ? "bounded" : "simulation";
    const compiled = compileQuintMachine(model);
    if (compiled.kind === "uncompilable") {
      return { kind: "machine-uncompilable", method, error: compiled.error };
    }
    const machine = compiled.machine;
    const work = mkdtempSync(join4(tmpdir(), "deep-spec-quint-"));
    const modulePath = join4(work, "main.qnt");
    writeFileSync3(modulePath, machine.moduleText, "utf-8");
    try {
      const machineRun = this.#runMachinePhase(machine, modulePath, bounded, work);
      const skipTargets = new Set(machine.compileSkips.map((s) => s.target().asString()));
      if (machineRun !== null && machineRun.abortsMachineTargets()) {
        for (const t of machine.plan.machineTargets()) {
          skipTargets.add(t.asString());
        }
      }
      const temporals = bounded ? this.#runTemporalPhase(machine, modulePath, skipTargets, work) : new Map;
      const scenarios = this.#runScenarioPhase(machine, modulePath, work);
      const runs = QuintRuns.of({
        machine: machineRun,
        temporals: KeyedIndex.of([...temporals].map(([id, v]) => [ObligationId.reconstitute(id), v])),
        scenarios: KeyedIndex.of([...scenarios].map(([id, v]) => [ScenarioId.reconstitute(id), v]))
      });
      return { kind: "checked", method, plan: machine.plan, compileSkips: VerificationSkips.of(machine.compileSkips), runs };
    } finally {
      rmSync4(work, { recursive: true, force: true });
    }
  }
  #detectBoundedMode() {
    const override = this.#config.methodOverride;
    if (override === "bounded")
      return true;
    if (override === "simulation")
      return false;
    const java = spawnSync2("java", ["-version"], { encoding: "utf-8", timeout: 1e4 });
    if (java.error || java.status !== 0)
      return false;
    if (this.#config.apalacheDistSet)
      return true;
    try {
      return readdirSync2(join4(this.#config.homeDirectory, ".quint")).some((f) => f.startsWith("apalache-dist-"));
    } catch {
      return false;
    }
  }
  #runQuint(args, itfPath, timeoutMs, cwd) {
    const budget = this.#config.timeoutOverrideMs ?? timeoutMs;
    const res = spawnSync2(this.#config.quintBin, args, { encoding: "utf-8", timeout: budget, cwd, killSignal: "SIGINT" });
    const errorCode = res.error?.code;
    const timedOut = errorCode === "ETIMEDOUT" || res.signal === "SIGINT" || res.signal === "SIGTERM" || res.signal === "SIGKILL";
    const failed = !timedOut && (res.error !== undefined || res.status !== 0);
    let itf = null;
    if (itfPath && existsSync2(itfPath)) {
      try {
        itf = readFileSync4(itfPath, "utf-8");
      } catch {
        itf = null;
      }
    }
    return { timedOut, failed, stdout: res.stdout ?? "", stderr: res.stderr ?? "", itf };
  }
  #outputTail(run) {
    return `${run.stderr}${run.stdout}`.trim().split(`
`).pop()?.slice(0, 200) ?? "";
  }
  #didNotAnswer(run) {
    return run.failed || `${run.stdout}
${run.stderr}`.toLowerCase().includes("error");
  }
  #runMachinePhase(machine, modulePath, bounded, work) {
    const itfPath = join4(work, "machine.itf.json");
    const run = bounded ? this.#runQuint(["verify", modulePath, "--main=main", "--invariant=invAll", `--max-steps=${MAX_STEPS}`, `--out-itf=${itfPath}`], itfPath, VERIFY_TIMEOUT_MS, work) : this.#runQuint([
      "run",
      modulePath,
      "--main=main",
      "--invariant=invAll",
      `--seed=${SEED}`,
      `--max-samples=${MAX_SAMPLES}`,
      `--max-steps=${MAX_STEPS}`,
      `--out-itf=${itfPath}`
    ], itfPath, RUN_TIMEOUT_MS, work);
    if (run.timedOut)
      return QuintMachineRunVerdict.timeout();
    if (`${run.stdout}
${run.stderr}`.toLowerCase().includes("deadlock")) {
      return QuintMachineRunVerdict.deadlock(run.itf ? TraceStates.of(decodeItfTrace(run.itf, machine.varToPath)) : null);
    }
    const violated = run.itf !== null && (itfStatus(run.itf) === "violation" || bounded && !!run.itf);
    if (violated && run.itf) {
      return QuintMachineRunVerdict.violation(TraceStates.of(decodeItfTrace(run.itf, machine.varToPath)));
    }
    if (!violated && run.itf === null && this.#didNotAnswer(run)) {
      return QuintMachineRunVerdict.runFailed(this.#outputTail(run));
    }
    return QuintMachineRunVerdict.clean();
  }
  #runTemporalPhase(machine, modulePath, skipTargets, work) {
    const out = new Map;
    for (const [obId, temporalName] of machine.temporalNames) {
      if (skipTargets.has(obId))
        continue;
      const itfPath = join4(work, `${temporalName}.itf.json`);
      const run = this.#runQuint(["verify", modulePath, "--main=main", `--temporal=${temporalName}`, `--max-steps=${MAX_STEPS}`, `--out-itf=${itfPath}`], itfPath, VERIFY_TIMEOUT_MS, work);
      if (run.timedOut) {
        out.set(obId, QuintTemporalVerdict.timeout());
      } else if (run.itf) {
        out.set(obId, QuintTemporalVerdict.violation(TraceStates.of(decodeItfTrace(run.itf, machine.varToPath))));
      } else if (this.#didNotAnswer(run)) {
        out.set(obId, QuintTemporalVerdict.runFailed(this.#outputTail(run)));
      } else {
        out.set(obId, QuintTemporalVerdict.clean());
      }
    }
    return out;
  }
  #runScenarioPhase(machine, modulePath, work) {
    const out = new Map;
    for (const [scId, initAction] of machine.scenarioInitActions) {
      const itfPath = join4(work, `${initAction.replace(/^scInit/, "sc")}.itf.json`);
      const run = this.#runQuint([
        "run",
        modulePath,
        "--main=main",
        `--init=${initAction}`,
        "--step=idle",
        "--invariant=invAll",
        "--max-steps=1",
        "--max-samples=1",
        `--seed=${SEED}`,
        `--out-itf=${itfPath}`
      ], itfPath, SCENARIO_TIMEOUT_MS, work);
      if (run.timedOut) {
        out.set(scId, QuintScenarioVerdict.timeout());
      } else if (!run.itf && this.#didNotAnswer(run)) {
        out.set(scId, QuintScenarioVerdict.runFailed(this.#outputTail(run)));
      } else {
        out.set(scId, QuintScenarioVerdict.evaluated(run.itf !== null && itfStatus(run.itf) === "violation"));
      }
    }
    return out;
  }
}
// src/requirements/adapter/ir-validation-materials-repository-impl.ts
import { existsSync as existsSync3, readFileSync as readFileSync5 } from "fs";
import { basename as basename2, dirname as dirname2 } from "path";
var FORMAL_MODEL_BASENAME = "deep-spec-analysis-formal-model.md";
function asExpression(v) {
  return isObject(v) ? v : undefined;
}
function buildView(ir) {
  const entities = [];
  const schema = isObject(ir.schema) ? ir.schema : {};
  for (const ent of Array.isArray(schema.entities) ? schema.entities : []) {
    if (!isObject(ent) || typeof ent.name !== "string")
      continue;
    const attributes = [];
    for (const attr of Array.isArray(ent.attributes) ? ent.attributes : []) {
      if (!isObject(attr) || typeof attr.name !== "string")
        continue;
      const t = isObject(attr.type) ? attr.type : {};
      attributes.push(IrAttributeDecl.reconstitute({
        name: IrAttributeName.reconstitute(attr.name),
        kind: typeof t.kind === "string" ? t.kind : "",
        values: Array.isArray(t.values) ? IrDeclaredValues.of(t.values.filter((v) => typeof v === "string")) : undefined,
        min: typeof t.min === "number" ? AttributeBound.reconstitute(t.min) : undefined,
        max: typeof t.max === "number" ? AttributeBound.reconstitute(t.max) : undefined
      }));
    }
    entities.push(IrEntityDecl.reconstitute({ name: IrEntityName.reconstitute(ent.name), attributes: IrAttributeDecls.of(attributes) }));
  }
  const obligations = [];
  for (const ob of Array.isArray(ir.obligations) ? ir.obligations : []) {
    if (!isObject(ob) || typeof ob.id !== "string")
      continue;
    const temporal = isObject(ob.temporal) ? ob.temporal : null;
    obligations.push(IrObligationDecl.reconstitute({
      id: ObligationId.reconstitute(ob.id),
      assert: asExpression(ob.assert ?? null),
      guard: asExpression(ob.guard ?? null),
      effect: asExpression(ob.effect ?? null),
      temporal: temporal === null ? undefined : IrTemporalDecl.reconstitute({
        assert: asExpression(temporal.assert ?? null),
        from: asExpression(temporal.from ?? null),
        to: asExpression(temporal.to ?? null)
      })
    }));
  }
  const scenarios = [];
  for (const sc of Array.isArray(ir.scenarios) ? ir.scenarios : []) {
    if (!isObject(sc) || typeof sc.id !== "string")
      continue;
    const bindings = isObject(sc.bindings) ? sc.bindings : {};
    scenarios.push(IrScenarioDecl.reconstitute({
      id: ScenarioId.reconstitute(sc.id),
      bindings: IrBindingPairs.of(Object.entries(bindings)),
      hasEvent: isObject(sc.event ?? null),
      expect: asExpression(sc.expect ?? null)
    }));
  }
  const background = [];
  for (const bg of Array.isArray(ir.background) ? ir.background : []) {
    if (!isObject(bg) || typeof bg.id !== "string")
      continue;
    background.push(IrBackgroundDecl.reconstitute({ id: BackgroundAssumptionId.reconstitute(bg.id), assert: asExpression(bg.assert ?? null) }));
  }
  return IrModelDecl.reconstitute({
    entities: IrEntityDecls.of(entities),
    obligations: IrObligationDecls.of(obligations),
    scenarios: IrScenarioDecls.of(scenarios),
    background: IrBackgroundDecls.of(background)
  });
}
function collectFrClaims(ir) {
  const claims = [];
  for (const section of ["obligations", "scenarios", "unformalized"]) {
    const arr = Array.isArray(ir[section]) ? ir[section] : [];
    arr.forEach((entry, i) => {
      if (!isObject(entry))
        return;
      const owner = typeof entry.id === "string" ? entry.id : `${section}[${i}]`;
      const refs = entry.frRefs ?? null;
      if (!Array.isArray(refs))
        return;
      claims.push(FrRefClaim.of(owner, FrRefs.reconstitute(refs.filter((r) => typeof r === "string"))));
    });
  }
  return claims;
}

class IrValidationMaterialsRepositoryImpl {
  #schemaPath;
  constructor(config) {
    this.#schemaPath = config.schemaPath;
  }
  findById(id) {
    const outputPath = id.modelId().artifactPath().asString();
    if (basename2(outputPath) !== FORMAL_MODEL_BASENAME || !existsSync3(outputPath)) {
      return err({ kind: "not-found", path: outputPath });
    }
    const corrupt = (cause) => err({ kind: "corrupt", path: outputPath, cause });
    let bytes;
    try {
      bytes = readFileSync5(outputPath);
    } catch (e) {
      return err({ kind: "io-failed", operation: "read", path: outputPath, cause: e instanceof Error ? e.message : String(e) });
    }
    const md = bytes.toString("utf-8");
    const fences = extractFences(md, "json").map((f) => f.body);
    if (fences.length !== 1) {
      return corrupt(`formal model must contain exactly one \`\`\`json fence (found ${fences.length})`);
    }
    let ir;
    try {
      ir = JSON.parse(fences[0] ?? "");
    } catch (e) {
      return corrupt(`IR fence is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!isObject(ir)) {
      return corrupt("IR fence must contain a JSON object");
    }
    if (!existsSync3(this.#schemaPath)) {
      return corrupt(`IR schema not installed at ${this.#schemaPath} \u2014 run plugin sync`);
    }
    const schema = readContractSchema(this.#schemaPath);
    if (!schema.ok) {
      return corrupt(`IR schema unreadable: ${schema.error.cause}`);
    }
    const schemaErrors = [];
    validateSchema(schema.value, schema.value, ir, "", schemaErrors);
    const recordRoot = ArtifactPath.parse(dirname2(dirname2(dirname2(outputPath))));
    if (!recordRoot.ok) {
      return corrupt("defect: record-root derivation produced an empty path");
    }
    return ok(IrValidationMaterials.reconstitute({
      id,
      irVersion: IrVersion.reconstitute(typeof ir.irVersion === "string" ? ir.irVersion : ""),
      schemaErrors: ErrorMessages.of(schemaErrors),
      view: buildView(ir),
      frClaims: FrRefClaims.of(collectFrClaims(ir)),
      declaredDigest: typeof ir.sourceDigest === "string" ? ir.sourceDigest : null,
      sourceId: RequirementsSourceId.of(recordRoot.value),
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
// src/requirements/adapter/requirements-source-repository-impl.ts
import { existsSync as existsSync4, readFileSync as readFileSync6, readdirSync as readdirSync3 } from "fs";
import { join as join5 } from "path";
function findRequirementsFile(recordDir) {
  const direct = join5(recordDir, "inception", "requirements-analysis", "requirements.md");
  if (existsSync4(direct))
    return { kind: "found", path: direct };
  if (!existsSync4(recordDir))
    return { kind: "absent" };
  try {
    for (const phase of readdirSync3(recordDir).sort()) {
      const candidate = join5(recordDir, phase, "requirements-analysis", "requirements.md");
      if (existsSync4(candidate))
        return { kind: "found", path: candidate };
    }
  } catch (e) {
    return { kind: "unreadable", cause: e instanceof Error ? e.message : String(e) };
  }
  return { kind: "absent" };
}

class RequirementsSourceRepositoryImpl {
  findById(id) {
    const search = findRequirementsFile(id.recordRoot().asString());
    if (search.kind === "unreadable") {
      return err({ kind: "io-failed", operation: "read", path: id.recordRoot().asString(), cause: search.cause });
    }
    if (search.kind === "absent")
      return err({ kind: "not-found", path: id.recordRoot().asString() });
    try {
      const bytes = readFileSync6(search.path);
      return ok(RequirementsSource.reconstitute({
        id,
        sourcePath: ArtifactPath.reconstitute(search.path),
        knownIds: RequirementIds.extractFrom(bytes.toString("utf-8")),
        digest: ContentHash.ofBytes(bytes).asString(),
        sourceDocument: new Uint8Array(bytes)
      }));
    } catch (e) {
      return err({ kind: "io-failed", operation: "read", path: search.path, cause: e instanceof Error ? e.message : String(e) });
    }
  }
  store(source) {
    const path = source.sourcePath().asString();
    try {
      writeFileAtomically(path, source.sourceDocument());
      return ok(undefined);
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path, cause: e instanceof Error ? e.message : String(e) });
    }
  }
}
// src/requirements/usecase/verification-report-finalizer.ts
class VerificationReportFinalizer {
  #repository;
  #findingsSchema;
  constructor(repository, findingsSchema) {
    this.#repository = repository;
    this.#findingsSchema = findingsSchema;
  }
  finalize(report, model) {
    return this.#finalizing(report, (staged) => staged.crossChecked(model, report.irHash()).conformedTo(this.#findingsSchema));
  }
  finalizeIrUnreadable(report) {
    const finalized = this.#finalizing(report, (staged) => staged.withoutCrossCheck());
    if (!finalized.ok)
      return err(finalized.error);
    return ok(undefined);
  }
  #finalizing(report, resolveCrossCheck) {
    const loaded = this.#repository.findByDirectory(report.id().directory());
    if (!loaded.ok)
      return err(loaded.error);
    const staged = loaded.value.finalizing(report).conformedTo(this.#findingsSchema);
    const aggregate = resolveCrossCheck(staged).conformedTo(this.#findingsSchema);
    const stored = this.#repository.store(aggregate);
    if (!stored.ok)
      return err(stored.error);
    const published = aggregate.candidate();
    if (published === null) {
      return err({ kind: "io-failed", operation: "write", path: report.id().fileName(), cause: "no finalization candidate" });
    }
    return ok(published);
  }
}
// src/requirements/usecase/verify-requirements-smt-usecase.ts
var BACKEND = "smt";

class VerifyRequirementsSmtUseCase {
  #formalModelRepository;
  #z3SolverClient;
  #finalizer;
  constructor(formalModelRepository, verificationDirectoryRepository, findingsSchema, z3SolverClient) {
    this.#formalModelRepository = formalModelRepository;
    this.#z3SolverClient = z3SolverClient;
    this.#finalizer = new VerificationReportFinalizer(verificationDirectoryRepository, findingsSchema);
  }
  execute(input) {
    const id = VerificationReportId.of(input.verifyDirectory, BACKEND);
    const acquired = this.#formalModelRepository.findById(input.modelId);
    if (!acquired.ok) {
      if (acquired.error.kind === "not-found")
        return { kind: "not-applicable" };
      if (acquired.error.kind === "io-failed")
        return { kind: "acquisition-failed", error: acquired.error };
      const saved = this.#finalizer.finalizeIrUnreadable(VerificationReport.irUnreadable(id, "exhaustive", acquired.error.cause));
      if (!saved.ok)
        return { kind: "save-failed", error: saved.error };
      return { kind: "model-unreadable" };
    }
    const model = acquired.value;
    const irHash = model.irHash();
    if (!model.supportsMajor(SUPPORTED_IR_MAJOR)) {
      const saved = this.#finalizer.finalize(VerificationReport.versionMismatch(id, model, irHash, "exhaustive"), model);
      if (!saved.ok)
        return { kind: "save-failed", error: saved.error };
      return { kind: "version-mismatch" };
    }
    const run = this.#z3SolverClient.check(model);
    if (run.result.kind === "unavailable") {
      const unavailable = VerificationReport.solverUnavailable(id, model, irHash, run.plan.planSkipped(), run.result.reason);
      const saved = this.#finalizer.finalize(unavailable, model);
      if (!saved.ok)
        return { kind: "save-failed", error: saved.error };
      return { kind: "solver-unavailable" };
    }
    const interpreted = run.plan.interpret(model, run.result.verdicts);
    const report = VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method: "exhaustive",
      findings: interpreted.findings,
      skipped: interpreted.skipped
    });
    const finalized = this.#finalizer.finalize(report, model);
    if (!finalized.ok)
      return { kind: "save-failed", error: finalized.error };
    const published = finalized.value;
    return {
      kind: "verified",
      pass: published.passes(),
      findingsCount: published.findingsCount(),
      skippedCount: published.skippedCount()
    };
  }
}
// src/requirements/usecase/verify-requirements-quint-usecase.ts
var BACKEND2 = "quint";

class VerifyRequirementsQuintUseCase {
  #formalModelRepository;
  #quintClient;
  #finalizer;
  constructor(formalModelRepository, verificationDirectoryRepository, findingsSchema, quintClient) {
    this.#formalModelRepository = formalModelRepository;
    this.#quintClient = quintClient;
    this.#finalizer = new VerificationReportFinalizer(verificationDirectoryRepository, findingsSchema);
  }
  execute(input) {
    const id = VerificationReportId.of(input.verifyDirectory, BACKEND2);
    const acquired = this.#formalModelRepository.findById(input.modelId);
    if (!acquired.ok) {
      if (acquired.error.kind === "not-found")
        return { kind: "not-applicable" };
      if (acquired.error.kind === "io-failed")
        return { kind: "acquisition-failed", error: acquired.error };
      const saved = this.#finalizer.finalizeIrUnreadable(VerificationReport.irUnreadable(id, "simulation", acquired.error.cause));
      if (!saved.ok)
        return { kind: "save-failed", error: saved.error };
      return { kind: "model-unreadable" };
    }
    const model = acquired.value;
    const irHash = model.irHash();
    if (!model.supportsMajor(SUPPORTED_IR_MAJOR)) {
      const saved = this.#finalizer.finalize(VerificationReport.versionMismatch(id, model, irHash, "simulation"), model);
      if (!saved.ok)
        return { kind: "save-failed", error: saved.error };
      return { kind: "version-mismatch" };
    }
    const checked = this.#quintClient.check(model);
    if (checked.kind === "cli-unavailable") {
      const saved = this.#finalizer.finalize(VerificationReport.quintUnavailable(id, model, irHash), model);
      if (!saved.ok)
        return { kind: "save-failed", error: saved.error };
      return { kind: "backend-unavailable" };
    }
    if (checked.kind === "machine-uncompilable") {
      const uncompilable = VerificationReport.machineUncompilable(id, model, irHash, checked.method, checked.error);
      const saved = this.#finalizer.finalize(uncompilable, model);
      if (!saved.ok)
        return { kind: "save-failed", error: saved.error };
      return { kind: "machine-uncompilable" };
    }
    const interpreted = checked.plan.interpret(model, checked.compileSkips, checked.method, checked.runs);
    const report = VerificationReport.compose({
      id,
      irVersion: model.irVersion(),
      irHash,
      method: checked.method,
      findings: interpreted.findings,
      skipped: interpreted.skipped
    });
    const finalized = this.#finalizer.finalize(report, model);
    if (!finalized.ok)
      return { kind: "save-failed", error: finalized.error };
    const published = finalized.value;
    return {
      kind: "verified",
      pass: published.passes(),
      findingsCount: published.findingsCount(),
      skippedCount: published.skippedCount(),
      method: checked.method
    };
  }
}
// src/requirements/usecase/validate-ir-usecase.ts
class ValidateIrUseCase {
  #irValidationMaterialsRepository;
  #requirementsSourceRepository;
  constructor(irValidationMaterialsRepository, requirementsSourceRepository) {
    this.#irValidationMaterialsRepository = irValidationMaterialsRepository;
    this.#requirementsSourceRepository = requirementsSourceRepository;
  }
  execute(modelId) {
    const found = this.#irValidationMaterialsRepository.findById(IrValidationMaterialsId.ofModel(modelId));
    if (!found.ok) {
      if (found.error.kind === "not-found")
        return { kind: "not-applicable" };
      return { kind: "verdict", pass: false, errors: [found.error.cause] };
    }
    const materials = found.value;
    const errors = [];
    const major = materials.irVersion().majorVersion();
    if (Number.isInteger(major) && major !== SUPPORTED_IR_MAJOR) {
      errors.push(`irVersion ${materials.irVersion().asString()}: unsupported major version (this validator supports ${SUPPORTED_IR_MAJOR}.x.x)`);
    }
    errors.push(...materials.schemaErrors());
    if (errors.length === 0) {
      errors.push(...materials.view().wellFormednessErrors());
      const index = materials.frReferenceIndex();
      const source = this.#requirementsSourceRepository.findById(materials.sourceId());
      if (!source.ok) {
        errors.push("requirements.md not found under this intent record \u2014 frRefs cannot be reverse-verified");
      } else {
        errors.push(...index.missingErrors(source.value.knownIds()));
        errors.push(...SourceAnchor.of(materials.declaredDigest(), source.value.digest()).errors());
      }
    }
    return { kind: "verdict", pass: errors.length === 0, errors };
  }
}
// src/entries/aidlc-sensor-deep-spec-ir-valid.ts
var MAX_REPORTED_ERRORS = 25;
function main() {
  const flags = parseFlags(process.argv.slice(2));
  const target = ArtifactPath.parse(flags.outputPath);
  if (!target.ok) {
    process.stderr.write(`deep-spec-ir-valid: --output-path is required
`);
    process.exit(1);
  }
  const schemaPath = join6(dirname3(fileURLToPath(import.meta.url)), "data", "deep-spec-ir-schema.json");
  const useCase = new ValidateIrUseCase(new IrValidationMaterialsRepositoryImpl({ schemaPath }), new RequirementsSourceRepositoryImpl);
  const outcome = useCase.execute(FormalModelId.of(target.value));
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
