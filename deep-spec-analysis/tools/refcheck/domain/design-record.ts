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
import type { DesignRecordSeed } from "./design-record-seed.ts";



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

  declaredUnits(): DesignRecordSeed["declaredUnits"] {
    return this.#seed.declaredUnits;
  }

  functional(): DesignRecordSeed["functional"] {
    return this.#seed.functional;
  }
}
