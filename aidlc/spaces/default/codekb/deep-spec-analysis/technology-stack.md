# deep-spec-analysis — 技術スタック

## Focused scan 更新: 配布ライフサイクルの技術前提

| 技術・契約 | 現行 | 本 intent での位置づけ |
|---|---|---|
| Bun 1.3.13 | installer runtime、workspace、bundle、test | bootstrap の唯一の必須 runtime。archive 展開を外部 `tar`／`unzip` に委ねるとこの契約と衝突する |
| Node 24 | z3 子プロセス | installer/source resolver の必須 runtime にはしない |
| GitHub archive／tags API | 現行 installer では未使用 | tag／branch tarball と latest semver tag の取得元。認証なし取得は intent の事前実測だが、pagination／rate limit／timeout は未契約 |
| Git | 開発 checkout、submodule、release 操作 | build 自体には不要。`scripts/release.ts` の clean-tree／commit／tag／push transaction には必要 |
| AIDLC destination tools | 現行は source checkout 側を使用 | `<project>/<harness>/tools/aidlc-plugin-build.ts`、target data、plugin test へ切替予定。利用先への本家導入が前提 |
| JSON filesystem metadata | 未実装 | `<harness>/tools/data/deep-spec-analysis-install.json` の provenance。npm registry／DB は使わない |

`package.json` は private な開発 workspace で、plugin は npm 公開しない。`@informalsystems/quint`、`z3-solver`、TypeScript、`@types/bun` はすべて exact pin だが、bootstrap installer が利用先へ package を追加する契約ではない。以下の形式検証 runtime 全体の情報は前回 store 由来で、今回の focused scan では設定宣言と pin の存在だけを再確認した。

出典: `package.json`、`bun.lock`、`bunfig.toml`、`tsconfig.json`、ワークスペースルートの `mise.toml`・`renovate.json`・`.github/workflows/ci.yml`、developer link の実測。

## ランタイムと言語

| 技術 | 版 | 用途 | 根拠・備考 |
|---|---|---|---|
| bun | 1.3.13（`mise.toml`、CI `oven-sh/setup-bun@v2`） | ランタイム（`tools/*.ts` を直接実行）、テストランナー（`bun:test`）、（本 intent で）バンドラ | ビルド工程は現状 **無し**。`bun build --help` で `--target bun|node|browser`・`--external`・`--splitting`・`--minify`、`bun install --help` で `--linker=isolated|hoisted` を確認（実測）。`Bun.*` API は `tools/` 内 0 件（`scripts/install.ts:254` の `Bun.which` のみ） |
| node | 24（`mise.toml`、CI `actions/setup-node@v5`）。要件は ≥ 23 | SMT センサーの z3 子プロセス専用 | `z3-solver` の WASM（pthread ビルド）は bun 上で Emscripten の起動アサーションで即死する（5.2.0／4.15.8 とも、bun 1.3.13。`docs/decisions.ja.md` A1）。node 24.19.0 が bundle の `--smt-child` 分岐を直接実行できることも実測済み |
| TypeScript | 7.0.2（exact pin） | 型検査のみ（`bunx tsc --noEmit`、実測 0.14 秒、exit 0） | `moduleResolution: "bundler"`、`allowImportingTsExtensions`、`strict`、`noUnusedLocals`／`noUnusedParameters`、`types: ["bun"]`。emit しない |
| JDK 17+ ＋ Apalache | 任意（`~/.quint/apalache-dist-*`、`APALACHE_DIST`） | Quint の `bounded` モード（`quint verify`） | CI には JVM が無いので `simulation`。bounded は実サンドボックスで実射する。Apalache サーバはポート 8822 に立ち、孤児化の問題と対策は `formal-verification-ops.md`（チームナレッジ）と #128 |

## 依存パッケージ（`package.json` の devDependencies、すべて exact pin）

