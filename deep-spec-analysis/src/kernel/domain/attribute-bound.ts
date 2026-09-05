import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
// int 属性の有界境界（Quint バックエンドの有限領域要件）。要件 IR と
// 設計 IR の decl 束が共有する語彙のため kernel に置く（FrRefs と同じ扱い）。

export class AttributeBound {
  readonly #value: number;

  private constructor(raw: number) {
    if (!Number.isInteger(raw)) throw new IllegalArgumentException({ kind: "non-integer-bound", raw });
    // 安全整数範囲外は number として正確でない（凍結解除 #34 項 4）。
    if (!Number.isSafeInteger(raw)) throw new IllegalArgumentException({ kind: "unsafe-bound", raw });
    this.#value = raw;
  }

  static of(raw: number): AttributeBound {
    return new AttributeBound(raw);
  }

  static parse(raw: number): Result<AttributeBound, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new AttributeBound(raw));
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
