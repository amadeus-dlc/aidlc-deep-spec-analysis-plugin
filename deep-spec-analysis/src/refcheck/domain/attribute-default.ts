import { NumericBound } from "./numeric-bound.ts";

// default 宣言 — 文書上は文字列または数値（それ以外は宣言なし扱い＝凍結挙動）。
export class AttributeDefault {
  readonly #value: string | number;
  private constructor(value: string | number) { this.#value = value; }
  static reconstitute(raw: string | number): AttributeDefault { return new AttributeDefault(raw); }
  isNumber(): boolean { return typeof this.#value === "number"; }
  isString(): boolean { return typeof this.#value === "string"; }
  // 境界: 数値既定値の比較材料（isNumber ガード下でのみ意味を持つ）。
  asNumber(): number { return this.#value as number; }
  asString(): string { return String(this.#value); }
  // 境界: 凍結文言への埋め込み形（旧 `${def}` / String(def) と同一）。
  render(): string { return String(this.#value); }
  // FD-E3: 数値既定値の範囲照合（数値でない既定値は常に範囲内扱い＝凍結挙動）。
  belowBound(bound: NumericBound): boolean { return typeof this.#value === "number" && this.#value < bound.asNumber(); }
  aboveBound(bound: NumericBound): boolean { return typeof this.#value === "number" && this.#value > bound.asNumber(); }
}
