import { AttributeName } from "./attribute-name.ts";

// ---- ファーストクラスコレクション（語彙） -----------------------------------
// ドメイン層は配列を生で扱わない。集合の知識（正規化照合・差分・所属）は
// コレクション自身が所有し、toArray() は境界（描画・アダプタ）専用の脱出口。

export class AttributeNames {
  readonly #values: readonly AttributeName[];

  private constructor(values: readonly AttributeName[]) {
    this.#values = values;
  }

  static of(values: readonly AttributeName[]): AttributeNames {
    return new AttributeNames([...values]);
  }

  add(value: AttributeName): AttributeNames {
    return new AttributeNames([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<AttributeName> {
    yield* this.#values;
  }

  count(): number {
    return this.#values.length;
  }

  // 正規化名での被覆判定（XS-3 の照合知識）。
  coversNormalized(name: AttributeName): boolean {
    return this.#values.some((v) => v.normalized() === name.normalized());
  }

  // 境界: 描画・アダプタ専用。
  toArray(): readonly AttributeName[] {
    return this.#values;
  }
}
