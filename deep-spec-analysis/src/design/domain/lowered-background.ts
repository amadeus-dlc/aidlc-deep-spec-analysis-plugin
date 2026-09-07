import type { Expression } from "@deep-spec-analysis/kernel-domain";
import { ExpressionTree } from "@deep-spec-analysis/kernel-domain";
import {
  canonicalStringify,
  combinedHash,
  hashOfString,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";

import type { LoweredIdentifier } from "./lowered-identifier.ts";
import { sameExpression } from "./value-equality.ts";

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

  equals(other: LoweredBackground): boolean {
    return this.#id.equals(other.#id) && sameExpression(this.#assert, other.#assert);
  }

  hashCode(): number {
    return combinedHash([this.#id.hashCode(), hashOfString(canonicalStringify(this.#assert))]);
  }

  id(): LoweredIdentifier {
    return this.#id;
  }

  assertion(): Expression {
    return this.#assert;
  }
}
