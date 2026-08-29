// deep-spec-refcheck-domain sensor — deterministic reference/structure checks
// for the domain-design component catalogue (components.md).
//
// Check families (all solver-free, LLM-free — phase 1):
//   DD-0  exactly one fenced yaml block, parseable, with the documented shape
//   DD-1  component names PascalCase and unique
//   DD-2  every referenced component (depends_on / dependents / owned_by) declared
//   DD-3  no component depends on itself
//   DD-4  depends_on / dependents symmetry
//   DD-5  every entity owned by exactly one component, with an identifier
//   DD-6  every references.entity declared under its stated owned_by component
//   DD-7  the depends_on graph is acyclic
//
// These are the seven well-formedness rules the domain-design stage states in
// prose and nothing machine-checks today. Findings land in
// deep-spec-refcheck/components.json next to the artifact (contract 2,
// method: static, self-validated before writing). Families that ran clean are
// listed in checked[] — a clean run is distinguishable from a family that
// never ran (no-silence).
//
// Sensor contract: parses --stage / --output-path (+ --report-only for the
// doctor: compute and report, write nothing); pass-through on writes that are
// not components.md; one JSON verdict line on stdout; always exit 0.

import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  type Finding,
  type InputEntry,
  type Json,
  type RefEntry,
  type Skipped,
  emitRefcheckDoc,
  extractFences,
  findRecordRoot,
  isObject,
  parseFlags,
  parseYamlSubset,
  relArtifact,
  sha256,
  sortedUnique,
  idCompare,
  verdictOut,
} from "./deep-spec-lib.ts";

const BACKEND = "components";
const TARGET_BASENAME = "components.md";
const FAMILIES = ["DD-0", "DD-1", "DD-2", "DD-3", "DD-4", "DD-5", "DD-6", "DD-7"];

interface CompRef {
  component: string;
  element: string;
}

interface CompEntity {
  name: string;
  element: string;
  identifier: string | null;
  references: { entity: string; ownedBy: string; element: string }[];
}

interface Comp {
  name: string;
  element: string;
  dependsOn: CompRef[];
  dependents: CompRef[];
  entities: CompEntity[];
}

function str(v: Json): string | null {
  return typeof v === "string" ? v : null;
}

function extractComponents(value: Json): { comps: Comp[]; shapeErrors: { element: string; detail: string }[] } {
  const shapeErrors: { element: string; detail: string }[] = [];
  const comps: Comp[] = [];
  if (!isObject(value) || !Array.isArray(value.components)) {
    shapeErrors.push({ element: "components", detail: "top-level `components:` list is missing" });
    return { comps, shapeErrors };
  }
  value.components.forEach((raw, i) => {
    const element = `components[${i}]`;
    if (!isObject(raw)) {
      shapeErrors.push({ element, detail: "component entry is not a mapping" });
      return;
    }
    const name = str(raw.name);
    if (name === null) {
      shapeErrors.push({ element: `${element}.name`, detail: "component has no string `name`" });
      return;
    }
    const refs = (key: "depends_on" | "dependents"): CompRef[] => {
      const out: CompRef[] = [];
      if (!Array.isArray(raw[key])) return out;
      (raw[key] as Json[]).forEach((entry, j) => {
        const el = `${element}.${key}[${j}].component`;
        const comp = isObject(entry) ? str(entry.component) : str(entry);
        if (comp !== null) out.push({ component: comp, element: el });
      });
      return out;
    };
    const entities: CompEntity[] = [];
    if (Array.isArray(raw.entities)) {
      (raw.entities as Json[]).forEach((entry, j) => {
        if (!isObject(entry)) return;
        const ename = str(entry.name);
        if (ename === null) return;
        const references: CompEntity["references"] = [];
        if (Array.isArray(entry.references)) {
          (entry.references as Json[]).forEach((ref, k) => {
            if (!isObject(ref)) return;
            const target = str(ref.entity);
            const ownedBy = str(ref.owned_by);
            if (target !== null && ownedBy !== null) {
              references.push({ entity: target, ownedBy, element: `${element}.entities[${j}].references[${k}]` });
            }
          });
        }
        entities.push({
          name: ename,
          element: `${element}.entities[${j}]`,
          identifier: str(entry.identifier),
          references,
        });
      });
    }
    comps.push({ name, element, dependsOn: refs("depends_on"), dependents: refs("dependents"), entities });
  });
  return { comps, shapeErrors };
}

