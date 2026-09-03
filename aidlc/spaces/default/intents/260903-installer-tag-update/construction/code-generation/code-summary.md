# Code Generation 実装サマリー

## 実装した内容

- `aidlc-workflows` submodule に既に存在する 2.7.1 配布物から、導入済みの Codex／Claude／Cursor harness 面を更新した。ユーザー固有の `aidlc/` 記録・memory と既存 Claude 設定は保持し、Codex hook trust hash を再生成して個人設定へ反映した。
- Codex PreToolUse adapter が `updatedInput` を返す全経路で `permissionDecision: "allow"` を付与し、参照 worktree の修正パターンを本リポジトリへ適用した。
- zero-Unit express の `construction/code-generation/traceability.json` を Unit path と誤認していた検査を修正し、Requirements の FR／NFR を直接検証できるようにした。
- installer を checkout／submodule 非依存にし、local repo root、branch、固定 tag、latest stable tag から source を解決できるようにした。remote archive は絶対 path、`..`、hard link、symlink を展開前に拒否する。
- build は導入先 harness の `aidlc-plugin-build.ts`、target 定義、plugin test を使用する。source の取得・manifest 検証・build が終わるまで導入先 payload を変更しない。
- compose 後の plugin-owned regular filesを相対 path の byte 順で正準化し、SHA-256 を来歴へ原子的に保存する。来歴自身は digest、contributes、refresh、tombstone の対象外である。
- `--update` は local path／branch／latest の意味を維持し、固定 tag は照会せず `Changed 0` とする。完全一致時は来歴 bytes と mtime を変えない。
- doctor に来歴と最新 stable tag の version advisory を追加した。GitHub 不達時も既存 doctor を失敗させず、`pass: true` の advisory label に skip 理由を残す。
- release script は clean な `main`、stable SemVer、local／remote tag 未使用を事前検証し、英語 commit、tag、`git push --atomic` を実行する。CI は tag と manifest version の一致を検査する。
- root／plugin の日英 README を tag-first Quickstart、stdin bootstrap、各 selector、update、来歴の説明へ更新した。

## 変更ファイルの概要

- AI-DLC 2.7.1 投影: `.codex/`、`.claude/settings.json`、`.cursor/` の更新対象
- installer／release: `deep-spec-analysis/scripts/{install,release}.ts`
- doctor: `deep-spec-analysis/src/doctor/{domain,usecase,adapter}/` と `deep-spec-analysis/src/entries/deep-spec-analysis-doctor.ts`
- tests: adapter、installer、doctor version、release、intent E2E、architecture 回帰
- distribution: `deep-spec-analysis/tools/deep-spec-analysis-doctor.ts`
- CI／documentation: `.github/workflows/ci.yml` と4つの日英 README
- AI-DLC成果物: 本ディレクトリの plan、unit-test instructions、summary、traceability、source manifest

## テストと品質

- 事前基線: TypeScript、bundle drift、既存全502 tests（501 pass／1 skip）がgreen。
- 実装後: `bun test --coverage` は528 tests（527 pass／1 skip）、0 failure。domain coverage floorは維持した。
- Codex adapter専用4 tests、installer専用9 tests、doctor version専用7 tests、release専用9 testsがgreen。
- `bunx tsc --noEmit`、architecture rules、golden、bundle drift、plugin validate、7 harness buildがgreen。
- vanilla Claude harnessに対する`aidlc-plugin-test`は`CLEAN`、`Drops: 0`、`Idempotent second compose: true`。plugin由来の`tools/`はbundle 10本＋data 4本の14ファイルを維持した。

## 設計判断と計画差分

- 承認済み plan と unit-test instructions は approval fingerprint の入力であり、生成後のcheckbox追記でも承認が失効する。実施状況と実測コマンドは本summaryへ記録し、承認済み2ファイルのbytesは維持した。
- stdin bootstrap は単一のraw scriptだけで起動できる必要があるため、source acquisition の境界ロジックは自己完結した `scripts/install.ts` に置いた。doctor は既存の層構造に従い、domain／usecase／adapterへ分離した。
- compose は Markdown 内の `{{HARNESS_DIR}}` を具体値へ materialize する。no-op判定はこの変換後bytesを候補digestに使い、同一sourceを誤って再導入しないようにした。
- 既知tombstoneが残る場合はpayload digestが一致してもno-opにせず、cleanupを優先する。
- Codex向けplugin-testのvanilla 2.7.1投影は`.codex/skills`欠落を上流composeがdropとして報告するため、権威ある`CLEAN`確認は同一pluginのClaude投影で実施した。Codexを含む7 harnessのbuild自体はすべて成功している。
