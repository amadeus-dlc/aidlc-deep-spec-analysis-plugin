import { AttributePath, KeySet } from "@deep-spec/kernel-domain";
// 設計属性パス集合のファーストクラスコレクション（lowering・alpha 置換の照会面）。
export class AttrPaths {
  readonly #values: KeySet<AttributePath>;

  private constructor(values: KeySet<AttributePath>) {
    this.#values = values;
  }

  static of(values: readonly AttributePath[]): AttrPaths {
    return new AttrPaths(KeySet.of(values));
  }

  add(value: AttributePath): AttrPaths {
    return new AttrPaths(this.#values.with(value));
  }

  *[Symbol.iterator](): Iterator<AttributePath> {
    yield* this.#values;
  }

  has(value: AttributePath): boolean {
    return this.#values.has(value);
  }

  toArray(): readonly AttributePath[] {
    return [...this.#values];
  }
}
