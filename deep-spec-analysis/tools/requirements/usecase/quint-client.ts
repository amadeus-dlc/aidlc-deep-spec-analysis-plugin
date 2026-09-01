// quint CLI 実行ポート。check は可用性 probe → method 検出（bounded /
// simulation）→ 機械コンパイル（Quint テキスト生成を含む）→ CLI 実行までを
// 実装に委ね、機械事実・コンパイル時 skip・型付き実行判定だけを返す。
// 旧 main と同じく、CLI 不在時は機械をコンパイルしない（smt と違い
// unavailable 文書にコンパイル時 skip は載らない——凍結挙動）。

import type { RequirementsModel } from "../domain/index.ts";
import type { QuintCheckResult } from "./quint-check-result.ts";

export interface QuintClient {
  check(model: RequirementsModel): QuintCheckResult;
}
