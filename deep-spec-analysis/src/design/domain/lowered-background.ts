import type { Expression } from "@deep-spec/kernel-domain";
import { ExpressionTree } from "@deep-spec/kernel-domain";
import { type ParseError, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

import type { LoweredIdentifier } from "./lowered-identifier.ts";

// lowered v1 背景制約（#71 波20）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type LoweredBackgroundParam = { id: LoweredIdentifier; assert: Expression };

export class LoweredBackground {
  readonly #id: LoweredIdentifier;
  readonly #assert: Expression;

  private constructor(props: LoweredBackgroundParam) {
    this.#id = props.id;
    this.#assert = ExpressionTree.of(props.assert).asExpression();
  }

  static parse(props: LoweredBackgroundParam): Result<LoweredBackground, ParseError> {
    return parseConstruction(() => new LoweredBackground(props));
  }

  static of(props: LoweredBackgroundParam): LoweredBackground {
    return new LoweredBackground(props);
  }

  id(): LoweredIdentifier {
    return this.#id;
  }

  assertion(): Expression {
    return this.#assert;
  }
}
