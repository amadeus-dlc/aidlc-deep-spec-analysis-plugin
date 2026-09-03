# ビルドとテストの要約

`code-generation-plan.md`（16 ステップ、Testing Contract 埋め込み）、
`unit-test-instructions.md`（新規テスト 4 ファイル／15 本）、`code-summary.md`
（成果と 2 件のオーナー裁定）を入力に、ビルドと全テストを実行した。

## 全体の状態

| 項目 | 状態 |
|---|---|
| ビルド（`bun scripts/build-tools.ts`） | 成功。14 ファイルを 101ms で生成 |
| drift guard（`--check`） | 緑（`14 file(s) up to date`、exit 0） |
| 型検査（`bunx tsc --noEmit`） | exit 0 |
| テスト（`bun test --coverage`） | 496 pass / 1 skip / 0 fail（2,745 expects、497 tests / 25 files、25.9s） |
| カバレッジ床 0.9（domain 層、行・関数） | 維持（breach なし） |
| プラグイン検証 | VALID（Errors 0、warning 1 は既存の `compose-hook-absent`） |
| 7 ハーネス build | 全て exit 0。`dist/claude/tools` は 14 ファイル |
| 実サンドボックス | `.claude/tools/` に bundle 10 本＋`data/` 4 本、層ディレクトリ 6 本は消滅 |
| 実射（実ディスパッチャ） | findings 3 ファイルすべて基線と byte 同一 |
| doctor | 31 checks、fail 0 |
| `aidlc-plugin-test` | CLEAN（Changed files 0 / Drops 0 / 冪等 true） |
| golden・parity スナップショット | 無変更 |

**判定: ビルド可・テスト可・配布可。**

## 生成したテスト指示の一覧

Test Strategy は **Minimal** なので、原則として追加のテスト指示は作らない。ただし
このプロジェクトには既存の結合テスト群があり、今回の変更でその対象（spawn 先）が
出荷物へ移ったこと、配布モデルの変更が供給網の観点を変えたこと、NFR3・NFR4 が
測定可能な目標であることから、記録として 3 本を追加した。**新しいテストスイートは
足していない**——既存のどれが何を繋いでいるかを書いただけである。

| ファイル | 内容 |
|---|---|
| `build-instructions.md` | 前提条件・依存インストール・生成・検証・配布・失敗時の対処 |
| `integration-test-instructions.md` | 既存の結合テスト 7 区分と実行コマンド、境界がどう変わったか |
| `performance-test-instructions.md` | NFR3（時間）・NFR4（大きさ）の測り方と回帰の見つけ方 |
| `security-test-instructions.md` | STRIDE のうち当たる 4 脅威、供給網の検証コマンド、依存の管理方針 |

## 単体テストのカバレッジ（Minimal 戦略）

`unit-test-instructions.md` の定義どおり、要件ごとに 1 本の検証を置いた。

| 新規ファイル | 本数 | 検証する要件 |
|---|---|---|
| `tests/package-boundaries.test.ts` | 3 | FR1.3 / NFR5 |
| `tests/build-tools.test.ts` | 10 | FR2.1 / FR3.2 / FR3.3 / NFR1 / NFR4 |
| `tests/architecture.test.ts`（追加ケース） | red/green 各 2 | FR1.5 / FR5.3 |
| `tests/intent-e2e.test.ts`（tombstone 拡張） | 2 | FR4.5 |

既存 480 テストは緑のまま。数値の床は domain 層の 0.9（行・関数）で、生成物 `tools/` は
すべて子プロセス実行のため計測に現れない（実測）。

## Target Verification Matrix

