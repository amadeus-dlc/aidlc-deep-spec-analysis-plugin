// deep-spec-design-ir-valid sensor — deterministic design-IR contract check
// (contract 3).
//
// Validates the functional formal model
// (deep-spec-analysis-functional-formal-model.md):
//   1. exactly one ```json fence containing the design IR document;
//   2. conformance to tools/data/deep-spec-design-ir-schema.json;
//   3. semantic well-formedness beyond the schema, per unit: unique ids per
//      namespace (DOB/DSC/DBG/SM/TR), resolvable attribute references, enum
//      literal membership, prime legality, machine well-formedness (the
//      lifecycle attribute is a declared enum; initial/from/to are its
//      values; ignores collide with no transition; a transition's effect
//      never assigns the machine's own attribute);
//   4. brRefs reverse-verified against each unit's rules.md, plus the BR
//      coverage rule: every BR{n}.{m} in rules.md is referenced by an
//      obligation/transition/scenario or listed in unformalized[] (the
//      design-level no-silence ledger).
//
// Sensor contract: parses only --stage / --output-path; pass-through on
// writes that are not the functional formal model; one JSON verdict line on
// stdout; always exit 0 for a real verdict.

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findRecordRoot, readIfExists } from "./deep-spec-lib.ts";
import { type Json, isObject, validateSchema } from "./kernel/domain/index.ts";
import { DESIGN_MODEL_BASENAME, extractSingleJsonFence } from "./deep-spec-design-lib.ts";

const IR_MAJOR_SUPPORTED = 1;
const MAX_REPORTED_ERRORS = 25;

interface Expr {
  op: string;
  args?: Expr[];
  path?: string;
  prime?: boolean;
  value?: boolean | number | string;
}

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
  process.stdout.write(`${JSON.stringify({ pass, findings_count: errors.length, errors: errors.slice(0, MAX_REPORTED_ERRORS) })}\n`);
  process.exit(0);
}

function walkExpr(e: Expr, visit: (node: Expr) => void): void {
  visit(e);
  for (const a of e.args ?? []) walkExpr(a, visit);
}

function brIds(text: string): Set<string> {
  const ids = new Set<string>();
  for (const m of text.matchAll(/\bBR[0-9]+\.[0-9]+\b/g)) ids.add(m[0]);
  return ids;
}

