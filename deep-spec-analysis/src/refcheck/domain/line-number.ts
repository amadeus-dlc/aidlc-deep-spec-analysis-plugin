import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
// 位置語彙 — 成果物内の行番号（1-based）とフェンスブロック序数（1-based）の
// ドメインプリミティブ。witness element の凍結文言（`(line N)` / `#N`）へ
// 値を供給する側で、描画そのものは呼び手の凍結面に残る。

export class LineNumber {
  readonly #value: number;

  private constructor(raw: number) {
    if (!Number.isInteger(raw) || raw < 1) throw new IllegalArgumentException({ kind: "non-positive-location", raw });
    this.#value = raw;
  }

  static of(raw: number): LineNumber {
    return new LineNumber(raw);
  }

  static parse(raw: number): Result<LineNumber, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new LineNumber(raw));
  }

  equals(other: LineNumber): boolean {
    return this.#value === other.#value;
  }

  asNumber(): number {
    return this.#value;
  }
}

