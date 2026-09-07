// DesignIntermediateRepresentationValidationMaterials 集約 — 契約3 設計 IR の well-formedness 検査材料。
// フェンス抽出・JSON 解釈・スキーマ検証・ユニットごとの BR 材料の解決までを
// アダプタが門で済ませ、ドメインへは検査語彙だけが届く。恒等は設計形式モデル
// 成果物への 1:1 錨着（RefinementMaterialsIdentifier と同じ規律）。sourceDocument は
// 成果物の原文（原文材料——store の往復則 findById∘store がバイト恒等）。

import {
  ErrorMessage,
  ErrorMessages,
  type IntermediateRepresentationVersion,
  ValidationAssessment,
} from "@deep-spec-analysis/kernel-domain";
import { ok, type ParseError, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignIntermediateRepresentationValidationMaterialsIdentifier } from "./design-intermediate-representation-validation-materials-identifier.ts";
import { SUPPORTED_DESIGN_IR_MAJOR } from "./design-report.ts";
import type { DesignUnitDeclarations } from "./design-unit-declarations.ts";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type DesignIntermediateRepresentationValidationMaterialsParam = {
  readonly id: DesignIntermediateRepresentationValidationMaterialsIdentifier;
  readonly irVersion: IntermediateRepresentationVersion;
  readonly schemaErrors: ErrorMessages;
  readonly units: DesignUnitDeclarations;
  readonly sourceDocument: Uint8Array;
};

export class DesignIntermediateRepresentationValidationMaterials {
  readonly #id: DesignIntermediateRepresentationValidationMaterialsIdentifier;
  readonly #irVersion: IntermediateRepresentationVersion;
  readonly #schemaErrors: ErrorMessages;
  readonly #units: DesignUnitDeclarations;
  readonly #sourceDocument: Uint8Array;

  private constructor(seed: DesignIntermediateRepresentationValidationMaterialsParam) {
    this.#id = seed.id;
    this.#irVersion = seed.irVersion;
    this.#schemaErrors = seed.schemaErrors;
    this.#units = seed.units;
    this.#sourceDocument = new Uint8Array(seed.sourceDocument);
  }

  // アダプタの寛容パースからの唯一の構築口。
  static of(
    seed: DesignIntermediateRepresentationValidationMaterialsParam,
  ): DesignIntermediateRepresentationValidationMaterials {
    return new DesignIntermediateRepresentationValidationMaterials(seed);
  }

  id(): DesignIntermediateRepresentationValidationMaterialsIdentifier {
    return this.#id;
  }

  assess(): ValidationAssessment {
    return ValidationAssessment.of(ErrorMessages.collect(this.#diagnostics()));
  }

  // 診断の発生順：版の不支持 → schema 誤り → ユニット診断（schema が通ったときだけ）。
  #diagnostics(): Result<ErrorMessage, ParseError>[] {
    const supported = this.#irVersion.supportsMajor(SUPPORTED_DESIGN_IR_MAJOR);
    const diagnostics: Result<ErrorMessage, ParseError>[] = [];
    if (!supported) {
      diagnostics.push(
        ErrorMessage.parse(
          `irVersion ${this.#irVersion.asString()}: unsupported major version (this validator supports ${SUPPORTED_DESIGN_IR_MAJOR}.x.x)`,
        ),
      );
    }
    this.#schemaErrors.foldLeft(diagnostics, (acc, error) => {
      acc.push(ok(error));
      return acc;
    });
    if (supported && this.#schemaErrors.isEmpty()) {
      this.#units.diagnostics().foldLeft(diagnostics, (acc, error) => {
        acc.push(ok(error));
        return acc;
      });
    }
    return diagnostics;
  }

  // 境界: store が書く原文（バイト逐語——UTF-8 復号で非可逆にならないよう生
  // バイト列で保持し、外部からの変更を防ぐため構築・照会の両方で防御コピー）。
  sourceDocument(): Uint8Array {
    return new Uint8Array(this.#sourceDocument);
  }
}
