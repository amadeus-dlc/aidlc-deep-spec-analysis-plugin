// CD 検査ファミリー（CD-1..CD-3）— 型付き入力上の純検査。
// finding/skip の文言・targets・witness refs は旧センサー本体からの逐語移動。

import { TargetIds } from "../../kernel/domain/index.ts";
import { CheckFamily } from "./check-family.ts";
import { CheckFamilies } from "./check-families.ts";
import type { CheckFamilyLedger } from "./check-family-ledger.ts";
import { ContractRows } from "./contract-rows.ts";
import { type UnitDecls } from "./unit-decls.ts";
import { WitnessRef } from "./witness-ref.ts";
import type { ArtifactPath } from "../../kernel/domain/index.ts";
import type { ContractsTableOutcome } from "./contracts-table-outcome.ts";
import type { DeclaredUnitsOutcome } from "./declared-units-outcome.ts";
import type { SpecBlockAssessments } from "./spec-block-assessments.ts";

const CD_1 = CheckFamily.reconstitute("CD-1");
const CD_2 = CheckFamily.reconstitute("CD-2");
const CD_3 = CheckFamily.reconstitute("CD-3");

export const CONTRACT_FAMILIES = CheckFamilies.of([CD_1, CD_2, CD_3]);


function runContractChecksImpl(materials: {
  readonly artifact: ArtifactPath;
  readonly depArtifact: ArtifactPath;
  readonly declaredUnits: DeclaredUnitsOutcome;
  readonly contractsTable: ContractsTableOutcome;
  readonly specBlocks: SpecBlockAssessments;
  }, ledger: CheckFamilyLedger): void {
  const artifact = materials.artifact.asString();
  const depArtifact = materials.depArtifact.asString();
  const ref = (art: string, element: string, value?: string): WitnessRef =>
    WitnessRef.reconstitute(value === undefined ? { artifact: art, element } : { artifact: art, element, value });

  // --- declared units (unit-of-work-dependency.md edge block) --------------
  const units: UnitDecls | null = materials.declaredUnits.match({
    absent: () => {
      ledger.skip(CD_1, "absent-input", "unit-of-work-dependency.md is not present under this intent record — declared units are unknown");
      ledger.skip(CD_3, "absent-input", "unit-of-work-dependency.md is not present under this intent record — the unit dependency DAG is unknown");
      return null;
    },
    unrecognized: (error) => {
      ledger.skip(CD_1, "unrecognized-format", `unit-of-work-dependency.md carries no parseable \`units:\` edge block${error ? ` (${error})` : ""}`);
      ledger.skip(CD_3, "unrecognized-format", "blocked: the units edge block is unusable");
      return null;
    },
    declared: (declaredUnits) => {
      return declaredUnits;
    },
  });

  // --- CD-1: contracts table -------------------------------------------------
  const rows: ContractRows | null = materials.contractsTable.match({
    absent: () => {
      if (units !== null) ledger.skip(CD_1, "unrecognized-format", "no markdown table with a Provider column found");
      ledger.skip(CD_3, "unrecognized-format", "no contracts table — DAG edge coverage cannot be checked");
      return null;
    },
    rows: (tableRows) => {
      if (units !== null) {
        const declared = units;
        for (const row of tableRows) {
          const el = row.locationLabel();
          if (!row.provider().isBlank() && !declared.declares(row.provider().asString())) {
            ledger.finding(CD_1, "reference-broken", [`contract:${row.id().asString()}`, TargetIds.safe("unit", row.provider().asString())],
              [ref(artifact, el, row.provider().asString()), ref(depArtifact, "units")],
              `Provider Unit "${row.provider().asString()}" is not a declared unit`);
          }
          if (!row.consumer().isBlank() && !declared.declares(row.consumer().asString()) && !row.consumer().declaresExternal()) {
            ledger.finding(CD_1, "reference-broken", [`contract:${row.id().asString()}`, TargetIds.safe("unit", row.consumer().asString())],
              [ref(artifact, el, row.consumer().asString()), ref(depArtifact, "units")],
              `Consumer "${row.consumer().asString()}" is neither a declared unit nor \`External: …\``);
          }
          if (!row.owner().isBlank() && !declared.declares(row.owner().asString())) {
            ledger.finding(CD_1, "reference-broken", [`contract:${row.id().asString()}`, TargetIds.safe("unit", row.owner().asString())],
              [ref(artifact, el, row.owner().asString()), ref(depArtifact, "units")],
              `Owner "${row.owner().asString()}" is not a declared unit`);
          }
        }
      }
      return tableRows;
    },
  });

  // --- CD-2: spec blocks -----------------------------------------------------
  for (const block of materials.specBlocks) {
    const blockId = block.blockId();
    const el = block.locationLabel();
    block.matchIssue({
      sound: () => {},
      unparseable: (error) => {
        ledger.finding(CD_2, "structure-invalid", [blockId], [ref(artifact, el)],
          `spec block does not parse in the supported YAML subset: ${error}`);
      },
      notAMapping: () => {
        ledger.finding(CD_2, "structure-invalid", [blockId], [ref(artifact, el)], "spec block is not a YAML mapping");
      },
      openapiWithoutPaths: () => {
        ledger.finding(CD_2, "structure-invalid", [blockId], [ref(artifact, el, "openapi")],
          "OpenAPI spec block carries `openapi:` but no `paths:`");
      },
    });
  }

  // --- CD-3: DAG edge coverage ----------------------------------------------
  if (units !== null && rows !== null) {
    for (const u of units.sortedByName()) {
      const uName = u.name().asString();
      // 宙に浮いた辺（未宣言の依存先）は宣言が落とす——units-generation の問題。
      for (const dep of u.declaredDependencies(units)) {
        const depName = dep.asString();
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
  readonly #seed: {
  readonly artifact: ArtifactPath;
  readonly depArtifact: ArtifactPath;
  readonly declaredUnits: DeclaredUnitsOutcome;
  readonly contractsTable: ContractsTableOutcome;
  readonly specBlocks: SpecBlockAssessments;
  };

  private constructor(seed: {
    readonly artifact: ArtifactPath;
    readonly depArtifact: ArtifactPath;
    readonly declaredUnits: DeclaredUnitsOutcome;
    readonly contractsTable: ContractsTableOutcome;
    readonly specBlocks: SpecBlockAssessments;
  }) {
    this.#seed = seed;
  }

  static of(seed: {
    readonly artifact: ArtifactPath;
    readonly depArtifact: ArtifactPath;
    readonly declaredUnits: DeclaredUnitsOutcome;
    readonly contractsTable: ContractsTableOutcome;
    readonly specBlocks: SpecBlockAssessments;
  }): ContractCheckMaterials {
    return new ContractCheckMaterials(seed);
  }

  runChecks(ledger: CheckFamilyLedger): void {
    runContractChecksImpl(this.#seed, ledger);
  }
}
