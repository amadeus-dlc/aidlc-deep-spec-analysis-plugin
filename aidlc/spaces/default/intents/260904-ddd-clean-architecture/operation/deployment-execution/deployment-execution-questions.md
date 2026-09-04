# Deployment Execution Questions — DDD／クリーンアーキテクチャ改善

Depth は Minimal です。実行内容は [`cd-config.md`](../deployment-pipeline/cd-config.md) の段 0〜4（`.codex/tools/` を HEAD へ → 検証の再実行 → ブランチ → コミット（監査シャード同梱）→ PR → 3 チェックとレビュー対応）と [`deployment-strategy.md`](../deployment-pipeline/deployment-strategy.md) で決まっており、マージはオーナーが GitHub 上で行います。事前検証は私が実行して結果を記録するので聞きません（Build and Test の [`test-results.md`](../../construction/build-and-test/test-results.md) は 0 fail）。サンドボックス検証は前段の指示（「サンドボックス検証いるよ」）どおり PR ブランチから導入して `aidlc-plugin-test` が CLEAN になるまで行います。伺うのは、実行の窓と、PR 作成後に増える監査行の運び方の 2 点です。

## Q1. いつ、どこまで実行するか

`main` の作業ツリーには 206 パスの変更（deep-spec-analysis 本体、aidlc レコード、codekb、memory）があり、PR を作ると CodeRabbit と Devin Review が動き始めます。この段階で PR まで進めるか、手前で止めるかを決めてください。

A. 今すぐ、PR 作成と 3 チェックの確認まで一気に進める（推奨。承認済みの手順どおりで、マージはオーナーの手に残る）
B. ブランチ作成とコミット、push までで止め、PR はオーナーが自分で作る
C. 今は実行せず、手順の記録だけ残す（後日 Deployment Execution をやり直す）
X. Other (please specify)

[Answer]: A

## Q2. PR 作成後に増える監査行をどう運ぶか

監査ログ同梱規律は「PR 作成の直前に監査シャードの追記を取り込む」ですが、この段階の承認（ゲート）と学習の永続化、ワークフロー完了の行は PR 作成の後に書かれます。マージはオーナーが行うので、その前に私が PR ブランチへ追いコミットすれば同じ PR に載せられます。既存のパターンは追いの chore PR（#135、#137）でした。

A. この段階の承認後、ワークフロー完了までの監査行を PR ブランチへ追いコミットして同じ PR に載せる（推奨。同梱規律に最も忠実。オーナーには「追いコミット後にマージしてほしい」と PR コメントで伝える）
B. 既存パターンどおり、マージ後に追いの chore PR で運ぶ
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Q1 実行の窓: A — 今すぐ、PR 作成と 3 チェックの確認、PR ブランチからのサンドボックス検証まで進める。マージはオーナー
- Q2 PR 作成後の監査行: A — 承認後、完了までの監査行を PR ブランチへ追いコミットして同じ PR に載せる。オーナーには PR コメントで伝える

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
