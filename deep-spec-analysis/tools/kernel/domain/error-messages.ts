// 検査エラー文言のファーストクラスコレクション。文言そのものは凍結 verdict の
// 材料（#46 の宣言済み除外——文字列単位の DP 化はしない）だが、ドメイン層は
// 配列を生で運ばない。宣言順を保持し、toArray() は境界専用の脱出口。

export class ErrorMessages {
  readonly #values: readonly string[];

  private constructor(values: readonly string[]) {
    this.#values = values;
  }

  static of(values: readonly string[]): ErrorMessages {
    return new ErrorMessages([...values]);
  }

  add(value: string): ErrorMessages {
    return new ErrorMessages([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<string> {
    yield* this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }

  toArray(): readonly string[] {
    return this.#values;
  }
}