// Deterministic cycle detection over the depends_on graph. Returns each
// distinct cycle once, canonicalized to start at its lexicographically
// smallest member.
function findCycles(comps: Comp[]): string[][] {
  const declared = new Set(comps.map((c) => c.name));
  const adj = new Map<string, string[]>();
  for (const c of [...comps].sort((a, b) => (a.name < b.name ? -1 : 1))) {
    adj.set(
      c.name,
      sortedUnique(
        c.dependsOn.map((d) => d.component).filter((n) => declared.has(n)),
        idCompare,
      ),
    );
  }
  const cycles = new Map<string, string[]>();
  const state = new Map<string, "active" | "done">();
  const stack: string[] = [];
  const visit = (node: string): void => {
    state.set(node, "active");
    stack.push(node);
    for (const next of adj.get(node) ?? []) {
      const s = state.get(next);
      if (s === "done") continue;
      if (s === "active") {
        const from = stack.indexOf(next);
        const cycle = stack.slice(from);
        let minIdx = 0;
        cycle.forEach((n, i) => {
          if (n < (cycle[minIdx] ?? "")) minIdx = i;
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
    if (!state.has(name)) visit(name);
  }
  return [...cycles.keys()].sort().map((k) => cycles.get(k) as string[]);
}

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  if (!flags.outputPath) {
    process.stderr.write("deep-spec-refcheck-domain: --output-path is required\n");
    process.exit(1);
  }
  if (basename(flags.outputPath) !== TARGET_BASENAME) {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "not-applicable" })}\n`);
    process.exit(0);
  }
  let md: string;
  try {
    md = readFileSync(flags.outputPath, "utf-8");
  } catch {
    process.stdout.write(`${JSON.stringify({ pass: true, findings_count: 0, skipped_count: 0, note: "not-applicable" })}\n`);
    process.exit(0);
  }

  const recordRoot = findRecordRoot(dirname(flags.outputPath));
  const artifact = relArtifact(recordRoot, flags.outputPath);
  const inputs: InputEntry[] = [{ artifact, sha256: sha256(md) }];
  const findings: Finding[] = [];
  const skipped: Skipped[] = [];
  const ref = (element: string, value?: string): RefEntry =>
    value === undefined ? { artifact, element } : { artifact, element, value };
  const finding = (family: string, kind: string, targets: string[], refs: RefEntry[], detail: string): void => {
    findings.push({
      kind,
      frRefs: [],
      targets: sortedUnique(targets, idCompare),
      witness: { refs },
      detail: `${family}: ${detail}`,
    });
  };

  // --- DD-0: fence shape --------------------------------------------------
  const fences = extractFences(md, "yaml");
  let comps: Comp[] = [];
  let dd0Failed = false;
  if (fences.length !== 1) {
    finding("DD-0", "structure-invalid", ["check:DD-0"], [ref("yaml fence")],
      `components.md must carry exactly one fenced yaml source-of-truth block (found ${fences.length})`);
    dd0Failed = true;
  } else {
    const parsed = parseYamlSubset(fences[0]?.body ?? "");
    if (parsed.error !== undefined) {
      finding("DD-0", "structure-invalid", ["check:DD-0"], [ref(`yaml fence (line ${fences[0]?.line})`)],
        `yaml block does not parse in the supported subset: ${parsed.error}`);
      dd0Failed = true;
    } else {
      const { comps: extracted, shapeErrors } = extractComponents(parsed.value ?? null);
      comps = extracted;
      for (const e of shapeErrors) {
        finding("DD-0", "structure-invalid", ["check:DD-0"], [ref(e.element)], e.detail);
      }
      if (shapeErrors.length > 0 && comps.length === 0) dd0Failed = true;
    }
  }

  if (dd0Failed) {
    for (const family of FAMILIES.slice(1)) {
      skipped.push({ target: `check:${family}`, reason: "unrecognized-format", detail: "blocked by DD-0: the yaml source-of-truth block is unusable" });
    }
  } else {
    const declared = new Set(comps.map((c) => c.name));

    // --- DD-1: name uniqueness + PascalCase -------------------------------
    const seen = new Map<string, Comp>();
    for (const c of comps) {
      if (!/^[A-Z][A-Za-z0-9]*$/.test(c.name)) {
        finding("DD-1", "structure-invalid", [`component:${c.name}`], [ref(`${c.element}.name`, c.name)],
          `component name "${c.name}" is not PascalCase`);
      }
      const prior = seen.get(c.name);
      if (prior) {
        finding("DD-1", "structure-invalid", [`component:${c.name}`],
          [ref(`${prior.element}.name`, c.name), ref(`${c.element}.name`, c.name)],
          `component name "${c.name}" is declared more than once`);
      }
      seen.set(c.name, c);
    }

    // --- DD-2: referenced components declared -----------------------------
    for (const c of comps) {
      for (const r of [...c.dependsOn, ...c.dependents]) {
        if (!declared.has(r.component)) {
          finding("DD-2", "reference-broken", [`component:${r.component}`], [ref(r.element, r.component)],
            `"${c.name}" references undeclared component "${r.component}"`);
        }
      }
      for (const e of c.entities) {
        for (const r of e.references) {
          if (!declared.has(r.ownedBy)) {
            finding("DD-2", "reference-broken", [`component:${r.ownedBy}`], [ref(`${r.element}.owned_by`, r.ownedBy)],
              `entity "${e.name}" references owner component "${r.ownedBy}" which is not declared`);
          }
        }
      }
    }

    // --- DD-3: no self-dependency ------------------------------------------
    for (const c of comps) {
      for (const r of [...c.dependsOn, ...c.dependents]) {
        if (r.component === c.name) {
          finding("DD-3", "structure-invalid", [`component:${c.name}`], [ref(r.element, c.name)],
            `component "${c.name}" lists itself as a dependency`);
        }
      }
    }

    // --- DD-4: depends_on / dependents symmetry ----------------------------
    const byName = new Map(comps.map((c) => [c.name, c]));
    for (const c of comps) {
      for (const r of c.dependsOn) {
        const other = byName.get(r.component);
        if (!other || r.component === c.name) continue;
        if (!other.dependents.some((d) => d.component === c.name)) {
          finding("DD-4", "structure-invalid", [`component:${c.name}`, `component:${r.component}`],
            [ref(r.element, r.component), ref(`${other.element}.dependents`, c.name)],
            `"${c.name}" depends on "${r.component}" but "${r.component}" does not list "${c.name}" in dependents`);
        }
      }
      for (const r of c.dependents) {
        const other = byName.get(r.component);
        if (!other || r.component === c.name) continue;
        if (!other.dependsOn.some((d) => d.component === c.name)) {
          finding("DD-4", "structure-invalid", [`component:${c.name}`, `component:${r.component}`],
            [ref(r.element, r.component), ref(`${other.element}.depends_on`, c.name)],
            `"${c.name}" lists "${r.component}" as a dependent but "${r.component}" does not depend on "${c.name}"`);
        }
      }
    }

    // --- DD-5: entity single ownership + identifier ------------------------
    const owners = new Map<string, { comp: Comp; entity: CompEntity }[]>();
    for (const c of comps) {
      for (const e of c.entities) {
        const list = owners.get(e.name) ?? [];
        list.push({ comp: c, entity: e });
        owners.set(e.name, list);
        if (e.identifier === null || e.identifier === "") {
          finding("DD-5", "structure-invalid", [`entity:${e.name}`], [ref(`${e.element}.identifier`)],
            `entity "${e.name}" has no identifier`);
        }
      }
    }
    for (const [name, list] of [...owners.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      if (list.length > 1) {
        finding("DD-5", "structure-invalid", [`entity:${name}`],
          list.map((o) => ref(o.entity.element, o.comp.name)),
          `entity "${name}" is owned by ${list.length} components (${list.map((o) => o.comp.name).join(", ")}) — must be exactly one`);
      }
    }

    // --- DD-6: references.entity declared under its owned_by ---------------
    for (const c of comps) {
      for (const e of c.entities) {
        for (const r of e.references) {
          const owner = byName.get(r.ownedBy);
          if (!owner) continue; // DD-2 already reported the undeclared owner
          if (!owner.entities.some((oe) => oe.name === r.entity)) {
            finding("DD-6", "reference-broken", [`entity:${r.entity}`], [ref(`${r.element}.entity`, r.entity)],
              `entity "${e.name}" references "${r.entity}" as owned by "${r.ownedBy}", but "${r.ownedBy}" declares no such entity`);
          }
        }
      }
    }

    // --- DD-7: acyclic depends_on graph -------------------------------------
    // Self-loops are DD-3's finding; DD-7 reports only genuine multi-node cycles.
    for (const cycle of findCycles(comps).filter((c) => c.length > 1)) {
      finding("DD-7", "structure-invalid", cycle.map((n) => `component:${n}`),
        cycle.map((n, i) => ref(`${byName.get(n)?.element ?? "components"}.depends_on`, cycle[(i + 1) % cycle.length])),
        `dependency cycle: ${[...cycle, cycle[0]].join(" -> ")}`);
    }
  }

  const failedFamilies = new Set(findings.map((f) => f.detail.split(":")[0] ?? ""));
  const skippedFamilies = new Set(skipped.map((s) => (s.target.startsWith("check:") ? s.target.slice(6) : "")));
  const checked = FAMILIES.filter((f) => !failedFamilies.has(f) && !skippedFamilies.has(f)).map((f) => `check:${f}`);

  emitRefcheckDoc(join(dirname(flags.outputPath), "deep-spec-refcheck"), {
    backend: BACKEND,
    inputs,
    checked,
    findings,
    skipped,
  }, flags.reportOnly);

  verdictOut(findings.length === 0, findings.length, skipped.length, flags.reportOnly ? "report-only" : undefined);
}

main();
