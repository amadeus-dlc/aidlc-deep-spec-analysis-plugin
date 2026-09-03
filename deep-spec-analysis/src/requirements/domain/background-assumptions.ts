import type { BackgroundAssumption } from "./background-assumption.ts";

// 背景仮定のファーストクラスコレクション。
export class BackgroundAssumptions {
  readonly #values: readonly BackgroundAssumption[];

  private constructor(values: readonly BackgroundAssumption[]) {
    this.#values = values;
  }

  static of(values: readonly BackgroundAssumption[]): BackgroundAssumptions {
    return new BackgroundAssumptions([...values]);
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
}
