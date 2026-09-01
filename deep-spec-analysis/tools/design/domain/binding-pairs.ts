export class BindingPairs {
  readonly #values: readonly (readonly [string, unknown])[];

  private constructor(values: readonly (readonly [string, unknown])[]) {
    this.#values = values;
  }

  static of(values: readonly (readonly [string, unknown])[]): BindingPairs {
    return new BindingPairs([...values]);
  }

  add(value: readonly [string, unknown]): BindingPairs {
    return new BindingPairs([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<readonly [string, unknown]> {
    yield* this.#values;
  }

  toArray(): readonly (readonly [string, unknown])[] {
    return this.#values;
  }
}
