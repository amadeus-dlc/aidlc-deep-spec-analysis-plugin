import type { Json } from "@deep-spec/kernel-infrastructure";

export class BindingPairs {
  readonly #values: readonly (readonly [string, Json])[];

  private constructor(values: readonly (readonly [string, Json])[]) {
    this.#values = structuredClone(values);
  }

  static of(values: readonly (readonly [string, Json])[]): BindingPairs {
    return new BindingPairs(values);
  }

  add(value: readonly [string, Json]): BindingPairs {
    return new BindingPairs([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<readonly [string, Json]> {
    yield* this.toArray();
  }

  toArray(): readonly (readonly [string, Json])[] {
    return structuredClone(this.#values);
  }
}
