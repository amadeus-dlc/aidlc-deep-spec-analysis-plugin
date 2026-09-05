import type { ValueSnapshotParam } from "@deep-spec/kernel-infrastructure";

// 契約1/契約3 が共有する式ツリー（kernel 語彙）。演算子の集合は契約スキーマの
// Published Language そのもの。SMT-LIB/Quint への写像は形式知識なのでアダプタが
// 持つ。requirements と design の両コンテキストが消費するため kernel が所有する。

export interface Expression {
  readonly [key: string]: ValueSnapshotParam;
  readonly op: string;
  readonly args?: readonly Expression[];
  readonly path?: string;
  readonly prime?: boolean;
  readonly value?: boolean | number | string;
}
