// witness refs の 1 座標（成果物パス＋要素＋生値）。deep-spec-lib.ts からの逐語移動。
// 集まりはファーストクラスコレクション（記録順＝ペイロード順を保持）。

export interface WitnessRef {
  artifact: string;
  element: string;
  value?: string;
}

export class WitnessRefs {
  readonly #values: readonly WitnessRef[];

  private constructor(values: readonly WitnessRef[]) {
    this.#values = values;
  }

  static of(values: readonly WitnessRef[]): WitnessRefs {
    return new WitnessRefs([...values]);
  }

  add(value: WitnessRef): WitnessRefs {
    return new WitnessRefs([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<WitnessRef> {
    yield* this.#values;
  }

  toArray(): readonly WitnessRef[] {
    return this.#values;
  }
}
