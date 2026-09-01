// refcheck finding（契約2 語彙）。ペイロードはファーストクラスコレクション
// （FrRefs / TargetIds は kernel の共有語彙）で運び、描画キー順・拡張 kind
// 順位表（NFR1、golden バイトを決める）はここが所有する。v1 バックエンドの
// 4-kind 表とは意図的に別実装のまま保つ（順序互換は tests/kind-rank.test.ts
// が機械証明）。旧 catalog-order.ts の sort は Findings/Skips の集合知識へ
// 畳んだ。

import type { FrRefs, TargetIds } from "../../kernel/domain/index.ts";
import { type WitnessRefs } from "./witness-refs.ts";

export interface Finding {
  kind: string;
  frRefs: FrRefs;
  targets: TargetIds;
  witness: { refs: WitnessRefs };
  unit?: string;
  detail: string;
}




