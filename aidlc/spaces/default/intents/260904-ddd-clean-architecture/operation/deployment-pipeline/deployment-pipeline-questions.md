# Deployment Pipeline Questions — DDD／クリーンアーキテクチャ改善

Depth は Minimal、scope は `refactor` なので、既に決まっていること（trunk-based・squash-merge・`main` への PR・監査シャード同梱・外部仕様は byte 不変）は聞き直しません。Build and Test の結果（`deep-spec-analysis` 577 pass / 0 fail、7 harness build OK、サンドボックス A／B／A→update byte 一致）を前提に、この変更を `main` へ届けて配布するために未確定の 3 点だけ伺います。

## Q1. リリースタグを切るか

この Intent の変更は内部のリファクタで、外部仕様（契約 1〜4、golden bytes、findings JSON、stdout verdict、文言、正準順、solver pin）は byte 不変です。利用プロジェクトはタグでしか導入・更新できないため（`scripts/install.ts` は `--tag`／最新の安定タグを解決し、`--ref` は再現性がなく非推奨）、タグを切らない限り利用側には届きません。現在の最新タグは `v0.5.0`（`chore(release): publish v0.5.0`、`.aidlc-plugin/plugin.json` の `version` と一致）です。

A. マージのみ。タグは切らず、次に外部に見える変更（機能追加・修正）を出すときにまとめて切る（推奨。利用側の挙動は変わらないので、配布して得られるものが無い）
B. マージ後に `v0.5.1` を切る（内部変更のパッチリリース。`bun deep-spec-analysis/scripts/release.ts 0.5.1` が manifest 更新・`chore(release): publish v0.5.1` コミット・タグ・`git push --atomic origin main v0.5.1` を一括で行い、CI の `--check-tag` が突き合わせる）
C. マージ後に `v0.6.0` を切る（マイナーリリース）
X. Other (please specify)

[Answer]: A

## Q2. `.codex/tools/` の導入コピー 2 ファイルの扱い

ワークスペース直下の `.codex/tools/aidlc-lib.ts` と `.codex/tools/aidlc-sensor-traceability.ts` は、このセッションの前に FR8（本家のゼロ Unit 経路の修正）を導入コピーへ同期したもので、`git status` では変更ありのままです。FR8 の本家側の変更は「`aidlc-workflows/` は開発対象ではない」という裁定で全部戻し（submodule は a277af21 と同一）、`.claude/tools/` の同期も戻しました。この 2 ファイルだけが、本家にはまだ入っていない修正を持っています（本家 issue #1011／#1020 へは内容を書き込み済み）。

A. HEAD へ戻し、この PR に含めない（推奨。裁定と同じ理由——本家未取り込みの修正をワークスペースの導入コピーだけに残すと、次に `.codex/` を dist から更新したときに黙って消える差分になる。本家に入ったら dist 経由で入ってくる）
B. この PR に含める（codex harness でこのリポジトリを回すときにゼロ Unit 経路が動くようにしておく。本家取り込みまでの暫定として、PR 説明に明記する）
C. 別 PR にする（この Intent の PR から切り離し、暫定パッチとして単独でレビューする）
X. Other (please specify)

[Answer]: A

## Q3. `main` へのマージを誰がどの条件で行うか

`main` には branch protection も ruleset も無く（GitHub API で確認）、squash／merge／rebase のどれも許可、auto-merge は無効です。過去の PR（#133〜#137）は `ci`（GitHub Actions）・CodeRabbit・Devin Review の 3 チェックが SUCCESS になってから squash-merge されています。リポジトリ固有のセンサー `pr-review-clean` が「未解決のレビュースレッド 0・レビュー系チェック完了」をマージ前の儀式として検査します。この Intent では `main` へのマージがそのまま配布可能な状態（=本番相当）になるので、その承認の形を決めます。

A. 私が PR を作成し、`ci`・CodeRabbit・Devin Review が SUCCESS で未解決スレッド 0 になるまで対応したうえで、マージ自体はオーナーが GitHub 上で行う（推奨。`org.md` の「本番は別の手動承認でゲートする」に沿う）
B. 3 チェック SUCCESS・未解決スレッド 0 を確認したら、私が `gh pr merge --squash` でマージする（実行の直前にもう一度確認を取る）
C. リポジトリ設定で auto-merge を有効にし、PR に auto-merge（squash）を設定して、チェックが揃い次第 GitHub が自動でマージする（設定変更が要る）
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Q1 リリースタグ: A — マージのみ。タグは切らず、次に外部に見える変更を出すときにまとめて切る
- Q2 `.codex/tools/` の 2 ファイル: A — HEAD へ戻し、この PR に含めない
- Q3 `main` へのマージ: A — 私が PR を作成し 3 チェック SUCCESS・未解決スレッド 0 まで対応、マージ自体はオーナーが GitHub 上で行う

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
