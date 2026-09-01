// contract-summary.md と units エッジブロックの型付き入力モデル（domain 語彙）。
// 解析（markdown テーブル/fence/YAML 歩き）はアダプタのパーサが行う。
// フィールドはドメインプリミティブ、集まりはファーストクラスコレクション。

import type { ContractRow } from "./contract-row.ts";


export class ContractRows {
  readonly #values: readonly ContractRow[];

  private constructor(values: readonly ContractRow[]) {
    this.#values = values;
  }

  static of(values: readonly ContractRow[]): ContractRows {
    return new ContractRows([...values]);
  }

  add(value: ContractRow): ContractRows {
    return new ContractRows([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<ContractRow> {
    yield* this.#values;
  }

  // CD-3：行が両方向で覆う (provider, consumer) 対の集合知識。
  coversEdge(from: string, to: string): boolean {
    return this.#values.some(
      (r) =>
        (r.provider.asString() === from && r.consumer.asString() === to) ||
        (r.consumer.asString() === from && r.provider.asString() === to),
    );
  }

  toArray(): readonly ContractRow[] {
    return this.#values;
  }
}

