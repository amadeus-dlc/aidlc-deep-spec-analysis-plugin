# アーキテクチャ文書

日本語 | [English](README.md)

`deep-spec-analysis/src/` の DDD とクリーンアーキテクチャの設計規則。**他の AI-DLC プラグインへそのまま持っていける形**で書いてある。

| 文書 | 内容 |
|---|---|
| [`design-rules.ja.md`](design-rules.ja.md) | 規則の本体。35 規則を 6 群（構造・ドメイン・境界・外界・失敗・命名）に分けて、規則／なぜ／実例／検査の 4 点で書く。新しい型を作るときの決定手続きと、このリポジトリに残っている逸脱も含む |
| [`enforcement.ja.md`](enforcement.ja.md) | 機械検査 20 件の棚卸し。どの規則が機械で守られ、どれが人のレビュー頼りかの対応表。免除の表と、検査の既知の限界 |

## この文書の位置づけ

- **ここは「いまの規則」** — 何を守るか。
- [`../decisions.ja.md`](../decisions.ja.md) **は「経緯」** — どの裁定がいつ、なぜ下されたか。規則が変わった理由はあちらにある。
- `aidlc/spaces/default/memory/project.md` の `## Mandated` は**裁定の 1 行要約**。ワークフローが自動で読む。

矛盾したときは、この文書とコードを正とする（この文書はコードを読んで書いた）。

## どう書いたか

`src/` の 489 ファイル・26,007 行を全部読んで、**先に「こう書かれている」を確定し、そこから規範を抜き出した**。既存の設計文書は意図的に参照していない——文書の主張ではなくコードの実体を取るため。

そのため、規則を守れていない箇所も [`design-rules.ja.md` §8](design-rules.ja.md#8-このリポジトリに残っている逸脱) に**そのまま記録してある**。規則の側を曲げて辻褄を合わせていない。移植先が「これは真似しなくてよい」と分かるようにするためでもある。

## 他のプラグインで使うには

短い版:

1. `design-rules.ja.md` と `enforcement.ja.md` をコピーし、§8 の逸脱の表を自分のリポジトリのものに置き換える（最初は空でよい）。
2. 層を決めて各層に `package.json` を置き、`bunfig.toml` に `[install] linker = "isolated"` を入れる。これが無いと層の境界が実行時に効かない。
3. `tests/architecture/rules.ts` をコピーして、文脈・層・entry・免除表を自分のものに差し替える。20 規則を一度に入れなくてよい——層の向き・フィールドとコンストラクタ・1 ファイル 1 公開型から始める。
4. 検査には必ず red example（違反を検出できること）と green example を書く。

どの規則が領域に依存し、どれがしないかは [`design-rules.ja.md` §9](design-rules.ja.md#9-他のプラグインへ移すとき) にある。

## いま守られていること（実測）

| 項目 | 値 |
|---|---|
| 機械検査 | 20 規則、全部に red/green example。`bun test tests/architecture.test.ts` → 38 pass / 0 fail |
| domain の `export class` / `private constructor` | 301 / 302（例外ゼロ） |
| TS の `private` キーワード（constructor 以外） | 0 件 |
| `get` アクセサ | 0 件 |
| `enum` 宣言 / `export *` 宣言 | 0 件 / 0 件 |
| `node:*` を import するファイル | adapter 27・entries 10・domain 1・usecase 0・infrastructure 0 |
| `catch` | adapter 92・entries 4・domain 0・usecase 0・infrastructure 0 |
| Repository の port | 11 個、すべて `find*` と `store` の 2 メソッド |
| `production` ファイルの最大行数 | 400（上限 1,000） |