| パッケージ | 版 | 用途 | pin の理由 |
|---|---|---|---|
| `z3-solver` | 5.2.0 | SMT バックエンド。`tools/requirements/adapter/z3-engine-child.ts:29` の `await import("z3-solver")` が唯一の npm import（`tests/architecture/rules.ts:187 ALLOWED_NPM`） | golden（`tests/fixtures/*/expected/*.json`）はこの版の出力を **byte 凍結** している。版上げは golden 更新の裁定事項であり定期バンプではない |
| `@informalsystems/quint` | 0.32.0 | Quint CLI。テストは `node_modules/.bin/quint` を `AIDLC_DEEP_SPEC_QUINT_BIN` で注入する | 同上（`quint run --seed` の決定論と ITF の `#meta` 除去を前提に golden を凍結） |
| `typescript` | 7.0.2 | 型検査 | ツールチェーンの再現性 |
| `@types/bun` | 1.4.0 | 型定義 | Renovate が bun ランタイムと同時に上げる |

`package.json` は `deep-spec-analysis-plugin-dev`（private）で「Nothing here ships」と自己申告している。出荷単位は npm パッケージではなく AI-DLC プラグインの projection（`.aidlc-plugin/plugin.json` v0.5.0、`core` 依存）。`bun.lock` は lockfileVersion 1、`workspaces: { "": ... }` のみ。`bunfig.toml` に `[install]` は無く、linker は未指定（＝hoisted）。

## 実行時に外部から取るもの（利用先プロジェクト側）

| 依存 | 取得元 | 無いときの挙動 |
|---|---|---|
| `z3-solver` | 利用先の `<projectDir>/node_modules/z3-solver`（`bun add z3-solver`） | verify-smt が `unavailable` を記録し、doctor が `package.json` の不在を報告 |
| `node` ≥ 23 | PATH | bun フォールバック（z3 は動かないので `unavailable` に閉じる） |
| `quint` | PATH または `AIDLC_DEEP_SPEC_QUINT_BIN` | verify-quint が `unavailable`、exit 127 |
| JDK ＋ Apalache | `java` と `~/.quint/apalache-dist-*` | `simulation` に切替（縮退であって障害ではない） |
| node 組み込み | `node:path`・`node:url`（entry）、`node:crypto`（kernel/domain）、`node:fs`・`node:path`・`node:os`・`node:child_process`（adapter） | — |

フレームワーク（Web／DI／ORM 等）は無し。lint ツール（ESLint／Biome／Prettier）の設定はリポジトリにもワークスペースルートにも **無い**。代替は `tsc --strict` と `tests/architecture/rules.ts` の 18 規則（`code-quality-assessment.md`）。

## CI と依存更新

- **CI**（`.github/workflows/ci.yml`、1 ジョブ、`working-directory: deep-spec-analysis`、15 分）: submodule 取得 → node 24 → bun 1.3.13 → `bun install --frozen-lockfile` → `bunx tsc --noEmit` → `bun test --coverage` → `bun ../aidlc-workflows/core/tools/aidlc-plugin-validate.ts .` → 7 ハーネス（claude／codex／copilot／cursor／kiro／kiro-ide／opencode）分の `aidlc-plugin-build.ts`
- **Renovate**（`renovate.json`）: `config:recommended`、月曜 9 時前（Asia/Tokyo）、PR 同時 3 本。ソルバー 2 本（`@informalsystems/quint`・`z3-solver`）は「solver backends」に束ねて **Dependency Dashboard 承認制**、bun ランタイムと `@types/bun` は同時更新、GitHub Actions は 1 本に束ねる。mise マネージャが `mise.toml` と CI の固定を同時に上げる
- **配布**: projection ビルド（`aidlc-plugin-build.ts`）と PR マージ。運用ステージ（deployment／observability）は本リポジトリでは対象外

## 関連成果物

- 外部依存と内部依存の全体: `dependencies.md`
- CI の手順とテストの数字: `code-quality-assessment.md`
