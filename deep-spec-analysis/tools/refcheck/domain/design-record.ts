// DesignRecord 集約 — refcheck が検査する「intent record の設計面」の
// 型付きスナップショット。識別は発火対象の成果物パス。Repository の Impl が
// 読み＋解析（形式知識）を所有し、ここには解析済みの型付き視点だけが載る。
// 各値の取得規則（requirements は rules が使えるときだけ・兄弟は catalog が
// 解析できたときだけ等）は Impl が凍結挙動として実装する。

import { type ArtifactPath, type RequirementIds } from "../../kernel/domain/index.ts";
import type { DesignRecordId } from "./design-record-id.ts";
import type { InputAnchor } from "./input-anchor.ts";
import type { ComponentCatalogOutcome } from "./component-catalog.ts";
import type { ContractsTableOutcome, DeclaredUnitsOutcome, SpecBlockAssessments } from "./contract-summary.ts";
import type { UnitName } from "./unit-name.ts";
import type {
  DomainEntitiesOutcome,
  EntitiesOutcome,
  FunctionalSpecOutcome,
  RulesOutcome,
  SiblingUnitIndex,
} from "./functional-design.ts";

// 読み込まれ解析済みの 1 文書：inputs[] 記録用の (artifact, sha256) と解析結果。
export interface LoadedDocument<Outcome> {
  readonly input: InputAnchor;
  readonly outcome: Outcome;
}

export interface DesignRecordSeed {
  readonly id: DesignRecordId;
  // 発火対象の record 相対名と (artifact, sha256)。対象が読めない場合に
  // 集約は作られない（Repository が not-found を返す）。
  readonly target: InputAnchor;
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
    readonly siblingInputs: readonly InputAnchor[];
  } | null;
}

export class DesignRecord {
  readonly #seed: DesignRecordSeed;

  private constructor(seed: DesignRecordSeed) {
    this.#seed = seed;
  }

  static reconstitute(seed: DesignRecordSeed): DesignRecord {
    return new DesignRecord(seed);
  }

  id(): DesignRecordId {
    return this.#seed.id;
  }

  target(): InputAnchor {
    return this.#seed.target;
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

  declaredUnits(): DesignRecordSeed["declaredUnits"] {
    return this.#seed.declaredUnits;
  }

  functional(): DesignRecordSeed["functional"] {
    return this.#seed.functional;
  }
}
