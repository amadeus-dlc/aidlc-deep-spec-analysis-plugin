// DD 検査ファミリー（DD-0..DD-7）— 型付き ComponentCatalogOutcome 上の純検査。
// finding/skip の文言・targets・witness refs は旧センサー本体からの逐語移動
//（golden バイト凍結）。形式の解析はアダプタ側パーサの責務。

import { TargetIds } from "../../kernel/domain/index.ts";
import { CheckFamily } from "./check-family.ts";
import { CheckFamilies } from "./check-families.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import { Components } from "./components.ts";
import { ComponentName } from "./component-name.ts";
import { type ComponentCatalogOutcome } from "./component-catalog-outcome.ts";
import { WitnessRef } from "./witness-ref.ts";
import type { ArtifactPath } from "../../kernel/domain/index.ts";

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

function runComponentChecksImpl(
  outcome: ComponentCatalogOutcome,
  artifact: string,
  report: ReferenceCheckReport,
): void {
  const ref = (element: string, value?: string): WitnessRef =>
    WitnessRef.reconstitute(value === undefined ? { artifact, element } : { artifact, element, value });

  // --- DD-0: fence shape --------------------------------------------------
  const dd0 = outcome.match<{ comps: Components; failed: boolean }>({
    wrongFenceCount: (found) => {
      report.finding(DD_0, "structure-invalid", [DD_0.asCheckTarget()], [ref("yaml fence")],
        `components.md must carry exactly one fenced yaml source-of-truth block (found ${found})`);
      return { comps: Components.of([]), failed: true };
    },
    unparseable: (line, error) => {
      report.finding(DD_0, "structure-invalid", [DD_0.asCheckTarget()], [ref(`yaml fence (line ${line.asNumber()})`)],
        `yaml block does not parse in the supported subset: ${error}`);
      return { comps: Components.of([]), failed: true };
    },
    extracted: (components, shapeErrors) => {
      for (const e of shapeErrors) {
        report.finding(DD_0, "structure-invalid", [DD_0.asCheckTarget()], [ref(e.element().asString())], e.detail());
      }
      return { comps: components, failed: shapeErrors.count() > 0 && components.count() === 0 };
    },
  });
  const comps = dd0.comps;
  const dd0Failed = dd0.failed;

  if (dd0Failed) {
    for (const family of BLOCKED_BY_DD_0) {
      report.skip(family, "unrecognized-format", "blocked by DD-0: the yaml source-of-truth block is unusable");
    }
    return;
  }


  // --- DD-1: name uniqueness + PascalCase -------------------------------
  for (const c of comps) {
    if (!c.nameIsPascalCase()) {
      const cName = c.name().asString();
      report.finding(DD_1, "structure-invalid", [TargetIds.safe("component", cName)], [ref(`${c.element().asString()}.name`, cName)],
        `component name "${cName}" is not PascalCase`);
    }
  }
  for (const { prior, current } of comps.duplicateNamePairs()) {
    const cName = current.name().asString();
    report.finding(DD_1, "structure-invalid", [TargetIds.safe("component", cName)],
      [ref(`${prior.element().asString()}.name`, cName), ref(`${current.element().asString()}.name`, cName)],
      `component name "${cName}" is declared more than once`);
  }

  // --- DD-2: referenced components declared -----------------------------
  for (const c of comps) {
    for (const r of [...c.dependsOn(), ...c.dependents()]) {
      if (!comps.declares(r.component())) {
        report.finding(DD_2, "reference-broken", [TargetIds.safe("component", r.component().asString())], [ref(r.element().asString(), r.component().asString())],
          `"${c.name().asString()}" references undeclared component "${r.component().asString()}"`);
      }
    }
    for (const e of c.entities()) {
      for (const r of e.references()) {
        if (!comps.declares(r.ownedBy())) {
          report.finding(DD_2, "reference-broken", [TargetIds.safe("component", r.ownedBy().asString())], [ref(`${r.element().asString()}.owned_by`, r.ownedBy().asString())],
            `entity "${e.name().asString()}" references owner component "${r.ownedBy().asString()}" which is not declared`);
        }
      }
    }
  }

  // --- DD-3: no self-dependency ------------------------------------------
  for (const c of comps) {
    for (const r of c.selfReferences()) {
      report.finding(DD_3, "structure-invalid", [TargetIds.safe("component", c.name().asString())], [ref(r.element().asString(), c.name().asString())],
        `component "${c.name().asString()}" lists itself as a dependency`);
    }
  }

  // --- DD-4: depends_on / dependents symmetry ----------------------------
  for (const c of comps) {
    for (const r of c.dependsOn()) {
      const other = comps.byName(r.component());
      if (!other || r.pointsAt(c.name())) continue;
      if (!other.dependents().listsComponent(c.name())) {
        report.finding(DD_4, "structure-invalid", [TargetIds.safe("component", c.name().asString()), TargetIds.safe("component", r.component().asString())],
          [ref(r.element().asString(), r.component().asString()), ref(`${other.element().asString()}.dependents`, c.name().asString())],
          `"${c.name().asString()}" depends on "${r.component().asString()}" but "${r.component().asString()}" does not list "${c.name().asString()}" in dependents`);
      }
    }
    for (const r of c.dependents()) {
      const other = comps.byName(r.component());
      if (!other || r.pointsAt(c.name())) continue;
      if (!other.dependsOn().listsComponent(c.name())) {
        report.finding(DD_4, "structure-invalid", [TargetIds.safe("component", c.name().asString()), TargetIds.safe("component", r.component().asString())],
          [ref(r.element().asString(), r.component().asString()), ref(`${other.element().asString()}.depends_on`, c.name().asString())],
          `"${c.name().asString()}" lists "${r.component().asString()}" as a dependent but "${r.component().asString()}" does not depend on "${c.name().asString()}"`);
      }
    }
  }

  // --- DD-5: entity single ownership + identifier ------------------------
  for (const c of comps) {
    for (const e of c.entities()) {
      if (!e.hasIdentifier()) {
        report.finding(DD_5, "structure-invalid", [TargetIds.safe("entity", e.name().asString())], [ref(`${e.element().asString()}.identifier`)],
          `entity "${e.name().asString()}" has no identifier`);
      }
    }
  }
  for (const conflict of comps.ownershipConflicts()) {
    const name = conflict.name.asString();
    report.finding(DD_5, "structure-invalid", [TargetIds.safe("entity", name)],
      conflict.owners.map((o) => ref(o.entity.element().asString(), o.component.name().asString())),
      `entity "${name}" is owned by ${conflict.owners.length} components (${conflict.owners.map((o) => o.component.name().asString()).join(", ")}) — must be exactly one`);
  }

  // --- DD-6: references.entity declared under its owned_by ---------------
  for (const c of comps) {
    for (const e of c.entities()) {
      for (const r of e.references()) {
        const owner = comps.byName(r.ownedBy());
        if (!owner) continue; // DD-2 already reported the undeclared owner
        if (!owner.entities().declaresEntity(r.entity())) {
          report.finding(DD_6, "reference-broken", [TargetIds.safe("entity", r.entity().asString())], [ref(`${r.element().asString()}.entity`, r.entity().asString())],
            `entity "${e.name().asString()}" references "${r.entity().asString()}" as owned by "${r.ownedBy().asString()}", but "${r.ownedBy().asString()}" declares no such entity`);
        }
      }
    }
  }

  // --- DD-7: acyclic depends_on graph -------------------------------------
  // Self-loops are DD-3's finding; DD-7 reports only genuine multi-node cycles.
  for (const cycle of comps.dependencyCycles().filter((c) => c.length > 1)) {
    report.finding(DD_7, "structure-invalid", cycle.map((n) => TargetIds.safe("component", n)),
      cycle.map((n, i) => ref(`${comps.byName(ComponentName.reconstitute(n))?.element().asString() ?? "components"}.depends_on`, cycle[(i + 1) % cycle.length])),
      `dependency cycle: ${[...cycle, cycle[0]].join(" -> ")}`);
  }
}


export class ComponentCheckMaterials {
  readonly #seed: {
  readonly outcome: ComponentCatalogOutcome;
  readonly artifact: ArtifactPath;
  };

  private constructor(seed: {
    readonly outcome: ComponentCatalogOutcome;
    readonly artifact: ArtifactPath;
  }) {
    this.#seed = seed;
  }

  static of(seed: {
    readonly outcome: ComponentCatalogOutcome;
    readonly artifact: ArtifactPath;
  }): ComponentCheckMaterials {
    return new ComponentCheckMaterials(seed);
  }

  runChecks(report: ReferenceCheckReport): void {
    runComponentChecksImpl(this.#seed.outcome, this.#seed.artifact.asString(), report);
  }
}
