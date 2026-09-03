# deep-spec-analysis — リバースエンジニアリング実施記録

## 実施記録

- **実施日時（UTC）**: 2026-09-03（developer link のスキャンと architect link の合成は同日。合成の完了時刻 2026-09-03T07:02:33Z）
- **git コミット**: `bce767d2741b3a3e35dba5ad577b440b0226b14b`（`git -C <ワークスペースルート> rev-parse HEAD`、architect link 実行時）。developer link のスキャン時点の HEAD は `94d64a3`（コミット数 144、初回コミット 2026-08-28）。その間の 3 コミット（`b67216e` チームナレッジの seed、`08eec8d` #130 quint クライアントの SIGINT 停止と doctor の陳腐化検出、`bce767d` 検証ノウハウの文書更新）は handoff の記述（`killSignal: "SIGINT"`、8822 の listen 判定）に既に反映されており、`tools/` の構造・数値に影響しない
- **intent**: `260903-src-bundle-split`（Brownfield / express / Depth: Minimal / Test Strategy: Minimal）
- **対象リポジトリ**: `deep-spec-analysis`（ワークスペースルートの git リポジトリ）。解析対象はルート直下の `deep-spec-analysis/`（AI-DLC プラグイン本体、bun / TypeScript）
- **store の状態**: 初回スキャン（NO_STORE）。9 成果物はこの run から新規作成し、既存 store のマージは無い
- **リポジトリのファイルは変更していない**（両リンクとも）

## 2 リンクで実施したこと

| リンク | エージェント | 実施内容 | 成果 |
|---|---|---|---|
| 1 | developer | `deep-spec-analysis/tools/` の entry 10 本を全文、17 層の facade・spawn 系 adapter・doctor manifest を全文、残り全 468 `.ts` の import を走査スクリプトで機械集計（1,747 import）。`tests/`（architecture 規則・e2e・parity の spawn 部・`tools/` 参照の grep）、`scripts/`、`sensors/`、`knowledge/`、`stages/`、`contributions/`、`docs/`、設定ファイルを読了。`bun test --coverage`（480 テスト、26.8 秒）と `bunx tsc --noEmit` を実行。scratchpad で 2 本のスパイク（`bun build` による bundle 実射と golden の byte 比較、bun workspaces ＋ isolated linker の境界挙動）を実測 | handoff `inception/reverse-engineering/developer-scan.md`（168 行: 層別ファイル数・行数、層間依存表、出荷経路の `.ts` 固定パス、テストの到達経路、技術的負債 14 項目、リスク 9 項目、スパイク結果） |
| 2 | architect | handoff を読み、`README.md`・`docs/decisions.ja.md` の見出し・`sensors/*.md` の frontmatter・各層 `index.ts` の再輸出一覧・`tests/architecture/rules.ts` の `PUBLISHED_LANGUAGE` 表・設定ファイルで事実を補ってアーキテクチャに合成。再スキャンはしていない | staging の 9 成果物（本ファイルを含む）。`business-overview`・`architecture`（Interaction Diagrams 2 本）・`code-structure`・`api-documentation`・`component-inventory`・`technology-stack`・`dependencies`・`code-quality-assessment` |

## 解析範囲の説明

- **深く読んだ範囲**は `deep-spec-analysis/` 配下——`tools/`・`tests/`・`scripts/`・`sensors/`・`knowledge/`・`stages/`・`contributions/`・`docs/` と `package.json`・`bunfig.toml`・`tsconfig.json`・`README.md`。次節の `analyzed.components` がその一覧で、`component-inventory.md` の見出しと逐語一致する
- **浅く読んだ範囲**（事実確認のみ）: ワークスペースルートの `.github/workflows/ci.yml`・`renovate.json`・`mise.toml`、チームナレッジ `aidlc/spaces/default/knowledge/aidlc-shared/`、submodule の `aidlc-workflows/core/tools/aidlc-plugin-build.ts`・`aidlc-plugin-validate.ts`（`tools/` 契約に関わる箇所だけ）
- **対象外**: `aidlc-workflows/`（submodule 本体）、`.claude/`（このワークスペースのシェル）、sandbox（`deep-spec-analysis-sandbox`）。developer link が出荷物の形の確認のため `deep-spec-analysis/dist/claude/` を 1 回だけ覗いた（ファイル数と `hooks/compose.ts` の grep）が、解析対象には含めない
- **`fingerprint` が `unknown` である理由**: このワークスペースの fingerprint ツール（`codekb-scope-diff --mint`）は入れ子パス（`deep-spec-analysis/tools/` のようなサブディレクトリ）を fingerprint できず、次節の `analyzed.paths` をカンマ区切りで渡して実行した出力が逐語で `unknown` だった。テンプレートは「計算できないときは `unknown`」を認めているのでそのまま記録する。深い解析範囲は `analyzed.paths` のとおりで、ワークスペース全体は深く読んでいないため `kind: partial`（`./` は含めない）

## Scope of Analysis

```yaml
scope_version: 1
kind: partial
intent: 260903-src-bundle-split
fingerprint: unknown
analyzed:
  paths:
    - deep-spec-analysis/tools/
    - deep-spec-analysis/tests/
    - deep-spec-analysis/scripts/
    - deep-spec-analysis/sensors/
    - deep-spec-analysis/knowledge/
    - deep-spec-analysis/stages/
    - deep-spec-analysis/contributions/
    - deep-spec-analysis/docs/
    - deep-spec-analysis/package.json
    - deep-spec-analysis/bunfig.toml
    - deep-spec-analysis/tsconfig.json
    - deep-spec-analysis/README.md
  components:
    - deep-spec-analysis/tools
    - deep-spec-analysis/tests
    - deep-spec-analysis/scripts
    - deep-spec-analysis/sensors
    - deep-spec-analysis/knowledge
    - deep-spec-analysis/stages
    - deep-spec-analysis/contributions
    - deep-spec-analysis/docs
    - deep-spec-analysis/package.json
    - deep-spec-analysis/bunfig.toml
    - deep-spec-analysis/tsconfig.json
    - deep-spec-analysis/README.md
shallow:
  paths:
    - .github/workflows/ci.yml
    - renovate.json
    - mise.toml
    - aidlc/spaces/default/knowledge/aidlc-shared/
    - aidlc-workflows/core/tools/aidlc-plugin-build.ts
    - aidlc-workflows/core/tools/aidlc-plugin-validate.ts
```
