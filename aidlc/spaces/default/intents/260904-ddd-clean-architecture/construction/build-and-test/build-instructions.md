# Build Instructions — DDD／クリーンアーキテクチャ改善

対象は `deep-spec-analysis/`（プラグイン本体）です。`aidlc-workflows/` submodule はこのリポジトリの開発対象ではなく変更しません（オーナー裁定 2026-09-04）。その配布ツール（`aidlc-plugin-validate` / `aidlc-plugin-build`）は変更せずに使います。Code Generation の [`code-generation-plan.md`](../code-generation/code-generation-plan.md)（Testing Contract と品質目標）、[`unit-test-instructions.md`](../code-generation/unit-test-instructions.md)（波ごとのスコープ付きコマンド）、[`code-summary.md`](../code-generation/code-summary.md)（変更ファイルと検証結果）を入力にしています。

## Prerequisites

| 項目 | 要件 | 確認方法 |
|---|---|---|
| bun | 1.3.13（CI と同じ） | `bun --version` |
| node | ≥ 23（z3 の子プロセス用。CI は 24） | `node --version` |
| quint | 0.32.0（`deep-spec-analysis` の devDependency に exact pin） | `bunx quint --version` |
| JDK + Apalache | 任意。無ければ quint は simulation に落ちる | `~/.quint/apalache-dist-*` の有無 |
| git | submodule と worktree 操作 | `git --version` |

環境変数は不要です。テストは `bunfig.toml` の設定（`linker = "isolated"`、`coverageThreshold = 0.9`）を読みます。CI では quint を simulation に固定していますが、ローカルでは `AIDLC_DEEP_SPEC_QUINT_METHOD` を未設定にすると自動判定（Apalache があれば bounded）になります。

## Dependency Installation

```bash
(cd deep-spec-analysis && bun install --frozen-lockfile)
```

## Build Commands

このプロジェクトはコンパイル成果物を持たず、「ビルド」は型検査と生成物の同期です。

```bash
# deep-spec-analysis: 型検査と、src/ から tools/ への bundle 生成（生成物の drift guard）
(cd deep-spec-analysis && bunx tsc --noEmit)
(cd deep-spec-analysis && bun scripts/build-tools.ts)          # 再生成（src を変えたとき）
(cd deep-spec-analysis && bun scripts/build-tools.ts --check)  # 同期確認（CI 相当）
```

## Build Verification

```bash
(cd deep-spec-analysis && bun ../aidlc-workflows/core/tools/aidlc-plugin-validate.ts .)
for h in claude codex copilot cursor kiro kiro-ide opencode; do
  (cd deep-spec-analysis && bun ../aidlc-workflows/core/tools/aidlc-plugin-build.ts . "$h")
done
```

期待: validate は `Errors: 0`（警告 1 件 `compose-hook-absent` は従来からのもの）、7 harness の build がすべて成功。

## Troubleshooting

- **`build-tools --check` が drift を報告**: `src/` を変えたのに `bun scripts/build-tools.ts` を走らせていない。生成器は cwd をパッケージルートに固定するので、必ず `deep-spec-analysis/` で実行する。
- **`bunx tsc --noEmit` が `@deep-spec/*` を解決できない**: workspace の `bun install` 後に `linker = "isolated"` で各層の `node_modules` が張られる。ルート `package.json` の `dependencies` に層を列挙してはいけない（未宣言の層からの import が上位探索で解決してしまい境界検査が無効になる）。
- **quint の bounded 検証が失敗する（`_apalache-out/server/... No such file or directory`）**: 8822 番ポートに孤児化した Apalache サーバが残っている。`lsof -nP -iTCP:8822 -sTCP:LISTEN` で見つけて `kill` する。
