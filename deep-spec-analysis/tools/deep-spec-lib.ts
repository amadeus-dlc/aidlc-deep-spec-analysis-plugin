// Shared deterministic machinery for the deep-spec-refcheck-* sensors
// (phase 1: solver-free reference/structure integrity checks).
//
// This is a PLUGIN-INTERNAL library: it ships in the same compose delta as
// the sensor scripts that import it, so the self-containment rule (never
// import a framework/core tool) is preserved. Everything here is
// deterministic: a fixed YAML subset (no anchors, aliases, tags, or flow
// maps — out-of-subset input becomes a parse error, never a guess), canonical
// sorting, no timestamps, and content-hash provenance.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export function isObject(v: Json): v is { [k: string]: Json } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// --- canonical serialization + hashing --------------------------------------

export function canonicalStringify(value: Json): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  if (isObject(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(value[k] ?? null)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf-8").digest("hex");
}

// --- canonical ordering ------------------------------------------------------

function numSegments(id: string): number[] {
  return (id.match(/[0-9]+/g) ?? []).map((s) => Number.parseInt(s, 10));
}

export function idCompare(a: string, b: string): number {
  const pa = a.replace(/[0-9.]/g, "");
  const pb = b.replace(/[0-9.]/g, "");
  if (pa !== pb) return pa < pb ? -1 : 1;
  const na = numSegments(a);
  const nb = numSegments(b);
  for (let i = 0; i < Math.max(na.length, nb.length); i++) {
    const da = na[i] ?? -1;
    const db = nb[i] ?? -1;
    if (da !== db) return da - db;
  }
  return 0;
}

// Extended kind rank (NFR1). Preserves the relative order of the v1 kinds.
const KIND_RANK: { [k: string]: number } = {
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
  "cross-check-disagreement": 10,
};

export interface RefEntry {
  artifact: string;
  element: string;
  value?: string;
}

export interface Finding {
  kind: string;
  frRefs: string[];
  targets: string[];
  witness: { refs: RefEntry[] };
  unit?: string;
  detail: string;
}

export interface Skipped {
  target: string;
  reason: string;
  unit?: string;
  detail?: string;
}

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const kr = (KIND_RANK[a.kind] ?? 99) - (KIND_RANK[b.kind] ?? 99);
    if (kr !== 0) return kr;
    const ta = a.targets.join(",");
    const tb = b.targets.join(",");
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.detail < b.detail ? -1 : a.detail > b.detail ? 1 : 0;
  });
}

export function sortSkipped(skipped: Skipped[]): Skipped[] {
  return [...skipped].sort((a, b) => {
    const c = idCompare(a.target, b.target);
    if (c !== 0) return c;
    return a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0;
  });
}

export function sortedUnique(values: string[], cmp: (a: string, b: string) => number): string[] {
  return [...new Set(values)].sort(cmp);
}

// --- fenced block extraction -------------------------------------------------

export interface Fence {
  info: string;
  body: string;
  line: number; // 1-based line of the opening fence
}

export function extractFences(md: string, lang: string): Fence[] {
  const fences: Fence[] = [];
  const lines = md.split("\n");
  let open = false;
  let info = "";
  let openLine = 0;
  let buf: string[] = [];
  for (let i = 0; i < lines.length; i++) {
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
        fences.push({ info, body: buf.join("\n"), line: openLine });
      }
      open = false;
      continue;
    }
    if (open) buf.push(lines[i] ?? "");
  }
  return fences;
}

// --- deterministic YAML subset parser ---------------------------------------
// Supports: block mappings, block sequences, plain/quoted scalars, inline
// arrays [a, b], literal (|) and folded (>) blocks, full-line and trailing
// comments. Rejects anchors (&), aliases (*), tags (!), and flow maps ({})
// as "unsupported YAML feature" — out-of-subset input is an error, never an
// interpretation guess (NFR: deterministic parsing).

export type Yaml = Json;

interface YamlLine {
  indent: number;
  text: string;
  n: number;
}

class YamlError extends Error {}

