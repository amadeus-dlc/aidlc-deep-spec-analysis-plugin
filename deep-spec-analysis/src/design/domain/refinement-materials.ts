// RefinementMaterials 集約 — Phase 3（refinement）の随伴文脈。恒等は設計
// モデルへの 1:1 錨着（RefinementMaterialsIdentifier）。inactive は適用外（レコード
// ルートまたは要件モデルが存在しない場合）だけを表す。取得失敗や不正入力は
// Repository port の Result で運び、この集約の正当な状態に混ぜない。

import { SkipReason, UnitName } from "@deep-spec/kernel-domain";
import { DesignInputAnchors } from "./design-input-anchors.ts";
import type { DesignModel } from "./design-model.ts";
import { DesignSkipped } from "./design-skipped.ts";
import { DesignSkips } from "./design-skips.ts";
import type { RefinementMapAcquisition } from "./refinement-map-acquisition.ts";
import type { RefinementMaterialsIdentifier } from "./refinement-materials-identifier.ts";
import { RefinementPreparation } from "./refinement-preparation.ts";
import type { RefinementRequirements } from "./refinement-requirements.ts";
import { UnitRefinementPlan } from "./unit-refinement-plan.ts";

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

  prepare(model: DesignModel): RefinementPreparation {
    if (this.#state.kind === "inactive") return RefinementPreparation.of([], DesignSkips.of([]), null);
    const requirements = this.#state.requirements;
    const skipAll = (reason: SkipReason, detail: string): RefinementPreparation =>
      RefinementPreparation.of(
        [],
        DesignSkips.of(
          [...model].flatMap((unit) =>
            [...requirements.allTargetIds()].map((target) =>
              DesignSkipped.of({ target, reason, detail, unit: UnitName.of(unit.name()) }),
            ),
          ),
        ),
        null,
      );
    return this.#state.map.match({
      absent: (error) =>
        skipAll(
          SkipReason.absentInput(),
          error ?? "no refinement map (deep-spec-analysis-refinement-map.md) was authored for this record",
        ),
      loaded: (map, artifact, inputs) => {
        if (!map.requirementsIrHash().equals(requirements.hash()))
          return skipAll(
            SkipReason.staleInput(),
            "the refinement map's requirementsIrHash no longer matches the requirements formal model — re-author the map",
          );
        if (!map.designIrHash().equals(model.irHash()))
          return skipAll(
            SkipReason.staleInput(),
            "the refinement map's designIrHash no longer matches this design IR — re-author the map",
          );
        const plans: UnitRefinementPlan[] = [];
        let skipped = DesignSkips.of([]);
        for (const unit of model) {
          const unitMap = map.unitMapOf(unit.id());
          if (unitMap !== undefined && unitMap !== null) {
            plans.push(UnitRefinementPlan.of(unit, unitMap, requirements, artifact));
            continue;
          }
          for (const target of requirements.allTargetIds())
            skipped = skipped.add(
              DesignSkipped.of({
                target,
                reason: SkipReason.absentInput(),
                unit: UnitName.of(unit.name()),
                detail: `the refinement map has no entry for unit ${unit.name()}`,
              }),
            );
        }
        return RefinementPreparation.of(plans, skipped, DesignInputAnchors.of(inputs));
      },
    });
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
