# コード生成の結果 — tools/ を出荷物（bundle）と src/ に分離

計画 16 ステップをすべて実行し、全体検証と実サンドボックス実射まで通した。

## 変更したもの

差分の形: リネーム 454（`git mv tools src` と entry の移動）、追加 40、変更 42、削除 4。

| 領域 | 内容 |
|---|---|
| `deep-spec-analysis/src/` | `tools/` から移設。`<ctx>/<layer>/` 17 層＋`entries/`（entry 10 本）＋`entries/data/`（契約スキーマ 4 本）。17 層と `entries` に `package.json`（`@deep-spec/<ctx>-<layer>`、`exports` は `"."` → `./index.ts` のみ、`dependencies` は実際に import している辺だけを `workspace:*` で宣言）。層またぎ import 695 箇所を bare specifier に置換 |
| `deep-spec-analysis/tools/` | 生成物のみ。bundle 10 本＋`data/` 4 本の 14 ファイル。ファイル名は `<entry>.ts`（中身は bundle 済み JS） |
| `deep-spec-analysis/scripts/build-tools.ts` | 新規。entry ごとに `bun build --target=bun --external z3-solver --sourcemap=none` で 1 本ずつ束ね、`src/entries/data/` を `tools/data/` に同期。`--check`（一時ディレクトリへ再生成して byte 比較、差分はファイル名を挙げて非ゼロ終了）と `--out <dir>` |
| `deep-spec-analysis/scripts/install.ts` | `REMOVED_PAYLOADS` をファイル／ディレクトリ両対応にし、6 コンテキストの層ディレクトリを再帰削除 |
| `deep-spec-analysis/tests/` | in-process import を bare specifier へ。spawn 先を `tools/` の出荷物へ。アーキテクチャ規則を `src/` 基点に移し新規則を 1 本追加（18 → 19 本）。新規テスト 2 ファイル（`package-boundaries` 3 test、`build-tools` 10 test）と `intent-e2e` の tombstone 拡張 2 本 |
| `deep-spec-analysis/sensors/`, `stages/`, `README*.md`, `tests/README*.md` | 新しい構成（`src/` がソース、`tools/` が生成物）に追随 |
| `deep-spec-analysis/{package.json,bun.lock,bunfig.toml,tsconfig.json}` | `workspaces`、`[install] linker = "isolated"`、カバレッジ除外と `include` を `src/` 起点へ |
| `.github/workflows/ci.yml` | typecheck の直後に `bun scripts/build-tools.ts --check` を追加 |
| `deep-spec-analysis/docs/decisions{,.ja}.md`, チームナレッジ `aidlc-engine-operations.md` | 配布モデル変更と裁定を記録 |

## 主な実装判断

- **`tests` を workspace メンバーにした（実測に基づく）**: 計画の既定案（root `package.json` の `dependencies` に層を列挙）は、未宣言の層からの import が root `node_modules` へ上位探索して解決してしまい、`tsc` も TS2307 を出さなくなった。境界の検出が丸ごと無効になるため不採用。`tests` をメンバーにすると `@deep-spec` は `tests/node_modules/` にだけ張られ、依存 0 の層からの import は `Cannot find module` になる
- **`layer-direction` は相対 import の判定を残したまま bare specifier の判定を追加した**: 相対判定を外すと既存 red/green example の検出力が落ちて「既存規則を維持」に反する。越境相対は新規則 `no-cross-package-relative-imports` と二重に検出される
- **出荷物名を層から追い出した**: 兄弟 entry 名・refcheck tool 名・`childHostPath` を entry が注入する形にした（`process-only-in-entries` の流儀）。今後の拡張子や名前の変更が層に波及しない
- **`--out <dir>` を生成器に足した**: `--check` の比較先も切り替わるので、`tools/` を一切書き換えずに「1 バイト改変」「欠落」「余剰」の検出力を検証でき、決定論テストも一時ディレクトリで完結する
- **`tools/**` をカバレッジ除外に足さなかった**: `bun test --coverage` の実測で `tools/` は計測に一切現れない（すべて子プロセス実行で in-process 計測に乗らない）。計画 Step 13.3 は実測により no-op

## 計画からの逸脱

1. **契約スキーマの原本を `src/data/` から `src/entries/data/` へ移した**（計画 Step 8.3 は `src/data/`。オーナー承認済み）。entry は `dirname(fileURLToPath(import.meta.url))` からの相対で `data/` を引くため、原本を entry と同階層に置くとソースツリーと出荷物で相対規則が一致し、`bun src/entries/<entry>.ts` の直接実行も生きる。`src/` は配布されない（`plugin.json` の `contributes` は `stages/` `contributions/` `sensors/` `knowledge/` `tools/` の 5 つ）ので配布への影響はない
2. **Step 4 の範囲を広げた**: `tools/data/*.json` をファイルとして読む in-process テスト 9 本の schema 参照を追随させた。`git mv` で全て赤になり、そのままでは Step 5 の緑判定ができなかったため
3. **`tests/architecture/rules.ts` の `locationOf` が `entries/data/` を分類するようにした**（1 の副次）。`.json` は走査対象外なので実ツリーへの影響はゼロだが、規則が原本の実位置を指すようにした

計画ファイルは Plan Approval の署名対象なので編集していない。逸脱はここと `memory.md` に記録した。

## オーナー裁定 2 件（実装中に発生）

