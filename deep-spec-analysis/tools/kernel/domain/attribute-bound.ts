// int 属性の有界境界（Quint バックエンドの有限領域要件）。要件 IR と
// 設計 IR の decl 束が共有する語彙のため kernel に置く（FrRefs と同じ扱い）。

import { type Result, err, ok } from "../infrastructure/index.ts";

export type AttributeBoundError = { readonly kind: "non-integer-bound"; readonly raw: number };

export class AttributeBound {
  readonly #value: number;

  private constructor(value: number) {
    this.#value = value;
  }

  static parse(raw: number): Result<AttributeBound, AttributeBoundError> {
    if (!Number.isInteger(raw)) return err({ kind: "non-integer-bound", raw });
    return ok(new AttributeBound(raw));
  }

  static reconstitute(raw: number): AttributeBound {
    return new AttributeBound(raw);
  }

  equals(other: AttributeBound): boolean {
    return this.#value === other.#value;
  }

  asNumber(): number {
    return this.#value;
  }

  // min > max の範囲逆転判定は境界自身の知識（well-formedness の凍結文言が使う）。
  exceeds(other: AttributeBound): boolean {
    return this.#value > other.#value;
  }
}
