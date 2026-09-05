// TraceValue — 復号済みトレース（ITF）と scenario binding が運ぶ 1 つの値の
// 値オブジェクト（種別規律の裁定 2、2026-09-03）。値の意味論——真偽（`true`
// そのものだけが真）、数値化（number 以外は NaN）、等価（JSON の逐語比較）——は
// 値自身の知識で、評価器（QuintMachineComponent）はこれを問うだけ。中身の形
// は ITF が決める JSON 値で、文書へは `toDocument` で逐語に降りる。

type Decoded = null | boolean | number | string | readonly Decoded[] | { readonly [k: string]: Decoded };

export class TraceValue {
  readonly #value: Decoded;

  private constructor(value: Parameters<typeof TraceValue.of>[0]) {
    this.#value = value;
  }

  // 復号器（adapter）と scenario binding からの門。
  static of(value: Decoded): TraceValue {
    return new TraceValue(value);
  }

  // 式のリテラル（`bool` / `int` / `enum`）——値が無ければ null（凍結挙動）。
  static ofLiteral(value: boolean | number | string | undefined): TraceValue {
    return new TraceValue(value ?? null);
  }

  static ofBoolean(value: boolean): TraceValue {
    return new TraceValue(value);
  }

  static ofNumber(value: number): TraceValue {
    return new TraceValue(value);
  }

  // 参照先が無い・未知の演算子——寛容評価の null。
  static absent(): TraceValue {
    return new TraceValue(null);
  }

  // 真偽: `true` そのものだけが真（凍結挙動——truthy ではない）。
  isTrue(): boolean {
    return this.#value === true;
  }

  // 数値化: number 以外は NaN（比較・演算は NaN 伝播で偽になる——凍結挙動）。
  asNumber(): number {
    return typeof this.#value === "number" ? this.#value : Number.NaN;
  }

  // 等価: JSON 描画の逐語一致（凍結挙動——ネストした値もこの一致で比べる）。
  equals(other: TraceValue): boolean {
    return JSON.stringify(this.#value) === JSON.stringify(other.#value);
  }

  // 境界: 文書（witness の trace／model）へ逐語で降りる。
  toDocument(): Decoded {
    return this.#value;
  }
}
