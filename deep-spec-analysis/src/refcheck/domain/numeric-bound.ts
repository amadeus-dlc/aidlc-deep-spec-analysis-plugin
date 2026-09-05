import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";

export class NumericBound {
  readonly #value: number;
  private constructor(raw: number) {
    if (!Number.isFinite(raw)) throw new IllegalArgumentException({ kind: "not-finite", raw });
    this.#value = raw;
  }
  static of(raw: number): NumericBound {
    return new NumericBound(raw);
  }

  static parse(raw: number): Result<NumericBound, ParseError> {
    return parseConstruction(() => new NumericBound(raw));
  }
  equals(other: NumericBound): boolean {
    return this.#value === other.#value;
  }
  asNumber(): number {
    return this.#value;
  }
  // FD-E3: 範囲逆転（min > max）の判定は境界自身の知識。
  exceeds(other: NumericBound): boolean {
    return this.#value > other.#value;
  }
}
