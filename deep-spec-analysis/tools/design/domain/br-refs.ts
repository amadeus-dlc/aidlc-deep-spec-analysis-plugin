export class BrRefs {
  readonly #values: readonly string[];

  private constructor(values: readonly string[]) {
    this.#values = values;
  }

  static of(values: readonly string[]): BrRefs {
    return new BrRefs([...values]);
  }

  add(value: string): BrRefs {
    return new BrRefs([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<string> {
    yield* this.#values;
  }

  toArray(): readonly string[] {
    return this.#values;
  }
}
