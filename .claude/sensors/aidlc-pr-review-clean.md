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
  note: string
timeout_seconds: 30
---

# pr-review-clean — PR レビュー放置検出センサー

現在のブランチ（または `AIDLC_PR_REVIEW_PR` で指定した番号）の open PR について、

1. **未解決のレビュースレッド数**（GraphQL `reviewThreads.isResolved`）
2. **進行中のレビュー系チェック**（CodeRabbit 等が pending のもの）

を検査し、どちらかが残っていれば `pass: false` の verdict を返す。マージ判断を
人間に諮る前の儀式（ロードマップ issue #12）でこの verdict を提示すること。

- open PR が無ければ `pass: true` / `note: "no-open-pr"`（pass-through）。
- gh が使えない・ネットワーク不通などの基盤障害は `pass: false` /
  `note: "unavailable"` で理由を明示する（沈黙した緑を出さない）。
- advisory: 何もブロックしない。verdict の記録と提示が抑止の本体。
