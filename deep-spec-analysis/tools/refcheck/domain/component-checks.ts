// DD 検査ファミリー（DD-0..DD-7）— 型付き ComponentCatalogOutcome 上の純検査。
// finding/skip の文言・targets・witness refs は旧センサー本体からの逐語移動
//（golden バイト凍結）。形式の解析はアダプタ側パーサの責務。

import { safeTarget } from "../../kernel/domain/index.ts";
import { CheckFamilies, CheckFamily } from "./check-family.ts";
import type { CheckFamilyLedger } from "./check-family-ledger.ts";
import { Components } from "./component-catalog.ts";
import { ComponentName } from "./functional-design-values.ts";
import type { Component, ComponentCatalogOutcome, ComponentEntity } from "./component-catalog.ts";
import type { WitnessRef } from "./witness-ref.ts";

const DD_0 = CheckFamily.reconstitute("DD-0");
const DD_1 = CheckFamily.reconstitute("DD-1");
const DD_2 = CheckFamily.reconstitute("DD-2");
const DD_3 = CheckFamily.reconstitute("DD-3");
const DD_4 = CheckFamily.reconstitute("DD-4");
const DD_5 = CheckFamily.reconstitute("DD-5");
const DD_6 = CheckFamily.reconstitute("DD-6");
const DD_7 = CheckFamily.reconstitute("DD-7");

export const COMPONENT_FAMILIES = CheckFamilies.of([DD_0, DD_1, DD_2, DD_3, DD_4, DD_5, DD_6, DD_7]);

// DD-0 が落ちたとき blocked スキップになる後続ファミリー。
const BLOCKED_BY_DD_0 = [DD_1, DD_2, DD_3, DD_4, DD_5, DD_6, DD_7];

