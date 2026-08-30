// frRef（FR/NFR id への参照主張）のファーストクラスコレクション。
// 宣言順を保持——逆索引の owner 積み順・帰属ペイロードの順序に効く。

export class FrRefs {
  readonly #values: readonly string[];

  private constructor(values: readonly string[]) {
    this.#values = values;
  }

  static of(values: readonly string[]): FrRefs {
    return new FrRefs([...values]);
  }

  add(value: string): FrRefs {
    return new FrRefs([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<string> {
    yield* this.#values;
  }

  toArray(): readonly string[] {
    return this.#values;
  }
}
