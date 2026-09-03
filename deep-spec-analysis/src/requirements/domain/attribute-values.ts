// enum 宣言値のファーストクラスコレクション。宣言順＝SMT の序数符号化・
// Quint の集合リテラル順という凍結面なので順序を所有する。
export class AttributeValues {
  readonly #values: readonly string[];

  private constructor(values: readonly string[]) {
    this.#values = values;
  }

  static of(values: readonly string[]): AttributeValues {
    return new AttributeValues([...values]);
  }

  add(value: string): AttributeValues {
    return new AttributeValues([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<string> {
    yield* this.#values;
  }

  indexOf(value: string): number {
    return this.#values.indexOf(value);
  }

  valueAt(index: number): string | undefined {
    return this.#values[index];
  }

  count(): number {
    return this.#values.length;
  }

  toArray(): readonly string[] {
    return this.#values;
  }
}
