// ValidateDesignIrUseCase — 契約3 設計 IR の決定論的検査（design-ir-valid
// センサーの本体）。旧 aidlc-sensor-deep-spec-design-ir-valid.ts の main からの
// 逐語移植で、検査順序とエラーの積み方（errors[] の並び）を保存する。
//
// 順序の凍結点：材料が組めない失敗（フェンス／JSON／スキーマファイル）は
// irVersion チェックより前に verdict へ落ちる。意味検査はスキーマ検証まで
// 無傷の IR にのみ走る。

import { type DesignModelId, SUPPORTED_DESIGN_IR_MAJOR, designWellFormednessErrors } from "../domain/index.ts";
import type { DesignIrValidationMaterialsRepository } from "./design-ir-validation-materials-repository.ts";
import type { ValidateDesignIrOutcome } from "./validate-design-ir-outcome.ts";

export class ValidateDesignIrUseCase {
  readonly #materials: DesignIrValidationMaterialsRepository;

  constructor(materials: DesignIrValidationMaterialsRepository) {
    this.#materials = materials;
  }

  execute(modelId: DesignModelId): ValidateDesignIrOutcome {
    const acquired = this.#materials.acquire(modelId);
    if (acquired.kind === "not-applicable") return { kind: "not-applicable" };
    if (acquired.kind === "unreadable") {
      return { kind: "verdict", pass: false, errors: acquired.errors };
    }
    const materials = acquired.materials;

    const errors: string[] = [];
    const major = Number.parseInt(materials.irVersion.split(".")[0] ?? "", 10);
    if (Number.isInteger(major) && major !== SUPPORTED_DESIGN_IR_MAJOR) {
      errors.push(
        `irVersion ${materials.irVersion}: unsupported major version (this validator supports ${SUPPORTED_DESIGN_IR_MAJOR}.x.x)`,
      );
    }
    errors.push(...materials.schemaErrors);

    if (errors.length === 0) {
      errors.push(...designWellFormednessErrors(materials.units));
    }

    return { kind: "verdict", pass: errors.length === 0, errors };
  }
}
