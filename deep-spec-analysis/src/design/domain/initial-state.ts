import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

// 状態機械で初期状態として指定した状態。所属先の状態宣言との照合は機械が担う。
export class InitialState {
  readonly #value: string;

  /** 列挙メンバーと同じ4,096 UTF-16コード単位の処理予算。 */
  private constructor(value: string) {
    if (value.length > 4096) throw new IllegalArgumentException({ kind: "initial-state-too-long", raw: value.length });
    this.#value = value;
  }

  static of(value: string): InitialState {
    return new InitialState(value);
  }
  static parse(value: string): Result<InitialState, ParseError> {
    return parseConstruction(() => new InitialState(value));
  }
  matchesName(value: string): boolean {
    return this.#value === value;
  }
  asString(): string {
    return this.#value;
  }
}
