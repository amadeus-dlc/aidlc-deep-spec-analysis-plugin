// deep-spec-refcheck-functional sensor — deterministic reference/structure
// checks for a unit's functional-design artifacts (entities.md / rules.md /
// functional-spec.md). Fires on any markdown write inside a functional-design
// record dir and runs the full catalog for that unit.
//
// Check families (solver-free, LLM-free — phase 1):
//   FD-E1  entities yaml parses; required keys; entity/attribute names unique
//   FD-E2  type-token coherence (allowed values vs type, min/max vs type,
//          unique vs scalar)
//   FD-E3  min <= max; default within range and allowed values
//   FD-E4  relationship endpoints are declared entities
//   FD-E5  cardinality from the closed set 1:1 | 1:N | N:1 | N:M, with a
//          direction
//   FD-E6  attribute references resolve to declared entities
//   FD-R1  rules yaml parses; required keys per rule
//   FD-R2  rule ids match BR{n}.{m} and are unique
//   FD-R3  every source FR/NFR id exists in the intent's requirements.md
//   FD-R4  applies-to resolves against this unit's entities.md
//   FD-R5  category from the closed set
//   FD-S1  state-machine diagram states are allowed values of the lifecycle
//          attribute
//   FD-S2  allowed lifecycle values that appear in no diagram state
//   XS-1   a domain-design entity defined in two or more units
//   XS-2   a domain-design entity defined in no unit
//   XS-3   domain-design attributes silently dropped by this unit's entity
//
// Missing sibling artifacts skip their families with reason absent-input;
// unparseable regions skip with unrecognized-format — never a crash, never
// silence. Findings land in deep-spec-refcheck/functional-design.json in the
// unit's functional-design dir (contract 2, method: static, self-validated).
//
// Sensor contract: parses --stage / --output-path (+ --report-only);
// pass-through on writes outside a functional-design dir; one JSON verdict
// line on stdout; always exit 0.

import { existsSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  type Finding,
  type InputEntry,
  type RefEntry,
  type Skipped,
  emitRefcheckDoc,
  findRecordRoot,
  parseFlags,
  readIfExists,
  relArtifact,
  verdictOut,
} from "./deep-spec-lib.ts";
import {
  type Json,
  extractFences,
  idCompare,
  isObject,
  normalizeName,
  parseYamlSubset,
  requirementIds,
  safeTarget,
  sha256,
  sortedUnique,
} from "./kernel/domain/index.ts";

const BACKEND = "functional-design";
const FAMILIES = [
  "FD-E1", "FD-E2", "FD-E3", "FD-E4", "FD-E5", "FD-E6",
  "FD-R1", "FD-R2", "FD-R3", "FD-R4", "FD-R5",
  "FD-S1", "FD-S2",
  "XS-1", "XS-2", "XS-3",
];
const CARDINALITIES = new Set(["1:1", "1:N", "N:1", "N:M"]);
const CATEGORIES = new Set(["validation", "authorization", "constraint", "calculation", "policy"]);
const NUMERICISH = new Set(["int", "integer", "number", "decimal", "float", "double", "long"]);
const DATEISH = new Set(["date", "datetime", "timestamp", "time"]);
const BOOLISH = new Set(["bool", "boolean"]);
const COLLECTIONISH = new Set(["list", "array", "map", "object", "collection", "set"]);

function str(v: Json): string | null {
  return typeof v === "string" ? v : null;
}

// --- tolerant entities.md extraction ----------------------------------------

interface AttrDecl {
  name: string;
  element: string;
  type: string | null;
  unique: Json;
  references: string | null;
  allowed: string[] | null;
  def: Json;
  min: Json;
  max: Json;
}

interface RelDecl {
  element: string;
  from: string | null;
  to: string | null;
  cardinality: string | null;
  hasDirection: boolean;
}

interface EntityDecl {
  name: string;
  element: string;
  attrs: AttrDecl[];
  rels: RelDecl[];
}

interface EntitiesModel {
  entities: EntityDecl[];
  rels: RelDecl[]; // top-level relationships
  shapeErrors: { element: string; detail: string }[];
}

function pick(v: { [k: string]: Json }, keys: string[]): Json {
  for (const k of keys) {
    if (k in v) return v[k] as Json;
  }
  return null;
}

