// RefinementMap（契約4）— 人間が承認した抽象化関数 alpha の宣言。
// AttributeMapping は閉じたユニオン：式写像（bool/int）か enum の場合分け
// （オーナー裁定 7 — expr/enumMap の Option 対を型で畳む）。"unspecified" は
// 契約4 スキーマ検証を通った文書では到達しない素通し形（旧実装は expr も
// enumMap も無い entry を byReq へ登録だけしていた——挙動保存のため表現を残す。
// alpha 到達時は AlphaError）。

import type { ContentHash } from "../../kernel/domain/index.ts";
import type { Expression } from "../../kernel/domain/index.ts";

export type AttributeMapping =
  | { readonly kind: "expression"; readonly req: string; readonly expr: Expression }
  | { readonly kind: "enum-cases"; readonly req: string; readonly from: string; readonly cases: { readonly [designValue: string]: string } }
  | { readonly kind: "unspecified"; readonly req: string };

export interface EventMapping {
  readonly reqTrigger: string;
  readonly transitions: readonly string[];
  readonly waived?: { readonly reason: string };
}

export interface UnmappedEntry {
  readonly target: string;
  readonly reason: string;
}

export interface RefinementUnitMap {
  readonly unit: string;
  readonly attrMap: readonly AttributeMapping[];
  readonly eventMap: readonly EventMapping[];
  readonly unmapped: readonly UnmappedEntry[];
}

export interface RefinementMapSeed {
  readonly requirementsIrHash: ContentHash;
  readonly designIrHash: ContentHash;
  readonly units: readonly RefinementUnitMap[];
}

export class RefinementMap {
  readonly #requirementsIrHash: ContentHash;
  readonly #designIrHash: ContentHash;
  readonly #units: readonly RefinementUnitMap[];

  private constructor(seed: RefinementMapSeed) {
    this.#requirementsIrHash = seed.requirementsIrHash;
    this.#designIrHash = seed.designIrHash;
    this.#units = seed.units;
  }

  // アダプタのパーサ（契約4 スキーマ検証済み）からの唯一の構築口。
  static reconstitute(seed: RefinementMapSeed): RefinementMap {
    return new RefinementMap(seed);
  }

  // 境界: 要件形式モデルの hash と照合される宣言値（陳腐化検出）。
  requirementsIrHash(): ContentHash {
    return this.#requirementsIrHash;
  }

  // 境界: 設計 IR の irHash と照合される宣言値（陳腐化検出）。
  designIrHash(): ContentHash {
    return this.#designIrHash;
  }

  units(): readonly RefinementUnitMap[] {
    return this.#units;
  }

  unitMapOf(unitName: string): RefinementUnitMap | undefined {
    return this.#units.find((m) => m.unit === unitName);
  }
}
