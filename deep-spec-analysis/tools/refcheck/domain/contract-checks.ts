// CD 検査ファミリー（CD-1..CD-3）— 型付き入力上の純検査。
// finding/skip の文言・targets・witness refs は旧センサー本体からの逐語移動。

import { safeTarget } from "../../kernel/domain/index.ts";
import type { CheckFamilyLedger } from "./check-family-ledger.ts";
import type {
  ContractRow,
  ContractsTableOutcome,
  DeclaredUnitsOutcome,
  SpecBlockAssessment,
  UnitDecl,
} from "./contract-summary.ts";
import type { WitnessRef } from "./witness-ref.ts";

export const CONTRACT_FAMILIES = ["CD-1", "CD-2", "CD-3"];

export interface ContractCheckMaterials {
  readonly artifact: string;
  readonly depArtifact: string;
  readonly declaredUnits: DeclaredUnitsOutcome;
  readonly contractsTable: ContractsTableOutcome;
  readonly specBlocks: readonly SpecBlockAssessment[];
}

export function runContractChecks(input: ContractCheckMaterials, ledger: CheckFamilyLedger): void {
  const { artifact, depArtifact } = input;
  const ref = (art: string, element: string, value?: string): WitnessRef =>
    value === undefined ? { artifact: art, element } : { artifact: art, element, value };

  // --- declared units (unit-of-work-dependency.md edge block) --------------
  let units: UnitDecl[] | null = null;
  if (input.declaredUnits.kind === "absent") {
    ledger.skip("CD-1", "absent-input", "unit-of-work-dependency.md is not present under this intent record — declared units are unknown");
    ledger.skip("CD-3", "absent-input", "unit-of-work-dependency.md is not present under this intent record — the unit dependency DAG is unknown");
  } else if (input.declaredUnits.kind === "unrecognized") {
    ledger.skip("CD-1", "unrecognized-format", `unit-of-work-dependency.md carries no parseable \`units:\` edge block${input.declaredUnits.error ? ` (${input.declaredUnits.error})` : ""}`);
    ledger.skip("CD-3", "unrecognized-format", "blocked: the units edge block is unusable");
  } else {
    units = input.declaredUnits.units;
  }

  // --- CD-1: contracts table -------------------------------------------------
  let rows: ContractRow[] = [];
  if (input.contractsTable.kind === "absent") {
    if (units !== null) ledger.skip("CD-1", "unrecognized-format", "no markdown table with a Provider column found");
    ledger.skip("CD-3", "unrecognized-format", "no contracts table — DAG edge coverage cannot be checked");
  } else {
    rows = [...input.contractsTable.rows];
    if (units !== null) {
      const declared = new Set(units.map((u) => u.name));
      for (const row of rows) {
        const el = `contracts table row ${row.id} (line ${row.line})`;
        if (row.provider !== "" && !declared.has(row.provider)) {
          ledger.finding("CD-1", "reference-broken", [`contract:${row.id}`, safeTarget("unit", row.provider)],
            [ref(artifact, el, row.provider), ref(depArtifact, "units")],
            `Provider Unit "${row.provider}" is not a declared unit`);
        }
        if (row.consumer !== "" && !declared.has(row.consumer) && !/^external\b/i.test(row.consumer)) {
          ledger.finding("CD-1", "reference-broken", [`contract:${row.id}`, safeTarget("unit", row.consumer)],
            [ref(artifact, el, row.consumer), ref(depArtifact, "units")],
            `Consumer "${row.consumer}" is neither a declared unit nor \`External: …\``);
        }
        if (row.owner !== "" && !declared.has(row.owner)) {
          ledger.finding("CD-1", "reference-broken", [`contract:${row.id}`, safeTarget("unit", row.owner)],
            [ref(artifact, el, row.owner), ref(depArtifact, "units")],
            `Owner "${row.owner}" is not a declared unit`);
        }
      }
    }
  }

  // --- CD-2: spec blocks -----------------------------------------------------
  for (const block of input.specBlocks) {
    if (block.issue === null) continue;
    const blockId = `contract:block-${block.index}`;
    const el = `yaml fence #${block.index} (line ${block.line})`;
    if (block.issue.kind === "unparseable") {
      ledger.finding("CD-2", "structure-invalid", [blockId], [ref(artifact, el)],
        `spec block does not parse in the supported YAML subset: ${block.issue.error}`);
    } else if (block.issue.kind === "not-a-mapping") {
      ledger.finding("CD-2", "structure-invalid", [blockId], [ref(artifact, el)], "spec block is not a YAML mapping");
    } else {
      ledger.finding("CD-2", "structure-invalid", [blockId], [ref(artifact, el, "openapi")],
        "OpenAPI spec block carries `openapi:` but no `paths:`");
    }
  }

  // --- CD-3: DAG edge coverage ----------------------------------------------
  if (units !== null && input.contractsTable.kind !== "absent") {
    const covered = new Set<string>();
    for (const row of rows) {
      covered.add(`${row.provider} ${row.consumer}`);
      covered.add(`${row.consumer} ${row.provider}`);
    }
    for (const u of [...units].sort((a, b) => (a.name < b.name ? -1 : 1))) {
      for (const dep of [...u.dependsOn].sort()) {
        if (!units.some((d) => d.name === dep)) continue; // dangling edge is units-generation's problem
        if (!covered.has(`${dep} ${u.name}`)) {
          ledger.finding("CD-3", "consistency-mismatch", [safeTarget("unit", dep), safeTarget("unit", u.name)],
            [ref(depArtifact, `units (${u.name} depends_on ${dep})`), ref(artifact, "contracts table")],
            `unit dependency edge "${u.name}" -> "${dep}" has no contracts-table row in either orientation`);
        }
      }
    }
  }
}
