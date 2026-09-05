import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec/kernel-infrastructure";
import type { StageScope } from "./stage-scope.ts";

export class StageScopes {
  readonly #values: readonly StageScope[];
  /** stage宣言の処理予算は1,024スコープ。コピーより先に確認する。 */
  private constructor(values: readonly StageScope[]) {
    if (values.length > 1024) throw new IllegalArgumentException({ kind: "too-many-stage-scopes", raw: values.length });
    this.#values = Object.freeze([...values]);
  }
  static of(values: readonly StageScope[]): StageScopes {
    return new StageScopes(values);
  }
  static parse(values: readonly StageScope[]): Result<StageScopes, ParseError> {
    return parseConstruction(() => new StageScopes(values));
  }
  includes(scope: StageScope): boolean {
    return this.#values.some((value) => value.equals(scope));
  }
  *[Symbol.iterator](): Iterator<StageScope> {
    yield* this.#values;
  }
}
