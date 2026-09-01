import type { ArtifactPath, RequirementIds } from "../../kernel/domain/index.ts";
import { type ComponentCatalogOutcome } from "./component-catalog-outcome.ts";
import { type ContractsTableOutcome } from "./contracts-table-outcome.ts";
import { type DeclaredUnitsOutcome } from "./declared-units-outcome.ts";
import { type SpecBlockAssessments } from "./spec-block-assessments.ts";
import type { DesignRecordId } from "./design-record-id.ts";
import { type DomainEntitiesOutcome } from "./domain-entities-outcome.ts";
import { type EntitiesOutcome } from "./entities-outcome.ts";
import { type FunctionalSpecOutcome } from "./functional-spec-outcome.ts";
import { type RulesOutcome } from "./rules-outcome.ts";
import { type SiblingUnitIndex } from "./sibling-unit-index.ts";
import type { InputAnchor } from "./input-anchor.ts";
import { type InputAnchors } from "./input-anchors.ts";
import type { LoadedDocument } from "./loaded-document.ts";
import type { UnitName } from "./unit-name.ts";

export interface DesignRecordSeed {
  readonly id: DesignRecordId;
  // 発火対象の record 相対名と (artifact, sha256)。対象が読めない場合に
  // 集約は作られない（Repository が not-found を返す）。
  readonly target: InputAnchor;
  // 錨成果物の原文の生バイト列（原文材料——store の往復則 findById∘store が
  // バイト恒等。兄弟成果物は読み取り視点であり store の対象外）。
  readonly sourceDocument: Uint8Array;
  // 対象が components.md のときだけ載る視点。
  readonly componentCatalog: ComponentCatalogOutcome | null;
  // 対象が contract-summary.md のときだけ載る視点。
  readonly contractsTable: ContractsTableOutcome | null;
  readonly specBlocks: SpecBlockAssessments | null;
  readonly declaredUnits: { readonly artifactName: ArtifactPath; readonly document: LoadedDocument<DeclaredUnitsOutcome> | null } | null;
  // 対象が functional-design 配下のときだけ載る視点。
  readonly functional: {
    readonly unit: UnitName | undefined;
    readonly entitiesArtifact: ArtifactPath;
    readonly entities: LoadedDocument<EntitiesOutcome> | null;
    readonly rulesArtifact: ArtifactPath;
    readonly rules: LoadedDocument<RulesOutcome> | null;
    readonly specArtifact: ArtifactPath;
    readonly spec: LoadedDocument<FunctionalSpecOutcome> | null;
    readonly requirements: LoadedDocument<RequirementIds> | null;
    readonly componentsArtifact: ArtifactPath;
    readonly components: LoadedDocument<DomainEntitiesOutcome> | null;
    readonly siblingUnits: SiblingUnitIndex;
    readonly siblingInputs: InputAnchors;
  } | null;
}
