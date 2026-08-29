---
id: pr-review-clean
kind: deterministic
command: bun .claude/tools/aidlc-sensor-pr-review-clean.ts
default_severity: advisory
description: Checks the current branch's open GitHub PR for unresolved review threads and in-progress reviewer checks — the merge-readiness evidence for the per-PR ritual (advisory, never blocks)
category: delivery-readiness
matches: "**/*.pr-review.md"
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  unresolved_threads: integer
  pending_reviews: string[]
  pr: string
  state: string
  note: string
timeout_seconds: 30
---

# pr-review-clean — PR レビュー放置検出センサー

現在のブランチ（または `AIDLC_PR_REVIEW_PR` で指定した番号）の PR について、

1. **未解決のレビュースレッド数**（GraphQL `reviewThreads.isResolved`、
   100 件ずつ全ページ走査。走査上限超過は `thread-scan-truncated` の明示 fail）
2. **未完了のレビュー系チェック**（CodeRabbit/Bugbot/review の CheckRun が
   COMPLETED 以外、または StatusContext が PENDING/EXPECTED）

を検査し、どちらかが残っていれば `pass: false` の verdict を返す。マージ判断を
人間に諮る前の儀式（ロードマップ issue #12）でこの verdict を提示すること。

- ブランチ解決時に open PR が無ければ `pass: true` / `note: "no-open-pr"`
  （「このブランチに PR なし」だけを pass-through にし、リポジトリ解決失敗や
  認証切れは unavailable に落とす——沈黙した緑を出さない）。
- `AIDLC_PR_REVIEW_PR` 明示時は closed/merged PR も監査できる（red/green の
  実証・事後監査用の意図的仕様）。verdict の `state` と
  `note: "explicit-audit-of-non-open-pr"` が区別を運ぶ。
- gh が使えない・ネットワーク不通などの基盤障害は `pass: false` /
  `note: "unavailable"` で理由を明示する。
- タイムアウト予算: 外部コマンド各 6s・直列で `timeout_seconds: 30` に収まる。
- advisory: 何もブロックしない。verdict の記録と提示が抑止の本体。
