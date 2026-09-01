// ---- ファーストクラスコレクション（decl 束） --------------------------------
// ドメイン層は配列を生で運ばない。巡回・所属・宣言値の照合という集合の知識は
// コレクションが所有し、toArray() は境界専用の脱出口。

export class DeclaredValues {
  readonly #values: readonly string[];

  private constructor(values: readonly string[]) {
    this.#values = values;
  }

  static of(values: readonly string[]): DeclaredValues {
    return new DeclaredValues([...values]);
  }

  add(value: string): DeclaredValues {
    return new DeclaredValues([...this.#values, value]);
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
