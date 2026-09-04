# エンジンとシェルの更新、プラグインの再 compose

aidlc-workflows（submodule）とこのリポジトリの `.claude/`（シェル）を 2.6.123 → 2.7.1 に上げたときに確立した手順と、正しい検証信号。

## 1. 更新の 3 層

| 層 | 実体 | 更新のしかた |
|---|---|---|
| エンジン（開発時） | `aidlc-workflows/` submodule | `git -C aidlc-workflows checkout --detach origin/main` → 親で commit。CI の validate／build ツールチェーンはここから来る |
| シェル（このリポジトリの `.claude/`） | `dist/claude/.claude` のコピー | `rm -rf .claude && cp -R aidlc-workflows/dist/claude/.claude .claude` → ローカル固有分を戻す |
| インストール先（サンドボックスや利用プロジェクト） | `dist/claude/` の上書き ＋ プラグイン再 compose | 公式手順（下記 3） |

## 2. シェル更新で保全するもの（このリポジトリの場合）

- `settings.json`: env ブロックは同梱の Bedrock 既定を外した独自設定で、top-level にも独自キー（`language`・`attribution` など）がある。**バイト同一で戻す**。upstream 側の `settings.json` が変わっていないかは `git -C aidlc-workflows diff <旧> <新> -- dist/claude/.claude/settings.json` で確認する
- リポジトリ固有のセンサー（`sensors/aidlc-pr-review-clean.md` ＋ `tools/aidlc-sensor-pr-review-clean.ts`）
- `CLAUDE.md` はルート配置（dist は `.claude/CLAUDE.md` にテンプレートを置く。本文はプロジェクト名行以外同一なので、ルートに移してある分と二重化させない）
- `settings.local.json` は dist に無いので上書きでは消えない
- カスタム scope `plugin-dev`（2026-09-05、aidlc-grilling-plugin から取り込み）: `.claude/scopes/aidlc-plugin-dev.md`・`.codex/scopes/aidlc-plugin-dev.md`、11 stage ファイル（initialization 3・intent-capture・reverse-engineering・requirements-analysis・domain-design・units-generation・functional-design・code-generation・build-and-test）の `scopes:` の `- plugin-dev` 行、`aidlc-graph compile` で再生成した `tools/data/{stage-graph,scope-grid}.json`（両シェル）、`scope-table` の表（`.claude/skills/aidlc/SKILL.md`・`.agents/skills/aidlc/SKILL.md`）、runner `.claude/skills/aidlc-plugin-dev/`・`.agents/skills/aidlc-plugin-dev/`（`aidlc-runner-gen scopes` で再生成）。シェルを dist から上書きしたら、この 5 種を戻して compile・scope-table・runner-gen scopes を再実行する
- 検証: `diff -rq .claude <backup>` の差分が upstream の `dist/claude/.claude` 差分と一致すること、`bun .claude/tools/aidlc-runner-gen.ts check` が in sync、hooks が無変更なら再承認・再起動は不要

## 3. インストール先の後入れアップグレード（公式手順と実証）

