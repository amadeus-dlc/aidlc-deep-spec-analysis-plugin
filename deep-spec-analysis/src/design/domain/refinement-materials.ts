// RefinementMaterials 集約 — Phase 3（refinement）の随伴文脈。恒等は設計
// モデルへの 1:1 錨着（RefinementMaterialsIdentifier）。inactive は適用外（レコード
// ルートまたは要件モデルが存在しない場合）だけを表す。取得失敗や不正入力は
// Repository port の Result で運び、この集約の正当な状態に混ぜない。

import type { RefinementMaterialsIdentifier } from "@deep-spec/design-domain";
import type { RefinementMapAcquisition } from "./refinement-map-acquisition.ts";
import type { RefinementRequirements } from "./refinement-requirements.ts";

type RefinementMaterialsState =
  | { readonly kind: "inactive" }
  | { readonly kind: "active"; readonly requirements: RefinementRequirements; readonly map: RefinementMapAcquisition };

export class RefinementMaterials {
  readonly #id: RefinementMaterialsIdentifier;
  readonly #state: RefinementMaterialsState;

  private constructor(id: RefinementMaterialsIdentifier, state: RefinementMaterialsState) {
    this.#id = id;
    this.#state = state;
  }

  static inactive(id: RefinementMaterialsIdentifier): RefinementMaterials {
    return new RefinementMaterials(id, { kind: "inactive" });
  }

  static active(
    id: RefinementMaterialsIdentifier,
    requirements: RefinementRequirements,
    map: RefinementMapAcquisition,
  ): RefinementMaterials {
    return new RefinementMaterials(id, { kind: "active", requirements, map });
  }

  id(): RefinementMaterialsIdentifier {
    return this.#id;
  }

  isActive(): boolean {
    return this.#state.kind === "active";
  }

  // active のときだけ意味を持つ（inactive で呼ぶのは defect——黙殺しない）。
  requirements(): RefinementRequirements {
    if (this.#state.kind !== "active")
      throw new Error("defect: RefinementMaterials.requirements() on inactive materials");
    return this.#state.requirements;
  }

  mapAcquisition(): RefinementMapAcquisition {
    if (this.#state.kind !== "active")
      throw new Error("defect: RefinementMaterials.mapAcquisition() on inactive materials");
    return this.#state.map;
  }
}