function extractRel(raw: Json, element: string, implicitFrom: string | null): RelDecl | null {
  if (!isObject(raw)) return null;
  const from = str(pick(raw, ["from", "source"])) ?? implicitFrom;
  const to = str(pick(raw, ["to", "target", "entity"]));
  const cardinality = str(pick(raw, ["cardinality"]));
  const hasDirection = (from !== null && to !== null) || str(pick(raw, ["direction"])) !== null;
  return { element, from, to, cardinality, hasDirection };
}

function extractEntities(value: Json): EntitiesModel {
  const model: EntitiesModel = { entities: [], rels: [], shapeErrors: [] };
  if (!isObject(value) || !Array.isArray(value.entities)) {
    model.shapeErrors.push({ element: "entities", detail: "top-level `entities:` list is missing" });
    return model;
  }
  value.entities.forEach((raw, i) => {
    const element = `entities[${i}]`;
    if (!isObject(raw)) {
      model.shapeErrors.push({ element, detail: "entity entry is not a mapping" });
      return;
    }
    const name = str(raw.name);
    if (name === null) {
      model.shapeErrors.push({ element: `${element}.name`, detail: "entity has no string `name`" });
      return;
    }
    const attrs: AttrDecl[] = [];
    if (Array.isArray(raw.attributes)) {
      (raw.attributes as Json[]).forEach((a, j) => {
        const ael = `${element}.attributes[${j}]`;
        if (!isObject(a)) {
          model.shapeErrors.push({ element: ael, detail: "attribute entry is not a mapping" });
          return;
        }
        const aname = str(a.name);
        if (aname === null) {
          model.shapeErrors.push({ element: `${ael}.name`, detail: "attribute has no string `name`" });
          return;
        }
        const type = str(pick(a, ["type", "logical_type", "logical-type"]));
        if (type === null) {
          model.shapeErrors.push({ element: `${ael}.type`, detail: `attribute "${name}.${aname}" has no logical type` });
        }
        const allowedRaw = pick(a, ["allowed_values", "allowed-values", "allowed", "values"]);
        const allowed = Array.isArray(allowedRaw)
          ? (allowedRaw as Json[]).map((x) => (typeof x === "string" ? x : JSON.stringify(x)))
          : null;
        attrs.push({
          name: aname,
          element: ael,
          type,
          unique: pick(a, ["unique"]),
          references: str(pick(a, ["references", "reference", "ref"])),
          allowed,
          def: pick(a, ["default"]),
          min: pick(a, ["min"]),
          max: pick(a, ["max"]),
        });
      });
    }
    const rels: RelDecl[] = [];
    if (Array.isArray(raw.relationships)) {
      (raw.relationships as Json[]).forEach((r, j) => {
        const rel = extractRel(r, `${element}.relationships[${j}]`, name);
        if (rel) rels.push(rel);
      });
    }
    model.entities.push({ name, element, attrs, rels });
  });
  if (Array.isArray(value.relationships)) {
    (value.relationships as Json[]).forEach((r, j) => {
      const rel = extractRel(r, `relationships[${j}]`, null);
      if (rel) model.rels.push(rel);
    });
  }
  return model;
}

// --- state machine extraction from functional-spec.md ------------------------

interface Machine {
  spec: string; // "Entity" or "Entity.attribute" from the heading
  states: string[];
  fenceLine: number;
  unsupported: string | null;
}

