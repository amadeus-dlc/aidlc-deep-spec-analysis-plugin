// CD 検査ファミリー（CD-1..CD-3）— 型付き入力上の純検査。
// finding/skip の文言・targets・witness refs は旧センサー本体からの逐語移動。

import { type ArtifactPath, TargetIds } from "../../kernel/domain/index.ts";
import { CheckFamilies, CheckFamily } from "./check-family.ts";
import type { CheckFamilyLedger } from "./check-family-ledger.ts";
import { ContractRows } from "./contract-summary.ts";
import type {
  ContractsTableOutcome,
  DeclaredUnitsOutcome,
  SpecBlockAssessments,
  UnitDecls,
} from "./contract-summary.ts";
import type { WitnessRef } from "./witness-ref.ts";

const CD_1 = CheckFamily.reconstitute("CD-1");
const CD_2 = CheckFamily.reconstitute("CD-2");
const CD_3 = CheckFamily.reconstitute("CD-3");

export const CONTRACT_FAMILIES = CheckFamilies.of([CD_1, CD_2, CD_3]);

export interface ContractCheckMaterialsSeed {
  readonly artifact: ArtifactPath;
  readonly depArtifact: ArtifactPath;
  readonly declaredUnits: DeclaredUnitsOutcome;
  readonly contractsTable: ContractsTableOutcome;
  readonly specBlocks: SpecBlockAssessments;
}

function runContractChecksImpl(materials: ContractCheckMaterialsSeed, ledger: CheckFamilyLedger): void {
  const artifact = materials.artifact.asString();
  const depArtifact = materials.depArtifact.asString();
  const ref = (art: string, element: string, value?: string): WitnessRef =>
    value === undefined ? { artifact: art, element } : { artifact: art, element, value };

  // --- declared units (unit-of-work-dependency.md edge block) --------------
  let units: UnitDecls | null = null;
  if (materials.declaredUnits.kind === "absent") {
    ledger.skip(CD_1, "absent-input", "unit-of-work-dependency.md is not present under this intent record — declared units are unknown");
    ledger.skip(CD_3, "absent-input", "unit-of-work-dependency.md is not present under this intent record — the unit dependency DAG is unknown");
  } else if (materials.declaredUnits.kind === "unrecognized") {
    ledger.skip(CD_1, "unrecognized-format", `unit-of-work-dependency.md carries no parseable \`units:\` edge block${materials.declaredUnits.error ? ` (${materials.declaredUnits.error})` : ""}`);
    ledger.skip(CD_3, "unrecognized-format", "blocked: the units edge block is unusable");
  } else {
    units = materials.declaredUnits.units;
  }

  // --- CD-1: contracts table -------------------------------------------------
  let rows = ContractRows.of([]);
  if (materials.contractsTable.kind === "absent") {
    if (units !== null) ledger.skip(CD_1, "unrecognized-format", "no markdown table with a Provider column found");
    ledger.skip(CD_3, "unrecognized-format", "no contracts table — DAG edge coverage cannot be checked");
  } else {
    rows = materials.contractsTable.rows;
    if (units !== null) {
      const declared = units;
      for (const row of rows) {
        const el = `contracts table row ${row.id.asString()} (line ${row.line.asNumber()})`;
        if (!row.provider.isBlank() && !declared.declares(row.provider.asString())) {
          ledger.finding(CD_1, "reference-broken", [`contract:${row.id.asString()}`, TargetIds.safe("unit", row.provider.asString())],
            [ref(artifact, el, row.provider.asString()), ref(depArtifact, "units")],
            `Provider Unit "${row.provider.asString()}" is not a declared unit`);
        }
        if (!row.consumer.isBlank() && !declared.declares(row.consumer.asString()) && !row.consumer.declaresExternal()) {
          ledger.finding(CD_1, "reference-broken", [`contract:${row.id.asString()}`, TargetIds.safe("unit", row.consumer.asString())],
            [ref(artifact, el, row.consumer.asString()), ref(depArtifact, "units")],
            `Consumer "${row.consumer.asString()}" is neither a declared unit nor \`External: …\``);
        }
        if (!row.owner.isBlank() && !declared.declares(row.owner.asString())) {
          ledger.finding(CD_1, "reference-broken", [`contract:${row.id.asString()}`, TargetIds.safe("unit", row.owner.asString())],
            [ref(artifact, el, row.owner.asString()), ref(depArtifact, "units")],
            `Owner "${row.owner.asString()}" is not a declared unit`);
        }
      }
    }
  }

  // --- CD-2: spec blocks -----------------------------------------------------
  for (const block of materials.specBlocks) {
    if (block.issue === null) continue;
    const blockId = `contract:block-${block.index.asNumber()}`;
    const el = `yaml fence #${block.index.asNumber()} (line ${block.line.asNumber()})`;
    if (block.issue.kind === "unparseable") {
      ledger.finding(CD_2, "structure-invalid", [blockId], [ref(artifact, el)],
        `spec block does not parse in the supported YAML subset: ${block.issue.error}`);
    } else if (block.issue.kind === "not-a-mapping") {
      ledger.finding(CD_2, "structure-invalid", [blockId], [ref(artifact, el)], "spec block is not a YAML mapping");
    } else {
      ledger.finding(CD_2, "structure-invalid", [blockId], [ref(artifact, el, "openapi")],
        "OpenAPI spec block carries `openapi:` but no `paths:`");
    }
  }

  // --- CD-3: DAG edge coverage ----------------------------------------------
  if (units !== null && materials.contractsTable.kind !== "absent") {
    for (const u of units.sortedByName()) {
      const uName = u.name.asString();
      for (const dep of u.dependsOn.sortedByValue()) {
        const depName = dep.asString();
        if (!units.declares(depName)) continue; // dangling edge is units-generation's problem
        if (!rows.coversEdge(depName, uName)) {
          ledger.finding(CD_3, "consistency-mismatch", [TargetIds.safe("unit", depName), TargetIds.safe("unit", uName)],
            [ref(depArtifact, `units (${uName} depends_on ${depName})`), ref(artifact, "contracts table")],
            `unit dependency edge "${uName}" -> "${depName}" has no contracts-table row in either orientation`);
        }
      }
    }
  }
}

// CD 検査材料。検査の起動は材料自身の振る舞い（OOUI 裁定：旧
// runContractChecks の従属先）。
export class ContractCheckMaterials {
  readonly #seed: ContractCheckMaterialsSeed;

  private constructor(seed: ContractCheckMaterialsSeed) {
    this.#seed = seed;
  }

  static of(seed: ContractCheckMaterialsSeed): ContractCheckMaterials {
    return new ContractCheckMaterials(seed);
  }

  runChecks(ledger: CheckFamilyLedger): void {
    runContractChecksImpl(this.#seed, ledger);
  }
}
