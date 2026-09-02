// DesignRecord 集約 — refcheck が検査する「intent record の設計面」の
// 型付きスナップショット。識別は発火対象の成果物パス。Repository の Impl が
// 読み＋解析（形式知識）を所有し、ここには解析済みの型付き視点だけが載る。
// 各値の取得規則（requirements は rules が使えるときだけ・兄弟は catalog が
// 解析できたときだけ等）は Impl が凍結挙動として実装する。

import type { DesignRecordId } from "./design-record-id.ts";
import type { InputAnchor } from "./input-anchor.ts";
import { type ComponentCatalogOutcome } from "./component-catalog-outcome.ts";
import { type ContractsTableOutcome } from "./contracts-table-outcome.ts";
import { type SpecBlockAssessments } from "./spec-block-assessments.ts";
import type { ArtifactPath, RequirementIds } from "../../kernel/domain/index.ts";
import type { DeclaredUnitsOutcome } from "./declared-units-outcome.ts";
import type { DomainEntitiesOutcome } from "./domain-entities-outcome.ts";
import type { EntitiesOutcome } from "./entities-outcome.ts";
import type { FunctionalSpecOutcome } from "./functional-spec-outcome.ts";
import type { RulesOutcome } from "./rules-outcome.ts";
import type { SiblingUnitIndex } from "./sibling-unit-index.ts";
import type { InputAnchors } from "./input-anchors.ts";
import type { LoadedDocument } from "./loaded-document.ts";
import type { UnitName } from "./unit-name.ts";



export class DesignRecord {
  readonly #seed: {
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
  };

  private constructor(seed: {
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
  }) {
    this.#seed = seed;
  }

  static reconstitute(seed: {
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
  }): DesignRecord {
    return new DesignRecord(seed);
  }

  id(): DesignRecordId {
    return this.#seed.id;
  }

  target(): InputAnchor {
    return this.#seed.target;
  }

  // 境界: store が書く錨成果物の原文（バイト逐語——外部変更を防ぐ防御コピー）。
  sourceDocument(): Uint8Array {
    return new Uint8Array(this.#seed.sourceDocument);
  }

  componentCatalog(): ComponentCatalogOutcome | null {
    return this.#seed.componentCatalog;
  }

  contractsTable(): ContractsTableOutcome | null {
    return this.#seed.contractsTable;
  }

  specBlocks(): SpecBlockAssessments | null {
    return this.#seed.specBlocks;
  }

  declaredUnits(): {
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
  }["declaredUnits"] {
    return this.#seed.declaredUnits;
  }

  functional(): {
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
  }["functional"] {
    return this.#seed.functional;
  }
}
