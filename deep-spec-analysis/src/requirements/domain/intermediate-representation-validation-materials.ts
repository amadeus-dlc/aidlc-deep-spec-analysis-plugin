// IntermediateRepresentationValidationMaterials 集約 — 契約1 IR の well-formedness 検査材料。
// スキーマ検証を通過するまでのアダプタ知識（フェンス抽出・JSON 解釈・
// スキーマ検証・逆トレーサビリティ材料の抽出）が門で組み上げ、ドメインへは
// 検査語彙だけが届く。恒等は形式モデル成果物への 1:1 錨着
// （RefinementMaterialsIdentifier と同じ規律）。sourceDocument は成果物の原文
// （原文材料——store の往復則 findById∘store がバイト恒等になる永続化面）。

import {
  type DeclaredDigest,
  ErrorMessage,
  ErrorMessages,
  type IntermediateRepresentationVersion,
  ValidationAssessment,
} from "@deep-spec/kernel-domain";
import { ok, type ParseError, type Result } from "@deep-spec/kernel-infrastructure";
import type { FunctionalRequirementReferenceClaims } from "./functional-requirement-reference-claims.ts";
import { FunctionalRequirementReferenceIndex } from "./functional-requirement-reference-index.ts";
import type { IntermediateRepresentationModelDeclaration } from "./intermediate-representation-model-declaration.ts";
import type { IntermediateRepresentationValidationMaterialsIdentifier } from "./intermediate-representation-validation-materials-identifier.ts";
import type { RequirementsSourceIdentifier } from "./requirements-source-identifier.ts";
import { RequirementsSourceValidation } from "./requirements-source-validation.ts";
import { SUPPORTED_IR_MAJOR } from "./verification-report.ts";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type IntermediateRepresentationValidationMaterialsParam = {
  readonly id: IntermediateRepresentationValidationMaterialsIdentifier;
  readonly irVersion: IntermediateRepresentationVersion;
  readonly schemaErrors: ErrorMessages;
  readonly view: IntermediateRepresentationModelDeclaration;
  readonly functionalRequirementReferenceClaims: FunctionalRequirementReferenceClaims;
  // IR の sourceDigest。文字列でなければ null（宣言なし）。
  readonly declaredDigest: DeclaredDigest | null;
  readonly sourceId: RequirementsSourceIdentifier;
  readonly sourceDocument: Uint8Array;
};

export class IntermediateRepresentationValidationMaterials {
  readonly #id: IntermediateRepresentationValidationMaterialsIdentifier;
  readonly #irVersion: IntermediateRepresentationVersion;
  readonly #schemaErrors: ErrorMessages;
  readonly #view: IntermediateRepresentationModelDeclaration;
  readonly #functionalRequirementReferenceClaims: FunctionalRequirementReferenceClaims;
  readonly #declaredDigest: DeclaredDigest | null;
  readonly #sourceId: RequirementsSourceIdentifier;
  readonly #sourceDocument: Uint8Array;

  private constructor(seed: IntermediateRepresentationValidationMaterialsParam) {
    this.#id = seed.id;
    this.#irVersion = seed.irVersion;
    this.#schemaErrors = seed.schemaErrors;
    this.#view = seed.view;
    this.#functionalRequirementReferenceClaims = seed.functionalRequirementReferenceClaims;
    this.#declaredDigest = seed.declaredDigest;
    this.#sourceId = seed.sourceId;
    this.#sourceDocument = new Uint8Array(seed.sourceDocument);
  }

  // アダプタの寛容パースからの唯一の構築口。
  static of(seed: IntermediateRepresentationValidationMaterialsParam): IntermediateRepresentationValidationMaterials {
    return new IntermediateRepresentationValidationMaterials(seed);
  }

  // バージョンとスキーマが適合した場合だけ、要件原文が必要な検査段階へ進む。
  // callback は取得フローの選択であり、検査の条件・順序・診断はこの集約が所有する。
  validate<T>(cases: {
    complete: (assessment: ValidationAssessment) => T;
    sourceRequired: (id: RequirementsSourceIdentifier, validation: RequirementsSourceValidation) => T;
  }): T {
    const errors = ErrorMessages.collect(this.#initialDiagnostics());
    if (!errors.isEmpty()) return cases.complete(ValidationAssessment.of(errors));
    return cases.sourceRequired(
      this.#sourceId,
      RequirementsSourceValidation.of(
        this.#view,
        FunctionalRequirementReferenceIndex.of(this.#functionalRequirementReferenceClaims.toArray()),
        this.#declaredDigest,
      ),
    );
  }

  *#initialDiagnostics(): Iterable<Result<ErrorMessage, ParseError>> {
    if (!this.#irVersion.supportsMajor(SUPPORTED_IR_MAJOR)) {
      yield ErrorMessage.parse(
        `irVersion ${this.#irVersion.asString()}: unsupported major version (this validator supports ${SUPPORTED_IR_MAJOR}.x.x)`,
      );
    }
    for (const error of this.#schemaErrors) yield ok(error);
  }

  id(): IntermediateRepresentationValidationMaterialsIdentifier {
    return this.#id;
  }

  // 境界: store が書く原文（バイト逐語——UTF-8 復号で非可逆にならないよう生
  // バイト列で保持し、外部からの変更を防ぐため構築・照会の両方で防御コピー）。
  sourceDocument(): Uint8Array {
    return new Uint8Array(this.#sourceDocument);
  }
}
