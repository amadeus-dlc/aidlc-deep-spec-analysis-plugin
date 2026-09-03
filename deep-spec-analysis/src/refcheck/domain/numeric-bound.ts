import { err, ok } from "@deep-spec/kernel-infrastructure";
import type { Result } from "@deep-spec/kernel-infrastructure";

type BoundError = { readonly kind: "not-finite"; readonly raw: number };

export class NumericBound {
  readonly #value: number;
  private constructor(value: number) { this.#value = value; }
  static parse(raw: number): Result<NumericBound, BoundError> {
    if (!Number.isFinite(raw)) return err({ kind: "not-finite", raw });
    return ok(new NumericBound(raw));
  }
  static reconstitute(raw: number): NumericBound { return new NumericBound(raw); }
  equals(other: NumericBound): boolean { return this.#value === other.#value; }
  asNumber(): number { return this.#value; }
  // FD-E3: 範囲逆転（min > max）の判定は境界自身の知識。
  exceeds(other: NumericBound): boolean { return this.#value > other.#value; }
}
