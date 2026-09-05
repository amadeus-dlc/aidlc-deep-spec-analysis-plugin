// ValidateDesignIntermediateRepresentationUseCase — 契約3 設計 IR の決定論的検査（design-ir-valid
// センサーの本体）。旧 aidlc-sensor-deep-spec-design-ir-valid.ts の main からの
// 逐語移植で、検査順序とエラーの積み方（errors[] の並び）を保存する。
//
// 順序の凍結点：材料が組めない失敗（フェンス／JSON／スキーマファイル）は
// irVersion チェックより前に verdict へ落ちる。意味検査はスキーマ検証まで
// 無傷の IR にのみ走る。

import { type DesignModelIdentifier, DesignIntermediateRepresentationValidationMaterialsIdentifier, SUPPORTED_DESIGN_IR_MAJOR } from "@deep-spec/design-domain";
import type { DesignIntermediateRepresentationValidationMaterialsRepository } from "./port/design-intermediate-representation-validation-materials-repository.ts";
import type { ValidateDesignIntermediateRepresentationOutcome } from "./validate-design-intermediate-representation-outcome.ts";

export class ValidateDesignIntermediateRepresentationUseCase {
  readonly #designIrValidationMaterialsRepository: DesignIntermediateRepresentationValidationMaterialsRepository;

  constructor(designIrValidationMaterialsRepository: DesignIntermediateRepresentationValidationMaterialsRepository) {
    this.#designIrValidationMaterialsRepository = designIrValidationMaterialsRepository;
  }

  execute(modelId: DesignModelIdentifier): ValidateDesignIntermediateRepresentationOutcome {
    const found = this.#designIrValidationMaterialsRepository.findById(DesignIntermediateRepresentationValidationMaterialsIdentifier.of(modelId));
    if (!found.ok) {
      // not-found = 機能形式モデル以外・不在（旧 not-applicable の pass-through）。
      if (found.error.kind === "not-found") return { kind: "not-applicable" };
      // corrupt.cause は verdict にそのまま載る凍結文言（旧 unreadable）。
      return { kind: "verdict", pass: false, errors: [found.error.cause] };
    }
    const materials = found.value;

    const errors: string[] = [];
    const major = materials.irVersion().majorVersion();
    if (Number.isInteger(major) && major !== SUPPORTED_DESIGN_IR_MAJOR) {
      errors.push(
        `irVersion ${materials.irVersion().asString()}: unsupported major version (this validator supports ${SUPPORTED_DESIGN_IR_MAJOR}.x.x)`,
      );
    }
    errors.push(...materials.schemaErrors().toArray().map((message) => message.asString()));

    if (errors.length === 0) {
      errors.push(...materials.units().wellFormednessErrors());
    }

    return { kind: "verdict", pass: errors.length === 0, errors };
  }
}