`nfr-requirements/` と `nfr-design/` は express スコープで SKIP されているので、測定可能な
目標の出典は `requirements.md` の NFR1〜NFR6・FR6.1・FR6.2 と、
`code-generation-plan.md` に埋め込んだ承認済み `## Testing Contract` である。

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| NFR1 | requirements.md NFR1 | 同一ソース・同一 bun から byte 同一 | 一致 | `build-tools --check` exit 0 / `tests/build-tools.test.ts` の決定論テスト | build-and-test | Met |
| NFR2 | requirements.md NFR2 | 外部仕様の項目と文言が不変（例外は canary 17 行の消滅のみ） | 不変 | golden 3 ファイル byte 同一 / parity スナップショット無変更 / doctor の entry 行のラベル不変 | build-and-test | Met |
| NFR3-a | requirements.md NFR3 | `bun test --coverage` 60 秒以内 | 25.9 秒 | `/usr/bin/time -p bun test --coverage` | build-and-test | Met |
| NFR3-b | requirements.md NFR3 | 全 bundle 生成 10 秒以内 | 0.101 秒 | `build-tools: wrote 14 file(s) to tools in 101ms` | build-and-test | Met |
| NFR3-c | requirements.md NFR3 | CI 総所要が変更前の 2 倍以内 | 増分 0.12 秒（追加ステップ 1 本のローカル実測） | `.github/workflows/ci.yml` の差分は `build-tools --check` の 1 ステップのみ。既存ステップは増減なし | build-and-test | Met |
| NFR4-a | requirements.md NFR4 | bundle 1 本 512 KiB 以下 | 最大 300,296 バイト（`design-verify-smt`） | `ls -lS tools/*.ts` / `tests/build-tools.test.ts` の出荷形テスト | build-and-test | Met |
| NFR4-b | requirements.md NFR4 | `tools/` 総ファイル数 14 | 14（bundle 10＋data 4） | `ls tools \| wc -l` = 11（うち `data/` 1）、`ls tools/data \| wc -l` = 4 | build-and-test | Met |
| NFR5 | requirements.md NFR5 | 宣言外の bare import が (a) tsc (b) 規則 (c) 実行時 の 3 点で検出される | 3 点とも検出 | `tests/package-boundaries.test.ts` 3 test 緑 | build-and-test | Met |
| NFR6 | requirements.md NFR6 | 層追加時の変更点が 4 箇所で、手順を README に 1 節で書ける | 4 箇所（層 `package.json`・root `workspaces`・`rules.ts` の許可表・必要なら entry の依存）、README に記載 | `README.md` / `README.ja.md` の構成節 | build-and-test | Met |
| FR6.1 | requirements.md FR6.1 | tsc・test・validate・7 ハーネス build がすべて成功 | すべて成功 | 上表「全体の状態」の該当行 | build-and-test | Met |
| FR6.2 | requirements.md FR6.2 | サンドボックス再導入の形が正しく、実射が 2.7.1 検証時と一致 | 一致 | `test-results.md` の実射節（findings 3 ファイル byte 同一、doctor 31 checks fail 0、plugin-test CLEAN） | build-and-test | Met |
| TC-1 | code-generation-plan.md Testing Contract `obligations.scope_floor` | 既存テストスイートが緑のまま | 緑 | `bun test --coverage` 0 fail | build-and-test | Met |
| TC-2 | code-generation-plan.md Testing Contract `obligations.strategy_volume` | 要件ごとに 1 本、コンポーネントごとに happy-path の床 | 新規 15 本が 7 要件群を覆う | `unit-test-instructions.md` の新規テスト表 / 上表 | build-and-test | Met |
| TC-3 | bunfig.toml `coverageThreshold`（org.md の「弱めてはならない」） | domain 層 0.9（行・関数）維持 | 維持 | `bun test --coverage` が exit 0（床割れは非ゼロ終了） | build-and-test | Met |

`Pending` と `Unverified` は残っていない。後段のステージに委ねた目標も無い。

## 既知の制限と積み残し

- **NFR3-c は上界での判定**である。CI の実測値は次回の GitHub Actions 実行で確認する。
  判定根拠は「追加ステップが 1 本・ローカル実測 0.12 秒・既存ステップは増減なし」で、
  2 倍という目標に対して桁で余裕がある
- **実射時のサンドボックスの active intent は `260829-intent` のまま**だった。findings JSON は
  成果物の隣（`260829-feature`）の正しい場所に出ており検証結果に影響はないが、失敗 2 本の
  detail md が別 intent の `.aidlc-sensors/`（gitignore 対象）に落ちている
- **`scripts/install.ts` に冗長がある**。`tools/design/` のディレクトリ項目と
  `tools/design/domain/design-temporal-decl.ts` のファイル項目を両方持つ（前者が後者を包含）。
  この変更の前からあるもので害はない
- **SBOM とシークレットスキャンの自動化は入れていない**。実行時依存 2 本という規模に対する
  判断であって恒久的な結論ではない（`security-test-instructions.md`）
- **コミットしていない**。差分は作業ツリーにあり `git add` まで済んでいる
