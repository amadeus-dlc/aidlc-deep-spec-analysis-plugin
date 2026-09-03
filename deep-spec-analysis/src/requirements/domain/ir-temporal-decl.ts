import type { Expression } from "@deep-spec/kernel-domain";

// 契約1 要件 IR の時相宣言（well-formedness 検査材料）: always の assert、
// leads-to の from / to。式の巡回（いずれも prime 禁止）は宣言自身の知識
// （#71 波14）。
export class IrTemporalDecl {
  readonly #assert: Expression | undefined;
  readonly #from: Expression | undefined;
  readonly #to: Expression | undefined;

  private constructor(props: { assert?: Expression; from?: Expression; to?: Expression }) {
    this.#assert = props.assert;
    this.#from = props.from;
    this.#to = props.to;
  }

  static reconstitute(props: { assert?: Expression; from?: Expression; to?: Expression }): IrTemporalDecl {
    return new IrTemporalDecl(props);
  }

  // assert → from → to の順に、存在する式だけを訪ねる（凍結順）。
  inspectExpressions(visitor: (expression: Expression, primesAllowed: boolean) => void): void {
    if (this.#assert !== undefined) visitor(this.#assert, false);
    if (this.#from !== undefined) visitor(this.#from, false);
    if (this.#to !== undefined) visitor(this.#to, false);
  }
}
