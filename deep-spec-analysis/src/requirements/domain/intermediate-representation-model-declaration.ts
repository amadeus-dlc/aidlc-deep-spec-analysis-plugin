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

import { ErrorMessage, ErrorMessages, type Expression } from "@deep-spec-analysis/kernel-domain";
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
  // modelWellFormednessErrors の逐語移植）。
  diagnostics(): ErrorMessages {
    const errors: string[] = [];
    for (const message of this.#entities.diagnostics()) errors.push(message.asString());
    const parsed = IntermediateRepresentationAttributeCatalog.parse(this.#entities);
    const catalog = parsed.ok ? parsed.value : null;
    if (!parsed.ok && parsed.error.kind !== "ambiguous-requirement-attributes")
      errors.push(`schema: attribute catalog: ${parsed.error.kind}`);
    if (catalog !== null) for (const message of catalog.diagnostics()) errors.push(message.asString());
    const checkExpr = (expression: Expression, where: string, primesAllowed: boolean): void => {
      if (catalog !== null)
        for (const message of catalog.expressionDiagnostics(expression, where, primesAllowed))
          errors.push(message.asString());
    };

    const seenIds = new Set<string>();
    const dupCheck = (id: string, where: string): void => {
      if (seenIds.has(id)) errors.push(`${where}: duplicate id "${id}"`);
      seenIds.add(id);
    };

    for (const ob of this.#obligations) {
      const where = `obligation ${ob.id().asString()}`;
      dupCheck(ob.id().asString(), where);
      ob.inspectExpressions((expression, primesAllowed) => checkExpr(expression, where, primesAllowed));
    }

    for (const sc of this.#scenarios) {
      const where = `scenario ${sc.id().asString()}`;
      dupCheck(sc.id().asString(), where);
      if (catalog !== null)
        for (const message of catalog.bindingDiagnostics(sc.bindings(), where)) errors.push(message.asString());
      sc.inspectExpectation((expression, primesAllowed) => checkExpr(expression, where, primesAllowed));
    }

    for (const bg of this.#background) {
      const where = `background ${bg.id().asString()}`;
      dupCheck(bg.id().asString(), where);
      bg.inspectExpressions((expression, primesAllowed) => checkExpr(expression, where, primesAllowed));
    }

    return ErrorMessages.collect(errors.map(ErrorMessage.parse));
  }
}