export function parseYamlSubset(src: string): { value?: Yaml; error?: string } {
  const raw = src.split("\n");
  const lines: YamlLine[] = [];
  for (let i = 0; i < raw.length; i++) {
    const expanded = (raw[i] ?? "").replace(/\t/g, "  ");
    const trimmed = expanded.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    lines.push({ indent: expanded.length - expanded.trimStart().length, text: trimmed, n: i + 1 });
  }
  if (lines.length === 0) return { value: null };
  try {
    const [value, next] = parseBlock(lines, 0, lines[0]?.indent ?? 0);
    if (next < lines.length) {
      throw new YamlError(`line ${lines[next]?.n}: content outside the top-level block`);
    }
    return { value };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

function parseBlock(lines: YamlLine[], start: number, indent: number): [Yaml, number] {
  const first = lines[start];
  if (!first) return [null, start];
  if (first.text === "-" || first.text.startsWith("- ")) {
    return parseSequence(lines, start, indent);
  }
  return parseMapping(lines, start, indent);
}

function parseSequence(lines: YamlLine[], start: number, indent: number): [Yaml, number] {
  const out: Yaml[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (!line || line.indent !== indent || !(line.text === "-" || line.text.startsWith("- "))) break;
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
      // `- key: value` — an inline mapping start; fold the inline part in as a
      // virtual line and consume the deeper continuation lines.
      const virtual: YamlLine = { indent: indent + 2, text: rest, n: line.n };
      const sub: YamlLine[] = [virtual];
      let j = i + 1;
      while (j < lines.length && (lines[j]?.indent ?? 0) > indent) {
        sub.push(lines[j] as YamlLine);
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

function isMappingEntry(text: string): boolean {
  if (text.startsWith("[") || text.startsWith("'") || text.startsWith('"')) return false;
  return /^[^:]+:(\s|$)/.test(text);
}

function parseMapping(lines: YamlLine[], start: number, indent: number): [Yaml, number] {
  const out: { [k: string]: Yaml } = {};
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (!line || line.indent !== indent) break;
    if (line.text === "-" || line.text.startsWith("- ")) break;
    const m = line.text.match(/^([^:]+):(?:\s+(.*))?$/);
    if (!m) throw new YamlError(`line ${line.n}: not a mapping entry: "${line.text}"`);
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
      const parts: string[] = [];
      let j = i + 1;
      while (j < lines.length && (lines[j]?.indent ?? 0) > indent) {
        parts.push(lines[j]?.text ?? "");
        j++;
      }
      out[key] = parts.join(valPart.startsWith(">") ? " " : "\n");
      i = j;
      continue;
    }
    out[key] = parseScalar(valPart, line.n);
    i++;
  }
  return [out, i];
}

function unquote(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function parseScalar(s: string, lineNo: number): Yaml {
  let v = s;
  if (v.startsWith("&") || v.startsWith("*") || v.startsWith("!")) {
    throw new YamlError(`line ${lineNo}: unsupported YAML feature (anchor/alias/tag): "${v}"`);
  }
  if (v.startsWith("{")) {
    throw new YamlError(`line ${lineNo}: unsupported YAML feature (flow mapping): "${v}"`);
  }
  if (v.startsWith('"') || v.startsWith("'")) {
    const quote = v[0] as string;
    const close = v.indexOf(quote, 1);
    if (close > 0) return v.slice(1, close);
    throw new YamlError(`line ${lineNo}: unterminated quoted scalar: "${v}"`);
  }
  const hash = v.indexOf(" #");
  if (hash >= 0) v = v.slice(0, hash).trim();
  if (v.startsWith("[")) {
    if (!v.endsWith("]")) throw new YamlError(`line ${lineNo}: unterminated inline sequence: "${v}"`);
    const inner = v.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((item) => parseScalar(item.trim(), lineNo));
  }
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null" || v === "~") return null;
  if (/^-?[0-9]+$/.test(v)) return Number.parseInt(v, 10);
  if (/^-?[0-9]+\.[0-9]+$/.test(v)) return Number.parseFloat(v);
  return v;
}

// --- markdown table parsing --------------------------------------------------

export interface MdTable {
  header: string[];
  rows: { cells: string[]; line: number }[];
  line: number;
}

export function parseMarkdownTables(md: string): MdTable[] {
  const tables: MdTable[] = [];
  const lines = md.split("\n");
  let i = 0;
  const splitRow = (row: string): string[] =>
    row
      .replace(/^\s*\|/, "")
      .replace(/\|\s*$/, "")
      .split("|")
      .map((c) => c.trim());
  while (i < lines.length) {
    const isRow = (n: number): boolean => /^\s*\|.*\|\s*$/.test(lines[n] ?? "");
    if (isRow(i) && isRow(i + 1) && /^[\s|:-]+$/.test(lines[i + 1] ?? "")) {
      const table: MdTable = { header: splitRow(lines[i] ?? ""), rows: [], line: i + 1 };
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

// --- minimal JSON Schema (draft-07 subset) validator ------------------------
// Same keyword subset as the ir-valid sensor; used for contract-2
// self-validation (a writer must never emit a non-conforming findings file).

type Schema = { [k: string]: Json };

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
  if (typeof schema.$ref === "string") {
    return validateSchema(root, resolveRef(root, schema.$ref), value, path, errors);
  }
  if (Array.isArray(schema.oneOf)) {
    let matched = 0;
    for (const branch of schema.oneOf) {
      if (!isObject(branch)) continue;
      const probe: string[] = [];
      if (validateSchema(root, branch as Schema, value, path, probe)) matched++;
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
      if (seen.size !== value.length) errors.push(`${path}: items are not unique`);
    }
    if (isObject(schema.items)) {
      value.forEach((item, i) => {
        validateSchema(root, schema.items as Schema, item, `${path}/${i}`, errors);
      });
    }
  }
  if (isObject(value)) {
    const props = isObject(schema.properties) ? (schema.properties as { [k: string]: Json }) : {};
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
        validateSchema(root, props[key] as Schema, val, `${path}/${key}`, errors);
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}: unexpected property "${key}"`);
      } else if (isObject(schema.additionalProperties)) {
        validateSchema(root, schema.additionalProperties as Schema, val, `${path}/${key}`, errors);
      }
      if (isObject(schema.propertyNames) && typeof (schema.propertyNames as Schema).pattern === "string") {
        if (!new RegExp((schema.propertyNames as Schema).pattern as string).test(key)) {
          errors.push(`${path}: property name "${key}" does not match required pattern`);
        }
      }
    }
  }
  return errors.length === before;
}

// --- findings document assembly (contract 2 + self-validation) ---------------

export const CATALOG_VERSION = "1.0.0";

export interface InputEntry {
  artifact: string;
  sha256: string;
}

export interface RefcheckDoc {
  backend: string;
  unavailable?: { reason: string };
  inputs: InputEntry[];
  checked: string[];
  findings: Finding[];
  skipped: Skipped[];
}

function findingsSchemaPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "data", "deep-spec-findings-schema.json");
}

export interface EmitResult {
  findingsCount: number;
  skippedCount: number;
  unavailable: boolean;
}

// Namespaced target ids (unit:…, component:…, entity:…) must satisfy the
// findings schema's targetId pattern, but the raw names they are built from
// come out of free-form artifact text (a markdown table cell, a yaml scalar)
// and may carry spaces or other out-of-alphabet characters. Sanitize the
// token deterministically — the raw string always survives in the witness
// refs `value` — so a defective name can never invalidate the whole document.
export function safeTarget(prefix: string, raw: string): string {
  const token = raw.replace(/[^A-Za-z0-9_./-]/g, "-");
  return `${prefix}:${token === "" ? "unknown" : token}`;
}

// Assembles the contract-2 document (canonical key order, canonical sorts),
// self-validates it against the findings schema (FR: a writer never emits a
// non-conforming file — on failure it degrades to an `unavailable` document
// carrying the validation error), and writes it unless reportOnly. Returns
// the counts of the document actually written, so the caller's stdout
// verdict can never contradict the file.
export function emitRefcheckDoc(outDir: string, doc: RefcheckDoc, reportOnly: boolean): EmitResult {
  const inputs = [...doc.inputs].sort((a, b) => (a.artifact < b.artifact ? -1 : a.artifact > b.artifact ? 1 : 0));
  const irHash = sha256(canonicalStringify(inputs as unknown as Json));
  const assemble = (d: RefcheckDoc): { [k: string]: Json } => {
    const ordered: { [k: string]: Json } = {
      backend: d.backend,
      irVersion: CATALOG_VERSION,
      irHash,
      method: "static",
    };
    if (d.unavailable) ordered.unavailable = d.unavailable as unknown as Json;
    ordered.inputs = inputs as unknown as Json;
    ordered.checked = sortedUnique(d.checked, idCompare) as unknown as Json;
    ordered.findings = sortFindings(d.findings) as unknown as Json;
    ordered.skipped = sortSkipped(d.skipped) as unknown as Json;
    return ordered;
  };
  let ordered = assemble(doc);
  try {
    const schemaDoc = JSON.parse(readFileSync(findingsSchemaPath(), "utf-8")) as Schema;
    const errors: string[] = [];
    validateSchema(schemaDoc, schemaDoc, ordered as Json, "", errors);
    if (errors.length > 0) {
      ordered = assemble({
        backend: doc.backend,
        unavailable: { reason: `self-validation against deep-spec-findings-schema.json failed: ${errors[0]}` },
        inputs: doc.inputs,
        checked: [],
        findings: [],
        skipped: [],
      });
    }
  } catch (err) {
    ordered = assemble({
      backend: doc.backend,
      unavailable: { reason: `findings schema unreadable: ${err instanceof Error ? err.message : String(err)}` },
      inputs: doc.inputs,
      checked: [],
      findings: [],
      skipped: [],
    });
  }
  if (!reportOnly) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, `${doc.backend}.json`), `${JSON.stringify(ordered, null, 2)}\n`, "utf-8");
  }
  return {
    findingsCount: (ordered.findings as Json[]).length,
    skippedCount: (ordered.skipped as Json[]).length,
    unavailable: "unavailable" in ordered,
  };
}

// --- record-root and requirements resolution ---------------------------------

// Ascend from the written artifact's directory to the intent record root —
// the directory that contains the phase directories (inception/…,
// construction/…). Bounded walk; null when no root shape is found.
export function findRecordRoot(startDir: string): string | null {
  let d = startDir;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(d, "inception")) || existsSync(join(d, "aidlc-state.md"))) return d;
    const parent = dirname(d);
    if (parent === d) break;
    d = parent;
  }
  return null;
}

export function relArtifact(recordRoot: string | null, absPath: string): string {
  if (recordRoot && absPath.startsWith(`${recordRoot}/`)) {
    return absPath.slice(recordRoot.length + 1);
  }
  return absPath.split("/").slice(-1)[0] ?? absPath;
}

export function requirementIds(text: string): Set<string> {
  const ids = new Set<string>();
  for (const m of text.matchAll(/\b(?:FR|NFR)-?[0-9]+(?:\.[0-9]+)*\b/g)) {
    ids.add(m[0]);
  }
  return ids;
}

// --- misc --------------------------------------------------------------------

// Name normalization for cross-artifact entity matching (XS checks):
// casefold + strip non-alphanumerics, so "OrderItem" matches "order_item".
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function parseFlags(argv: string[]): { stage: string; outputPath: string; reportOnly: boolean } {
  let stage = "";
  let outputPath = "";
  let reportOnly = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--stage") stage = argv[i + 1] ?? "";
    if (argv[i] === "--output-path") outputPath = argv[i + 1] ?? "";
    if (argv[i] === "--report-only") reportOnly = true;
  }
  return { stage, outputPath, reportOnly };
}

export function verdictOut(pass: boolean, findings: number, skipped: number, note?: string): never {
  const out: { [k: string]: Json } = { pass, findings_count: findings, skipped_count: skipped, method: "static" };
  if (note) out.note = note;
  process.stdout.write(`${JSON.stringify(out)}\n`);
  process.exit(0);
}

export function readIfExists(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf-8") : null;
}
