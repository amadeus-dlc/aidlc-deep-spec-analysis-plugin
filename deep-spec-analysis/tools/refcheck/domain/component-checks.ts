// DD 検査ファミリー（DD-0..DD-7）— 型付き ComponentCatalogOutcome 上の純検査。
// finding/skip の文言・targets・witness refs は旧センサー本体からの逐語移動
//（golden バイト凍結）。形式の解析はアダプタ側パーサの責務。

import { idCompare, safeTarget, sortedUnique } from "../../kernel/domain/index.ts";
import type { CheckFamilyLedger } from "./check-family-ledger.ts";
import type { Component, ComponentCatalogOutcome, ComponentEntity } from "./component-catalog.ts";
import type { RefEntry } from "./ref-entry.ts";

export const COMPONENT_FAMILIES = ["DD-0", "DD-1", "DD-2", "DD-3", "DD-4", "DD-5", "DD-6", "DD-7"];

// Deterministic cycle detection over the depends_on graph. Returns each
// distinct cycle once, canonicalized to start at its lexicographically
// smallest member.
function findCycles(comps: Component[]): string[][] {
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

export function runComponentChecks(
  outcome: ComponentCatalogOutcome,
  artifact: string,
  ledger: CheckFamilyLedger,
): void {
  const ref = (element: string, value?: string): RefEntry =>
    value === undefined ? { artifact, element } : { artifact, element, value };

  // --- DD-0: fence shape --------------------------------------------------
  let comps: Component[] = [];
  let dd0Failed = false;
  if (outcome.kind === "wrong-fence-count") {
    ledger.finding("DD-0", "structure-invalid", ["check:DD-0"], [ref("yaml fence")],
      `components.md must carry exactly one fenced yaml source-of-truth block (found ${outcome.found})`);
    dd0Failed = true;
  } else if (outcome.kind === "unparseable") {
    ledger.finding("DD-0", "structure-invalid", ["check:DD-0"], [ref(`yaml fence (line ${outcome.line})`)],
      `yaml block does not parse in the supported subset: ${outcome.error}`);
    dd0Failed = true;
  } else {
    comps = outcome.components;
    for (const e of outcome.shapeErrors) {
      ledger.finding("DD-0", "structure-invalid", ["check:DD-0"], [ref(e.element)], e.detail);
    }
    if (outcome.shapeErrors.length > 0 && comps.length === 0) dd0Failed = true;
  }

  if (dd0Failed) {
    for (const family of COMPONENT_FAMILIES.slice(1)) {
      ledger.skip(family, "unrecognized-format", "blocked by DD-0: the yaml source-of-truth block is unusable");
    }
    return;
  }

  const declared = new Set(comps.map((c) => c.name));

  // --- DD-1: name uniqueness + PascalCase -------------------------------
  const seen = new Map<string, Component>();
  for (const c of comps) {
    if (!/^[A-Z][A-Za-z0-9]*$/.test(c.name)) {
      ledger.finding("DD-1", "structure-invalid", [safeTarget("component", c.name)], [ref(`${c.element}.name`, c.name)],
        `component name "${c.name}" is not PascalCase`);
    }
    const prior = seen.get(c.name);
    if (prior) {
      ledger.finding("DD-1", "structure-invalid", [safeTarget("component", c.name)],
        [ref(`${prior.element}.name`, c.name), ref(`${c.element}.name`, c.name)],
        `component name "${c.name}" is declared more than once`);
    }
    seen.set(c.name, c);
  }

  // --- DD-2: referenced components declared -----------------------------
  for (const c of comps) {
    for (const r of [...c.dependsOn, ...c.dependents]) {
      if (!declared.has(r.component)) {
        ledger.finding("DD-2", "reference-broken", [safeTarget("component", r.component)], [ref(r.element, r.component)],
          `"${c.name}" references undeclared component "${r.component}"`);
      }
    }
    for (const e of c.entities) {
      for (const r of e.references) {
        if (!declared.has(r.ownedBy)) {
          ledger.finding("DD-2", "reference-broken", [safeTarget("component", r.ownedBy)], [ref(`${r.element}.owned_by`, r.ownedBy)],
            `entity "${e.name}" references owner component "${r.ownedBy}" which is not declared`);
        }
      }
    }
  }

  // --- DD-3: no self-dependency ------------------------------------------
  for (const c of comps) {
    for (const r of [...c.dependsOn, ...c.dependents]) {
      if (r.component === c.name) {
        ledger.finding("DD-3", "structure-invalid", [safeTarget("component", c.name)], [ref(r.element, c.name)],
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
        ledger.finding("DD-4", "structure-invalid", [safeTarget("component", c.name), safeTarget("component", r.component)],
          [ref(r.element, r.component), ref(`${other.element}.dependents`, c.name)],
          `"${c.name}" depends on "${r.component}" but "${r.component}" does not list "${c.name}" in dependents`);
      }
    }
    for (const r of c.dependents) {
      const other = byName.get(r.component);
      if (!other || r.component === c.name) continue;
      if (!other.dependsOn.some((d) => d.component === c.name)) {
        ledger.finding("DD-4", "structure-invalid", [safeTarget("component", c.name), safeTarget("component", r.component)],
          [ref(r.element, r.component), ref(`${other.element}.depends_on`, c.name)],
          `"${c.name}" lists "${r.component}" as a dependent but "${r.component}" does not depend on "${c.name}"`);
      }
    }
  }

  // --- DD-5: entity single ownership + identifier ------------------------
  const owners = new Map<string, { comp: Component; entity: ComponentEntity }[]>();
  for (const c of comps) {
    for (const e of c.entities) {
      const list = owners.get(e.name) ?? [];
      list.push({ comp: c, entity: e });
      owners.set(e.name, list);
      if (e.identifier === null || e.identifier === "") {
        ledger.finding("DD-5", "structure-invalid", [safeTarget("entity", e.name)], [ref(`${e.element}.identifier`)],
          `entity "${e.name}" has no identifier`);
      }
    }
  }
  for (const [name, list] of [...owners.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (list.length > 1) {
      ledger.finding("DD-5", "structure-invalid", [safeTarget("entity", name)],
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
          ledger.finding("DD-6", "reference-broken", [safeTarget("entity", r.entity)], [ref(`${r.element}.entity`, r.entity)],
            `entity "${e.name}" references "${r.entity}" as owned by "${r.ownedBy}", but "${r.ownedBy}" declares no such entity`);
        }
      }
    }
  }

  // --- DD-7: acyclic depends_on graph -------------------------------------
  // Self-loops are DD-3's finding; DD-7 reports only genuine multi-node cycles.
  for (const cycle of findCycles(comps).filter((c) => c.length > 1)) {
    ledger.finding("DD-7", "structure-invalid", cycle.map((n) => safeTarget("component", n)),
      cycle.map((n, i) => ref(`${byName.get(n)?.element ?? "components"}.depends_on`, cycle[(i + 1) % cycle.length])),
      `dependency cycle: ${[...cycle, cycle[0]].join(" -> ")}`);
  }
}
