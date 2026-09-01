// enum 属性の宣言値のコレクション（宣言順を保持——decode の序数対応に効く）。
export class ReqAttributeValues {
  readonly #values: readonly string[];

  private constructor(values: readonly string[]) {
    this.#values = values;
  }

  static of(values: readonly string[]): ReqAttributeValues {
    return new ReqAttributeValues([...values]);
  }

  add(value: string): ReqAttributeValues {
    return new ReqAttributeValues([...this.#values, value]);
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
