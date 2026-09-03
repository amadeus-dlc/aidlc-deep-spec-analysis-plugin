export class InitialStates {
  readonly #values: readonly string[];

  private constructor(values: readonly string[]) {
    this.#values = values;
  }

  static of(values: readonly string[]): InitialStates {
    return new InitialStates([...values]);
  }

  add(value: string): InitialStates {
    return new InitialStates([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<string> {
    yield* this.#values;
  }

  includes(value: string): boolean {
    return this.#values.includes(value);
  }

  toArray(): readonly string[] {
    return this.#values;
  }
}
