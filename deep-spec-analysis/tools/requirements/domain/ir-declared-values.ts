// enum 属性の宣言値のコレクション（宣言順を保持——序数対応・文言順に効く）。
export class IrDeclaredValues {
  readonly #values: readonly string[];

  private constructor(values: readonly string[]) {
    this.#values = values;
  }

  static of(values: readonly string[]): IrDeclaredValues {
    return new IrDeclaredValues([...values]);
  }

  add(value: string): IrDeclaredValues {
    return new IrDeclaredValues([...this.#values, value]);
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