function extractMachines(md: string): Machine[] {
  const machines: Machine[] = [];
  const lines = md.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const h = (lines[i] ?? "").match(/^#{2,4}\s+State Machine:\s*(.+?)\s*$/i);
    if (!h) continue;
    // Find the next mermaid fence before the next heading of same/higher level.
    for (let j = i + 1; j < lines.length; j++) {
      if (/^#{1,4}\s/.test(lines[j] ?? "")) break;
      const f = (lines[j] ?? "").match(/^\s*```\s*mermaid\s*$/i);
      if (!f) continue;
      const body: string[] = [];
      let k = j + 1;
      while (k < lines.length && !/^\s*```\s*$/.test(lines[k] ?? "")) {
        body.push(lines[k] ?? "");
        k++;
      }
      const text = body.join("\n");
      if (!/stateDiagram/i.test(text)) break;
      let unsupported: string | null = null;
      if (/\{/.test(text)) unsupported = "composite states are outside the supported stateDiagram subset";
      if (/<<choice>>|<<fork>>|<<join>>/.test(text)) unsupported = "choice/fork/join nodes are outside the supported stateDiagram subset";
      const states = new Set<string>();
      for (const line of body) {
        const t = (line ?? "").trim();
        const m = t.match(/^(\[?\*?\]?[\w-]*)\s*-->\s*([\w-]+)/);
        if (m) {
          for (const s of [m[1] ?? "", m[2] ?? ""]) {
            if (s !== "" && s !== "[*]" && !s.startsWith("[")) states.add(s);
          }
        }
      }
      machines.push({ spec: (h[1] ?? "").trim(), states: [...states].sort(), fenceLine: j + 1, unsupported });
      break;
    }
  }
  return machines;
}

// --- tolerant components.md extraction (for the XS checks) -------------------

interface DomainEntity {
  name: string;
  component: string;
  attributes: string[];
}

function extractDomainEntities(value: Json): DomainEntity[] {
  const out: DomainEntity[] = [];
  if (!isObject(value) || !Array.isArray(value.components)) return out;
  for (const raw of value.components as Json[]) {
    if (!isObject(raw) || typeof raw.name !== "string") continue;
    if (!Array.isArray(raw.entities)) continue;
    for (const e of raw.entities as Json[]) {
      if (!isObject(e) || typeof e.name !== "string") continue;
      const attributes = Array.isArray(e.attributes)
        ? (e.attributes as Json[]).filter((a): a is string => typeof a === "string")
        : [];
      out.push({ name: e.name, component: raw.name, attributes });
    }
  }
  return out;
}

// --- main --------------------------------------------------------------------

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  if (!flags.outputPath) {
    process.stderr.write("deep-spec-refcheck-functional: --output-path is required\n");
    process.exit(1);
  }
  const fdDir = dirname(flags.outputPath);
  if (basename(fdDir) !== "functional-design" || !flags.outputPath.endsWith(".md") || !existsSync(fdDir)) {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "not-applicable" })}\n`);
    process.exit(0);
  }

  const recordRoot = findRecordRoot(fdDir);
  const unitDir = dirname(fdDir);
  const unit = recordRoot !== null && basename(unitDir) !== "construction" && unitDir !== recordRoot ? basename(unitDir) : undefined;

  const inputs: InputEntry[] = [];
  const findings: Finding[] = [];
  const skipped: Skipped[] = [];
  const rel = (p: string): string => relArtifact(recordRoot, p);
  const ref = (art: string, element: string, value?: string): RefEntry =>
    value === undefined ? { artifact: art, element } : { artifact: art, element, value };
  const finding = (family: string, kind: string, targets: string[], refs: RefEntry[], detail: string, frRefs: string[] = []): void => {
    const f: Finding = {
      kind,
      frRefs: sortedUnique(frRefs, idCompare),
      targets: sortedUnique(targets, idCompare),
      witness: { refs },
      detail: `${family}: ${detail}`,
    };
    if (unit !== undefined) f.unit = unit;
    findings.push(f);
  };
  const skipFamily = (family: string, reason: string, detail: string): void => {
    const s: Skipped = { target: `check:${family}`, reason, detail };
    if (unit !== undefined) s.unit = unit;
    skipped.push(s);
  };
  const readInput = (path: string): string | null => {
    const text = readIfExists(path);
    if (text !== null) inputs.push({ artifact: rel(path), sha256: sha256(text) });
    return text;
  };

  // --- entities.md ----------------------------------------------------------
  const entitiesPath = join(fdDir, "entities.md");
  const entitiesArt = rel(entitiesPath);
  const entitiesMd = readInput(entitiesPath);
  let entities: EntitiesModel | null = null;
  if (entitiesMd === null) {
    for (const f of ["FD-E1", "FD-E2", "FD-E3", "FD-E4", "FD-E5", "FD-E6"]) {
      skipFamily(f, "absent-input", "entities.md is not present in this unit's functional-design record");
    }
  } else {
    const fences = extractFences(entitiesMd, "yaml");
    if (fences.length !== 1) {
      finding("FD-E1", "structure-invalid", ["check:FD-E1"], [ref(entitiesArt, "yaml fence")],
        `entities.md must carry exactly one fenced yaml source-of-truth block (found ${fences.length})`);
      for (const f of ["FD-E2", "FD-E3", "FD-E4", "FD-E5", "FD-E6"]) {
        skipFamily(f, "unrecognized-format", "blocked by FD-E1: the entities yaml block is unusable");
      }
    } else {
      const parsed = parseYamlSubset(fences[0]?.body ?? "");
      if (parsed.error !== undefined) {
        finding("FD-E1", "structure-invalid", ["check:FD-E1"], [ref(entitiesArt, `yaml fence (line ${fences[0]?.line})`)],
          `yaml block does not parse in the supported subset: ${parsed.error}`);
        for (const f of ["FD-E2", "FD-E3", "FD-E4", "FD-E5", "FD-E6"]) {
          skipFamily(f, "unrecognized-format", "blocked by FD-E1: the entities yaml block is unusable");
        }
      } else {
        entities = extractEntities(parsed.value ?? null);
        for (const e of entities.shapeErrors) {
          finding("FD-E1", "structure-invalid", ["check:FD-E1"], [ref(entitiesArt, e.element)], e.detail);
        }
        const seenEntities = new Set<string>();
        for (const e of entities.entities) {
          if (seenEntities.has(e.name)) {
            finding("FD-E1", "structure-invalid", [safeTarget("entity", e.name)], [ref(entitiesArt, `${e.element}.name`, e.name)],
              `entity "${e.name}" is declared more than once`);
          }
          seenEntities.add(e.name);
          const seenAttrs = new Set<string>();
          for (const a of e.attrs) {
            if (seenAttrs.has(a.name)) {
              finding("FD-E1", "structure-invalid", [safeTarget("attr", `${e.name}.${a.name}`)], [ref(entitiesArt, `${a.element}.name`, a.name)],
                `attribute "${e.name}.${a.name}" is declared more than once`);
            }
            seenAttrs.add(a.name);
          }
        }
      }
    }
  }

  if (entities !== null) {
    const declaredEntities = new Set(entities.entities.map((e) => e.name));
    for (const e of entities.entities) {
      for (const a of e.attrs) {
        const t = (a.type ?? "").toLowerCase();
        const attrId = safeTarget("attr", `${e.name}.${a.name}`);
        // FD-E2: type-token coherence
        if (a.allowed !== null && (NUMERICISH.has(t) || DATEISH.has(t) || BOOLISH.has(t))) {
          finding("FD-E2", "structure-invalid", [attrId], [ref(entitiesArt, a.element, t)],
            `"${e.name}.${a.name}" declares allowed values but its type "${a.type}" is not an enumerable type`);
        }
        if ((a.min !== null || a.max !== null) && t !== "" && !NUMERICISH.has(t) && !DATEISH.has(t)) {
          finding("FD-E2", "structure-invalid", [attrId], [ref(entitiesArt, a.element, t)],
            `"${e.name}.${a.name}" declares min/max but its type "${a.type}" is not numeric or date-like`);
        }
        if (a.unique === true && COLLECTIONISH.has(t)) {
          finding("FD-E2", "structure-invalid", [attrId], [ref(entitiesArt, a.element, t)],
            `"${e.name}.${a.name}" declares unique but its type "${a.type}" is not scalar`);
        }
        // FD-E3: range/default coherence
        if (typeof a.min === "number" && typeof a.max === "number" && a.min > a.max) {
          finding("FD-E3", "structure-invalid", [attrId], [ref(entitiesArt, a.element, `min ${a.min} > max ${a.max}`)],
            `"${e.name}.${a.name}": min ${a.min} exceeds max ${a.max}`);
        }
        if (typeof a.def === "number") {
          if (typeof a.min === "number" && a.def < a.min) {
            finding("FD-E3", "structure-invalid", [attrId], [ref(entitiesArt, a.element, String(a.def))],
              `"${e.name}.${a.name}": default ${a.def} is below min ${a.min}`);
          }
          if (typeof a.max === "number" && a.def > a.max) {
            finding("FD-E3", "structure-invalid", [attrId], [ref(entitiesArt, a.element, String(a.def))],
              `"${e.name}.${a.name}": default ${a.def} is above max ${a.max}`);
          }
        }
        if (a.allowed !== null && typeof a.def === "string" && !a.allowed.includes(a.def)) {
          finding("FD-E3", "structure-invalid", [attrId], [ref(entitiesArt, a.element, a.def)],
            `"${e.name}.${a.name}": default "${a.def}" is not one of the allowed values`);
        }
        // FD-E6: attribute references resolve
        if (a.references !== null) {
          const token = a.references.match(/^([A-Za-z][A-Za-z0-9_]*)(?:\.[A-Za-z][A-Za-z0-9_]*)?$/);
          const target = token ? (token[1] ?? "") : "";
          const resolves = token
            ? declaredEntities.has(target)
            : entities.entities.some((d) => a.references !== null && a.references.toLowerCase().includes(d.name.toLowerCase()));
          if (!resolves) {
            finding("FD-E6", "reference-broken", [attrId], [ref(entitiesArt, a.element, a.references)],
              `"${e.name}.${a.name}" references "${a.references}" which is not a declared entity`);
          }
        }
      }
    }
    // FD-E4 / FD-E5: relationships
    const allRels = [...entities.rels, ...entities.entities.flatMap((e) => e.rels)];
    for (const r of allRels) {
      for (const endpoint of [r.from, r.to]) {
        if (endpoint !== null && !declaredEntities.has(endpoint)) {
          finding("FD-E4", "reference-broken", [safeTarget("entity", endpoint)], [ref(entitiesArt, r.element, endpoint)],
            `relationship endpoint "${endpoint}" is not a declared entity`);
        }
      }
      if (r.cardinality !== null) {
        const token = r.cardinality.toUpperCase().replace(/\s/g, "");
        if (!CARDINALITIES.has(token)) {
          finding("FD-E5", "structure-invalid", ["check:FD-E5"], [ref(entitiesArt, r.element, r.cardinality)],
            `cardinality "${r.cardinality}" is not in the closed set 1:1 | 1:N | N:1 | N:M`);
        }
        if (!r.hasDirection) {
          finding("FD-E5", "structure-invalid", ["check:FD-E5"], [ref(entitiesArt, r.element)],
            "relationship declares a cardinality but no direction (from/to or direction key)");
        }
      }
    }
  }

  // --- rules.md -------------------------------------------------------------
  const rulesPath = join(fdDir, "rules.md");
  const rulesArt = rel(rulesPath);
  const rulesMd = readInput(rulesPath);
  interface RuleDecl {
    id: string | null;
    element: string;
    category: string | null;
    appliesTo: string | null;
    sourceIds: string[];
    missing: string[];
  }
  let rules: RuleDecl[] | null = null;
  if (rulesMd === null) {
    for (const f of ["FD-R1", "FD-R2", "FD-R3", "FD-R4", "FD-R5"]) {
      skipFamily(f, "absent-input", "rules.md is not present in this unit's functional-design record");
    }
  } else {
    const fences = extractFences(rulesMd, "yaml");
    const blockRs = (why: string): void => {
      for (const f of ["FD-R2", "FD-R3", "FD-R4", "FD-R5"]) skipFamily(f, "unrecognized-format", why);
    };
    if (fences.length !== 1) {
      finding("FD-R1", "structure-invalid", ["check:FD-R1"], [ref(rulesArt, "yaml fence")],
        `rules.md must carry exactly one fenced yaml source-of-truth block (found ${fences.length})`);
      blockRs("blocked by FD-R1: the rules yaml block is unusable");
    } else {
      const parsed = parseYamlSubset(fences[0]?.body ?? "");
      if (parsed.error !== undefined) {
        finding("FD-R1", "structure-invalid", ["check:FD-R1"], [ref(rulesArt, `yaml fence (line ${fences[0]?.line})`)],
          `yaml block does not parse in the supported subset: ${parsed.error}`);
        blockRs("blocked by FD-R1: the rules yaml block is unusable");
      } else {
        const v = parsed.value ?? null;
        if (!isObject(v) || !Array.isArray(v.rules)) {
          finding("FD-R1", "structure-invalid", ["check:FD-R1"], [ref(rulesArt, "rules")],
            "top-level `rules:` list is missing");
          blockRs("blocked by FD-R1: the rules yaml block is unusable");
        } else {
          rules = (v.rules as Json[]).map((raw, i) => {
            const element = `rules[${i}]`;
            if (!isObject(raw)) return { id: null, element, category: null, appliesTo: null, sourceIds: [], missing: ["<entry is not a mapping>"] };
            const missing = ["id", "statement", "category"].filter((k) => !(k in raw));
            if (!("source" in raw) && !("sources" in raw)) missing.push("source");
            const source = pick(raw, ["source", "sources"]);
            const sourceText = Array.isArray(source)
              ? (source as Json[]).filter((s): s is string => typeof s === "string").join(" ")
              : (str(source) ?? "");
            return {
              id: str(raw.id),
              element,
              category: str(raw.category),
              appliesTo: str(pick(raw, ["applies_to", "applies-to", "applies to", "appliesTo"])),
              sourceIds: [...requirementIds(sourceText)],
              missing,
            };
          });
          for (const r of rules) {
            if (r.missing.length > 0) {
              finding("FD-R1", "structure-invalid", [r.id !== null && /^BR[0-9]+\.[0-9]+$/.test(r.id) ? r.id : "check:FD-R1"],
                [ref(rulesArt, r.element)],
                `rule is missing required key(s): ${r.missing.join(", ")}`);
            }
          }
        }
      }
    }
  }

  if (rules !== null) {
    // FD-R2: id shape + uniqueness
    const seenIds = new Set<string>();
    for (const r of rules) {
      if (r.id === null) continue;
      if (!/^BR[0-9]+\.[0-9]+$/.test(r.id)) {
        finding("FD-R2", "structure-invalid", ["check:FD-R2"], [ref(rulesArt, `${r.element}.id`, r.id)],
          `rule id "${r.id}" does not match BR{group}.{seq}`);
        continue;
      }
      if (seenIds.has(r.id)) {
        finding("FD-R2", "structure-invalid", [r.id], [ref(rulesArt, `${r.element}.id`, r.id)],
          `rule id "${r.id}" is declared more than once`);
      }
      seenIds.add(r.id);
    }
    // FD-R3: source FR/NFR ids exist in requirements.md
    const reqPath = recordRoot === null ? null : join(recordRoot, "inception", "requirements-analysis", "requirements.md");
    const reqMd = reqPath === null ? null : readIfExists(reqPath);
    if (reqMd === null) {
      skipFamily("FD-R3", "absent-input", "requirements.md not found under this intent record — source ids cannot be reverse-verified");
    } else {
      inputs.push({ artifact: rel(reqPath as string), sha256: sha256(reqMd) });
      const known = requirementIds(reqMd);
      for (const r of rules) {
        const missing = r.sourceIds.filter((id) => !known.has(id)).sort();
        if (missing.length > 0) {
          finding("FD-R3", "reference-broken",
            [r.id !== null && /^BR[0-9]+\.[0-9]+$/.test(r.id) ? r.id : "check:FD-R3"],
            missing.map((id) => ref(rulesArt, `${r.element}.source`, id)),
            `source id(s) ${missing.join(", ")} do not exist in requirements.md`, missing);
        }
      }
    }
    // FD-R4: applies-to resolves against entities.md
    if (entities === null) {
      skipFamily("FD-R4", "absent-input", "entities.md is unavailable — applies-to cannot be resolved");
    } else {
      const declaredEntities = entities.entities;
      for (const r of rules) {
        if (r.appliesTo === null) continue;
        const token = r.appliesTo.match(/^([A-Za-z][A-Za-z0-9_]*)(?:\.([A-Za-z][A-Za-z0-9_]*))?$/);
        let resolves: boolean;
        if (token) {
          const ent = declaredEntities.find((e) => e.name === token[1]);
          resolves = ent !== undefined && (token[2] === undefined || ent.attrs.some((a) => a.name === token[2]));
        } else {
          resolves = declaredEntities.some((e) => (r.appliesTo ?? "").toLowerCase().includes(e.name.toLowerCase()));
        }
        if (!resolves) {
          finding("FD-R4", "reference-broken",
            [r.id !== null && /^BR[0-9]+\.[0-9]+$/.test(r.id) ? r.id : "check:FD-R4"],
            [ref(rulesArt, r.element, r.appliesTo)],
            `applies-to "${r.appliesTo}" does not resolve to a declared entity or entity.attribute`);
        }
      }
    }
    // FD-R5: category closed set
    for (const r of rules) {
      if (r.category !== null && !CATEGORIES.has(r.category.toLowerCase())) {
        finding("FD-R5", "structure-invalid",
          [r.id !== null && /^BR[0-9]+\.[0-9]+$/.test(r.id) ? r.id : "check:FD-R5"],
          [ref(rulesArt, `${r.element}.category`, r.category)],
          `category "${r.category}" is not one of validation | authorization | constraint | calculation | policy`);
      }
    }
  }

  // --- functional-spec.md state machines ------------------------------------
  const specPath = join(fdDir, "functional-spec.md");
  const specArt = rel(specPath);
  const specMd = readInput(specPath);
  const lifecycleAttrOf = (e: EntityDecl): AttrDecl | null => {
    const named = e.attrs.find((a) => (a.name === "status" || a.name === "state") && a.allowed !== null);
    if (named) return named;
    const withAllowed = e.attrs.filter((a) => a.allowed !== null);
    return withAllowed.length === 1 ? (withAllowed[0] ?? null) : null;
  };
  if (specMd === null) {
    skipFamily("FD-S1", "absent-input", "functional-spec.md is not present in this unit's functional-design record");
    skipFamily("FD-S2", "absent-input", "functional-spec.md is not present in this unit's functional-design record");
  } else if (entities === null) {
    skipFamily("FD-S1", "absent-input", "entities.md is unavailable — state machines cannot be checked against allowed values");
    skipFamily("FD-S2", "absent-input", "entities.md is unavailable — state machines cannot be checked against allowed values");
  } else {
    const machines = extractMachines(specMd);
    if (machines.length === 0) {
      const lifecycle = entities.entities.filter((e) => lifecycleAttrOf(e) !== null);
      for (const e of lifecycle) {
        skipFamily("FD-S1", "unrecognized-format",
          `no \`### State Machine: ${e.name}\` heading with a stateDiagram fence found for lifecycle entity "${e.name}"`);
        skipFamily("FD-S2", "unrecognized-format",
          `no \`### State Machine: ${e.name}\` heading with a stateDiagram fence found for lifecycle entity "${e.name}"`);
      }
    }
    for (const m of machines) {
      const [entName, attrName] = m.spec.split(".");
      const el = `State Machine: ${m.spec} (fence line ${m.fenceLine})`;
      if (m.unsupported !== null) {
        skipFamily("FD-S1", "unrecognized-format", `${el}: ${m.unsupported}`);
        skipFamily("FD-S2", "unrecognized-format", `${el}: ${m.unsupported}`);
        continue;
      }
      const ent = entities.entities.find((e) => normalizeName(e.name) === normalizeName(entName ?? ""));
      if (!ent) {
        finding("FD-S1", "consistency-mismatch", [safeTarget("entity", entName ?? "")], [ref(specArt, el, entName)],
          `state machine names entity "${entName}" which is not declared in entities.md`);
        continue;
      }
      const attr = attrName !== undefined
        ? (ent.attrs.find((a) => a.name === attrName) ?? null)
        : lifecycleAttrOf(ent);
      if (!attr || attr.allowed === null) {
        skipFamily("FD-S1", "unrecognized-format",
          `${el}: no lifecycle attribute with allowed values could be determined for entity "${ent.name}"`);
        skipFamily("FD-S2", "unrecognized-format",
          `${el}: no lifecycle attribute with allowed values could be determined for entity "${ent.name}"`);
        continue;
      }
      const attrId = safeTarget("attr", `${ent.name}.${attr.name}`);
      const allowedNorm = new Map(attr.allowed.map((v) => [normalizeName(v), v]));
      const stateNorm = new Map(m.states.map((s) => [normalizeName(s), s]));
      const rogue = m.states.filter((s) => !allowedNorm.has(normalizeName(s))).sort();
      if (rogue.length > 0) {
        finding("FD-S1", "consistency-mismatch", [attrId],
          rogue.map((s) => ref(specArt, el, s)),
          `diagram state(s) ${rogue.join(", ")} are not allowed values of ${ent.name}.${attr.name} in entities.md`);
      }
      const dangling = attr.allowed.filter((v) => !stateNorm.has(normalizeName(v))).sort();
      if (dangling.length > 0) {
        finding("FD-S2", "consistency-mismatch", [attrId],
          dangling.map((v) => ref(entitiesArt, attr.element, v)),
          `allowed value(s) ${dangling.join(", ")} of ${ent.name}.${attr.name} appear in no diagram state`);
      }
    }
  }

  // --- XS: domain-design vs functional-design entities ------------------------
  const componentsPath = recordRoot === null ? null : join(recordRoot, "inception", "domain-design", "components.md");
  const componentsMd = componentsPath === null ? null : readIfExists(componentsPath);
  if (componentsMd === null) {
    for (const f of ["XS-1", "XS-2", "XS-3"]) {
      skipFamily(f, "absent-input", "domain-design components.md is not present under this intent record");
    }
  } else {
    inputs.push({ artifact: rel(componentsPath as string), sha256: sha256(componentsMd) });
    const compFence = extractFences(componentsMd, "yaml")[0];
    const compParsed = compFence === undefined ? { error: "no yaml fence" } : parseYamlSubset(compFence.body);
    if (compParsed.error !== undefined) {
      for (const f of ["XS-1", "XS-2", "XS-3"]) {
        skipFamily(f, "unrecognized-format", `components.md yaml block is unusable (${compParsed.error})`);
      }
    } else {
      const domainEntities = extractDomainEntities(compParsed.value ?? null);
      const compArt = rel(componentsPath as string);
      // Collect every unit's declared entities (normalized) from the record.
      const unitEntities = new Map<string, Map<string, { name: string; attrs: string[] }>>();
      const constructionDir = join(recordRoot as string, "construction");
      let unitDirs: string[] = [];
      try {
        unitDirs = readdirSync(constructionDir, { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => e.name)
          .sort();
      } catch {
        unitDirs = [];
      }
      for (const u of unitDirs) {
        const p = join(constructionDir, u, "functional-design", "entities.md");
        const text = readIfExists(p);
        if (text === null) continue;
        if (p !== entitiesPath) inputs.push({ artifact: rel(p), sha256: sha256(text) });
        const fence = extractFences(text, "yaml")[0];
        if (fence === undefined) continue;
        const parsed = parseYamlSubset(fence.body);
        if (parsed.error !== undefined) continue; // its own unit's run reports the parse error
        const model = extractEntities(parsed.value ?? null);
        const map = new Map<string, { name: string; attrs: string[] }>();
        for (const e of model.entities) {
          map.set(normalizeName(e.name), { name: e.name, attrs: e.attrs.map((a) => a.name) });
        }
        unitEntities.set(u, map);
      }
      // Dedupe by normalized name: a doubly-declared domain entity is DD-5's
      // finding; the XS checks look at each distinct entity once.
      const seenDomain = new Set<string>();
      for (const de of [...domainEntities].sort((a, b) => (a.name < b.name ? -1 : 1))) {
        const key = normalizeName(de.name);
        if (seenDomain.has(key)) continue;
        seenDomain.add(key);
        const definers = [...unitEntities.entries()].filter(([, m]) => m.has(key)).map(([u]) => u);
        if (definers.length >= 2) {
          finding("XS-1", "consistency-mismatch", [safeTarget("entity", de.name)],
            [ref(compArt, `entity ${de.name} (component ${de.component})`),
              ...definers.map((u) => ref(`construction/${u}/functional-design/entities.md`, `entity ${de.name}`))],
            `domain entity "${de.name}" is defined in ${definers.length} units (${definers.join(", ")}) — ownership is duplicated`);
        } else if (definers.length === 0 && unitEntities.size > 0) {
          finding("XS-2", "consistency-mismatch", [safeTarget("entity", de.name)],
            [ref(compArt, `entity ${de.name} (component ${de.component})`)],
            `domain entity "${de.name}" is defined in no unit's entities.md — it was dropped on the way to functional design`);
        }
        // XS-3: attribute drift, for THIS unit's definition only.
        if (unit !== undefined) {
          const mine = unitEntities.get(unit)?.get(key);
          if (mine) {
            const mineNorm = new Set(mine.attrs.map(normalizeName));
            const dropped = de.attributes.filter((a) => !mineNorm.has(normalizeName(a))).sort();
            if (dropped.length > 0) {
              finding("XS-3", "consistency-mismatch", [safeTarget("entity", de.name)],
                dropped.map((a) => ref(compArt, `entity ${de.name}.attributes`, a)),
                `domain-design declares attribute(s) ${dropped.join(", ")} on "${de.name}" that this unit's entities.md does not carry`);
            }
          }
        }
      }
      if (unit === undefined) {
        skipFamily("XS-3", "unrecognized-format", "the unit for this functional-design record could not be determined from its path");
      }
    }
  }

  const failedFamilies = new Set(findings.map((f) => f.detail.split(":")[0] ?? ""));
  const skippedFamilies = new Set(skipped.map((s) => (s.target.startsWith("check:") ? s.target.slice(6) : "")));
  const checked = FAMILIES.filter((f) => !failedFamilies.has(f) && !skippedFamilies.has(f)).map((f) => `check:${f}`);

  const result = emitRefcheckDoc(join(fdDir, "deep-spec-refcheck"), {
    backend: BACKEND,
    inputs,
    checked,
    findings,
    skipped,
  }, flags.reportOnly);

  verdictOut(!result.unavailable && result.findingsCount === 0, result.findingsCount, result.skippedCount,
    flags.reportOnly ? "report-only" : undefined);
}

main();
