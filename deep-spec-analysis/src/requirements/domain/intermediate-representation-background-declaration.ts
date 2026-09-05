import type { Expression } from "@deep-spec/kernel-domain";
import { ExpressionTree } from "@deep-spec/kernel-domain";
import { type ParseError, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
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

  id(): BackgroundAssumptionIdentifier {
    return this.#id;
  }

  // 背景仮定が抱える唯一の式（不在は沈黙——黙殺条件はパーサ側で確定済み）。
  assertion(): Expression | undefined {
    return this.#assert;
  }

  // 式の役割は宣言が命じる: 背景仮定に prime は許されない（primesAllowed は
  // 常に false で届く）。呼び出し側が false を知る必要はない。
  inspectExpressions(visitor: (expression: Expression, primesAllowed: boolean) => void): void {
    if (this.#assert !== undefined) visitor(this.#assert, false);
  }
}
