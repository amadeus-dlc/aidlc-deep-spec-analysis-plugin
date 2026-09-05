import { ExpressionTree } from "@deep-spec/kernel-domain";
import type { Expression } from "@deep-spec/kernel-domain";
import type { BackgroundAssumptionId } from "./background-assumption-id.ts";

// 要件 IR の背景仮定 1 件——id と表明。コンパイラは id で名前を付け、表明を
// 自分の言語へ落とす（#71 波25）。
export class BackgroundAssumption {
  readonly #id: BackgroundAssumptionId;
  readonly #assert: Expression;

  private constructor(id: BackgroundAssumptionId, assert: Expression) {
    this.#id = id;
    this.#assert = ExpressionTree.of(assert).asExpression();
  }

  static reconstitute(props: { id: BackgroundAssumptionId; assert: Expression }): BackgroundAssumption {
    return new BackgroundAssumption(props.id, props.assert);
  }

  id(): BackgroundAssumptionId {
    return this.#id;
  }

  assertion(): Expression {
    return this.#assert;
  }
}
