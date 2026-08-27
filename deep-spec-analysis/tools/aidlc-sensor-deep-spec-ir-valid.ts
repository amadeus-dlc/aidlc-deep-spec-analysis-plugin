// deep-spec-ir-valid sensor — deterministic IR contract check (contract 1).
//
// Validates the formal model artifact (deep-spec-analysis-formal-model.md):
//   1. exactly one ```json fence containing the IR document;
//   2. IR conforms to tools/data/deep-spec-ir-schema.json (subset validator,
//      no external dependencies);
//   3. semantic well-formedness beyond the schema: unique ids, resolvable
//      attribute references, enum literal membership, prime legality;
//   4. every frRefs entry exists verbatim in the upstream requirements.md
//      (reverse traceability).
//
// Sensor contract: parses only --stage / --output-path; pass-through
// (exit 0, pass:true) on writes that are not the formal model; one JSON
// verdict line on stdout; always exit 0 for a real verdict.
//
// Self-contained — no import of the framework's aidlc-lib (a plugin tool
// ships in its own delta and must not depend on a sibling core tool being
// present).

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FORMAL_MODEL_BASENAME = "deep-spec-analysis-formal-model.md";
const IR_MAJOR_SUPPORTED = 1;
const MAX_REPORTED_ERRORS = 25;

// --- flag parsing -----------------------------------------------------------

function parseFlags(argv: string[]): { stage: string; outputPath: string } {
  let stage = "";
  let outputPath = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--stage") stage = argv[i + 1] ?? "";
    if (argv[i] === "--output-path") outputPath = argv[i + 1] ?? "";
  }
  return { stage, outputPath };
}

function verdict(pass: boolean, errors: string[]): never {
  const out = {
    pass,
    findings_count: errors.length,
    errors: errors.slice(0, MAX_REPORTED_ERRORS),
  };
  process.stdout.write(`${JSON.stringify(out)}\n`);
  process.exit(0);
}

// --- fence extraction -------------------------------------------------------

