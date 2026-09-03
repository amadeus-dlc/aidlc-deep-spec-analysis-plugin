# ビルド手順

対象は `deep-spec-analysis/` プラグインと、互換性修正を含むワークスペース直下の Codex hook である。

## 前提条件

- Bun 1.3.13（`mise.toml` と CI で固定）
- Node.js 24（SMT 子プロセス用）
- `deep-spec-analysis/package.json` の exact pin 依存
- ネットワークは通常ビルドとテストには不要。GitHub tags API はテスト double で置き換える

## 依存関係

```bash
cd deep-spec-analysis
bun install --frozen-lockfile
```

## ビルドと型検査

```bash
cd deep-spec-analysis
bunx tsc --noEmit
bun scripts/build-tools.ts
bun scripts/build-tools.ts --check
```

`build-tools.ts` は entry bundle 10本と `tools/data/` 4本を生成する。`--check` は生成済み14ファイルとの byte 差分を検出する。

## 配布面の検証

```bash
bun .codex/tools/aidlc-utility.ts plugin-validate deep-spec-analysis --json
cd deep-spec-analysis
for h in claude codex copilot cursor kiro kiro-ide opencode; do
  bun ../aidlc-workflows/core/tools/aidlc-plugin-build.ts . "$h"
done
```

## トラブルシューティング

- `Cannot find module @deep-spec/...`: 対象 workspace package の依存宣言と `bun install --frozen-lockfile` を確認する
- `build-tools --check` の drift: `bun scripts/build-tools.ts` を再実行し、生成物を直接編集しない
- installer の source acquisition failure: selector、tag と manifest version、GitHub応答を確認する。失敗前の導入先 payload は変更されない
- Codex の `updatedInput` schema error: `.codex/hooks/aidlc-codex-adapter.test.ts` を実行し、`permissionDecision: "allow"` を確認する

