// RefinementMap（契約4）— 人間が承認した抽象化関数 alpha の宣言。
// AttributeMapping は閉じたユニオン：式写像（bool/int）か enum の場合分け
// （オーナー裁定 7 — expr/enumMap の Option 対を型で畳む）。"unspecified" は
// 契約4 スキーマ検証を通った文書では到達しない素通し形（旧実装は expr も
// enumMap も無い entry を byReq へ登録だけしていた——挙動保存のため表現を残す。
// alpha 到達時は AlphaError）。ユニットの帰属は DesignUnitId（集約 ID）で運び、
// 集まりはファーストクラスコレクションで運ぶ。

import { DesignUnitId } from "../../design/domain/index.ts";
import type { RefinementMapId } from "./refinement-map-id.ts";
import type { ContentHash } from "../../kernel/domain/index.ts";
import type { RefinementUnitMap } from "./refinement-unit-map.ts";
import { RefinementUnitMaps } from "./refinement-unit-maps.ts";



export class RefinementMap {
  readonly #id: RefinementMapId;
  readonly #requirementsIrHash: ContentHash;
  readonly #designIrHash: ContentHash;
  readonly #units: RefinementUnitMaps;
  readonly #sourceDocument: Uint8Array;

  private constructor(seed: {
    readonly id: RefinementMapId;
    readonly requirementsIrHash: ContentHash;
    readonly designIrHash: ContentHash;
    readonly units: RefinementUnitMaps;
    // 成果物の原文（原文材料——store の往復則 findById∘store がバイト恒等）。
    readonly sourceDocument: Uint8Array;
  }) {
    this.#id = seed.id;
    this.#requirementsIrHash = seed.requirementsIrHash;
    this.#designIrHash = seed.designIrHash;
    this.#units = seed.units;
    this.#sourceDocument = new Uint8Array(seed.sourceDocument);
  }

  // アダプタのパーサ（契約4 スキーマ検証済み）からの唯一の構築口。
  static reconstitute(seed: {
    readonly id: RefinementMapId;
    readonly requirementsIrHash: ContentHash;
    readonly designIrHash: ContentHash;
    readonly units: RefinementUnitMaps;
    // 成果物の原文（原文材料——store の往復則 findById∘store がバイト恒等）。
    readonly sourceDocument: Uint8Array;
  }): RefinementMap {
    return new RefinementMap(seed);
  }

  // 境界: 要件形式モデルの hash と照合される宣言値（陳腐化検出）。
  id(): RefinementMapId {
    return this.#id;
  }

  requirementsIrHash(): ContentHash {
    return this.#requirementsIrHash;
  }

  // 境界: 設計 IR の irHash と照合される宣言値（陳腐化検出）。
  designIrHash(): ContentHash {
    return this.#designIrHash;
  }

  units(): RefinementUnitMaps {
    return this.#units;
  }

  unitMapOf(unit: DesignUnitId): RefinementUnitMap | undefined {
    return this.#units.mapOf(unit);
  }

  // 境界: store が書く原文（バイト逐語——UTF-8 復号で非可逆にならないよう生
  // バイト列で保持し、外部からの変更を防ぐため構築・照会の両方で防御コピー）。
  sourceDocument(): Uint8Array {
    return new Uint8Array(this.#sourceDocument);
  }
}
