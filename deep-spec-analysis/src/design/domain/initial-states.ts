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

  protected rebuild(values: readonly InitialState[]): InitialStates {
    return new InitialStates(values);
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

  *[Symbol.iterator](): Iterator<InitialState> {
    yield* this.#values;
  }

  toArray(): readonly InitialState[] {
    return this.#values;
  }
}
