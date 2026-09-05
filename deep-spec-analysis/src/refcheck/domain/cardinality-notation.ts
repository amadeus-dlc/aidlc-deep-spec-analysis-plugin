import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

const CARDINALITIES = new Set(["1:1", "1:N", "N:1", "N:M"]);

export class CardinalityNotation {
  readonly #value: string;
  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw: string): CardinalityNotation {
    return new CardinalityNotation(raw);
  }

  static parse(raw: string): Result<CardinalityNotation, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new CardinalityNotation(raw));
  }
  equals(other: CardinalityNotation): boolean { return this.#value === other.#value; }
  asString(): string { return this.#value; }
  // 閉集合（1:1 | 1:N | N:1 | N:M）との照合形：大文字化・空白除去（凍結挙動）。
  normalizedToken(): string { return this.#value.toUpperCase().replace(/\s/g, ""); }
  isInClosedSet(): boolean { return CARDINALITIES.has(this.normalizedToken()); }
}
