// decode 済みトレース状態の語彙。ITF という形式の知識はアダプタが持ち、
// ドメインには「属性パス → 復号済み値」の型付きデータだけが届く。
// 値は原理上ネスト構造も通る（旧実装の decode の素通し挙動を保存）。

export type DecodedValue = null | boolean | number | string | DecodedValue[] | { [k: string]: DecodedValue };

export type TraceState = { [path: string]: DecodedValue };

// 復号済みトレースのファーストクラスコレクション（ステップ順を保持——
// witness の trace ペイロードへ toArray() で降りる）。
export class TraceStates {
  readonly #values: readonly TraceState[];

  private constructor(values: readonly TraceState[]) {
    this.#values = values;
  }

  static of(values: readonly TraceState[]): TraceStates {
    return new TraceStates([...values]);
  }

  add(value: TraceState): TraceStates {
    return new TraceStates([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<TraceState> {
    yield* this.#values;
  }

  // 最終状態（不変量の帰属評価に使う）。空トレースは空状態。
  finalState(): TraceState {
    return this.#values[this.#values.length - 1] ?? {};
  }

  toArray(): TraceState[] {
    return [...this.#values];
  }
}
