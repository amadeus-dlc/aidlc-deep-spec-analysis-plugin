// IntermediateRepresentationValidationMaterials 集約 — 契約1 IR の well-formedness 検査材料。
// スキーマ検証を通過するまでのアダプタ知識（フェンス抽出・JSON 解釈・
// スキーマ検証・逆トレーサビリティ材料の抽出）が門で組み上げ、ドメインへは
// 検査語彙だけが届く。恒等は形式モデル成果物への 1:1 錨着
// （RefinementMaterialsIdentifier と同じ規律）。sourceDocument は成果物の原文
// （原文材料——store の往復則 findById∘store がバイト恒等になる永続化面）。

import type { DeclaredDigest, ErrorMessages, IntermediateRepresentationVersion } from "@deep-spec/kernel-domain";
import type { FunctionalRequirementReferenceClaims } from "./functional-requirement-reference-claims.ts";
import { FunctionalRequirementReferenceIndex } from "./functional-requirement-reference-index.ts";
import type { IntermediateRepresentationModelDeclaration } from "./intermediate-representation-model-declaration.ts";
import type { IntermediateRepresentationValidationMaterialsIdentifier } from "./intermediate-representation-validation-materials-identifier.ts";
import type { RequirementsSourceIdentifier } from "./requirements-source-identifier.ts";

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

  id(): IntermediateRepresentationValidationMaterialsIdentifier {
    return this.#id;
  }

  irVersion(): IntermediateRepresentationVersion {
    return this.#irVersion;
  }

  schemaErrors(): ErrorMessages {
    return this.#schemaErrors;
  }

  view(): IntermediateRepresentationModelDeclaration {
    return this.#view;
  }

  // 逆トレーサビリティ索引は集約自身が組む（Tell-Don't-Ask）。
  functionalRequirementReferenceIndex(): FunctionalRequirementReferenceIndex {
    return FunctionalRequirementReferenceIndex.of(this.#functionalRequirementReferenceClaims.toArray());
  }

  declaredDigest(): DeclaredDigest | null {
    return this.#declaredDigest;
  }

  sourceId(): RequirementsSourceIdentifier {
    return this.#sourceId;
  }

  // 境界: store が書く原文（バイト逐語——UTF-8 復号で非可逆にならないよう生
  // バイト列で保持し、外部からの変更を防ぐため構築・照会の両方で防御コピー）。
  sourceDocument(): Uint8Array {
    return new Uint8Array(this.#sourceDocument);
  }
}
