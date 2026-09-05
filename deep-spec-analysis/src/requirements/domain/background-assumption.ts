import { parseConstruction, type ParseError, type Result } from "@deep-spec/kernel-infrastructure";
import { ExpressionTree } from "@deep-spec/kernel-domain";
import type { Expression } from "@deep-spec/kernel-domain";

import type { BackgroundAssumptionIdentifier } from "./background-assumption-identifier.ts";

// 要件 IR の背景仮定 1 件——id と表明。コンパイラは id で名前を付け、表明を
// 自分の言語へ落とす（#71 波25）。
type BackgroundAssumptionParam = { id: BackgroundAssumptionIdentifier; assert: Expression };

export class BackgroundAssumption {
  readonly #id: BackgroundAssumptionIdentifier;
  readonly #assert: Expression;

  private constructor(props: BackgroundAssumptionParam) {
    this.#id = props.id;
    this.#assert = ExpressionTree.of(props.assert).asExpression();
  }

  static parse(props: BackgroundAssumptionParam): Result<BackgroundAssumption, ParseError> {
    return parseConstruction(() => new BackgroundAssumption(props));
  }

  static of(props: BackgroundAssumptionParam): BackgroundAssumption {
    return new BackgroundAssumption(props);
  }

  id(): BackgroundAssumptionIdentifier {
    return this.#id;
  }

  assertion(): Expression {
    return this.#assert;
  }
}
