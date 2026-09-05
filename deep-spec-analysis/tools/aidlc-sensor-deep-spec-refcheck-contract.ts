// @bun
// src/entries/aidlc-sensor-deep-spec-refcheck-contract.ts
import { basename as basename3, dirname as dirname4, join as join6 } from "path";
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
// src/kernel/adapter/verdict-line.ts
function renderVerdictLine(pass, findings, skipped, note) {
  const out = { pass, findings_count: findings, skipped_count: skipped, method: "static" };
  if (note)
    out.note = note;
  return `${JSON.stringify(out)}
`;
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
// src/kernel/infrastructure/canonical-json.ts
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
    if (error instanceof IllegalArgumentException)
      return err(error.problem);
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
// src/kernel/adapter/contract-schema.ts
function readContractSchema(path) {
  try {
    return ok(JSON.parse(readFileSync2(path, "utf-8")));
  } catch (e) {
    return err({ cause: e instanceof Error ? e.message : String(e) });
  }
}
// src/kernel/adapter/domain-decoding.ts
function decodeDomainValues(build) {
  const parsed = parseConstruction(build);
  return parsed.ok ? parsed : err(JSON.stringify(parsed.error));
}
// src/kernel/adapter/yaml.ts
class YamlError extends Error {
  constructor(message) {
    super(message);
  }
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
// src/kernel/adapter/md-table.ts
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
// src/kernel/adapter/list-subdirectories.ts
import { readdirSync } from "fs";
function listSubdirectories(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch {
    return [];
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
    const snapshot = structuredClone(root);
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
  constructor(raw) {
    if (!/^[0-9a-f]{64}$/.test(raw))
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
    this.#value = value;
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
// src/kernel/domain/ir-version.ts
class IrVersion {
  #value;
  constructor(raw) {
    if (!/^\d+\.\d+\.\d+$/.test(raw))
      throw new IllegalArgumentException({ kind: "not-a-semver", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new IrVersion(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new IrVersion(raw));
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
// src/kernel/domain/target-id.ts
var TARGET_ID_PATTERNS = [
  /^(OB|SC)-[0-9]+$/,
  /^BR[0-9]+\.[0-9]+$/,
  /^(DOB|DSC|DBG|SM|TR)-[0-9]+$/,
  /^(component|entity|attr|unit|contract|state|check):[A-Za-z0-9_./-]+$/
];

class TargetId {
  #value;
  constructor(raw) {
    if (!TARGET_ID_PATTERNS.some((pattern) => pattern.test(raw)))
      throw new IllegalArgumentException({ kind: "malformed-target-id", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new TargetId(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new TargetId(raw));
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
    return TargetIds.of(Array.from(sortedUniqueCanonically(this.toStrings()), (raw) => TargetId.of(raw)));
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
  static of(raw) {
    return new RequirementId(raw);
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

// src/kernel/domain/fr-refs.ts
class FrRefs {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new FrRefs([...values]);
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
    return FrRefs.of(Array.from(sortedUniqueCanonically(this.toStrings()), (raw) => RequirementId.of(raw)));
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

// src/kernel/domain/requirement-ids.ts
class RequirementIds {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static extractFrom(text) {
    const ids = [];
    for (const m of text.matchAll(/\b(?:FR|NFR)-?[0-9]+(?:\.[0-9]+)*\b/g)) {
      ids.push(RequirementId.of(m[0]));
    }
    return new RequirementIds(KeySet.of(ids));
  }
  static of(values) {
    return new RequirementIds(KeySet.of(values));
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
  constructor(raw) {
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
    this.#values = Object.freeze([...values]);
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
  constructor(raw) {
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
    this.#value = value;
  }
  static of(raw) {
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
  constructor(raw) {
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
// src/kernel/domain/unit-name.ts
class UnitName {
  #value;
  constructor(raw) {
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
    this.#value = value;
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
    this.#value = value;
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
// src/refcheck/domain/catalog-version.ts
var CATALOG_VERSION = "1.0.0";
// src/refcheck/domain/element-path.ts
class ElementPath {
  #value;
  constructor(raw) {
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

// src/refcheck/domain/witness-ref.ts
class WitnessRef {
  #artifact;
  #element;
  #value;
  constructor(props) {
    this.#artifact = ArtifactPath.of(props.artifact);
    this.#element = ElementPath.of(props.element);
    this.#value = props.value;
  }
  static of(props) {
    return new WitnessRef(props);
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
  pointsAt(artifact, element) {
    return this.#artifact.asString() === artifact && this.#element.asString() === element;
  }
  static at(artifact, element, value) {
    return new WitnessRef(value === undefined ? { artifact, element } : { artifact, element, value });
  }
}
// src/refcheck/domain/witness-refs.ts
class WitnessRefs {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new WitnessRefs([...values]);
  }
  add(value) {
    return new WitnessRefs([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/refcheck/domain/finding.ts
class Finding {
  #kind;
  #frRefs;
  #targets;
  #witness;
  #unit;
  #detail;
  constructor(props) {
    this.#kind = props.kind;
    this.#frRefs = props.frRefs;
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
  frRefs() {
    return this.#frRefs;
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
class Findings {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new Findings([...values]);
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
  isEmpty() {
    return this.#values.length === 0;
  }
  sortedCanonically() {
    return new Findings([...this.#values].sort((a, b) => a.compareTo(b)));
  }
  toArray() {
    return this.#values;
  }
}
// src/refcheck/domain/skips.ts
class Skips {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new Skips([...values]);
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
  compareTo(other) {
    const c = this.#target.compareTo(other.#target);
    if (c !== 0)
      return c;
    return this.#reason.compareTo(other.#reason);
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
  static of(props) {
    return new InputAnchor(props);
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
// src/refcheck/domain/input-anchors.ts
class InputAnchors {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new InputAnchors([...values]);
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
    return new ReferenceCheckReport(this.#id, this.#inputs, TargetIds.of([]), Findings.of([]), Skips.of([]), reason, undefined);
  }
  static of(seed) {
    return new ReferenceCheckReport(seed.id, seed.inputs, seed.checked, seed.findings, seed.skipped, seed.unavailableReason, undefined);
  }
  finding(family, kind, targets, refs, detail, frRefs = []) {
    this.#findings = this.#findings.add(Finding.of({
      kind,
      frRefs: FrRefs.of(Array.from(frRefs, (raw) => RequirementId.of(raw))).sortedUnique(),
      targets: TargetIds.of(Array.from(targets, (raw) => TargetId.of(raw))).sortedUniqueCanonically(),
      witness: { refs: WitnessRefs.of(refs) },
      detail: family.prefixedDetail(detail),
      ...this.#unit !== undefined ? { unit: this.#unit } : {}
    })).sortedCanonically();
    this.#checked = this.#checked.excluding(TargetId.of(family.asCheckTarget()));
  }
  skip(family, reason, detail) {
    this.#skipped = this.#skipped.add(Skipped.of({
      target: TargetId.of(family.asCheckTarget()),
      reason: SkipReason.of(reason),
      detail,
      ...this.#unit !== undefined ? { unit: this.#unit } : {}
    })).sortedCanonically();
    this.#checked = this.#checked.excluding(TargetId.of(family.asCheckTarget()));
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
        frRefs: f.frRefs().toStrings(),
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
// src/refcheck/domain/reference-check-report-id.ts
class ReferenceCheckReportId {
  #directory;
  #backend;
  constructor(directory, backend) {
    this.#directory = directory;
    this.#backend = backend;
  }
  static of(directory, backend) {
    return new ReferenceCheckReportId(directory, BackendName.of(backend));
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
// src/refcheck/domain/check-family.ts
class CheckFamily {
  #value;
  constructor(raw) {
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
// src/refcheck/domain/check-families.ts
class CheckFamilies {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new CheckFamilies([...values]);
  }
  add(value) {
    return new CheckFamilies([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  checkTargets() {
    return TargetIds.of(Array.from(this.#values.map((f) => f.asCheckTarget()), (raw) => TargetId.of(raw)));
  }
  toArray() {
    return this.#values;
  }
}
// src/refcheck/domain/unit-names.ts
class UnitNames {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new UnitNames([...values]);
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
// src/refcheck/domain/block-index.ts
class BlockIndex {
  #value;
  constructor(raw) {
    if (!Number.isInteger(raw) || raw < 1)
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
// src/refcheck/domain/line-number.ts
class LineNumber {
  #value;
  constructor(raw) {
    if (!Number.isInteger(raw) || raw < 1)
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
// src/refcheck/domain/fence-count.ts
class FenceCount {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static of(value) {
    return new FenceCount(value);
  }
  asNumber() {
    return this.#value;
  }
}
// src/refcheck/domain/component-name.ts
class ComponentName {
  #value;
  constructor(raw) {
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

// src/refcheck/domain/entity-name.ts
class EntityName {
  #value;
  constructor(raw) {
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

// src/refcheck/domain/components.ts
class Components {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new Components([...values]);
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
    const art = artifact.asString();
    for (const c of this) {
      if (!c.nameIsPascalCase()) {
        const cName = c.name().asString();
        report.finding(DD_1, FindingKind.structureInvalid(), [TargetIds.safe("component", cName)], [WitnessRef.at(art, `${c.element().asString()}.name`, cName)], `component name "${cName}" is not PascalCase`);
      }
    }
    for (const { prior, current } of this.duplicateNamePairs()) {
      const cName = current.name().asString();
      report.finding(DD_1, FindingKind.structureInvalid(), [TargetIds.safe("component", cName)], [WitnessRef.at(art, `${prior.element().asString()}.name`, cName), WitnessRef.at(art, `${current.element().asString()}.name`, cName)], `component name "${cName}" is declared more than once`);
    }
    for (const c of this) {
      for (const r of [...c.dependsOn(), ...c.dependents()]) {
        if (!this.declares(r.component())) {
          report.finding(DD_2, FindingKind.referenceBroken(), [TargetIds.safe("component", r.component().asString())], [WitnessRef.at(art, r.element().asString(), r.component().asString())], `"${c.name().asString()}" references undeclared component "${r.component().asString()}"`);
        }
      }
      for (const e of c.entities()) {
        for (const r of e.references()) {
          if (!this.declares(r.ownedBy())) {
            report.finding(DD_2, FindingKind.referenceBroken(), [TargetIds.safe("component", r.ownedBy().asString())], [WitnessRef.at(art, `${r.element().asString()}.owned_by`, r.ownedBy().asString())], `entity "${e.name().asString()}" references owner component "${r.ownedBy().asString()}" which is not declared`);
          }
        }
      }
    }
    for (const c of this) {
      for (const r of c.selfReferences()) {
        report.finding(DD_3, FindingKind.structureInvalid(), [TargetIds.safe("component", c.name().asString())], [WitnessRef.at(art, r.element().asString(), c.name().asString())], `component "${c.name().asString()}" lists itself as a dependency`);
      }
    }
    for (const c of this) {
      for (const r of c.dependsOn()) {
        const other = this.byName(r.component());
        if (!other || r.pointsAt(c.name()))
          continue;
        if (!other.dependents().listsComponent(c.name())) {
          report.finding(DD_4, FindingKind.structureInvalid(), [TargetIds.safe("component", c.name().asString()), TargetIds.safe("component", r.component().asString())], [WitnessRef.at(art, r.element().asString(), r.component().asString()), WitnessRef.at(art, `${other.element().asString()}.dependents`, c.name().asString())], `"${c.name().asString()}" depends on "${r.component().asString()}" but "${r.component().asString()}" does not list "${c.name().asString()}" in dependents`);
        }
      }
      for (const r of c.dependents()) {
        const other = this.byName(r.component());
        if (!other || r.pointsAt(c.name()))
          continue;
        if (!other.dependsOn().listsComponent(c.name())) {
          report.finding(DD_4, FindingKind.structureInvalid(), [TargetIds.safe("component", c.name().asString()), TargetIds.safe("component", r.component().asString())], [WitnessRef.at(art, r.element().asString(), r.component().asString()), WitnessRef.at(art, `${other.element().asString()}.depends_on`, c.name().asString())], `"${c.name().asString()}" lists "${r.component().asString()}" as a dependent but "${r.component().asString()}" does not depend on "${c.name().asString()}"`);
        }
      }
    }
    for (const c of this) {
      for (const e of c.entities()) {
        if (!e.hasIdentifier()) {
          report.finding(DD_5, FindingKind.structureInvalid(), [TargetIds.safe("entity", e.name().asString())], [WitnessRef.at(art, `${e.element().asString()}.identifier`)], `entity "${e.name().asString()}" has no identifier`);
        }
      }
    }
    for (const conflict of this.ownershipConflicts()) {
      const name = conflict.name.asString();
      report.finding(DD_5, FindingKind.structureInvalid(), [TargetIds.safe("entity", name)], conflict.owners.map((o) => WitnessRef.at(art, o.entity.element().asString(), o.component.name().asString())), `entity "${name}" is owned by ${conflict.owners.length} components (${conflict.owners.map((o) => o.component.name().asString()).join(", ")}) \u2014 must be exactly one`);
    }
    for (const c of this) {
      for (const e of c.entities()) {
        for (const r of e.references()) {
          const owner = this.byName(r.ownedBy());
          if (!owner)
            continue;
          if (!owner.entities().declaresEntity(r.entity())) {
            report.finding(DD_6, FindingKind.referenceBroken(), [TargetIds.safe("entity", r.entity().asString())], [WitnessRef.at(art, `${r.element().asString()}.entity`, r.entity().asString())], `entity "${e.name().asString()}" references "${r.entity().asString()}" as owned by "${r.ownedBy().asString()}", but "${r.ownedBy().asString()}" declares no such entity`);
          }
        }
      }
    }
    for (const cycle of this.dependencyCycles().filter((c) => c.length > 1)) {
      report.finding(DD_7, FindingKind.structureInvalid(), cycle.map((n) => TargetIds.safe("component", n)), cycle.map((n, i) => WitnessRef.at(art, `${this.byName(ComponentName.of(n))?.element().asString() ?? "components"}.depends_on`, cycle[(i + 1) % cycle.length])), `dependency cycle: ${[...cycle, cycle[0]].join(" -> ")}`);
    }
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
    this.#found = FenceCount.of(props.found);
    this.#line = props.line;
    this.#error = props.error;
    this.#components = props.components;
    this.#shapeErrors = props.shapeErrors;
  }
  static wrongFenceCount(found) {
    return new ComponentCatalogOutcome({ kind: "wrong-fence-count", found, line: null, error: null, components: null, shapeErrors: null });
  }
  static unparseable(line, error) {
    return new ComponentCatalogOutcome({ kind: "unparseable", found: 0, line, error, components: null, shapeErrors: null });
  }
  static extracted(components, shapeErrors) {
    return new ComponentCatalogOutcome({ kind: "extracted", found: 0, line: null, error: null, components, shapeErrors });
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
        report.finding(DD_0, FindingKind.structureInvalid(), [DD_0.asCheckTarget()], [WitnessRef.at(art, "yaml fence")], `components.md must carry exactly one fenced yaml source-of-truth block (found ${found})`);
        return null;
      },
      unparseable: (line, error) => {
        report.finding(DD_0, FindingKind.structureInvalid(), [DD_0.asCheckTarget()], [WitnessRef.at(art, `yaml fence (line ${line.asNumber()})`)], `yaml block does not parse in the supported subset: ${error}`);
        return null;
      },
      extracted: (components, shapeErrors) => {
        for (const e of shapeErrors) {
          report.finding(DD_0, FindingKind.structureInvalid(), [DD_0.asCheckTarget()], [WitnessRef.at(art, e.element().asString())], e.detail());
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
class ComponentEntities {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new ComponentEntities([...values]);
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
}
// src/refcheck/domain/component-ref.ts
class ComponentRef {
  #component;
  #element;
  constructor(props) {
    this.#component = props.component;
    this.#element = props.element;
  }
  static of(props) {
    return new ComponentRef(props);
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
}
// src/refcheck/domain/component-refs.ts
class ComponentRefs {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new ComponentRefs([...values]);
  }
  add(value) {
    return new ComponentRefs([...this.#values, value]);
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
}
// src/refcheck/domain/component-shape-errors.ts
class ComponentShapeErrors {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new ComponentShapeErrors([...values]);
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
  name() {
    return this.#name;
  }
  element() {
    return this.#element;
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
}
// src/refcheck/domain/entity-references.ts
class EntityReferences {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new EntityReferences([...values]);
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
// src/refcheck/domain/contract-rows.ts
class ContractRows {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new ContractRows([...values]);
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
// src/refcheck/domain/contract-id.ts
class ContractId {
  #value;
  constructor(raw) {
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-contract-id", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new ContractId(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new ContractId(raw));
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
    this.#value = value;
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
      report.finding(CD_1, FindingKind.referenceBroken(), [`contract:${this.#id.asString()}`, TargetIds.safe("unit", this.#provider.asString())], [WitnessRef.at(art, el, this.#provider.asString()), WitnessRef.at(depArt, "units")], `Provider Unit "${this.#provider.asString()}" is not a declared unit`);
    }
    if (!this.#consumer.isBlank() && !declared.declares(this.#consumer.asString()) && !this.#consumer.declaresExternal()) {
      report.finding(CD_1, FindingKind.referenceBroken(), [`contract:${this.#id.asString()}`, TargetIds.safe("unit", this.#consumer.asString())], [WitnessRef.at(art, el, this.#consumer.asString()), WitnessRef.at(depArt, "units")], `Consumer "${this.#consumer.asString()}" is neither a declared unit nor \`External: \u2026\``);
    }
    if (!this.#owner.isBlank() && !declared.declares(this.#owner.asString())) {
      report.finding(CD_1, FindingKind.referenceBroken(), [`contract:${this.#id.asString()}`, TargetIds.safe("unit", this.#owner.asString())], [WitnessRef.at(art, el, this.#owner.asString()), WitnessRef.at(depArt, "units")], `Owner "${this.#owner.asString()}" is not a declared unit`);
    }
  }
}
// src/refcheck/domain/contracts-table-outcome.ts
class ContractsTableOutcome {
  #rows;
  constructor(rows) {
    this.#rows = rows;
  }
  static absent() {
    return new ContractsTableOutcome(null);
  }
  static rows(rows) {
    return new ContractsTableOutcome(rows);
  }
  match(handlers) {
    return this.#rows === null ? handlers.absent() : handlers.rows(this.#rows);
  }
  check(report, units, artifact, depArtifact) {
    return this.match({
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
// src/refcheck/domain/spec-block-assessment.ts
class SpecBlockAssessment {
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
    return new SpecBlockAssessment(index, line, "sound", null);
  }
  static unparseable(index, line, error) {
    return new SpecBlockAssessment(index, line, "unparseable", error);
  }
  static notAMapping(index, line) {
    return new SpecBlockAssessment(index, line, "not-a-mapping", null);
  }
  static openapiWithoutPaths(index, line) {
    return new SpecBlockAssessment(index, line, "openapi-without-paths", null);
  }
  blockId() {
    return `contract:block-${this.#index.asNumber()}`;
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
        report.finding(CD_2, FindingKind.structureInvalid(), [blockId], [WitnessRef.at(art, el)], `spec block does not parse in the supported YAML subset: ${error}`);
      },
      notAMapping: () => {
        report.finding(CD_2, FindingKind.structureInvalid(), [blockId], [WitnessRef.at(art, el)], "spec block is not a YAML mapping");
      },
      openapiWithoutPaths: () => {
        report.finding(CD_2, FindingKind.structureInvalid(), [blockId], [WitnessRef.at(art, el, "openapi")], "OpenAPI spec block carries `openapi:` but no `paths:`");
      }
    });
  }
}
// src/refcheck/domain/spec-block-assessments.ts
class SpecBlockAssessments {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new SpecBlockAssessments([...values]);
  }
  add(value) {
    return new SpecBlockAssessments([...this.#values, value]);
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
// src/refcheck/domain/unit-decl.ts
class UnitDecl {
  #name;
  #dependsOn;
  constructor(props) {
    this.#name = props.name;
    this.#dependsOn = props.dependsOn;
  }
  static of(props) {
    return new UnitDecl(props);
  }
  name() {
    return this.#name;
  }
  dependsOn() {
    return this.#dependsOn;
  }
  declaredDependencies(declared) {
    return [...this.#dependsOn.sortedByValue()].filter((dep) => declared.declares(dep.asString()));
  }
}
// src/refcheck/domain/unit-decls.ts
class UnitDecls {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new UnitDecls([...values]);
  }
  add(value) {
    return new UnitDecls([...this.#values, value]);
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
    return new UnitDecls([...this.#values].sort((a, b) => a.name().asString() < b.name().asString() ? -1 : 1));
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
          report.finding(CD_3, FindingKind.consistencyMismatch(), [TargetIds.safe("unit", depName), TargetIds.safe("unit", uName)], [WitnessRef.at(depArt, `units (${uName} depends_on ${depName})`), WitnessRef.at(art, "contracts table")], `unit dependency edge "${uName}" -> "${depName}" has no contracts-table row in either orientation`);
        }
      }
    }
  }
}
// src/refcheck/domain/attr-decl.ts
class AttrDecl {
  #seed;
  constructor(seed) {
    this.#seed = seed;
  }
  static of(seed) {
    return new AttrDecl(seed);
  }
  name() {
    return this.#seed.name;
  }
  element() {
    return this.#seed.element;
  }
  references() {
    return this.#seed.references;
  }
  def() {
    return this.#seed.def;
  }
  min() {
    return this.#seed.min;
  }
  max() {
    return this.#seed.max;
  }
  hasAllowedValues() {
    return this.#seed.allowed !== null;
  }
  typeToken() {
    return this.#seed.type === null ? "" : this.#seed.type.normalized();
  }
  typeText() {
    return this.#seed.type === null ? "null" : this.#seed.type.asString();
  }
  declaresAllowedValuesOnNonEnumerableType() {
    const t = this.#seed.type;
    if (t === null || this.#seed.allowed === null)
      return false;
    return t.classifiesNumeric() || t.classifiesDate() || t.classifiesBool();
  }
  declaresBoundsOnNonNumericType() {
    const t = this.#seed.type;
    if (!(this.#seed.minDeclared || this.#seed.maxDeclared))
      return false;
    if (t === null || t.normalized() === "")
      return false;
    return !t.classifiesNumeric() && !t.classifiesDate();
  }
  declaresUniqueOnCollectionType() {
    return this.#seed.uniqueIsTrue && this.#seed.type !== null && this.#seed.type.classifiesCollection();
  }
  boundsInverted() {
    return this.#seed.min !== null && this.#seed.max !== null && this.#seed.min.exceeds(this.#seed.max);
  }
  defaultBelowMin() {
    const d = this.#seed.def;
    return d !== null && this.#seed.min !== null && d.belowBound(this.#seed.min);
  }
  defaultAboveMax() {
    const d = this.#seed.def;
    return d !== null && this.#seed.max !== null && d.aboveBound(this.#seed.max);
  }
  defaultOutsideAllowed() {
    const d = this.#seed.def;
    if (this.#seed.allowed === null || d === null || !d.isString())
      return false;
    return !this.#seed.allowed.containsValue(d.asString());
  }
  bearsLifecycleName() {
    return this.#seed.name.isLifecycleName();
  }
  rogueDiagramStates(states) {
    return this.#seed.allowed === null ? [] : this.#seed.allowed.rogueAmong(states);
  }
  allowedValuesAbsentFrom(states) {
    return this.#seed.allowed === null ? [] : this.#seed.allowed.absentFrom(states);
  }
}
// src/refcheck/domain/attr-decls.ts
class AttrDecls {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new AttrDecls([...values]);
  }
  add(value) {
    return new AttrDecls([...this.#values, value]);
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
  named(token) {
    return this.#values.find((a) => a.name().asString() === token) ?? null;
  }
  names() {
    return this.#values.map((a) => a.name());
  }
  toArray() {
    return this.#values;
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

// src/refcheck/domain/declared-entities.ts
class DeclaredEntities {
  #seed;
  constructor(seed) {
    this.#seed = seed;
  }
  static of(seed) {
    return new DeclaredEntities(seed);
  }
  entities() {
    return this.#seed.entities;
  }
  shapeErrors() {
    return this.#seed.shapeErrors;
  }
  allRels() {
    let all = this.#seed.rels;
    for (const e of this.#seed.entities)
      all = all.concat(e.rels());
    return all;
  }
  check(report, artifact) {
    const art = artifact.asString();
    for (const e of this.shapeErrors()) {
      report.finding(FD_E1, FindingKind.structureInvalid(), [FD_E1.asCheckTarget()], [WitnessRef.at(art, e.element().asString())], e.detail());
    }
    for (const dup of this.entities().duplicatesByName()) {
      report.finding(FD_E1, FindingKind.structureInvalid(), [TargetIds.safe("entity", dup.name().asString())], [WitnessRef.at(art, `${dup.element().asString()}.name`, dup.name().asString())], `entity "${dup.name().asString()}" is declared more than once`);
    }
    for (const e of this.entities()) {
      for (const dup of e.attrs().duplicatesByName()) {
        report.finding(FD_E1, FindingKind.structureInvalid(), [TargetIds.safe("attr", `${e.name().asString()}.${dup.name().asString()}`)], [WitnessRef.at(art, `${dup.element().asString()}.name`, dup.name().asString())], `attribute "${e.name().asString()}.${dup.name().asString()}" is declared more than once`);
      }
    }
    for (const e of this.entities()) {
      for (const a of e.attrs()) {
        const attrId = TargetIds.safe("attr", `${e.name().asString()}.${a.name().asString()}`);
        const label = `${e.name().asString()}.${a.name().asString()}`;
        if (a.declaresAllowedValuesOnNonEnumerableType()) {
          report.finding(FD_E2, FindingKind.structureInvalid(), [attrId], [WitnessRef.at(art, a.element().asString(), a.typeToken())], `"${label}" declares allowed values but its type "${a.typeText()}" is not an enumerable type`);
        }
        if (a.declaresBoundsOnNonNumericType()) {
          report.finding(FD_E2, FindingKind.structureInvalid(), [attrId], [WitnessRef.at(art, a.element().asString(), a.typeToken())], `"${label}" declares min/max but its type "${a.typeText()}" is not numeric or date-like`);
        }
        if (a.declaresUniqueOnCollectionType()) {
          report.finding(FD_E2, FindingKind.structureInvalid(), [attrId], [WitnessRef.at(art, a.element().asString(), a.typeToken())], `"${label}" declares unique but its type "${a.typeText()}" is not scalar`);
        }
        if (a.boundsInverted()) {
          report.finding(FD_E3, FindingKind.structureInvalid(), [attrId], [WitnessRef.at(art, a.element().asString(), `min ${a.min()?.asNumber()} > max ${a.max()?.asNumber()}`)], `"${label}": min ${a.min()?.asNumber()} exceeds max ${a.max()?.asNumber()}`);
        }
        if (a.defaultBelowMin()) {
          report.finding(FD_E3, FindingKind.structureInvalid(), [attrId], [WitnessRef.at(art, a.element().asString(), a.def()?.render() ?? "")], `"${label}": default ${a.def()?.render()} is below min ${a.min()?.asNumber()}`);
        }
        if (a.defaultAboveMax()) {
          report.finding(FD_E3, FindingKind.structureInvalid(), [attrId], [WitnessRef.at(art, a.element().asString(), a.def()?.render() ?? "")], `"${label}": default ${a.def()?.render()} is above max ${a.max()?.asNumber()}`);
        }
        if (a.defaultOutsideAllowed()) {
          report.finding(FD_E3, FindingKind.structureInvalid(), [attrId], [WitnessRef.at(art, a.element().asString(), a.def()?.render() ?? "")], `"${label}": default "${a.def()?.render()}" is not one of the allowed values`);
        }
        const reference = a.references();
        if (reference !== null && !this.entities().resolvesReference(reference)) {
          report.finding(FD_E6, FindingKind.referenceBroken(), [attrId], [WitnessRef.at(art, a.element().asString(), reference.asString())], `"${label}" references "${reference.asString()}" which is not a declared entity`);
        }
      }
    }
    for (const r of this.allRels()) {
      for (const endpoint of [r.from(), r.to()]) {
        if (endpoint !== null && !this.entities().containsNamed(endpoint)) {
          report.finding(FD_E4, FindingKind.referenceBroken(), [TargetIds.safe("entity", endpoint.asString())], [WitnessRef.at(art, r.element().asString(), endpoint.asString())], `relationship endpoint "${endpoint.asString()}" is not a declared entity`);
        }
      }
      if (r.cardinalityOutsideClosedSet()) {
        report.finding(FD_E5, FindingKind.structureInvalid(), [FD_E5.asCheckTarget()], [WitnessRef.at(art, r.element().asString(), r.cardinality()?.asString() ?? "")], `cardinality "${r.cardinality()?.asString()}" is not in the closed set 1:1 | 1:N | N:1 | N:M`);
      }
      if (r.cardinalityWithoutDirection()) {
        report.finding(FD_E5, FindingKind.structureInvalid(), [FD_E5.asCheckTarget()], [WitnessRef.at(art, r.element().asString())], "relationship declares a cardinality but no direction (from/to or direction key)");
      }
    }
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
        domainEntities.check(report, componentsArtifact, siblingUnits, unit);
      }
    });
  }
}
// src/refcheck/domain/domain-entity-sketch.ts
class DomainEntitySketch {
  #seed;
  constructor(seed) {
    this.#seed = seed;
  }
  static of(seed) {
    return new DomainEntitySketch(seed);
  }
  name() {
    return this.#seed.name;
  }
  catalogLabel() {
    return `entity ${this.#seed.name.asString()} (component ${this.#seed.component.asString()})`;
  }
  attributesDroppedIn(unitAttrs) {
    return this.#seed.attributes.toArray().filter((a) => !unitAttrs.coversNormalized(a)).map((a) => a.asString()).sort();
  }
}
// src/refcheck/domain/domain-entity-sketches.ts
class DomainEntitySketches {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new DomainEntitySketches([...values]);
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
    const compArt = componentsArtifact.asString();
    for (const de of this.sortedDistinctByNormalizedName()) {
      const key = de.name().normalized().asString();
      const definers = unitEntities.definersOf(key);
      if (definers.length >= 2) {
        report.finding(XS_1, FindingKind.consistencyMismatch(), [TargetIds.safe("entity", de.name().asString())], [
          WitnessRef.at(compArt, de.catalogLabel()),
          ...definers.map((u) => WitnessRef.at(`construction/${u}/functional-design/entities.md`, `entity ${de.name().asString()}`))
        ], `domain entity "${de.name().asString()}" is defined in ${definers.length} units (${definers.join(", ")}) \u2014 ownership is duplicated`);
      } else if (definers.length === 0 && unitEntities.hasAnyUnit()) {
        report.finding(XS_2, FindingKind.consistencyMismatch(), [TargetIds.safe("entity", de.name().asString())], [WitnessRef.at(compArt, de.catalogLabel())], `domain entity "${de.name().asString()}" is defined in no unit's entities.md \u2014 it was dropped on the way to functional design`);
      }
      if (unit !== undefined) {
        const mine = unitEntities.entityDeclaredIn(unit.asString(), key);
        if (mine) {
          const dropped = de.attributesDroppedIn(mine.attrs);
          if (dropped.length > 0) {
            report.finding(XS_3, FindingKind.consistencyMismatch(), [TargetIds.safe("entity", de.name().asString())], dropped.map((a) => WitnessRef.at(compArt, `entity ${de.name().asString()}.attributes`, a)), `domain-design declares attribute(s) ${dropped.join(", ")} on "${de.name().asString()}" that this unit's entities.md does not carry`);
          }
        }
      }
    }
    if (unit === undefined) {
      report.skip(XS_3, "unrecognized-format", "the unit for this functional-design record could not be determined from its path");
    }
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
    this.#found = FenceCount.of(props.found);
    this.#line = props.line;
    this.#error = props.error;
    this.#model = props.model;
  }
  static absent() {
    return new EntitiesOutcome({ kind: "absent", found: 0, line: null, error: null, model: null });
  }
  static wrongFenceCount(found) {
    return new EntitiesOutcome({ kind: "wrong-fence-count", found, line: null, error: null, model: null });
  }
  static unparseable(line, error) {
    return new EntitiesOutcome({ kind: "unparseable", found: 0, line, error, model: null });
  }
  static extracted(model) {
    return new EntitiesOutcome({ kind: "extracted", found: 0, line: null, error: null, model });
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
        report.finding(FD_E1, FindingKind.structureInvalid(), [FD_E1.asCheckTarget()], [WitnessRef.at(art, "yaml fence")], `entities.md must carry exactly one fenced yaml source-of-truth block (found ${found})`);
        for (const f of [FD_E2, FD_E3, FD_E4, FD_E5, FD_E6]) {
          report.skip(f, "unrecognized-format", "blocked by FD-E1: the entities yaml block is unusable");
        }
        return null;
      },
      unparseable: (line, error) => {
        report.finding(FD_E1, FindingKind.structureInvalid(), [FD_E1.asCheckTarget()], [WitnessRef.at(art, `yaml fence (line ${line.asNumber()})`)], `yaml block does not parse in the supported subset: ${error}`);
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
// src/refcheck/domain/entity-decl.ts
class EntityDecl {
  #seed;
  constructor(seed) {
    this.#seed = seed;
  }
  static of(seed) {
    return new EntityDecl(seed);
  }
  name() {
    return this.#seed.name;
  }
  element() {
    return this.#seed.element;
  }
  attrs() {
    return this.#seed.attrs;
  }
  rels() {
    return this.#seed.rels;
  }
  lifecycleAttr() {
    return this.#seed.attrs.lifecycleAttr();
  }
  attrNamed(token) {
    return this.#seed.attrs.named(token);
  }
}
// src/refcheck/domain/entity-decls.ts
class EntityDecls {
  #values;
  #names;
  constructor(values) {
    this.#values = values;
    this.#names = KeySet.of(values.map((e) => e.name()));
  }
  static of(values) {
    return new EntityDecls([...values]);
  }
  add(value) {
    return new EntityDecls([...this.#values, value]);
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
  containsNamed(name) {
    return this.#names.has(name);
  }
  byNormalizedName(normalized) {
    return this.#values.find((e) => e.name().normalized().equals(normalized));
  }
  lifecycleOnly() {
    return this.#values.filter((e) => e.lifecycleAttr() !== null);
  }
  resolvesReference(reference) {
    const token = reference.entityToken();
    if (token !== null)
      return this.#names.has(EntityName.of(token));
    return this.#values.some((d) => reference.looselyMentions(d.name()));
  }
  resolvesAppliesTo(target) {
    const token = target.entityToken();
    if (token !== null) {
      const ent = this.#values.find((e) => e.name().asString() === token);
      const attr = target.attributeToken();
      return ent !== undefined && (attr === null || ent.attrNamed(attr) !== null);
    }
    return this.#values.some((e) => target.looselyMentions(e.name()));
  }
  toArray() {
    return this.#values;
  }
}
// src/refcheck/domain/functional-spec-outcome.ts
class FunctionalSpecOutcome {
  #machines;
  constructor(machines) {
    this.#machines = machines;
  }
  static absent() {
    return new FunctionalSpecOutcome(null);
  }
  static present(machines) {
    return new FunctionalSpecOutcome(machines);
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
// src/refcheck/domain/rel-decl.ts
class RelDecl {
  #seed;
  constructor(seed) {
    this.#seed = seed;
  }
  static of(seed) {
    return new RelDecl(seed);
  }
  element() {
    return this.#seed.element;
  }
  from() {
    return this.#seed.from;
  }
  to() {
    return this.#seed.to;
  }
  cardinality() {
    return this.#seed.cardinality;
  }
  cardinalityOutsideClosedSet() {
    return this.#seed.cardinality !== null && !this.#seed.cardinality.isInClosedSet();
  }
  cardinalityWithoutDirection() {
    return this.#seed.cardinality !== null && !this.#seed.hasDirection;
  }
}
// src/refcheck/domain/rel-decls.ts
class RelDecls {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new RelDecls([...values]);
  }
  add(value) {
    return new RelDecls([...this.#values, value]);
  }
  concat(other) {
    return new RelDecls([...this.#values, ...other.#values]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
}
// src/refcheck/domain/rule-decl.ts
class RuleDecl {
  #seed;
  constructor(seed) {
    this.#seed = seed;
  }
  static of(seed) {
    return new RuleDecl(seed);
  }
  id() {
    return this.#seed.id;
  }
  element() {
    return this.#seed.element;
  }
  category() {
    return this.#seed.category;
  }
  appliesTo() {
    return this.#seed.appliesTo;
  }
  missing() {
    return this.#seed.missing;
  }
  findingTarget(fallback) {
    return this.#seed.id !== null && this.#seed.id.matchesShape() ? this.#seed.id.asString() : fallback;
  }
  sourceIdValuesMissingFrom(known) {
    return this.#seed.sourceIds.valuesMissingFrom(known);
  }
  categoryOutsideClosedSet() {
    return this.#seed.category !== null && !this.#seed.category.isKnownCategory();
  }
}
// src/refcheck/domain/rule-decls.ts
class RuleDecls {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new RuleDecls([...values]);
  }
  add(value) {
    return new RuleDecls([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  toArray() {
    return this.#values;
  }
  check(report, artifact, requirementIdsKnown, entities) {
    const art = artifact.asString();
    for (const r of this) {
      if (r.missing().length > 0) {
        report.finding(FD_R1, FindingKind.structureInvalid(), [r.findingTarget("check:FD-R1")], [WitnessRef.at(art, r.element().asString())], `rule is missing required key(s): ${r.missing().join(", ")}`);
      }
    }
    const seenIds = new Set;
    for (const r of this) {
      const id = r.id();
      if (id === null)
        continue;
      if (!id.matchesShape()) {
        report.finding(FD_R2, FindingKind.structureInvalid(), [FD_R2.asCheckTarget()], [WitnessRef.at(art, `${r.element().asString()}.id`, id.asString())], `rule id "${id.asString()}" does not match BR{group}.{seq}`);
        continue;
      }
      if (seenIds.has(id.asString())) {
        report.finding(FD_R2, FindingKind.structureInvalid(), [id.asString()], [WitnessRef.at(art, `${r.element().asString()}.id`, id.asString())], `rule id "${id.asString()}" is declared more than once`);
      }
      seenIds.add(id.asString());
    }
    if (requirementIdsKnown === null) {
      report.skip(FD_R3, "absent-input", "requirements.md not found under this intent record \u2014 source ids cannot be reverse-verified");
    } else {
      for (const r of this) {
        const missing = r.sourceIdValuesMissingFrom(requirementIdsKnown);
        if (missing.length > 0) {
          report.finding(FD_R3, FindingKind.referenceBroken(), [r.findingTarget("check:FD-R3")], missing.map((id) => WitnessRef.at(art, `${r.element().asString()}.source`, id)), `source id(s) ${missing.join(", ")} do not exist in requirements.md`, missing);
        }
      }
    }
    if (entities === null) {
      report.skip(FD_R4, "absent-input", "entities.md is unavailable \u2014 applies-to cannot be resolved");
    } else {
      for (const r of this) {
        const appliesTo = r.appliesTo();
        if (appliesTo === null)
          continue;
        if (!entities.entities().resolvesAppliesTo(appliesTo)) {
          report.finding(FD_R4, FindingKind.referenceBroken(), [r.findingTarget("check:FD-R4")], [WitnessRef.at(art, r.element().asString(), appliesTo.asString())], `applies-to "${appliesTo.asString()}" does not resolve to a declared entity or entity.attribute`);
        }
      }
    }
    for (const r of this) {
      if (r.categoryOutsideClosedSet()) {
        report.finding(FD_R5, FindingKind.structureInvalid(), [r.findingTarget("check:FD-R5")], [WitnessRef.at(art, `${r.element().asString()}.category`, r.category()?.asString() ?? "")], `category "${r.category()?.asString()}" is not one of validation | authorization | constraint | calculation | policy`);
      }
    }
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
    this.#found = FenceCount.of(props.found);
    this.#line = props.line;
    this.#error = props.error;
    this.#rules = props.rules;
  }
  static absent() {
    return new RulesOutcome({ kind: "absent", found: 0, line: null, error: null, rules: null });
  }
  static wrongFenceCount(found) {
    return new RulesOutcome({ kind: "wrong-fence-count", found, line: null, error: null, rules: null });
  }
  static unparseable(line, error) {
    return new RulesOutcome({ kind: "unparseable", found: 0, line, error, rules: null });
  }
  static noRulesList() {
    return new RulesOutcome({ kind: "no-rules-list", found: 0, line: null, error: null, rules: null });
  }
  static extracted(rules) {
    return new RulesOutcome({ kind: "extracted", found: 0, line: null, error: null, rules });
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
        report.finding(FD_R1, FindingKind.structureInvalid(), [FD_R1.asCheckTarget()], [WitnessRef.at(art, "yaml fence")], `rules.md must carry exactly one fenced yaml source-of-truth block (found ${found})`);
        blockRs("blocked by FD-R1: the rules yaml block is unusable");
      },
      unparseable: (line, error) => {
        report.finding(FD_R1, FindingKind.structureInvalid(), [FD_R1.asCheckTarget()], [WitnessRef.at(art, `yaml fence (line ${line.asNumber()})`)], `yaml block does not parse in the supported subset: ${error}`);
        blockRs("blocked by FD-R1: the rules yaml block is unusable");
      },
      noRulesList: () => {
        report.finding(FD_R1, FindingKind.structureInvalid(), [FD_R1.asCheckTarget()], [WitnessRef.at(art, "rules")], "top-level `rules:` list is missing");
        blockRs("blocked by FD-R1: the rules yaml block is unusable");
      },
      extracted: (ruleDecls) => {
        ruleDecls.check(report, artifact, requirementIdsKnown, entities);
      }
    });
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
  element() {
    return this.#element;
  }
  detail() {
    return this.#detail;
  }
}
// src/refcheck/domain/shape-errors.ts
class ShapeErrors {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new ShapeErrors([...values]);
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
// src/refcheck/domain/sibling-unit-index.ts
class SiblingUnitIndex {
  #units;
  constructor(units) {
    this.#units = units;
  }
  static of(units) {
    return new SiblingUnitIndex(new Map(units));
  }
  definersOf(normalizedName) {
    return [...this.#units.entries()].filter(([, m]) => m.has(normalizedName)).map(([u]) => u);
  }
  entityDeclaredIn(unit, normalizedName) {
    return this.#units.get(unit)?.get(normalizedName);
  }
  hasAnyUnit() {
    return this.#units.size > 0;
  }
}
// src/refcheck/domain/state-machine-sketch.ts
class StateMachineSketch {
  #seed;
  constructor(seed) {
    this.#seed = seed;
  }
  static of(seed) {
    return new StateMachineSketch(seed);
  }
  spec() {
    return this.#seed.spec;
  }
  states() {
    return this.#seed.states;
  }
  unsupported() {
    return this.#seed.unsupported;
  }
  locationLabel() {
    return `State Machine: ${this.#seed.spec.asString()} (fence line ${this.#seed.fenceLine.asNumber()})`;
  }
  check(report, specArtifact, entitiesArtifact, entities) {
    const specArt = specArtifact.asString();
    const entitiesArt = entitiesArtifact.asString();
    const entity = this.spec().entityToken();
    const entName = entity.asString();
    const attrName = this.spec().attributeToken();
    const el = this.locationLabel();
    if (this.unsupported() !== null) {
      report.skip(FD_S1, "unrecognized-format", `${el}: ${this.unsupported()}`);
      report.skip(FD_S2, "unrecognized-format", `${el}: ${this.unsupported()}`);
      return;
    }
    const ent = entities.entities().byNormalizedName(entity.normalized());
    if (!ent) {
      report.finding(FD_S1, FindingKind.consistencyMismatch(), [TargetIds.safe("entity", entName)], [WitnessRef.at(specArt, el, entName)], `state machine names entity "${entName}" which is not declared in entities.md`);
      return;
    }
    const attr = attrName !== undefined ? ent.attrNamed(attrName) : ent.lifecycleAttr();
    if (!attr || !attr.hasAllowedValues()) {
      report.skip(FD_S1, "unrecognized-format", `${el}: no lifecycle attribute with allowed values could be determined for entity "${ent.name().asString()}"`);
      report.skip(FD_S2, "unrecognized-format", `${el}: no lifecycle attribute with allowed values could be determined for entity "${ent.name().asString()}"`);
      return;
    }
    const attrId = TargetIds.safe("attr", `${ent.name().asString()}.${attr.name().asString()}`);
    const rogue = attr.rogueDiagramStates(this.states());
    if (rogue.length > 0) {
      report.finding(FD_S1, FindingKind.consistencyMismatch(), [attrId], rogue.map((v) => WitnessRef.at(specArt, el, v)), `diagram state(s) ${rogue.join(", ")} are not allowed values of ${ent.name().asString()}.${attr.name().asString()} in entities.md`);
    }
    const dangling = attr.allowedValuesAbsentFrom(this.states());
    if (dangling.length > 0) {
      report.finding(FD_S2, FindingKind.consistencyMismatch(), [attrId], dangling.map((v) => WitnessRef.at(entitiesArt, attr.element().asString(), v)), `allowed value(s) ${dangling.join(", ")} of ${ent.name().asString()}.${attr.name().asString()} appear in no diagram state`);
    }
  }
}
// src/refcheck/domain/state-machine-sketches.ts
class StateMachineSketches {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new StateMachineSketches([...values]);
  }
  add(value) {
    return new StateMachineSketches([...this.#values, value]);
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
  check(report, specArtifact, entitiesArtifact, entities) {
    if (this.isEmpty()) {
      for (const e of entities.entities().lifecycleOnly()) {
        report.skip(FD_S1, "unrecognized-format", `no \`### State Machine: ${e.name().asString()}\` heading with a stateDiagram fence found for lifecycle entity "${e.name().asString()}"`);
        report.skip(FD_S2, "unrecognized-format", `no \`### State Machine: ${e.name().asString()}\` heading with a stateDiagram fence found for lifecycle entity "${e.name().asString()}"`);
      }
    }
    for (const m of this) {
      m.check(report, specArtifact, entitiesArtifact, entities);
    }
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
    const report = ReferenceCheckReport.open(ReferenceCheckReportId.of(reportDirectory, "components"), COMPONENT_FAMILIES);
    catalog.check(report, ArtifactPath.of(this.#target.artifact()));
    report.input(this.#target);
    return ok(report);
  }
  checkContracts(reportDirectory) {
    const summary = this.#contractSummary;
    if (summary === null)
      return err({ kind: "not-applicable" });
    const report = ReferenceCheckReport.open(ReferenceCheckReportId.of(reportDirectory, "contract-summary"), CONTRACT_FAMILIES);
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
    const report = ReferenceCheckReport.open(ReferenceCheckReportId.of(reportDirectory, "functional-design"), FUNCTIONAL_FAMILIES, fd.unit);
    const entities = (fd.entities === null ? EntitiesOutcome.absent() : fd.entities.outcome).check(report, fd.entitiesArtifact);
    (fd.rules === null ? RulesOutcome.absent() : fd.rules.outcome).check(report, fd.rulesArtifact, fd.requirements === null ? null : fd.requirements.outcome, entities);
    (fd.spec === null ? FunctionalSpecOutcome.absent() : fd.spec.outcome).check(report, fd.specArtifact, fd.entitiesArtifact, entities);
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
// src/refcheck/domain/design-record-id.ts
class DesignRecordId {
  #path;
  constructor(path) {
    this.#path = path;
  }
  static of(path) {
    return new DesignRecordId(path);
  }
  equals(other) {
    return this.#path.equals(other.#path);
  }
  artifactPath() {
    return this.#path;
  }
}
// src/refcheck/domain/allowed-value.ts
class AllowedValue {
  #value;
  constructor(raw) {
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
class AllowedValues {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new AllowedValues([...values]);
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
// src/refcheck/domain/attribute-default.ts
class AttributeDefault {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static of(raw) {
    return new AttributeDefault(raw);
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
class AttributeNames {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new AttributeNames([...values]);
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
// src/refcheck/domain/business-rule-id.ts
class BusinessRuleId {
  #value;
  constructor(raw) {
    if (!/^BR[0-9]+\.[0-9]+$/.test(raw))
      throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new BusinessRuleId(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new BusinessRuleId(raw));
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
// src/refcheck/domain/machine-spec.ts
class MachineSpec {
  #value;
  constructor(raw) {
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new MachineSpec(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new MachineSpec(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
  entityToken() {
    return EntityName.of(this.#value.split(".")[0] ?? "");
  }
  attributeToken() {
    return this.#value.split(".")[1];
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
// src/refcheck/domain/rule-category.ts
var CATEGORIES = new Set(["validation", "authorization", "constraint", "calculation", "policy"]);

class RuleCategory {
  #value;
  constructor(raw) {
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
// src/refcheck/domain/source-id.ts
class SourceId {
  #value;
  constructor(raw) {
    if (raw === "")
      throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw) {
    return new SourceId(raw);
  }
  static parse(raw) {
    return parseConstruction(() => new SourceId(raw));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
}
// src/refcheck/domain/source-ids.ts
class SourceIds {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new SourceIds([...values]);
  }
  add(value) {
    return new SourceIds([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  valuesMissingFrom(known) {
    return this.#values.map((id) => id.asString()).filter((id) => !known.has(RequirementId.of(id))).sort();
  }
  toArray() {
    return this.#values;
  }
}
// src/refcheck/domain/state-name.ts
class StateName {
  #value;
  constructor(raw) {
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
class StateNames {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new StateNames([...values]);
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
// src/refcheck/domain/declared-rule-id.ts
class DeclaredRuleId {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static of(value) {
    return new DeclaredRuleId(value);
  }
  asString() {
    return this.#value;
  }
  matchesShape() {
    return BusinessRuleId.parse(this.#value).ok;
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
    const record = this.#designRecordRepository.findById(input.recordId);
    if (!record.ok)
      return { kind: "not-applicable" };
    const checked = record.value.checkComponents(input.reportDirectory);
    if (!checked.ok)
      return { kind: "not-applicable" };
    const conformed = checked.value.conformedTo(this.#findingsSchema);
    if (input.mode === "persist") {
      const stored = this.#referenceCheckReportRepository.store(conformed);
      if (!stored.ok)
        return { kind: "save-failed", error: stored.error };
    }
    return {
      kind: "verified",
      pass: conformed.passes(),
      findingsCount: conformed.findingsCount(),
      skippedCount: conformed.skippedCount()
    };
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
    const record = this.#designRecordRepository.findById(input.recordId);
    if (!record.ok)
      return { kind: "not-applicable" };
    const checked = record.value.checkContracts(input.reportDirectory);
    if (!checked.ok)
      return { kind: "not-applicable" };
    const conformed = checked.value.conformedTo(this.#findingsSchema);
    if (input.mode === "persist") {
      const stored = this.#referenceCheckReportRepository.store(conformed);
      if (!stored.ok)
        return { kind: "save-failed", error: stored.error };
    }
    return {
      kind: "verified",
      pass: conformed.passes(),
      findingsCount: conformed.findingsCount(),
      skippedCount: conformed.skippedCount()
    };
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
    const record = this.#designRecordRepository.findById(input.recordId);
    if (!record.ok)
      return { kind: "not-applicable" };
    const checked = record.value.checkFunctionalDesign(input.reportDirectory);
    if (!checked.ok)
      return { kind: "not-applicable" };
    const conformed = checked.value.conformedTo(this.#findingsSchema);
    if (input.mode === "persist") {
      const stored = this.#referenceCheckReportRepository.store(conformed);
      if (!stored.ok)
        return { kind: "save-failed", error: stored.error };
    }
    return {
      kind: "verified",
      pass: conformed.passes(),
      findingsCount: conformed.findingsCount(),
      skippedCount: conformed.skippedCount()
    };
  }
}
// src/refcheck/adapter/reference-check-report-repository-impl.ts
import { existsSync as existsSync3, readFileSync as readFileSync4 } from "fs";
import { join as join4 } from "path";

// src/refcheck/adapter/reference-check-report-serializer.ts
function renderReportBytes(report) {
  return `${JSON.stringify(report.toDocument(), null, 2)}
`;
}
function parseReportDocument(id, raw) {
  const decoded = decodeDomainValues(() => parseReportDocumentValue(id, raw));
  return decoded.ok ? decoded.value : { ok: false, error: { cause: decoded.error } };
}
function parseReportDocumentValue(id, raw) {
  if (!isObject(raw))
    return { ok: false, error: { cause: "document is not a JSON object" } };
  if (raw.backend !== id.backendName().asString()) {
    return { ok: false, error: { cause: `document backend "${String(raw.backend)}" does not match the id backend "${id.backendName().asString()}"` } };
  }
  if (!Array.isArray(raw.findings) || !Array.isArray(raw.skipped) || !Array.isArray(raw.inputs) || !Array.isArray(raw.checked)) {
    return { ok: false, error: { cause: "document lacks inputs/checked/findings/skipped arrays" } };
  }
  const unavailable = isObject(raw.unavailable) && typeof raw.unavailable.reason === "string" ? raw.unavailable.reason : null;
  return {
    ok: true,
    value: ReferenceCheckReport.of({
      id,
      inputs: InputAnchors.of(raw.inputs.map((e) => {
        const entry = isObject(e) ? e : {};
        return InputAnchor.of({
          artifact: typeof entry.artifact === "string" ? entry.artifact : "",
          sha256: ContentHash.of(typeof entry.sha256 === "string" ? entry.sha256 : "")
        });
      })),
      checked: TargetIds.of(Array.from(raw.checked.filter((c) => typeof c === "string"), (raw2) => TargetId.of(raw2))),
      findings: Findings.of(raw.findings.map((e) => {
        const entry = isObject(e) ? e : {};
        const witness = isObject(entry.witness) ? entry.witness : {};
        const refs = Array.isArray(witness.refs) ? witness.refs.map((r) => {
          const rr = isObject(r) ? r : {};
          return WitnessRef.of({
            artifact: typeof rr.artifact === "string" ? rr.artifact : "",
            element: typeof rr.element === "string" ? rr.element : "",
            ...typeof rr.value === "string" ? { value: rr.value } : {}
          });
        }) : [];
        return Finding.of({
          kind: FindingKind.of(typeof entry.kind === "string" ? entry.kind : ""),
          frRefs: FrRefs.of(Array.from(Array.isArray(entry.frRefs) ? entry.frRefs.filter((x) => typeof x === "string") : [], (raw2) => RequirementId.of(raw2))),
          targets: TargetIds.of(Array.from(Array.isArray(entry.targets) ? entry.targets.filter((x) => typeof x === "string") : [], (raw2) => TargetId.of(raw2))),
          witness: { refs: WitnessRefs.of(refs) },
          detail: typeof entry.detail === "string" ? entry.detail : "",
          ...typeof entry.unit === "string" ? { unit: UnitName.of(entry.unit) } : {}
        });
      })),
      skipped: Skips.of(raw.skipped.map((e) => {
        const entry = isObject(e) ? e : {};
        return Skipped.of({
          target: TargetId.of(typeof entry.target === "string" ? entry.target : ""),
          reason: SkipReason.of(typeof entry.reason === "string" ? entry.reason : ""),
          ...typeof entry.detail === "string" ? { detail: entry.detail } : {},
          ...typeof entry.unit === "string" ? { unit: UnitName.of(entry.unit) } : {}
        });
      })),
      unavailableReason: unavailable
    })
  };
}

// src/refcheck/adapter/reference-check-report-repository-impl.ts
var encoder = new TextEncoder;

class ReferenceCheckReportRepositoryImpl {
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
    const report = parseReportDocument(aggregateId, raw);
    if (!report.ok) {
      return err({ kind: "corrupt", path, cause: report.error.cause });
    }
    return report;
  }
  store(report) {
    const path = join4(report.id().directory().asString(), report.id().fileName());
    try {
      writeFileAtomically(path, encoder.encode(renderReportBytes(report)));
      return ok(undefined);
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path, cause: e instanceof Error ? e.message : String(e) });
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
    shapeErrors.push(ComponentShapeError.of({ element: ElementPath.of("components"), detail: "top-level `components:` list is missing" }));
    return { comps: Components.of(comps), shapeErrors: ComponentShapeErrors.of(shapeErrors) };
  }
  value.components.forEach((raw, i) => {
    const element = `components[${i}]`;
    if (!isObject(raw)) {
      shapeErrors.push(ComponentShapeError.of({ element: ElementPath.of(element), detail: "component entry is not a mapping" }));
      return;
    }
    const name = str(raw.name);
    if (name === null) {
      shapeErrors.push(ComponentShapeError.of({ element: ElementPath.of(`${element}.name`), detail: "component has no string `name`" }));
      return;
    }
    const refs = (key) => {
      const out = [];
      if (!Array.isArray(raw[key]))
        return ComponentRefs.of(out);
      raw[key].forEach((entry, j) => {
        const el = `${element}.${key}[${j}].component`;
        const comp = isObject(entry) ? str(entry.component) : str(entry);
        if (comp !== null)
          out.push(ComponentRef.of({ component: ComponentName.of(comp), element: ElementPath.of(el) }));
      });
      return ComponentRefs.of(out);
    };
    const entities = [];
    if (Array.isArray(raw.entities)) {
      raw.entities.forEach((entry, j) => {
        if (!isObject(entry))
          return;
        const ename = str(entry.name);
        if (ename === null)
          return;
        const references = [];
        if (Array.isArray(entry.references)) {
          entry.references.forEach((ref, k) => {
            if (!isObject(ref))
              return;
            const target = str(ref.entity);
            const ownedBy = str(ref.owned_by);
            if (target !== null && ownedBy !== null) {
              references.push(EntityReference.of({
                entity: EntityName.of(target),
                ownedBy: ComponentName.of(ownedBy),
                element: ElementPath.of(`${element}.entities[${j}].references[${k}]`)
              }));
            }
          });
        }
        const identifier = str(entry.identifier);
        entities.push(ComponentEntity.of({
          name: EntityName.of(ename),
          element: ElementPath.of(`${element}.entities[${j}]`),
          identifier: identifier === null || identifier === "" ? null : AttributeName.of(identifier),
          references: EntityReferences.of(references)
        }));
      });
    }
    comps.push(Component.of({
      name: ComponentName.of(name),
      element: ElementPath.of(element),
      dependsOn: refs("depends_on"),
      dependents: refs("dependents"),
      entities: ComponentEntities.of(entities)
    }));
  });
  return { comps: Components.of(comps), shapeErrors: ComponentShapeErrors.of(shapeErrors) };
}
function parseComponentCatalog(md) {
  const fences = extractFences(md, "yaml");
  if (fences.length !== 1) {
    return ComponentCatalogOutcome.wrongFenceCount(fences.length);
  }
  const parsed = parseYamlSubset(fences[0]?.body ?? "");
  if (parsed.error !== undefined) {
    return ComponentCatalogOutcome.unparseable(LineNumber.of(fences[0]?.line ?? 0), parsed.error);
  }
  const { comps, shapeErrors } = extractComponents(parsed.value ?? null);
  return ComponentCatalogOutcome.extracted(comps, shapeErrors);
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
      units.push(UnitDecl.of({ name: UnitName.of(raw.name), dependsOn: UnitNames.of(Array.from(dependsOn, (raw2) => UnitName.of(raw2))) }));
    }
    if (units.length === 0)
      return DeclaredUnitsOutcome.unrecognized();
    return DeclaredUnitsOutcome.declared(UnitDecls.of(units));
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
  return ContractsTableOutcome.rows(ContractRows.of(contractsTable.rows.map((r, i) => {
    const first = cleanCell(r.cells[0] ?? "");
    return ContractRow.of({
      id: ContractId.of(/^[0-9]+$/.test(first) ? first : String(i + 1)),
      provider: ContractParty.of(cleanCell(r.cells[pCol] ?? "")),
      consumer: ContractParty.of(cCol >= 0 ? cleanCell(r.cells[cCol] ?? "") : ""),
      owner: ContractParty.of(oCol >= 0 ? cleanCell(r.cells[oCol] ?? "") : ""),
      line: LineNumber.of(r.line)
    });
  })));
}
function assessSpecBlocks(md) {
  const blocks = extractFences(md, "yaml").map((fence, i) => {
    const index = BlockIndex.of(i + 1);
    const line = LineNumber.of(fence.line);
    const parsed = parseYamlSubset(fence.body);
    if (parsed.error !== undefined) {
      return SpecBlockAssessment.unparseable(index, line, parsed.error);
    }
    const v = parsed.value ?? null;
    if (!isObject(v)) {
      return SpecBlockAssessment.notAMapping(index, line);
    }
    if ("openapi" in v && !("paths" in v)) {
      return SpecBlockAssessment.openapiWithoutPaths(index, line);
    }
    return SpecBlockAssessment.sound(index, line);
  });
  return SpecBlockAssessments.of(blocks);
}
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
    return null;
  const from = str2(pick(raw, ["from", "source"])) ?? implicitFrom;
  const to = str2(pick(raw, ["to", "target", "entity"]));
  const cardinality = str2(pick(raw, ["cardinality"]));
  const hasDirection = from !== null && to !== null || str2(pick(raw, ["direction"])) !== null;
  return RelDecl.of({
    element: ElementPath.of(element),
    from: from === null ? null : EntityName.of(from),
    to: to === null ? null : EntityName.of(to),
    cardinality: cardinality === null ? null : CardinalityNotation.of(cardinality),
    hasDirection
  });
}
function extractEntities(value) {
  const collected = { entities: [], rels: [], shapeErrors: [] };
  const model = collected;
  if (!isObject(value) || !Array.isArray(value.entities)) {
    model.shapeErrors.push(ShapeError.of({ element: ElementPath.of("entities"), detail: "top-level `entities:` list is missing" }));
    return DeclaredEntities.of({
      entities: EntityDecls.of(collected.entities),
      rels: RelDecls.of(collected.rels),
      shapeErrors: ShapeErrors.of(collected.shapeErrors)
    });
  }
  value.entities.forEach((raw, i) => {
    const element = `entities[${i}]`;
    if (!isObject(raw)) {
      model.shapeErrors.push(ShapeError.of({ element: ElementPath.of(element), detail: "entity entry is not a mapping" }));
      return;
    }
    const name = str2(raw.name);
    if (name === null) {
      model.shapeErrors.push(ShapeError.of({ element: ElementPath.of(`${element}.name`), detail: "entity has no string `name`" }));
      return;
    }
    const attrs = [];
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
          model.shapeErrors.push(ShapeError.of({ element: ElementPath.of(`${ael}.type`), detail: `attribute "${name}.${aname}" has no logical type` }));
        }
        const allowedRaw = pick(a, ["allowed_values", "allowed-values", "allowed", "values"]);
        const allowed = Array.isArray(allowedRaw) ? allowedRaw.map((x) => typeof x === "string" ? x : JSON.stringify(x)) : null;
        const defRaw = pick(a, ["default"]);
        const minRaw = pick(a, ["min"]);
        const maxRaw = pick(a, ["max"]);
        const references = str2(pick(a, ["references", "reference", "ref"]));
        attrs.push(AttrDecl.of({
          name: AttributeName.of(aname),
          element: ElementPath.of(ael),
          type: type === null ? null : TypeName.of(type),
          uniqueIsTrue: pick(a, ["unique"]) === true,
          references: references === null ? null : ReferenceTarget.of(references),
          allowed: allowed === null ? null : AllowedValues.of(allowed.map((v) => AllowedValue.of(v))),
          def: typeof defRaw === "number" || typeof defRaw === "string" ? AttributeDefault.of(defRaw) : null,
          minDeclared: minRaw !== null,
          maxDeclared: maxRaw !== null,
          min: typeof minRaw === "number" ? NumericBound.of(minRaw) : null,
          max: typeof maxRaw === "number" ? NumericBound.of(maxRaw) : null
        }));
      });
    }
    const rels = [];
    if (Array.isArray(raw.relationships)) {
      raw.relationships.forEach((r, j) => {
        const rel = extractRel(r, `${element}.relationships[${j}]`, name);
        if (rel)
          rels.push(rel);
      });
    }
    model.entities.push(EntityDecl.of({
      name: EntityName.of(name),
      element: ElementPath.of(element),
      attrs: AttrDecls.of(attrs),
      rels: RelDecls.of(rels)
    }));
  });
  if (Array.isArray(value.relationships)) {
    value.relationships.forEach((r, j) => {
      const rel = extractRel(r, `relationships[${j}]`, null);
      if (rel)
        model.rels.push(rel);
    });
  }
  return DeclaredEntities.of({
    entities: EntityDecls.of(collected.entities),
    rels: RelDecls.of(collected.rels),
    shapeErrors: ShapeErrors.of(collected.shapeErrors)
  });
}
function parseEntitiesDocument(md) {
  if (md === null)
    return EntitiesOutcome.absent();
  const fences = extractFences(md, "yaml");
  if (fences.length !== 1)
    return EntitiesOutcome.wrongFenceCount(fences.length);
  const parsed = parseYamlSubset(fences[0]?.body ?? "");
  if (parsed.error !== undefined) {
    return EntitiesOutcome.unparseable(LineNumber.of(fences[0]?.line ?? 0), parsed.error);
  }
  return EntitiesOutcome.extracted(extractEntities(parsed.value ?? null));
}
function parseRulesDocument(md) {
  if (md === null)
    return RulesOutcome.absent();
  const fences = extractFences(md, "yaml");
  if (fences.length !== 1)
    return RulesOutcome.wrongFenceCount(fences.length);
  const parsed = parseYamlSubset(fences[0]?.body ?? "");
  if (parsed.error !== undefined) {
    return RulesOutcome.unparseable(LineNumber.of(fences[0]?.line ?? 0), parsed.error);
  }
  const v = parsed.value ?? null;
  if (!isObject(v) || !Array.isArray(v.rules))
    return RulesOutcome.noRulesList();
  const ruleList = v.rules.map((raw, i) => {
    const element = `rules[${i}]`;
    if (!isObject(raw)) {
      return RuleDecl.of({ id: null, element: ElementPath.of(element), category: null, appliesTo: null, sourceIds: SourceIds.of([]), missing: ["<entry is not a mapping>"] });
    }
    const missing = ["id", "statement", "category"].filter((k) => !(k in raw));
    if (!("source" in raw) && !("sources" in raw))
      missing.push("source");
    const source = pick(raw, ["source", "sources"]);
    const sourceText = Array.isArray(source) ? source.filter((s) => typeof s === "string").join(" ") : str2(source) ?? "";
    const id = str2(raw.id);
    const category = str2(raw.category);
    const appliesTo = str2(pick(raw, ["applies_to", "applies-to", "applies to", "appliesTo"]));
    return RuleDecl.of({
      id: id === null ? null : DeclaredRuleId.of(id),
      element: ElementPath.of(element),
      category: category === null ? null : RuleCategory.of(category),
      appliesTo: appliesTo === null ? null : AppliesTo.of(appliesTo),
      sourceIds: SourceIds.of([...RequirementIds.extractFrom(sourceText)].map((v2) => SourceId.of(v2.asString()))),
      missing
    });
  });
  return RulesOutcome.extracted(RuleDecls.of(ruleList));
}
function parseFunctionalSpecDocument(md) {
  if (md === null)
    return FunctionalSpecOutcome.absent();
  const machines = [];
  const lines = md.split(`
`);
  for (let i = 0;i < lines.length; i++) {
    const h = (lines[i] ?? "").match(/^#{2,4}\s+State Machine:\s*(.+?)\s*$/i);
    if (!h)
      continue;
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
      machines.push(StateMachineSketch.of({
        spec: MachineSpec.of((h[1] ?? "").trim()),
        states: StateNames.of([...states].sort().map((v) => StateName.of(v))),
        fenceLine: LineNumber.of(j + 1),
        unsupported
      }));
      break;
    }
  }
  return FunctionalSpecOutcome.present(StateMachineSketches.of(machines));
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
        out.push(DomainEntitySketch.of({
          name: EntityName.of(e.name),
          component: ComponentName.of(raw.name),
          attributes: AttributeNames.of(attributes.map((v) => AttributeName.of(v)))
        }));
      }
    }
  }
  return DomainEntitiesOutcome.extracted(DomainEntitySketches.of(out));
}
function buildSiblingUnitEntities(texts) {
  const unitEntities = new Map;
  for (const { unit, text } of texts) {
    const fence = extractFences(text, "yaml")[0];
    if (fence === undefined)
      continue;
    const parsed = parseYamlSubset(fence.body);
    if (parsed.error !== undefined)
      continue;
    const model = extractEntities(parsed.value ?? null);
    const map = new Map;
    for (const e of model.entities()) {
      map.set(e.name().normalized().asString(), { name: e.name(), attrs: AttributeNames.of(e.attrs().names()) });
    }
    unitEntities.set(unit, map);
  }
  return SiblingUnitIndex.of(unitEntities);
}
// src/refcheck/adapter/design-record-repository-impl.ts
import { readFileSync as readFileSync5 } from "fs";
import { basename as basename2, dirname as dirname3, join as join5 } from "path";
class DesignRecordRepositoryImpl {
  findById(id) {
    const decoded = decodeDomainValues(() => this.#findById(id));
    return decoded.ok ? decoded.value : err({ kind: "corrupt", path: id.artifactPath().asString(), cause: decoded.error });
  }
  #findById(id) {
    const artifactPath = id.artifactPath().asString();
    let sourceBytes;
    try {
      sourceBytes = new Uint8Array(readFileSync5(artifactPath));
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
    const seed = {
      id,
      target: input(artifactPath, md),
      sourceDocument: sourceBytes,
      componentCatalog: targetBase === "components.md" ? parseComponentCatalog(md) : null,
      contractSummary: targetBase === "contract-summary.md" ? { contractsTable: parseContractsTable(md), specBlocks: assessSpecBlocks(md), declaredUnits: this.#declaredUnits(recordRoot) } : null,
      functional: isFunctional ? this.#functional(recordRoot, fdDir) : null
    };
    return ok(DesignRecord.of(seed));
  }
  store(record) {
    const path = record.id().artifactPath().asString();
    try {
      writeFileAtomically(path, record.sourceDocument());
      return ok(undefined);
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path, cause: e instanceof Error ? e.message : String(e) });
    }
  }
  #declaredUnits(recordRoot) {
    const depPath = recordRoot === null ? null : join5(recordRoot, "inception", "units-generation", "unit-of-work-dependency.md");
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
    const entitiesPath = join5(fdDir, "entities.md");
    const entities = load(entitiesPath, (t) => parseEntitiesDocument(t));
    const rulesPath = join5(fdDir, "rules.md");
    const rules = load(rulesPath, (t) => parseRulesDocument(t));
    const specPath = join5(fdDir, "functional-spec.md");
    const spec = load(specPath, (t) => parseFunctionalSpecDocument(t));
    const reqPath = recordRoot === null ? null : join5(recordRoot, "inception", "requirements-analysis", "requirements.md");
    const requirements = rules !== null && rules.outcome.isExtracted() && reqPath !== null ? load(reqPath, (t) => RequirementIds.extractFrom(t)) : null;
    const componentsPath = recordRoot === null ? null : join5(recordRoot, "inception", "domain-design", "components.md");
    const components = componentsPath === null ? null : load(componentsPath, (t) => parseDomainEntitiesDocument(t));
    const siblingTexts = [];
    if (components !== null && components.outcome.isExtracted() && recordRoot !== null) {
      const constructionDir = join5(recordRoot, "construction");
      for (const u of listSubdirectories(constructionDir)) {
        const p = join5(constructionDir, u, "functional-design", "entities.md");
        const text = readIfExists(p);
        if (text !== null)
          siblingTexts.push({ unit: u, path: p, text });
      }
    }
    return {
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
      siblingInputs: InputAnchors.of(siblingTexts.filter((s) => s.path !== entitiesPath).map((s) => InputAnchor.of({ artifact: rel(s.path), sha256: ContentHash.ofText(s.text) })))
    };
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
  const findingsSchemaFile = readContractSchema(join6(dirname4(fileURLToPath(import.meta.url)), "data", "deep-spec-findings-schema.json"));
  const findingsSchema = findingsSchemaFile.ok ? FindingsSchema.of(findingsSchemaFile.value) : FindingsSchema.unreadable(findingsSchemaFile.error.cause);
  const reportRepository = new ReferenceCheckReportRepositoryImpl;
  const useCase = new CheckContractSummaryUseCase(new DesignRecordRepositoryImpl, reportRepository, findingsSchema);
  const outcome = useCase.execute({
    recordId: DesignRecordId.of(target.value),
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
  process.stdout.write(renderVerdictLine(outcome.pass, outcome.findingsCount, outcome.skippedCount, flags.reportOnly ? "report-only" : undefined));
  process.exit(0);
}
main();
