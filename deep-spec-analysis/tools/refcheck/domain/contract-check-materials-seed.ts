import type { ArtifactPath } from "../../kernel/domain/index.ts";
import { type ContractsTableOutcome } from "./contracts-table-outcome.ts";
import { type DeclaredUnitsOutcome } from "./declared-units-outcome.ts";
import { type SpecBlockAssessments } from "./spec-block-assessments.ts";

export interface ContractCheckMaterialsSeed {
  readonly artifact: ArtifactPath;
  readonly depArtifact: ArtifactPath;
  readonly declaredUnits: DeclaredUnitsOutcome;
  readonly contractsTable: ContractsTableOutcome;
  readonly specBlocks: SpecBlockAssessments;
}
