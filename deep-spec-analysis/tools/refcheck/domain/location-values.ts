// 位置語彙 — 成果物内の行番号（1-based）とフェンスブロック序数（1-based）の
// ドメインプリミティブ。witness element の凍結文言（`(line N)` / `#N`）へ
// 値を供給する側で、描画そのものは呼び手の凍結面に残る。

import { type Result, err, ok } from "../../kernel/infrastructure/index.ts";

export type LocationError = { readonly kind: "non-positive-location"; readonly raw: number };

export class LineNumber {
  readonly #value: number;

  private constructor(value: number) {
    this.#value = value;
  }

  static parse(raw: number): Result<LineNumber, LocationError> {
    if (!Number.isInteger(raw) || raw < 1) return err({ kind: "non-positive-location", raw });
    return ok(new LineNumber(raw));
  }

  static reconstitute(raw: number): LineNumber {
    return new LineNumber(raw);
  }

  equals(other: LineNumber): boolean {
    return this.#value === other.#value;
  }

  asNumber(): number {
    return this.#value;
  }
}

export class BlockIndex {
  readonly #value: number;

  private constructor(value: number) {
    this.#value = value;
  }

  static parse(raw: number): Result<BlockIndex, LocationError> {
    if (!Number.isInteger(raw) || raw < 1) return err({ kind: "non-positive-location", raw });
    return ok(new BlockIndex(raw));
  }

  static reconstitute(raw: number): BlockIndex {
    return new BlockIndex(raw);
  }

  equals(other: BlockIndex): boolean {
    return this.#value === other.#value;
  }

  asNumber(): number {
    return this.#value;
  }
}
