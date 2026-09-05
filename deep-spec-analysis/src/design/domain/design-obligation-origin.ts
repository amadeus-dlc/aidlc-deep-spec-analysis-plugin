import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
// 義務の起源（"" は未宣言・"rules" は BR 由来——decl 側の要求検査が使う語彙と
// 同じ閉集合。未知値は素通し）。
export class DesignObligationOrigin {
  readonly #value: string;

  /** 128 UTF-16コード単位までの宣言を保持する。空宣言は診断対象として有効。 */
  private constructor(value: string) {
    if (value.length > 128)
      throw new IllegalArgumentException({ kind: "design-obligation-origin-too-long", raw: value.length });

    this.#value = value;
  }

  static parse(value: string): Result<DesignObligationOrigin, ParseError> {
    return parseConstruction(() => new DesignObligationOrigin(value));
  }

  static of(raw: string): DesignObligationOrigin {
    return new DesignObligationOrigin(raw);
  }

  equals(other: DesignObligationOrigin): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }

  isRules(): boolean {
    return this.#value === "rules";
  }
}