export function runComponentChecks(
  outcome: ComponentCatalogOutcome,
  artifact: string,
  ledger: CheckFamilyLedger,
): void {
  const ref = (element: string, value?: string): WitnessRef =>
    value === undefined ? { artifact, element } : { artifact, element, value };

  // --- DD-0: fence shape --------------------------------------------------
  let comps = Components.of([]);
  let dd0Failed = false;
  if (outcome.kind === "wrong-fence-count") {
    ledger.finding(DD_0, "structure-invalid", [DD_0.asCheckTarget()], [ref("yaml fence")],
      `components.md must carry exactly one fenced yaml source-of-truth block (found ${outcome.found})`);
    dd0Failed = true;
  } else if (outcome.kind === "unparseable") {
    ledger.finding(DD_0, "structure-invalid", [DD_0.asCheckTarget()], [ref(`yaml fence (line ${outcome.line})`)],
      `yaml block does not parse in the supported subset: ${outcome.error}`);
    dd0Failed = true;
  } else {
    comps = outcome.components;
    for (const e of outcome.shapeErrors) {
      ledger.finding(DD_0, "structure-invalid", [DD_0.asCheckTarget()], [ref(e.element.value())], e.detail);
    }
    if (outcome.shapeErrors.count() > 0 && comps.count() === 0) dd0Failed = true;
  }

  if (dd0Failed) {
    for (const family of BLOCKED_BY_DD_0) {
      ledger.skip(family, "unrecognized-format", "blocked by DD-0: the yaml source-of-truth block is unusable");
    }
    return;
  }


  // --- DD-1: name uniqueness + PascalCase -------------------------------
  const seen = new Map<string, Component>();
  for (const c of comps) {
    const cName = c.name.value();
    if (!/^[A-Z][A-Za-z0-9]*$/.test(cName)) {
      ledger.finding(DD_1, "structure-invalid", [safeTarget("component", cName)], [ref(`${c.element.value()}.name`, cName)],
        `component name "${cName}" is not PascalCase`);
    }
    const prior = seen.get(cName);
    if (prior) {
      ledger.finding(DD_1, "structure-invalid", [safeTarget("component", cName)],
        [ref(`${prior.element.value()}.name`, cName), ref(`${c.element.value()}.name`, cName)],
        `component name "${cName}" is declared more than once`);
    }
    seen.set(cName, c);
  }

  // --- DD-2: referenced components declared -----------------------------
  for (const c of comps) {
    for (const r of [...c.dependsOn, ...c.dependents]) {
      if (!comps.declares(r.component)) {
        ledger.finding(DD_2, "reference-broken", [safeTarget("component", r.component.value())], [ref(r.element.value(), r.component.value())],
          `"${c.name.value()}" references undeclared component "${r.component.value()}"`);
      }
    }
    for (const e of c.entities) {
      for (const r of e.references) {
        if (!comps.declares(r.ownedBy)) {
          ledger.finding(DD_2, "reference-broken", [safeTarget("component", r.ownedBy.value())], [ref(`${r.element.value()}.owned_by`, r.ownedBy.value())],
            `entity "${e.name.value()}" references owner component "${r.ownedBy.value()}" which is not declared`);
        }
      }
    }
  }

  // --- DD-3: no self-dependency ------------------------------------------
  for (const c of comps) {
    for (const r of [...c.dependsOn, ...c.dependents]) {
      if (r.component.equals(c.name)) {
        ledger.finding(DD_3, "structure-invalid", [safeTarget("component", c.name.value())], [ref(r.element.value(), c.name.value())],
          `component "${c.name.value()}" lists itself as a dependency`);
      }
    }
  }

  // --- DD-4: depends_on / dependents symmetry ----------------------------
  for (const c of comps) {
    for (const r of c.dependsOn) {
      const other = comps.byName(r.component);
      if (!other || r.component.equals(c.name)) continue;
      if (!other.dependents.listsComponent(c.name)) {
        ledger.finding(DD_4, "structure-invalid", [safeTarget("component", c.name.value()), safeTarget("component", r.component.value())],
          [ref(r.element.value(), r.component.value()), ref(`${other.element.value()}.dependents`, c.name.value())],
          `"${c.name.value()}" depends on "${r.component.value()}" but "${r.component.value()}" does not list "${c.name.value()}" in dependents`);
      }
    }
    for (const r of c.dependents) {
      const other = comps.byName(r.component);
      if (!other || r.component.equals(c.name)) continue;
      if (!other.dependsOn.listsComponent(c.name)) {
        ledger.finding(DD_4, "structure-invalid", [safeTarget("component", c.name.value()), safeTarget("component", r.component.value())],
          [ref(r.element.value(), r.component.value()), ref(`${other.element.value()}.depends_on`, c.name.value())],
          `"${c.name.value()}" lists "${r.component.value()}" as a dependent but "${r.component.value()}" does not depend on "${c.name.value()}"`);
      }
    }
  }

  // --- DD-5: entity single ownership + identifier ------------------------
  const owners = new Map<string, { comp: Component; entity: ComponentEntity }[]>();
  for (const c of comps) {
    for (const e of c.entities) {
      const list = owners.get(e.name.value()) ?? [];
      list.push({ comp: c, entity: e });
      owners.set(e.name.value(), list);
      if (e.identifier === null || e.identifier.value() === "") {
        ledger.finding(DD_5, "structure-invalid", [safeTarget("entity", e.name.value())], [ref(`${e.element.value()}.identifier`)],
          `entity "${e.name.value()}" has no identifier`);
      }
    }
  }
  for (const [name, list] of [...owners.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (list.length > 1) {
      ledger.finding(DD_5, "structure-invalid", [safeTarget("entity", name)],
        list.map((o) => ref(o.entity.element.value(), o.comp.name.value())),
        `entity "${name}" is owned by ${list.length} components (${list.map((o) => o.comp.name.value()).join(", ")}) — must be exactly one`);
    }
  }

  // --- DD-6: references.entity declared under its owned_by ---------------
  for (const c of comps) {
    for (const e of c.entities) {
      for (const r of e.references) {
        const owner = comps.byName(r.ownedBy);
        if (!owner) continue; // DD-2 already reported the undeclared owner
        if (!owner.entities.declaresEntity(r.entity)) {
          ledger.finding(DD_6, "reference-broken", [safeTarget("entity", r.entity.value())], [ref(`${r.element.value()}.entity`, r.entity.value())],
            `entity "${e.name.value()}" references "${r.entity.value()}" as owned by "${r.ownedBy.value()}", but "${r.ownedBy.value()}" declares no such entity`);
        }
      }
    }
  }

  // --- DD-7: acyclic depends_on graph -------------------------------------
  // Self-loops are DD-3's finding; DD-7 reports only genuine multi-node cycles.
  for (const cycle of comps.dependencyCycles().filter((c) => c.length > 1)) {
    ledger.finding(DD_7, "structure-invalid", cycle.map((n) => safeTarget("component", n)),
      cycle.map((n, i) => ref(`${comps.byName(ComponentName.reconstitute(n))?.element.value() ?? "components"}.depends_on`, cycle[(i + 1) % cycle.length])),
      `dependency cycle: ${[...cycle, cycle[0]].join(" -> ")}`);
  }
}