function semanticErrors(units: Json[], outputPath: string): string[] {
  const errors: string[] = [];
  const recordRoot = findRecordRoot(dirname(outputPath));
  const unitNames = new Set<string>();

  for (const rawUnit of units) {
    if (!isObject(rawUnit) || typeof rawUnit.unit !== "string") continue;
    const unitName = rawUnit.unit;
    const where = (s: string): string => `unit ${unitName}: ${s}`;
    if (unitNames.has(unitName)) errors.push(`duplicate unit "${unitName}"`);
    unitNames.add(unitName);

    // Attribute catalogue for reference/enum checks.
    const attrTypes = new Map<string, { kind: string; values?: string[] }>();
    const schema = isObject(rawUnit.schema) ? rawUnit.schema : {};
    for (const ent of Array.isArray(schema.entities) ? schema.entities : []) {
      if (!isObject(ent) || typeof ent.name !== "string") continue;
      const attrNames = new Set<string>();
      for (const attr of Array.isArray(ent.attributes) ? ent.attributes : []) {
        if (!isObject(attr) || typeof attr.name !== "string") continue;
        if (attrNames.has(attr.name)) errors.push(where(`duplicate attribute "${ent.name}.${attr.name}"`));
        attrNames.add(attr.name);
        const t = isObject(attr.type) ? attr.type : {};
        const kind = typeof t.kind === "string" ? t.kind : "";
        const values = Array.isArray(t.values) ? (t.values.filter((v) => typeof v === "string") as string[]) : undefined;
        if (kind === "int" && (typeof t.min !== "number" || typeof t.max !== "number")) {
          errors.push(where(`${ent.name}.${attr.name}: int attributes require min and max — the Quint backend needs bounded domains`));
        }
        if (kind === "int" && typeof t.min === "number" && typeof t.max === "number" && t.min > t.max) {
          errors.push(where(`${ent.name}.${attr.name}: min > max`));
        }
        attrTypes.set(`${ent.name}.${attr.name}`, { kind, values });
      }
    }
    const checkExpr = (e: Json, ctx: string, primesAllowed: boolean): void => {
      if (!isObject(e)) return;
      // An enum literal in a binary comparison binds to its sibling ref: the
      // value must belong to THAT attribute, not to any enum somewhere in the
      // unit (a "closed" literal on ticket.channel must not legalize
      // "closed" against ticket.status).
      const boundEnum = new Map<Expr, string>();
      walkExpr(e as unknown as Expr, (node) => {
        const args = node.args ?? [];
        if (args.length === 2) {
          const ref = args.find((a) => a.op === "ref" && typeof a.path === "string");
          const en = args.find((a) => a.op === "enum");
          if (ref && en) boundEnum.set(en, ref.path as string);
        }
      });
      walkExpr(e as unknown as Expr, (node) => {
        if (node.op === "ref" && typeof node.path === "string") {
          if (!attrTypes.has(node.path)) errors.push(where(`${ctx}: unresolvable reference "${node.path}"`));
          if (node.prime === true && !primesAllowed) {
            errors.push(where(`${ctx}: primed reference "${node.path}" is only legal in effects and event-scenario expectations`));
          }
        }
        if (node.op === "enum" && typeof node.value === "string") {
          const sibling = boundEnum.get(node);
          const siblingType = sibling === undefined ? undefined : attrTypes.get(sibling);
          if (siblingType !== undefined) {
            if (siblingType.kind !== "enum") {
              errors.push(where(`${ctx}: enum literal "${node.value}" is compared against non-enum attribute "${sibling}"`));
            } else if (!(siblingType.values ?? []).includes(node.value)) {
              errors.push(where(`${ctx}: enum literal "${node.value}" is not a value of "${sibling}"`));
            }
          } else if (sibling === undefined) {
            const known = [...attrTypes.values()].some((t) => t.kind === "enum" && t.values?.includes(node.value as string));
            if (!known) errors.push(where(`${ctx}: enum literal "${node.value}" is not a value of any declared enum attribute`));
          }
          // An unresolvable sibling ref is already reported by the ref check.
        }
      });
    };

    const seenIds = new Set<string>();
    const dup = (id: string, ctx: string): void => {
      if (seenIds.has(id)) errors.push(where(`${ctx}: duplicate id "${id}"`));
      seenIds.add(id);
    };
    const brRefsUsed = new Set<string>();
    const collectBr = (v: Json): void => {
      if (!Array.isArray(v)) return;
      for (const b of v) if (typeof b === "string") brRefsUsed.add(b);
    };

    for (const ob of Array.isArray(rawUnit.obligations) ? rawUnit.obligations : []) {
      if (!isObject(ob) || typeof ob.id !== "string") continue;
      const ctx = `obligation ${ob.id}`;
      dup(ob.id, ctx);
      collectBr(ob.brRefs ?? null);
      if (ob.origin === "rules" && !Array.isArray(ob.brRefs)) {
        errors.push(where(`${ctx}: origin "rules" requires brRefs`));
      }
      if (isObject(ob.assert)) checkExpr(ob.assert, ctx, false);
      if (isObject(ob.guard)) checkExpr(ob.guard, ctx, false);
      if (isObject(ob.effect)) checkExpr(ob.effect, ctx, true);
      if (isObject(ob.temporal)) {
        const t = ob.temporal;
        if (isObject(t.assert)) checkExpr(t.assert, ctx, false);
        if (isObject(t.from)) checkExpr(t.from, ctx, false);
        if (isObject(t.to)) checkExpr(t.to, ctx, false);
      }
    }

    for (const sm of Array.isArray(rawUnit.stateMachines) ? rawUnit.stateMachines : []) {
      if (!isObject(sm) || typeof sm.id !== "string") continue;
      const ctx = `machine ${sm.id}`;
      dup(sm.id, ctx);
      const attrPath = `${typeof sm.entity === "string" ? sm.entity : "?"}.${typeof sm.attribute === "string" ? sm.attribute : "?"}`;
      const attr = attrTypes.get(attrPath);
      if (!attr) {
        errors.push(where(`${ctx}: lifecycle attribute "${attrPath}" is not declared`));
        continue;
      }
      if (attr.kind !== "enum" || !attr.values) {
        errors.push(where(`${ctx}: lifecycle attribute "${attrPath}" is not an enum — its values are the state set`));
        continue;
      }
      const states = new Set(attr.values);
      for (const s of Array.isArray(sm.initial) ? sm.initial : []) {
        if (typeof s === "string" && !states.has(s)) {
          errors.push(where(`${ctx}: initial state "${s}" is not a value of ${attrPath}`));
        }
      }
      const transitionCells = new Set<string>();
      for (const tr of Array.isArray(sm.transitions) ? sm.transitions : []) {
        if (!isObject(tr) || typeof tr.id !== "string") continue;
        const tctx = `transition ${tr.id}`;
        dup(tr.id, tctx);
        collectBr(tr.brRefs ?? null);
        for (const [k, v] of [["from", tr.from], ["to", tr.to]] as const) {
          if (typeof v === "string" && !states.has(v)) {
            errors.push(where(`${tctx}: ${k} state "${v}" is not a value of ${attrPath}`));
          }
        }
        if (typeof tr.from === "string" && typeof tr.trigger === "string") {
          transitionCells.add(`${tr.from}|${tr.trigger}`);
        }
        if (isObject(tr.guard)) checkExpr(tr.guard, tctx, false);
        if (isObject(tr.effect)) {
          checkExpr(tr.effect, tctx, true);
          walkExpr(tr.effect as unknown as Expr, (node) => {
            if (node.op === "ref" && node.prime === true && node.path === attrPath) {
              errors.push(where(`${tctx}: the effect assigns the machine's own attribute "${attrPath}" — state' = to is implicit`));
            }
          });
        }
      }
      for (const ig of Array.isArray(sm.ignores) ? sm.ignores : []) {
        if (!isObject(ig) || typeof ig.state !== "string" || typeof ig.trigger !== "string") continue;
        if (!states.has(ig.state)) {
          errors.push(where(`${ctx}: ignores state "${ig.state}" is not a value of ${attrPath}`));
        }
        if (transitionCells.has(`${ig.state}|${ig.trigger}`)) {
          errors.push(where(`${ctx}: ignores (${ig.state}, ${ig.trigger}) collides with a declared transition for the same (state, trigger)`));
        }
      }
    }

    for (const sc of Array.isArray(rawUnit.scenarios) ? rawUnit.scenarios : []) {
      if (!isObject(sc) || typeof sc.id !== "string") continue;
      const ctx = `scenario ${sc.id}`;
      dup(sc.id, ctx);
      collectBr(sc.brRefs ?? null);
      const bindings = isObject(sc.bindings) ? sc.bindings : {};
      for (const [path, val] of Object.entries(bindings)) {
        const t = attrTypes.get(path);
        if (!t) {
          errors.push(where(`${ctx}: binding for unknown attribute "${path}"`));
          continue;
        }
        const ok =
          (t.kind === "bool" && typeof val === "boolean") ||
          (t.kind === "int" && typeof val === "number" && Number.isInteger(val)) ||
          (t.kind === "enum" && typeof val === "string" && (t.values ?? []).includes(val));
        if (!ok) errors.push(where(`${ctx}: binding value ${JSON.stringify(val)} does not fit ${t.kind} attribute "${path}"`));
      }
      if (isObject(sc.expect)) checkExpr(sc.expect, ctx, isObject(sc.event));
    }

    for (const bg of Array.isArray(rawUnit.background) ? rawUnit.background : []) {
      if (!isObject(bg) || typeof bg.id !== "string") continue;
      dup(bg.id, `background ${bg.id}`);
      if (isObject(bg.assert)) checkExpr(bg.assert, `background ${bg.id}`, false);
    }

    // brRefs reverse-verification + BR coverage against this unit's rules.md.
    // A unit name that matches no construction directory is an error even
    // with zero brRefs: a typo would otherwise erase the whole BR coverage
    // check silently ("Silence is a contract violation").
    if (recordRoot !== null && !existsSync(join(recordRoot, "construction", unitName))) {
      errors.push(where(`no construction/${unitName}/ directory exists under this record — the unit name matches no unit-of-work, so BR coverage cannot be verified`));
    }
    const rulesPath = recordRoot === null ? null : join(recordRoot, "construction", unitName, "functional-design", "rules.md");
    const rulesMd = rulesPath === null ? null : readIfExists(rulesPath);
    if (rulesMd === null) {
      if (brRefsUsed.size > 0) {
        errors.push(where(`brRefs are used but construction/${unitName}/functional-design/rules.md was not found — they cannot be reverse-verified`));
      }
    } else {
      const known = brIds(rulesMd);
      for (const br of [...brRefsUsed].sort()) {
        if (!known.has(br)) errors.push(where(`brRef "${br}" does not exist in rules.md`));
      }
      const unformalizedTargets = new Set<string>();
      for (const uf of Array.isArray(rawUnit.unformalized) ? rawUnit.unformalized : []) {
        if (!isObject(uf)) continue;
        for (const t of Array.isArray(uf.targets) ? uf.targets : []) {
          if (typeof t === "string") unformalizedTargets.add(t);
        }
      }
      for (const br of [...known].sort()) {
        if (!brRefsUsed.has(br) && !unformalizedTargets.has(br)) {
          errors.push(where(`BR coverage: rule ${br} in rules.md is neither referenced by any obligation/transition/scenario nor listed in unformalized[] — silence is a contract violation`));
        }
      }
    }
  }
  return errors;
}

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  if (!flags.outputPath) {
    process.stderr.write("deep-spec-design-ir-valid: --output-path is required\n");
    process.exit(1);
  }
  if (basename(flags.outputPath) !== DESIGN_MODEL_BASENAME || !existsSync(flags.outputPath)) {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, errors: [], note: "not-applicable" })}\n`);
    process.exit(0);
  }
  const md = readFileSync(flags.outputPath, "utf-8");
  const fence = extractSingleJsonFence(md);
  if (fence === null) {
    verdict(false, ["formal model must contain exactly one ```json fence"]);
  }
  let ir: Json;
  try {
    ir = JSON.parse(fence as string) as Json;
  } catch (err) {
    verdict(false, [`design IR fence is not valid JSON: ${err instanceof Error ? err.message : String(err)}`]);
    return;
  }
  if (!isObject(ir)) {
    verdict(false, ["design IR fence must contain a JSON object"]);
    return;
  }

  const errors: string[] = [];
  const irVersion = typeof ir.irVersion === "string" ? ir.irVersion : "";
  const major = Number.parseInt(irVersion.split(".")[0] ?? "", 10);
  if (Number.isInteger(major) && major !== IR_MAJOR_SUPPORTED) {
    errors.push(`irVersion ${irVersion}: unsupported major version (this validator supports ${IR_MAJOR_SUPPORTED}.x.x)`);
  }

  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "data", "deep-spec-design-ir-schema.json");
  if (!existsSync(schemaPath)) {
    verdict(false, [`design IR schema not installed at ${schemaPath} — run plugin sync`]);
  }
  let schemaDoc: Json;
  try {
    schemaDoc = JSON.parse(readFileSync(schemaPath, "utf-8")) as Json;
  } catch (err) {
    verdict(false, [`design IR schema unreadable: ${err instanceof Error ? err.message : String(err)}`]);
    return;
  }
  validateSchema(schemaDoc as never, schemaDoc as never, ir as never, "", errors);

  if (errors.length === 0) {
    errors.push(...semanticErrors(Array.isArray(ir.units) ? ir.units : [], flags.outputPath));
  }
  verdict(errors.length === 0, errors);
}

main();
