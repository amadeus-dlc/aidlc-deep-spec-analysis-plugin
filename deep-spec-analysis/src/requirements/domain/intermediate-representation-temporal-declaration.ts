import { parseConstruction, type ParseError, type Result } from "@deep-spec/kernel-infrastructure";
import { ExpressionTree } from "@deep-spec/kernel-domain";
import type { Expression } from "@deep-spec/kernel-domain";

// 契約1 要件 IR の時相宣言（well-formedness 検査材料）: always の assert、
// leads-to の from / to。式の巡回（いずれも prime 禁止）は宣言自身の知識
// （#71 波14）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type IntermediateRepresentationTemporalDeclarationParam = { assert?: Expression; from?: Expression; to?: Expression };

export class IntermediateRepresentationTemporalDeclaration {
  readonly #assert: Expression | undefined;
  readonly #from: Expression | undefined;
  readonly #to: Expression | undefined;

  private constructor(props: IntermediateRepresentationTemporalDeclarationParam) {
    this.#assert = props.assert === undefined ? undefined : ExpressionTree.of(props.assert).asExpression();
    this.#from = props.from === undefined ? undefined : ExpressionTree.of(props.from).asExpression();
    this.#to = props.to === undefined ? undefined : ExpressionTree.of(props.to).asExpression();
  }

  static parse(props: IntermediateRepresentationTemporalDeclarationParam): Result<IntermediateRepresentationTemporalDeclaration, ParseError> {
    return parseConstruction(() => new IntermediateRepresentationTemporalDeclaration(props));
  }

  static of(props: IntermediateRepresentationTemporalDeclarationParam): IntermediateRepresentationTemporalDeclaration {
    return new IntermediateRepresentationTemporalDeclaration(props);
  }

  // assert → from → to の順に、存在する式だけを訪ねる（凍結順）。
  inspectExpressions(visitor: (expression: Expression, primesAllowed: boolean) => void): void {
    if (this.#assert !== undefined) visitor(this.#assert, false);
    if (this.#from !== undefined) visitor(this.#from, false);
    if (this.#to !== undefined) visitor(this.#to, false);
  }
}
