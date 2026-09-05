import { TraceState } from "./trace-state.ts";

// 復号済みトレースのファーストクラスコレクション（ステップ順を保持——
// witness の trace ペイロードへ toArray() で降りる）。
export class TraceStates {
  readonly #values: readonly TraceState[];

  private constructor(values: readonly TraceState[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly TraceState[]): TraceStates {
    return new TraceStates(values);
  }

  add(value: TraceState): TraceStates {
    return new TraceStates([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<TraceState> {
    yield* this.#values;
  }

  // 最終状態（不変量の帰属評価に使う）。空トレースは空状態。
  finalState(): TraceState {
    return this.#values[this.#values.length - 1] ?? TraceState.empty();
  }

  toArray(): TraceState[] {
    return [...this.#values];
  }
}
