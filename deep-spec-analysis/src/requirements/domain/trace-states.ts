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

  protected override rebuild(values: readonly TraceState[]): TraceStates {
    return new TraceStates(values);
  }

  override map(transform: (element: TraceState) => TraceState): TraceStates {
    return this.mapTo(transform, TraceStates.of);
  }

  override combine(other: TraceStates): TraceStates {
    return this.combineTo(other, TraceStates.of);
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

  override *[Symbol.iterator](): Iterator<TraceState> {
    yield* this.#values;
  }

  // 境界: 描画専用。witness の trace ペイロードへステップ順のまま落とす。
  toDocuments(): ReturnType<TraceState["toDocument"]>[] {
    return this.#values.map((state) => state.toDocument());
  }

  // 最終状態（不変量の帰属評価に使う）。空トレースは空状態。
  finalState(): TraceState {
    return this.#values[this.#values.length - 1] ?? TraceState.empty();
  }

  toArray(): TraceState[] {
    return [...this.#values];
  }
}
