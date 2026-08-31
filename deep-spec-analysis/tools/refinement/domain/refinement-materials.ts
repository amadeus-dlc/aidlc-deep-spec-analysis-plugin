// RefinementMaterials 集約 — Phase 3（refinement）の随伴文脈。恒等は設計
// モデルへの 1:1 錨着（RefinementMaterialsId）。inactive（レコードルートが
// 辿れない／要件モデルが読めない——Phase 3 は丸ごと発火しない旧 req === null
// 挙動）は不在ではなく集約の正当な状態なので、findById は Result ではなく
// 集約そのものを返す。状態の内訳は private に閉じ、照会は振る舞いで行う
// （Tell-Don't-Ask 裁定）。ツリー投影のため書き込み面は持たない（#46 台帳の
// 裁定待ち行）。
//
// refinement/domain に置く理由: 公認エッジは refinement/domain →
// {requirements,design}/domain であり、設計側 domain からは refinement 語彙
// （RefinementRequirements / RefinementMap）へ届かない。

import type { DesignInputAnchor, RefinementMaterialsId } from "../../design/domain/index.ts";
import type { RefinementMap } from "./refinement-map.ts";
import type { RefinementRequirements } from "./refinement-requirements.ts";

export type RefinementMapAcquisition =
  | { readonly kind: "absent"; readonly error: string | null }
  | {
      readonly kind: "loaded";
      readonly map: RefinementMap;
      readonly mapArtifact: string;
      readonly inputs: readonly DesignInputAnchor[];
    };

type RefinementMaterialsState =
  | { readonly kind: "inactive" }
  | { readonly kind: "active"; readonly requirements: RefinementRequirements; readonly map: RefinementMapAcquisition };

export class RefinementMaterials {
  readonly #id: RefinementMaterialsId;
  readonly #state: RefinementMaterialsState;

  private constructor(id: RefinementMaterialsId, state: RefinementMaterialsState) {
    this.#id = id;
    this.#state = state;
  }

  static inactive(id: RefinementMaterialsId): RefinementMaterials {
    return new RefinementMaterials(id, { kind: "inactive" });
  }

  static active(id: RefinementMaterialsId, requirements: RefinementRequirements, map: RefinementMapAcquisition): RefinementMaterials {
    return new RefinementMaterials(id, { kind: "active", requirements, map });
  }

  id(): RefinementMaterialsId {
    return this.#id;
  }

  isActive(): boolean {
    return this.#state.kind === "active";
  }

  // active のときだけ意味を持つ（inactive で呼ぶのは defect——黙殺しない）。
  requirements(): RefinementRequirements {
    if (this.#state.kind !== "active") throw new Error("defect: RefinementMaterials.requirements() on inactive materials");
    return this.#state.requirements;
  }

  mapAcquisition(): RefinementMapAcquisition {
    if (this.#state.kind !== "active") throw new Error("defect: RefinementMaterials.mapAcquisition() on inactive materials");
    return this.#state.map;
  }
}
