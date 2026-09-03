// IrValidationMaterials 集約 — 契約1 IR の well-formedness 検査材料。
// スキーマ検証を通過するまでのアダプタ知識（フェンス抽出・JSON 解釈・
// スキーマ検証・逆トレーサビリティ材料の抽出）が門で組み上げ、ドメインへは
// 検査語彙だけが届く。恒等は形式モデル成果物への 1:1 錨着
// （RefinementMaterialsId と同じ規律）。sourceDocument は成果物の原文
// （原文材料——store の往復則 findById∘store がバイト恒等になる永続化面）。

import { type ErrorMessages, type IrVersion, ContentHash } from "@deep-spec/kernel-domain";
import { FrReferenceIndex } from "./fr-reference-index.ts";
import { FrRefClaims } from "./fr-ref-claims.ts";
import type { IrModelDecl } from "./ir-model-decl.ts";
import type { RequirementsSourceId } from "./requirements-source-id.ts";
import { IrValidationMaterialsId } from "./ir-validation-materials-id.ts";



export class IrValidationMaterials {
  readonly #id: IrValidationMaterialsId;
  readonly #irVersion: IrVersion;
  readonly #schemaErrors: ErrorMessages;
  readonly #view: IrModelDecl;
  readonly #frClaims: FrRefClaims;
  readonly #declaredDigest: ContentHash | null;
  readonly #sourceId: RequirementsSourceId;
  readonly #sourceDocument: Uint8Array;

  private constructor(seed: {
    readonly id: IrValidationMaterialsId;
    readonly irVersion: IrVersion;
    readonly schemaErrors: ErrorMessages;
    readonly view: IrModelDecl;
    readonly frClaims: FrRefClaims;
    // IR の sourceDigest。文字列でなければ null（宣言なし）。
    readonly declaredDigest: string | null;
    readonly sourceId: RequirementsSourceId;
    readonly sourceDocument: Uint8Array;
  }) {
    this.#id = seed.id;
    this.#irVersion = seed.irVersion;
    this.#schemaErrors = seed.schemaErrors;
    this.#view = seed.view;
    this.#frClaims = seed.frClaims;
    this.#declaredDigest = seed.declaredDigest === null ? null : ContentHash.reconstitute(seed.declaredDigest);
    this.#sourceId = seed.sourceId;
    this.#sourceDocument = new Uint8Array(seed.sourceDocument);
  }

  // アダプタの寛容パースからの唯一の構築口。
  static reconstitute(seed: {
    readonly id: IrValidationMaterialsId;
    readonly irVersion: IrVersion;
    readonly schemaErrors: ErrorMessages;
    readonly view: IrModelDecl;
    readonly frClaims: FrRefClaims;
    // IR の sourceDigest。文字列でなければ null（宣言なし）。
    readonly declaredDigest: string | null;
    readonly sourceId: RequirementsSourceId;
    readonly sourceDocument: Uint8Array;
  }): IrValidationMaterials {
    return new IrValidationMaterials(seed);
  }

  id(): IrValidationMaterialsId {
    return this.#id;
  }

  irVersion(): IrVersion {
    return this.#irVersion;
  }

  schemaErrors(): ErrorMessages {
    return this.#schemaErrors;
  }

  view(): IrModelDecl {
    return this.#view;
  }

  // 逆トレーサビリティ索引は集約自身が組む（Tell-Don't-Ask）。
  frReferenceIndex(): FrReferenceIndex {
    return FrReferenceIndex.of(this.#frClaims.toArray());
  }

  declaredDigest(): string | null {
    return this.#declaredDigest?.asString() ?? null;
  }

  sourceId(): RequirementsSourceId {
    return this.#sourceId;
  }

  // 境界: store が書く原文（バイト逐語——UTF-8 復号で非可逆にならないよう生
  // バイト列で保持し、外部からの変更を防ぐため構築・照会の両方で防御コピー）。
  sourceDocument(): Uint8Array {
    return new Uint8Array(this.#sourceDocument);
  }
}