1. `cp -R aidlc-workflows/dist/claude/. <project>/`——shipped stage graph が復元され、**composed plugin entries（plugin stage）と contribution merge（core stage の `sensors:` への注入）が消える**。`aidlc/spaces/default/memory/*.md` と `.mcp.json` は dist と同一なら失われるものは無い
2. `bun deep-spec-analysis/scripts/install.ts --project <project>`——build → **upgrade refresh**（dist payload と同名の既存ファイルだけを除去し、tombstone はファイルだけでなくディレクトリも再帰削除する）→ no-clobber compose。冪等
3. **`dist/claude/tools` は 14 ファイル。** src/・tools 配布分離（2026-09-03。`docs/decisions.ja.md` 参照）以降、`.ts` を逐語コピーした 472 ファイルではなく、entry ごとに束ねた bundle 10 本＋`data/` 4 本になった。旧構成からの後入れアップグレードでは、upgrade refresh が同名ファイルを置き換え、tombstone が層ディレクトリ 6 本（`tools/{kernel,requirements,design,refinement,refcheck,doctor}/`）を再帰削除する。実測: 旧構成を導入していたサンドボックスの `.claude/tools/` が 616 → 85 ファイルになった
4. **`tools/<entry>.ts` は `.ts` の名を着た bundle 済み JavaScript。** ファイル名は上流ディスパッチャの契約の一部——`aidlc-workflows/core/tools/aidlc-sensor.ts` の `resolveScriptPath` は manifest の `command` から `.ts` で終わるトークンを探し、無ければ `dispatchError` で落ちる。**これを知らずに `.js` に変えるとセンサーが dispatchError で落ちる**
5. 検証の信号:
   - `bun aidlc-workflows/core/tools/aidlc-plugin-test.ts deep-spec-analysis --install <project>` が `Plugin test: CLEAN`、**`Changed files (0) / Drops: 0 / Idempotent second compose: true`**——これが冪等性の権威ある信号
   - `upgrade refresh: removed N files` の N は「除去した同名ファイル数」であって変更数ではない（1 回目 151、2 回目 486 でも正常）
   - stage-graph の slug 一覧が before と一致、sensors 9／sensor tools 9／doctor が揃う、core stage 3 つの frontmatter に `deep-spec-refcheck-*` が戻る
   - **`tools/` が 14 ファイルであること**、**doctor の manifest 行から層 facade の canary 17 行が消えていること**を確認する
   - doctor の before／after 差分が plugin 由来の行だけ

## 4. 2.7.x で知っておくこと

- 2.7.0 は 2.6.x を新しいマイナー基線に統合したもの（33 stages。ランタイム挙動は 2.6.124 から不変）。プラグインの contribution 先 `domain-design`／`contract-design`／`functional-design` は 2.6.121 の時点で既にある
- 2.6.124 以降、新規レコードの `aidlc-state.md` は `Project Root: .`（プロジェクト相対）。既存レコードは絶対パスのまま（書き換えない）
- 2.7.1 は solo ワークフローの Plan Approval デッドロック修正（Stop hook の probe が approval runtime を消していた）
- `AWS_AIDLC_DEFAULT_SCOPE` は既定 `classic`。旧来の full-lifecycle 既定に戻すなら `feature`

## 5. 委譲エージェントが越えられない線

`.claude/hooks/aidlc-state-transition-guard.ts` は、委譲エージェント（Task／サブエージェント）からの状態遷移コマンド——`aidlc-orchestrate.ts next`・`aidlc-utility.ts intent*`・`intent-create` 等——を対象プロジェクトに関わらず PreToolUse で拒否する。サンドボックス検証を委譲するときは、これらの手順はメインセッションが実行する前提で brief を書く。`active-intent` を直接書き換えて迂回させない。

## 6. 検証マトリクス（submodule を上げたときの最小）

1. `bun install --frozen-lockfile` → `bunx tsc --noEmit` → `bun test --coverage` → `aidlc-plugin-validate` → 7 ハーネス build（CI と同じ）。`tests/intent-e2e.test.ts` は `dist/claude` をバニラ導入した一時 sandbox で installer・センサー・doctor・`--single` を実走するので、新エンジンとの結合はここで通る
2. 実サンドボックスへの後入れアップグレード（上記 3）と実射（`formal-verification-ops.md` §5）
3. CI の flake に注意: bun の hook 既定予算は 5 秒で、engine プロセスを spawn する `beforeAll` は明示のタイムアウトを持つ（`{ timeout: 300_000 }`）

## 7. その他の運用メモ

- Renovate の GitHub App はアカウント／org 単位のインストール。リポジトリを個人から org へ移管すると App は付いてこないので、onboarding PR をマージしても動かない。`gh api orgs/<org>/installations` で確認する
- `gh pr view` の `headRefOid` が古いまま詰まることがある。`gh api repos/…/pulls/N` を直に読むか、PR の close/reopen で直る
- レビューボットのレートリミット待ちはマージを止める理由にしない。条件は CI グリーンと、既に付いている指摘の解決
