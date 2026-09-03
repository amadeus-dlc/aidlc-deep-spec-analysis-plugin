# チームナレッジ（aidlc-shared）

このディレクトリは `aidlc/spaces/default/knowledge/aidlc-shared/` ——すべてのエージェントが読む、チーム自身が育てる設計ノウハウの置き場。フレームワーク同梱の `.claude/knowledge/` とは別物で、ここにあるのはこのリポジトリ（`aidlc-deep-spec-analysis-plugin`）で実測と裁定を経て確立した知見だけ。

規則そのもの（何をしてよく、何をしてはいけないか）は `aidlc/spaces/default/memory/project.md` の `## Mandated` に置き、ここには「なぜそうなのか」「どう作るのか」「どこで転ぶのか」を書く。両者が食い違ったら memory が勝つ。

| ファイル | 内容 | 主な読み手 |
|---|---|---|
| `domain-modeling.md` | Tell-Don't-Ask 全数反転（issue #71）で確立したドメインモデリングの型——commandable class・ドメインプリミティブ・不変条件としての検査・published language とアーキテクチャゲート | architect / developer / architecture-reviewer |
| `formal-verification-ops.md` | z3 と quint／Apalache を決定論的に回すための設計と運用——固定版の意味、bun での z3、Apalache サーバの寿命と孤児化、診断と修復 | developer / quality / operations |
| `aidlc-engine-operations.md` | エンジン（aidlc-workflows）とシェル（`.claude/`）の更新手順、プラグインの再 compose、検証の正しい信号、実サンドボックス実射の型 | delivery / developer / pipeline-deploy |

出典の一次資料:

- `deep-spec-analysis/docs/decisions.ja.md`（設計判断記録。同 PR 表記で波ごとの段落がある）
- `deep-spec-analysis/docs/handoffs/71-tda-program.ja.md`（#71 プログラムの引き継ぎ資料。波一覧と「流儀」）
- issue #71 / #80 / #128、PR #106〜#127

追記するときは、実測か裁定に裏づけられたことだけを書く。仮説は「仮説」と明記する。
