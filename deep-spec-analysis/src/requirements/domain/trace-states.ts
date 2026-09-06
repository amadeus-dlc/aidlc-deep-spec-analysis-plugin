import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import { TraceState } from "./trace-state.ts";

// 復号済みトレースのファーストクラスコレクション（ステップ順を保持——
// witness の trace ペイロードへ toArray() で降りる）。
export class TraceStates
  extends FirstClassCollectionBase<TraceState, TraceStates>
  implements FirstClassCollection<TraceState>
{
  readonly #values: readonly TraceState[];

  private constructor(values: readonly TraceState[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-trace-states");
  }

  protected rebuild(values: readonly TraceState[]): TraceStates {
    return new TraceStates(values);
  }

  static parse(values: readonly TraceState[]): Result<TraceStates, ParseError> {
    return parseConstruction(() => new TraceStates(values));
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
