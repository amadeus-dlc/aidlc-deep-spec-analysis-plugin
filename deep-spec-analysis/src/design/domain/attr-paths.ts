// 設計属性パス集合のファーストクラスコレクション（lowering・alpha 置換の照会面）。
export class AttrPaths {
  readonly #values: ReadonlySet<string>;

  private constructor(values: ReadonlySet<string>) {
    this.#values = values;
  }

  static of(values: readonly string[]): AttrPaths {
    return new AttrPaths(new Set(values));
  }

  add(value: string): AttrPaths {
    return new AttrPaths(new Set([...this.#values, value]));
  }

  *[Symbol.iterator](): Iterator<string> {
    yield* this.#values;
  }

  has(value: string): boolean {
    return this.#values.has(value);
  }

  toArray(): readonly string[] {
    return [...this.#values];
  }
}
