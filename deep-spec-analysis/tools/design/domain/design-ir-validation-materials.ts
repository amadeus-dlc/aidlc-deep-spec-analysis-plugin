// DesignIrValidationMaterials 集約 — 契約3 設計 IR の well-formedness 検査材料。
// フェンス抽出・JSON 解釈・スキーマ検証・ユニットごとの BR 材料の解決までを
// アダプタが門で済ませ、ドメインへは検査語彙だけが届く。恒等は設計形式モデル
// 成果物への 1:1 錨着（RefinementMaterialsId と同じ規律）。sourceDocument は
// 成果物の原文（原文材料——store の往復則 findById∘store がバイト恒等）。

import type { ErrorMessages, IrVersion } from "../../kernel/domain/index.ts";
import type { DesignModelId } from "./design-model-id.ts";
import type { DesignUnitDecls } from "./design-ir-decl.ts";

export class DesignIrValidationMaterialsId {
  readonly #model: DesignModelId;

  private constructor(model: DesignModelId) {
    this.#model = model;
  }

  static ofModel(model: DesignModelId): DesignIrValidationMaterialsId {
    return new DesignIrValidationMaterialsId(model);
  }

  equals(other: DesignIrValidationMaterialsId): boolean {
    return this.#model.equals(other.#model);
  }

  modelId(): DesignModelId {
    return this.#model;
  }
}

export interface DesignIrValidationMaterialsSeed {
  readonly id: DesignIrValidationMaterialsId;
  readonly irVersion: IrVersion;
  readonly schemaErrors: ErrorMessages;
  readonly units: DesignUnitDecls;
  readonly sourceDocument: string;
}

export class DesignIrValidationMaterials {
  readonly #id: DesignIrValidationMaterialsId;
  readonly #irVersion: IrVersion;
  readonly #schemaErrors: ErrorMessages;
  readonly #units: DesignUnitDecls;
  readonly #sourceDocument: string;

  private constructor(seed: DesignIrValidationMaterialsSeed) {
    this.#id = seed.id;
    this.#irVersion = seed.irVersion;
    this.#schemaErrors = seed.schemaErrors;
    this.#units = seed.units;
    this.#sourceDocument = seed.sourceDocument;
  }

  // アダプタの寛容パースからの唯一の構築口。
  static reconstitute(seed: DesignIrValidationMaterialsSeed): DesignIrValidationMaterials {
    return new DesignIrValidationMaterials(seed);
  }

  id(): DesignIrValidationMaterialsId {
    return this.#id;
  }

  irVersion(): IrVersion {
    return this.#irVersion;
  }

  schemaErrors(): ErrorMessages {
    return this.#schemaErrors;
  }

  units(): DesignUnitDecls {
    return this.#units;
  }

  // 境界: store が書く原文（バイト逐語）。
  sourceDocument(): string {
    return this.#sourceDocument;
  }
}
