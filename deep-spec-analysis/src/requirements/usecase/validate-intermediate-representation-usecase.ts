// ValidateIntermediateRepresentationUseCase — 契約1 IR の決定論的検査（ir-valid センサーの本体）。
// 旧 aidlc-sensor-deep-spec-ir-valid.ts の main からの逐語移植：検査の順序と
// エラーの積み方が観測面（errors[] の並び）なので、そのまま保存する。
//
// 順序の凍結点：材料が組めない失敗（フェンス／JSON／スキーマファイル）は
// irVersion チェックより前に verdict へ落ち、irVersion のエラーは捨てられる。
// 意味検査と逆トレーサビリティは、スキーマ検証まで無傷の IR にのみ走る。

import {
  type FormalModelIdentifier,
  IntermediateRepresentationValidationMaterialsIdentifier,
  SUPPORTED_IR_MAJOR,
  SourceAnchor,
} from "@deep-spec/requirements-domain";
import type { IntermediateRepresentationValidationMaterialsRepository } from "./port/intermediate-representation-validation-materials-repository.ts";
import { type RequirementsSourceRepository } from "./port/requirements-source-repository.ts";
import type { ValidateIntermediateRepresentationOutcome } from "./validate-intermediate-representation-outcome.ts";

export class ValidateIntermediateRepresentationUseCase {
  readonly #irValidationMaterialsRepository: IntermediateRepresentationValidationMaterialsRepository;
  readonly #requirementsSourceRepository: RequirementsSourceRepository;

  constructor(irValidationMaterialsRepository: IntermediateRepresentationValidationMaterialsRepository, requirementsSourceRepository: RequirementsSourceRepository) {
    this.#irValidationMaterialsRepository = irValidationMaterialsRepository;
    this.#requirementsSourceRepository = requirementsSourceRepository;
  }

  execute(modelId: FormalModelIdentifier): ValidateIntermediateRepresentationOutcome {
    const found = this.#irValidationMaterialsRepository.findById(IntermediateRepresentationValidationMaterialsIdentifier.of(modelId));
    if (!found.ok) {
      // not-found = 機能形式モデル以外・不在（旧 not-applicable の pass-through）。
      if (found.error.kind === "not-found") return { kind: "not-applicable" };
      // corrupt.cause は verdict にそのまま載る凍結文言（旧 unreadable）。
      return { kind: "verdict", pass: false, errors: [found.error.cause] };
    }
    const materials = found.value;

    const errors: string[] = [];
    const major = materials.irVersion().majorVersion();
    if (Number.isInteger(major) && major !== SUPPORTED_IR_MAJOR) {
      errors.push(
        `irVersion ${materials.irVersion().asString()}: unsupported major version (this validator supports ${SUPPORTED_IR_MAJOR}.x.x)`,
      );
    }
    errors.push(...materials.schemaErrors().toArray().map((message) => message.asString()));

    // 意味検査とトレーサビリティはスキーマ妥当な IR にのみ意味がある。
    if (errors.length === 0) {
      errors.push(...materials.view().wellFormednessErrors());

      const index = materials.functionalRequirementReferenceIndex();
      const source = this.#requirementsSourceRepository.findById(materials.sourceId());
      if (!source.ok) {
        errors.push("requirements.md not found under this intent record — frRefs cannot be reverse-verified");
      } else {
        errors.push(...index.missingErrors(source.value.knownIds()));
        errors.push(...SourceAnchor.of(materials.declaredDigest(), source.value.digest()).errors());
      }
    }

    return { kind: "verdict", pass: errors.length === 0, errors };
  }
}
