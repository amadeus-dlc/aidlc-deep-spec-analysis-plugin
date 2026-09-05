import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec/kernel-infrastructure";
import type { InitialState } from "./initial-state.ts";
export class InitialStates {
  readonly #values: readonly InitialState[];

  private constructor(values: readonly InitialState[]) {
    if (values.length > 10_000)
      throw new IllegalArgumentException({ kind: "too-many-initial-states", raw: values.length });
    this.#values = Object.freeze([...values]);
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

  includes(value: string): boolean {
    return this.#values.some((state) => state.matchesName(value));
  }

  toArray(): readonly InitialState[] {
    return this.#values;
  }
}
