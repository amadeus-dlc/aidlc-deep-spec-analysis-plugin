# 実行結果

`build-instructions.md`・`integration-test-instructions.md`・
`performance-test-instructions.md`・`security-test-instructions.md` に書いたコマンドを
実行した記録。入力は `code-generation-plan.md`・`unit-test-instructions.md`・
`code-summary.md`。実行日 2026-09-03、macOS / bun 1.3.13 / node v24.19.0。

## ビルド

| コマンド | 結果 |
|---|---|
| `bun install --frozen-lockfile` | 成功。`Checked 123 installs across 125 packages (no changes)` |
| `bunx tsc --noEmit` | **exit 0**（エラーなし） |
| `bun scripts/build-tools.ts` | 成功。`wrote 14 file(s) to tools in 101ms` |
| `bun scripts/build-tools.ts --check` | **exit 0**。`14 file(s) up to date` |

出荷物の実サイズ（バイト）:

```
doctor                     48,979
ir-valid                  148,353
refcheck-domain           150,180
refcheck-contract         150,191
refcheck-functional       150,266
verify-quint              153,672
verify-smt                156,154
design-ir-valid           291,217
design-verify-quint       300,070
design-verify-smt         300,296   ← 最大（上限 524,288 に対し 43% 使用）
```

## テスト

```
496 pass
1 skip
0 fail
2745 expect() calls
Ran 497 tests across 25 files. [25.94s]
```

- **失敗 0**。skip 1 は opt-in の parity ハーネス（`AIDLC_PARITY=1` で有効化）
- カバレッジ床 0.9（domain 層、行・関数）は維持。`bun test --coverage` は床割れで
  非ゼロ終了するが exit 0 だった
- 変更前の基線は 479 pass / 1 skip / 0 fail（23 ファイル）。増分は新規 4 ファイル 15 本と
  既存ファイルへの追加ケース

区分別（`integration-test-instructions.md` の表に対応）:

| 区分 | 結果 |
|---|---|
| conformance（出荷物 spawn ＋ golden byte 比較） | 緑 |
| parity（スナップショット） | `AIDLC_PARITY=1` で 1 pass / 0 fail、byte 同一 |
| pipeline（in-process） | 緑 |
| entry spawn | 緑 |
| installer / compose（intent-e2e） | 緑（tombstone 拡張 2 本を含む） |
| projection（plugin.test） | 緑 |
| パッケージ境界（package-boundaries） | 緑（3 test） |
| アーキテクチャ規則（architecture） | 緑（19 規則、実ツリー `src/` 468 ファイルで違反 0） |

## 失敗の詳細

**なし。** 失敗したテストは 0 件で、失敗エスカレーションのはしごは発動していない。
`## Loop-Back Log` は存在しない。

## プラグイン検証と配布ビルド

| コマンド | 結果 |
|---|---|
| `aidlc-plugin-validate .` | **VALID**。`Errors: 0; warnings: 1`（`compose-hook-absent` は既存） |
| 7 ハーネス build（claude / codex / copilot / cursor / kiro / kiro-ide / opencode） | 全て **exit 0** |
| `dist/claude/tools` | **14 ファイル**（bundle 10 本＋`data/` 4 本）。列挙で確認 |

## 実サンドボックスでの検証（FR6.2）

対象は `deep-spec-analysis-sandbox/`。出荷物の byte 一致を先に確認してから実射した。

**配布物の一致**: `.claude/tools/` の 10 本と `deep-spec-analysis/tools/` の 10 本が
すべて byte 同一（`cmp`）。

**出荷形**: `.claude/tools/` 直下のサブディレクトリは `data/` のみ。層ディレクトリ
（`design/ doctor/ kernel/ refcheck/ refinement/ requirements/`）は消滅。プラグイン由来は
entry 10 本＋スキーマ 4 本。

**実射**（実ディスパッチャ `.claude/tools/aidlc-sensor.ts fire` 経由、fixture は
`260829-feature`）:

| センサー | 結果 | findings | skipped | method |
|---|---|---|---|---|
| `deep-spec-ir-valid` | passed | — | — | — |
| `deep-spec-verify-smt` | failed（advisory。fixture が findings を出す設計） | 5 | 2 | exhaustive |
| `deep-spec-verify-quint` | failed（同上） | 2 | 3 | **bounded（実 Apalache）** |
| cross-check | — | 0 | 0 | quint と smt が SC-3・SC-5 を照合、不一致 0 |

**3 ファイルすべて移行前の基線と byte 同一**（`smt.json` / `quint.json` /
`cross-check.json` を `cmp` で確認）。実射後の 8822 に listener なし——issue #128 の
SIGINT 対策が効いており、Apalache の孤児は残っていない。

**doctor**: 31 checks、**fail 0**。installed 行のラベルは entry 10 本とも `.ts` のままで
変わっていない。層 facade の canary 17 行は消えている（設計どおり）。

**`aidlc-plugin-test deep-spec-analysis --install deep-spec-analysis-sandbox`**:

```
Plugin test: CLEAN
Composed files (0): none
Changed files (0): none
Drops: 0
Graph compiled: true
Plugin stages present: deep-spec-analysis-functional-verify, deep-spec-analysis-verify
Idempotent second compose: true
```

## セキュリティ検証

| 検証 | 結果 |
|---|---|
| drift guard（生成物とソースの一致） | exit 0 |
| 非公認 import（`only-sanctioned-imports` ほか 19 規則） | 違反 0 |
| ハードコードされた秘密情報 | 検出 0。`token: string` 等の型注釈のみがパターンに当たった偽陽性で、文字列リテラルへの代入は 0 件 |
| 実行時依存 | `z3-solver` のみ（`--external`）。devDependencies 4 本 |
| 配布物の中身 | 14 ファイルちょうど。余計なものは載っていない |

## 外部仕様の不変（NFR2）

| 面 | 結果 |
|---|---|
| golden（`tests/fixtures/*/expected/*.json`） | 無変更（`git status` に項目なし） |
| parity スナップショット | 無変更、byte 同一 |
| 実射の findings JSON 3 ファイル | 基線と byte 同一 |
| verdict 行・exit code の意味 | 不変 |
| doctor の entry 行のラベル | 不変（`.ts` のまま） |
| doctor の層 canary 17 行 | **消滅**——これが唯一の外部仕様変更。層が配布されなくなる以上避けられず、この変更の目的そのものの帰結（要件 FR4.2 で裁定済み） |

## Target Verification Matrix（最終）

`build-and-test-summary.md` の同名の表が最終形である。全 14 目標が `Met`、
`Pending` と `Unverified` は 0。判定の根拠となる実測値は上記各節にある。

NFR3-c（CI 総所要）だけは上界での判定である: `.github/workflows/ci.yml` への追加は
`bun scripts/build-tools.ts --check` の 1 ステップのみ（ローカル実測 0.12 秒）で、
既存ステップは増減していない。実測値は次回の CI 実行で確認する。
