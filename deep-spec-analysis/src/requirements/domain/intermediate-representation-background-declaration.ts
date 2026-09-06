import type { Expression } from "@deep-spec-analysis/kernel-domain";
import { ErrorMessage, ErrorMessages, ExpressionTree } from "@deep-spec-analysis/kernel-domain";
import { type ParseError, parseConstruction, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { IntermediateRepresentationAttributeCatalog } from "./intermediate-representation-attribute-catalog.ts";
// 契約1 IR の背景仮定宣言。抱える式の列挙と prime 禁止（背景仮定は常に
// 無prime）は宣言自身が所有する——波3の義務／シナリオと同じ裁定（#71 波4）。

import type { BackgroundAssumptionIdentifier } from "./background-assumption-identifier.ts";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type IntermediateRepresentationBackgroundDeclarationParam = { id: BackgroundAssumptionIdentifier; assert?: Expression };

export class IntermediateRepresentationBackgroundDeclaration {
  readonly #id: BackgroundAssumptionIdentifier;
  readonly #assert: Expression | undefined;

  private constructor(props: IntermediateRepresentationBackgroundDeclarationParam) {
    this.#id = props.id;
    this.#assert = props.assert === undefined ? undefined : ExpressionTree.of(props.assert).asExpression();
  }

  static parse(
    props: IntermediateRepresentationBackgroundDeclarationParam,
  ): Result<IntermediateRepresentationBackgroundDeclaration, ParseError> {
    return parseConstruction(() => new IntermediateRepresentationBackgroundDeclaration(props));
  }

  static of(
    props: IntermediateRepresentationBackgroundDeclarationParam,
  ): IntermediateRepresentationBackgroundDeclaration {
    return new IntermediateRepresentationBackgroundDeclaration(props);
  }

  diagnostics(catalog: IntermediateRepresentationAttributeCatalog): ErrorMessages {
    const context = `background ${this.#id.asString()}`;
    const errors: string[] = [];
    if (this.#assert !== undefined)
      for (const message of catalog.expressionDiagnostics(this.#assert, context, false))
        errors.push(message.asString());
    return ErrorMessages.collect(errors.map(ErrorMessage.parse));
  }

  id(): BackgroundAssumptionIdentifier {
    return this.#id;
  }
}
