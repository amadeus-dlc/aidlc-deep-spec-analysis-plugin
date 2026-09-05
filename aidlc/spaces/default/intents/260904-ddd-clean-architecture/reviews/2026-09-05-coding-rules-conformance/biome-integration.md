# Biome による整形・lint

アプリケーションの Bun 開発依存に `@biomejs/biome` 2.5.12 を固定し、保守対象全体へ適用した。設定は `deep-spec-analysis/biome.json`、依存関係は同ディレクトリの `package.json` と `bun.lock` で管理する。

## 実行方法

`deep-spec-analysis/` で実行する。

| コマンド | 用途 |
| --- | --- |
| `bun run check` | 整形・lint・import 順序を確認。警告も失敗として扱う |
| `bun run check:fix` | 整形・import 整理・安全な lint 修正を適用 |
| `bun run format` | 整形を適用 |
| `bun run lint` | lint のみ確認 |
| `bun run typecheck` | TypeScript の型検査 |

CI の依存インストール後に `bun run check` を追加した。推奨 lint ルールを有効にし、ルール無効化や抑制コメントは追加していない。整形は 2 スペース・120 桁・ダブルクォートに統一した。

## 適用範囲と手修正

対象は `src/`・`scripts/`・`tests/` と開発用 JSON 設定の582ファイル。公開スキーマ `src/entries/data/` と期待値を含む `tests/fixtures/` は除外する。配布物 `tools/` は生成器から更新し、`aidlc-workflows/` の設定やソースは変更しない。

安全な自動修正後に残った指摘を確認し、次を修正した。

- インストーラーの終了時クリーンアップは、確定したパスをローカル変数で捕捉し、非nullアサーションを削除した。
- 任意の値に対する条件式を optional chaining に統一した。boolean を返す公開メソッドと型述語には `?? false` を付け、戻り値が undefined に変わらないようにした。
- 処理を追加していない Error 派生型のコンストラクタを削除した。
- テストの文字列連結、テンプレート構文を含む入力文字列、グローバル名と紛らわしいローカル変数を修正した。
- フォーマッターで複数行になった型契約テストでは、既存の `@ts-expect-error` を実際の不正プロパティの直前へ移動した。

ソースのトランスパイル結果も比較し、import/export の整理以外の実行コード差分が上記の手修正に対応することを確認した。ドメイン値の構築契約・公開JSON・期待値を変える修正は含めない。

## 検証結果

- `bun install --frozen-lockfile`、`bun run check`、`bun run typecheck`: 成功。Biome の指摘なし。
- `bun test --coverage`: **873成功・1スキップ・0失敗、874テスト、43ファイル、終了コード0**。
- `bun scripts/coverage.ts --base origin/main`: 絶対・相対ゲートとも成功。line coverage は変更後99.89%、基線99.86%。
- 構築契約・命名を含むアーキテクチャテスト47件: 成功。整形後の本番ソースは最大482行で、1000行未満を維持した。
- 生成14ファイルの同期、plugin validation、7ハーネス向けビルド: 成功。既存の compose-hook-absent 警告1件のみ。
- カバレッジのしきい値・除外設定は変更していない。