function extractJsonFences(md: string): string[] {
  const fences: string[] = [];
  const lines = md.split("\n");
  let open = false;
  let info = "";
  let buf: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\s*```(.*)$/);
    if (m && !open) {
      open = true;
      info = (m[1] ?? "").trim().toLowerCase();
      buf = [];
      continue;
    }
    if (m && open) {
      if (info === "json" || info.startsWith("json ")) fences.push(buf.join("\n"));
      open = false;
      continue;
    }
    if (open) buf.push(line);
  }
  return fences;
}

// --- minimal JSON Schema (draft-07 subset) validator ------------------------
// Interprets exactly the keywords used by deep-spec-ir-schema.json.

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Schema = { [k: string]: Json };

function isObject(v: Json): v is { [k: string]: Json } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

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

function validateSchema(root: Schema, schema: Schema, value: Json, path: string, errors: string[]): boolean {
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

// --- semantic checks beyond the schema --------------------------------------

type Expr = {
  op: string;
  args?: Expr[];
  path?: string;
  prime?: boolean;
  value?: boolean | number | string;
};

function walkExpr(e: Expr, visit: (node: Expr) => void): void {
  visit(e);
  for (const a of e.args ?? []) walkExpr(a, visit);
}

function semanticErrors(ir: { [k: string]: Json }): string[] {
  const errors: string[] = [];
  const attrTypes = new Map<string, { kind: string; values?: string[] }>();

  const schema = isObject(ir.schema) ? ir.schema : {};
  const entities = Array.isArray(schema.entities) ? schema.entities : [];
  const entityNames = new Set<string>();
  for (const ent of entities) {
    if (!isObject(ent) || typeof ent.name !== "string") continue;
    if (entityNames.has(ent.name)) errors.push(`schema: duplicate entity "${ent.name}"`);
    entityNames.add(ent.name);
    const attrs = Array.isArray(ent.attributes) ? ent.attributes : [];
    const attrNames = new Set<string>();
    for (const attr of attrs) {
      if (!isObject(attr) || typeof attr.name !== "string") continue;
      if (attrNames.has(attr.name)) {
        errors.push(`schema: duplicate attribute "${ent.name}.${attr.name}"`);
      }
      attrNames.add(attr.name);
      const t = isObject(attr.type) ? attr.type : {};
      const kind = typeof t.kind === "string" ? t.kind : "";
      const values = Array.isArray(t.values) ? (t.values.filter((v) => typeof v === "string") as string[]) : undefined;
      if (kind === "int" && typeof t.min === "number" && typeof t.max === "number" && t.min > t.max) {
        errors.push(`schema: ${ent.name}.${attr.name}: min > max`);
      }
      attrTypes.set(`${ent.name}.${attr.name}`, { kind, values });
    }
  }

  const checkExpr = (e: Json, where: string, primesAllowed: boolean): void => {
    if (!isObject(e)) return;
    walkExpr(e as Expr, (node) => {
      if (node.op === "ref" && typeof node.path === "string") {
        if (!attrTypes.has(node.path)) {
          errors.push(`${where}: unresolvable reference "${node.path}"`);
        }
        if (node.prime === true && !primesAllowed) {
          errors.push(`${where}: primed reference "${node.path}" is only legal in event effects and event-scenario expectations`);
        }
      }
      if (node.op === "enum" && typeof node.value === "string") {
        const known = [...attrTypes.values()].some((t) => t.kind === "enum" && t.values?.includes(node.value as string));
        if (!known) {
          errors.push(`${where}: enum literal "${node.value}" is not a value of any declared enum attribute`);
        }
      }
    });
  };

  const seenIds = new Set<string>();
  const dupCheck = (id: string, where: string): void => {
    if (seenIds.has(id)) errors.push(`${where}: duplicate id "${id}"`);
    seenIds.add(id);
  };

  const obligations = Array.isArray(ir.obligations) ? ir.obligations : [];
  for (const ob of obligations) {
    if (!isObject(ob) || typeof ob.id !== "string") continue;
    const where = `obligation ${ob.id}`;
    dupCheck(ob.id, where);
    if (isObject(ob.assert)) checkExpr(ob.assert, where, false);
    if (isObject(ob.guard)) checkExpr(ob.guard, where, false);
    if (isObject(ob.effect)) checkExpr(ob.effect, where, true);
    if (isObject(ob.temporal)) {
      const t = ob.temporal;
      if (isObject(t.assert)) checkExpr(t.assert, where, false);
      if (isObject(t.from)) checkExpr(t.from, where, false);
      if (isObject(t.to)) checkExpr(t.to, where, false);
    }
  }

  const scenarios = Array.isArray(ir.scenarios) ? ir.scenarios : [];
  for (const sc of scenarios) {
    if (!isObject(sc) || typeof sc.id !== "string") continue;
    const where = `scenario ${sc.id}`;
    dupCheck(sc.id, where);
    const bindings = isObject(sc.bindings) ? sc.bindings : {};
    for (const [path, val] of Object.entries(bindings)) {
      const t = attrTypes.get(path);
      if (!t) {
        errors.push(`${where}: binding for unknown attribute "${path}"`);
        continue;
      }
      const ok =
        (t.kind === "bool" && typeof val === "boolean") ||
        (t.kind === "int" && typeof val === "number" && Number.isInteger(val)) ||
        (t.kind === "enum" && typeof val === "string" && (t.values ?? []).includes(val));
      if (!ok) {
        errors.push(`${where}: binding value ${JSON.stringify(val)} does not fit ${t.kind} attribute "${path}"`);
      }
    }
    if (isObject(sc.expect)) checkExpr(sc.expect, where, isObject(sc.event));
  }

  const background = Array.isArray(ir.background) ? ir.background : [];
  for (const bg of background) {
    if (!isObject(bg) || typeof bg.id !== "string") continue;
    dupCheck(bg.id, `background ${bg.id}`);
    if (isObject(bg.assert)) checkExpr(bg.assert, `background ${bg.id}`, false);
  }

  return errors;
}

// --- frRefs reverse traceability (FR5.2) ------------------------------------

function collectFrRefs(ir: { [k: string]: Json }): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (owner: string, refs: Json): void => {
    if (!Array.isArray(refs)) return;
    for (const r of refs) {
      if (typeof r !== "string") continue;
      const owners = out.get(r) ?? [];
      owners.push(owner);
      out.set(r, owners);
    }
  };
  for (const section of ["obligations", "scenarios", "unformalized"] as const) {
    const arr = Array.isArray(ir[section]) ? (ir[section] as Json[]) : [];
    arr.forEach((entry, i) => {
      if (!isObject(entry)) return;
      const owner = typeof entry.id === "string" ? entry.id : `${section}[${i}]`;
      add(owner, entry.frRefs ?? null);
    });
  }
  return out;
}

function findRequirementsFile(outputPath: string): string | null {
  // <record>/<phase>/<stage>/deep-spec-analysis-formal-model.md → <record> is 3 levels up.
  const recordDir = dirname(dirname(dirname(outputPath)));
  const direct = join(recordDir, "inception", "requirements-analysis", "requirements.md");
  if (existsSync(direct)) return direct;
  try {
    for (const phase of readdirSync(recordDir).sort()) {
      const candidate = join(recordDir, phase, "requirements-analysis", "requirements.md");
      if (existsSync(candidate)) return candidate;
    }
  } catch {
    // recordDir unreadable — fall through to null.
  }
  return null;
}

function requirementIds(text: string): Set<string> {
  const ids = new Set<string>();
  for (const m of text.matchAll(/\b(?:FR|NFR)-?[0-9]+(?:\.[0-9]+)*\b/g)) {
    ids.add(m[0]);
  }
  return ids;
}

// --- main -------------------------------------------------------------------

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  if (!flags.outputPath) {
    process.stderr.write("deep-spec-ir-valid: --output-path is required\n");
    process.exit(1);
  }
  if (basename(flags.outputPath) !== FORMAL_MODEL_BASENAME || !existsSync(flags.outputPath)) {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, errors: [], note: "not-applicable" })}\n`);
    process.exit(0);
  }

  const md = readFileSync(flags.outputPath, "utf-8");
  const fences = extractJsonFences(md);
  if (fences.length !== 1) {
    verdict(false, [`formal model must contain exactly one \`\`\`json fence (found ${fences.length})`]);
  }

  let ir: Json;
  try {
    ir = JSON.parse(fences[0] ?? "");
  } catch (err) {
    verdict(false, [`IR fence is not valid JSON: ${err instanceof Error ? err.message : String(err)}`]);
    return;
  }
  if (!isObject(ir)) {
    verdict(false, ["IR fence must contain a JSON object"]);
    return;
  }

  const errors: string[] = [];

  const irVersion = typeof ir.irVersion === "string" ? ir.irVersion : "";
  const major = Number.parseInt(irVersion.split(".")[0] ?? "", 10);
  if (Number.isInteger(major) && major !== IR_MAJOR_SUPPORTED) {
    errors.push(`irVersion ${irVersion}: unsupported major version (this validator supports ${IR_MAJOR_SUPPORTED}.x.x)`);
  }

  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "data", "deep-spec-ir-schema.json");
  if (!existsSync(schemaPath)) {
    verdict(false, [`IR schema not installed at ${schemaPath} — run plugin sync`]);
  }
  let schemaDoc: Schema;
  try {
    schemaDoc = JSON.parse(readFileSync(schemaPath, "utf-8")) as Schema;
  } catch (err) {
    verdict(false, [`IR schema unreadable: ${err instanceof Error ? err.message : String(err)}`]);
    return;
  }
  validateSchema(schemaDoc, schemaDoc, ir, "", errors);

  // Semantic and traceability checks only make sense on a schema-valid IR.
  if (errors.length === 0) {
    errors.push(...semanticErrors(ir));

    const frRefOwners = collectFrRefs(ir);
    const reqPath = findRequirementsFile(flags.outputPath);
    if (reqPath === null) {
      errors.push("requirements.md not found under this intent record — frRefs cannot be reverse-verified");
    } else {
      const known = requirementIds(readFileSync(reqPath, "utf-8"));
      const missing = [...frRefOwners.keys()].filter((id) => !known.has(id)).sort();
      for (const id of missing) {
        const owners = (frRefOwners.get(id) ?? []).sort().join(", ");
        errors.push(`frRef "${id}" (used by ${owners}) does not exist in requirements.md`);
      }
    }
  }

  verdict(errors.length === 0, errors);
}

main();
