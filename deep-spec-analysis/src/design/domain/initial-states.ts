import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { InitialState } from "./initial-state.ts";
export class InitialStates extends FirstClassCollectionBase<InitialState, InitialStates> {
  readonly #values: readonly InitialState[];

  private constructor(values: readonly InitialState[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 10_000, "too-many-initial-states");
  }

  protected override rebuild(values: readonly InitialState[]): InitialStates {
    return new InitialStates(values);
  }

  override map(transform: (element: InitialState) => InitialState): InitialStates {
    return this.mapTo(transform, InitialStates.of);
  }

  override combine(other: InitialStates): InitialStates {
    return this.combineTo(other, InitialStates.of);
  }

  static parse(values: readonly InitialState[]): Result<InitialStates, ParseError> {
    return parseConstruction(() => new InitialStates(values));
  }

  static of(values: readonly InitialState[]): InitialStates {
    return new InitialStates(values);
  }

  add(value: InitialState): InitialStates {
    return new InitialStates([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<InitialState> {
    yield* this.#values;
  }

  // 境界: 描画・文言専用。宣言順のまま状態名の文字列へ落とす。
  toStrings(): string[] {
    return this.#values.map((state) => state.asString());
  }

  toArray(): readonly InitialState[] {
    return this.#values;
  }
}
