import { err, ok } from "@deep-spec/kernel-infrastructure";
import type { Result } from "@deep-spec/kernel-infrastructure";

const CARDINALITIES = new Set(["1:1", "1:N", "N:1", "N:M"]);

type TokenError = { readonly kind: "empty-token"; readonly raw: string };

export class CardinalityNotation {
  readonly #value: string;
  private constructor(value: string) { this.#value = value; }
  static parse(raw: string): Result<CardinalityNotation, TokenError> {
    if (raw === "") return err({ kind: "empty-token", raw });
    return ok(new CardinalityNotation(raw));
  }
  static reconstitute(raw: string): CardinalityNotation { return new CardinalityNotation(raw); }
  equals(other: CardinalityNotation): boolean { return this.#value === other.#value; }
  asString(): string { return this.#value; }
  // 閉集合（1:1 | 1:N | N:1 | N:M）との照合形：大文字化・空白除去（凍結挙動）。
  normalizedToken(): string { return this.#value.toUpperCase().replace(/\s/g, ""); }
  isInClosedSet(): boolean { return CARDINALITIES.has(this.normalizedToken()); }
}