1. **NFR4 の bundle サイズ上限を 512 KiB に見直した**。当初の「300 KB 以下（実測 50〜160 KB）」は requirements 系 entry だけの実測で、241 モジュールを束ねる design 系 3 本（291〜300 KB、最大 300,296 バイト）を織り込んでいなかった。単位の解釈次第で 189 バイト差で落ちる脆いゲートになるため、閾値を通すために単位を選ぶのではなく上限自体を見直した
2. **出荷物のファイル名を `.ts` のまま据え置いた**。上流の実行経路が `.ts` を要求する: `aidlc-workflows/core/tools/aidlc-sensor.ts` の `resolveScriptPath` は manifest の `command` から `.ts` で終わるトークンを探し、無ければ `dispatchError` で落ちる。`aidlc-utility.ts` の doctor チェックも `<plugin>-doctor.ts` を決め打ち。一方、配布経路（`aidlc-plugin-validate` / `aidlc-plugin-build` / compose）に拡張子検査は 1 件も無い。要件 FR2.1／FR2.4／FR3.1／FR4.1〜FR4.3／FR4.5／FR5.2／FR5.3／FR6.2／NFR2 を裁定に合わせて改訂した

副産物として、外部仕様の変更は **doctor の manifest から層 canary 17 行が消える 1 点だけ**になった（層が配布されなくなる以上避けられず、この変更の目的そのものの帰結）。entry 行のラベルは変わらない。installer の tombstone も層ディレクトリ 6 本だけで済む（旧 entry は同名なので既存の upgrade refresh が置き換える）。

## テストとカバレッジ

新規テストは 4 ファイル 15 本（Minimal 戦略: 要件ごとに 1 本）:

| ファイル | 本数 | 検証する要件 |
|---|---|---|
| `tests/package-boundaries.test.ts` | 3 | FR1.3 / NFR5（宣言外の層が型検査・実行時とも解決不能、深いパスも不可） |
| `tests/build-tools.test.ts` | 10 | FR3.2（drift guard と変更・欠落・余剰の検出力）／NFR1・FR3.3（決定論）／FR2.1・NFR4（出荷形とサイズ） |
| `tests/architecture.test.ts`（追加ケース） | red/green 各 2 | FR1.5（パッケージ外への相対 import）／FR5.3（bare specifier での方向判定） |
| `tests/intent-e2e.test.ts`（tombstone 拡張） | 2 | FR4.5（旧構成が再導入で消える、2 回目が冪等） |

既存の golden（`tests/fixtures/*/expected/*.json`）と parity スナップショットは**更新していない**。カバレッジ床 0.9（行・関数、domain 層のみ）も変えていない。

## 最終検証（すべて実測）

| 検証 | 結果 |
|---|---|
| `bunx tsc --noEmit` | exit 0 |
| `bun scripts/build-tools.ts --check` | exit 0（`14 file(s) up to date`） |
| `bun install --frozen-lockfile` | 123 installs / no changes |
| `bun test --coverage` | **496 pass / 1 skip / 0 fail**（2,745 expects、497 tests / 25 files、25.5s）。床 0.9 維持。skip 1 は opt-in の parity ハーネス |
| `aidlc-plugin-validate` | **VALID**（Errors 0、warning 1 は既存の `compose-hook-absent`） |
| 7 ハーネス build | claude / codex / copilot / cursor / kiro / kiro-ide / opencode すべて成功。`dist/claude/tools` は **14 ファイル** |
| installer 再導入（サンドボックス） | `.claude/tools/` の総ファイル 616 → 85。層ディレクトリ 6 本が消滅し、サブディレクトリは `data/` のみ |
| 実射（実ディスパッチャ、`260829-feature` fixture） | ir-valid **pass** ／ SMT **5 findings・skipped 2・exhaustive** ／ Quint **2 findings・skipped 3・bounded（実 Apalache）** ／ cross-check **SC-3・SC-5 で disagreement 0**。3 ファイルとも移行前の基線と **byte 同一** |
| doctor | **31 checks、fail 0** |
| `aidlc-plugin-test` | **CLEAN** ／ Changed files 0 ／ Drops 0 ／ Idempotent second compose true |
| golden・parity | `git status` に項目なし＝**無変更** |
| bundle サイズ | 48,979〜300,296 バイト（上限 512 KiB に対し十分） |
| bundle 生成時間 | 106ms（NFR3 の 10 秒に対し十分） |

## 残っている注意点

- 実射時のサンドボックスの active intent は `260829-feature` ではなく `260829-intent` のままだった（状態遷移コマンドは委譲エージェントに禁止されているため切り替えていない）。findings JSON は成果物の隣の正しい場所に出ており検証結果の妥当性に影響はないが、失敗 2 本の detail md が `260829-intent/.aidlc-sensors/` に落ちている（gitignore 対象）
- `src/entries/data` は root の workspace glob `src/*/*` に形の上で一致する。`package.json` を持たないので `bun install --frozen-lockfile` は no changes で通るが、将来 `src/entries/data/package.json` を作らないこと
- `scripts/install.ts` は `tools/design/` のディレクトリ項目と `tools/design/domain/design-temporal-decl.ts` のファイル項目を両方持つ（前者が後者を包含）。この変更の前からある冗長で害はないため触っていない
- entry を node で実行すると `MODULE_TYPELESS_PACKAGE_JSON` 警告が stderr に出る。親は stdout の最終行を読むのでプロトコルは無傷（実証済み）。`tools/package.json` を置けば消えるが 14 ファイルの出荷形に反するので置いていない
- コミットはしていない（`git add` まで）
