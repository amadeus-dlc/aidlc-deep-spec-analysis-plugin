// frRef（FR/NFR id への参照主張）のファーストクラスコレクション。
// 宣言順を保持——逆索引の owner 積み順・帰属ペイロードの順序に効く。
// requirements / design / refcheck が同じ語彙で話すため kernel が所有する。
// 正準順の重複除去（`sortedUnique`）はコレクション知識（裁定 1）。

import { sortedUniqueCanonically } from "./canonical-order.ts";

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

  // 正準順（英字骨格→数値セグメント）で重複を除いた参照列。
  sortedUnique(): FrRefs {
    return new FrRefs(sortedUniqueCanonically(this.#values));
  }

  toArray(): readonly string[] {
    return this.#values;
  }
}
