import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import type { BackgroundAssumption } from "./background-assumption.ts";

// 背景仮定のファーストクラスコレクション。
export class BackgroundAssumptions implements FirstClassCollection, IterableFirstClassCollection<BackgroundAssumption> {
  readonly #values: readonly BackgroundAssumption[];

  private constructor(values: readonly BackgroundAssumption[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly BackgroundAssumption[]): BackgroundAssumptions {
    return new BackgroundAssumptions(values);
  }

  add(value: BackgroundAssumption): BackgroundAssumptions {
    return new BackgroundAssumptions([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<BackgroundAssumption> {
    yield* this.#values;
  }

  toArray(): readonly BackgroundAssumption[] {
    return this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
