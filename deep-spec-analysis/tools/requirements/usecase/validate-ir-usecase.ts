// ValidateIrUseCase — 契約1 IR の決定論的検査（ir-valid センサーの本体）。
// 旧 aidlc-sensor-deep-spec-ir-valid.ts の main からの逐語移植：検査の順序と
// エラーの積み方が観測面（errors[] の並び）なので、そのまま保存する。
//
// 順序の凍結点：材料が組めない失敗（フェンス／JSON／スキーマファイル）は
// irVersion チェックより前に verdict へ落ち、irVersion のエラーは捨てられる。
// 意味検査と逆トレーサビリティは、スキーマ検証まで無傷の IR にのみ走る。

import {
  FrReferenceIndex,
  SUPPORTED_IR_MAJOR,
  SourceAnchor,
  modelWellFormednessErrors,
} from "../domain/index.ts";
import type {
  IrValidationMaterialsRepository,
  RequirementsSourceRepository,
} from "./ir-validation-materials-repository.ts";
import type { ValidateIrOutcome } from "./validate-ir-outcome.ts";

export class ValidateIrUseCase {
  readonly #materials: IrValidationMaterialsRepository;
  readonly #source: RequirementsSourceRepository;

  constructor(materials: IrValidationMaterialsRepository, source: RequirementsSourceRepository) {
    this.#materials = materials;
    this.#source = source;
  }

  execute(outputPath: string): ValidateIrOutcome {
    const acquired = this.#materials.acquire(outputPath);
    if (acquired.kind === "not-applicable") return { kind: "not-applicable" };
    if (acquired.kind === "unreadable") {
      return { kind: "verdict", pass: false, errors: acquired.errors };
    }
    const materials = acquired.materials;

    const errors: string[] = [];
    const major = Number.parseInt(materials.irVersion.split(".")[0] ?? "", 10);
    if (Number.isInteger(major) && major !== SUPPORTED_IR_MAJOR) {
      errors.push(
        `irVersion ${materials.irVersion}: unsupported major version (this validator supports ${SUPPORTED_IR_MAJOR}.x.x)`,
      );
    }
    errors.push(...materials.schemaErrors);

    // 意味検査とトレーサビリティはスキーマ妥当な IR にのみ意味がある。
    if (errors.length === 0) {
      errors.push(...modelWellFormednessErrors(materials.view));

      const index = FrReferenceIndex.of(materials.frClaims);
      const source = this.#source.resolve(outputPath);
      if (source === null) {
        errors.push("requirements.md not found under this intent record — frRefs cannot be reverse-verified");
      } else {
        errors.push(...index.missingErrors(source.knownIds));
        errors.push(...SourceAnchor.of(materials.declaredDigest, source.digest).errors());
      }
    }

    return { kind: "verdict", pass: errors.length === 0, errors };
  }
}
