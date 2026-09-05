import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
import type { NumericBound } from "./numeric-bound.ts";

// default 宣言 — 文書上は文字列または数値（それ以外は宣言なし扱い＝凍結挙動）。
export class AttributeDefault {
  readonly #value: string | number;
  /** 4096 UTF-16コード単位までの宣言を保持する。空宣言は診断対象として有効。 */
  private constructor(value: string | number) {
    if (typeof value === "string" && value.length > 4096)
      throw new IllegalArgumentException({ kind: "attribute-default-too-long", raw: value.length });
    this.#value = value;
  }
  static parse(value: string | number): Result<AttributeDefault, ParseError> {
    return parseConstruction(() => new AttributeDefault(value));
  }

  static of(raw: string | number): AttributeDefault {
    return new AttributeDefault(raw);
  }
  isNumber(): boolean {
    return typeof this.#value === "number";
  }
  isString(): boolean {
    return typeof this.#value === "string";
  }
  // 境界: 数値既定値の比較材料（isNumber ガード下でのみ意味を持つ）。
  asNumber(): number {
    return this.#value as number;
  }
  asString(): string {
    return String(this.#value);
  }
  // 境界: 凍結文言への埋め込み形（旧 `${def}` / String(def) と同一）。
  render(): string {
    return String(this.#value);
  }
  // FD-E3: 数値既定値の範囲照合（数値でない既定値は常に範囲内扱い＝凍結挙動）。
  belowBound(bound: NumericBound): boolean {
    return typeof this.#value === "number" && this.#value < bound.asNumber();
  }
  aboveBound(bound: NumericBound): boolean {
    return typeof this.#value === "number" && this.#value > bound.asNumber();
  }
}
