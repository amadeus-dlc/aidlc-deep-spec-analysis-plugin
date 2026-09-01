import type { ArtifactPath, RequirementIds } from "../../kernel/domain/index.ts";
import { type DomainEntitiesOutcome } from "./domain-entities-outcome.ts";
import { type EntitiesOutcome } from "./entities-outcome.ts";
import { type FunctionalSpecOutcome } from "./functional-spec-outcome.ts";
import { type RulesOutcome } from "./rules-outcome.ts";
import { type SiblingUnitIndex } from "./sibling-unit-index.ts";
import type { UnitName } from "./unit-name.ts";

export interface FunctionalCheckMaterialsSeed {
  readonly unit: UnitName | undefined;
  readonly entitiesArtifact: ArtifactPath;
  readonly entities: EntitiesOutcome;
  readonly rulesArtifact: ArtifactPath;
  readonly rules: RulesOutcome;
  readonly specArtifact: ArtifactPath;
  readonly spec: FunctionalSpecOutcome;
  // requirements.md が読めたときはその FR/NFR id 集合、読めなければ null。
  readonly requirementIdsKnown: RequirementIds | null;
  readonly componentsArtifact: ArtifactPath;
  readonly domainEntities: DomainEntitiesOutcome;
  readonly siblingUnits: SiblingUnitIndex;
}
