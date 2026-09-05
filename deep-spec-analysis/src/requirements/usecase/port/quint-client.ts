// quint CLI 実行ポート。check は可用性 probe → method 検出（bounded /
// simulation）→ 機械コンパイル（Quint テキスト生成を含む）→ CLI 実行までを
// 実装に委ねる。返す結果は、計画・コンパイル時skip・実行判定を内包して文書形成を所有する。
// 旧 main と同じく、CLI 不在時は機械をコンパイルしない（smt と違い
// unavailable 文書にコンパイル時 skip は載らない——凍結挙動）。

import type { QuintCheckResult, RequirementsModel } from "@deep-spec/requirements-domain";

export interface QuintClient {
  check(model: RequirementsModel): QuintCheckResult;
}
