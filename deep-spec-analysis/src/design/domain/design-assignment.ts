import type { AttributePath, ExpressionTree } from "@deep-spec-analysis/kernel-domain";

/** 設計イベントが属性へ与える右辺。代入の等式全体とは区別する。 */
export class DesignAssignment {
  readonly #target: AttributePath;
  readonly #rightHandSide: ExpressionTree;

  private constructor(target: AttributePath, rightHandSide: ExpressionTree) {
    this.#target = target;
    this.#rightHandSide = rightHandSide;
  }

  static of(target: AttributePath, rightHandSide: ExpressionTree): DesignAssignment {
    return new DesignAssignment(target, rightHandSide);
  }

  equals(other: DesignAssignment): boolean {
    return this.#target.equals(other.#target) && this.#rightHandSide.equals(other.#rightHandSide);
  }

  target(): AttributePath {
    return this.#target;
  }

  rightHandSide(): ExpressionTree {
    return this.#rightHandSide;
  }
}
