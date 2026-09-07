// 契約1 IR の well-formedness 検査材料。スキーマ検証を通過した IR を、
// アダプタの寛容パースが型付きに解体したもの——「Json をどう読むか」は
// アダプタの知識で、ここには構造だけが残る。束はファーストクラス
// コレクションで運び、意味的整合性（旧 modelWellFormednessErrors——一意な
// id、解決可能な属性参照、enum リテラルの所属、prime の合法性）は
// IntermediateRepresentationModelDeclaration 自身の振る舞い（OOUI 裁定）。エラー文言と発生順序は ir-valid
// の errors[] としてそのまま観測面に出る凍結面。
//
// 旧 ir-valid センサーのローカル semanticErrors が生 Json を直接走査していた
// ときの黙殺条件（isObject / typeof チェック）はパーサ側へ移り、ここに来る
// 時点で型は確定している。

import { ErrorMessage, ErrorMessages } from "@deep-spec-analysis/kernel-domain";
import { IntermediateRepresentationAttributeCatalog } from "./intermediate-representation-attribute-catalog.ts";
import type { IntermediateRepresentationBackgroundDeclarations } from "./intermediate-representation-background-declarations.ts";
import type { IntermediateRepresentationEntityDeclarations } from "./intermediate-representation-entity-declarations.ts";
import type { IntermediateRepresentationObligationDeclarations } from "./intermediate-representation-obligation-declarations.ts";
import type { IntermediateRepresentationScenarioDeclarations } from "./intermediate-representation-scenario-declarations.ts";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type IntermediateRepresentationModelDeclarationParam = {
  readonly entities: IntermediateRepresentationEntityDeclarations;
  readonly obligations: IntermediateRepresentationObligationDeclarations;
  readonly scenarios: IntermediateRepresentationScenarioDeclarations;
  readonly background: IntermediateRepresentationBackgroundDeclarations;
};

export class IntermediateRepresentationModelDeclaration {
  readonly #entities: IntermediateRepresentationEntityDeclarations;
  readonly #obligations: IntermediateRepresentationObligationDeclarations;
  readonly #scenarios: IntermediateRepresentationScenarioDeclarations;
  readonly #background: IntermediateRepresentationBackgroundDeclarations;

  private constructor(seed: IntermediateRepresentationModelDeclarationParam) {
    this.#entities = seed.entities;
    this.#obligations = seed.obligations;
    this.#scenarios = seed.scenarios;
    this.#background = seed.background;
  }

  // アダプタの寛容パースからの唯一の構築口。
  static of(seed: IntermediateRepresentationModelDeclarationParam): IntermediateRepresentationModelDeclaration {
    return new IntermediateRepresentationModelDeclaration(seed);
  }

  // ModelWellFormedness — スキーマを超えた意味的整合性（旧
  // modelWellFormednessErrors の逐語移植）。診断は文字列で積んでから collect
  // へ渡す——表現予算を超えても検査そのものを panic で失わないため。
  diagnostics(): ErrorMessages {
    return ErrorMessages.collect(this.diagnosticStrings().map(ErrorMessage.parse));
  }

  // 境界: 診断の表現予算は呼び手の ErrorMessages.collect が守るので、
  // ここは文字列のまま返す。
  diagnosticStrings(): string[] {
    const errors: string[] = [...this.#entities.diagnosticStrings()];
    const parsed = IntermediateRepresentationAttributeCatalog.parse(this.#entities);
    const catalog = parsed.ok ? parsed.value : null;
    if (!parsed.ok && parsed.error.kind !== "ambiguous-requirement-attributes")
      errors.push(`schema: attribute catalog: ${parsed.error.kind}`);
    if (catalog !== null) errors.push(...catalog.diagnosticStrings());
    // id は宣言の種別をまたいで一意——既出 id の台帳を 3 つの宣言列で持ち回る。
    const seenIds = new Set<string>();
    errors.push(...this.#obligations.diagnosticStrings(catalog, seenIds));
    errors.push(...this.#scenarios.diagnosticStrings(catalog, seenIds));
    errors.push(...this.#background.diagnosticStrings(catalog, seenIds));
    return errors;
  }
}
