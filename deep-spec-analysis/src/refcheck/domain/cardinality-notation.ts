import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

const CARDINALITIES = new Set(["1:1", "1:N", "N:1", "N:M"]);

export class CardinalityNotation {
  readonly #value: string;
  /** 多重度の宣言表記の処理予算。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 128)
      throw new IllegalArgumentException({ kind: "cardinality-notation-too-long", raw: raw.length });
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw: string): CardinalityNotation {
    return new CardinalityNotation(raw);
  }

  static parse(raw: string): Result<CardinalityNotation, ParseError> {
    return parseConstruction(() => new CardinalityNotation(raw));
  }
  equals(other: CardinalityNotation): boolean {
    return this.#value === other.#value;
  }
  asString(): string {
    return this.#value;
  }
  // 閉集合（1:1 | 1:N | N:1 | N:M）との照合形：大文字化・空白除去（凍結挙動）。
  normalizedToken(): string {
    return this.#value.toUpperCase().replace(/\s/g, "");
  }
  isInClosedSet(): boolean {
    return CARDINALITIES.has(this.normalizedToken());
  }
}
