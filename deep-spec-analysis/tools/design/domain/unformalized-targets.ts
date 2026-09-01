export class UnformalizedTargets {
  readonly #values: ReadonlySet<string>;

  private constructor(values: ReadonlySet<string>) {
    this.#values = values;
  }

  static of(values: readonly string[]): UnformalizedTargets {
    return new UnformalizedTargets(new Set(values));
  }

  add(value: string): UnformalizedTargets {
    return new UnformalizedTargets(new Set([...this.#values, value]));
  }

  *[Symbol.iterator](): Iterator<string> {
    yield* this.#values;
  }

  covers(target: string): boolean {
    return this.#values.has(target);
  }

  toArray(): readonly string[] {
    return [...this.#values];
  }
}
