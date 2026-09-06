# 文書の言語規律の検査

日本語 | [English](doc-language-lint.md)

`bun run lint:doc-language` は、Markdown 1 ファイルの散文に英語と日本語が混ざっていないことを検査する。`bun run check` と `bun run lint` に組み込んであり、CI でも回る。

この検査が見るのは**日本語の有無だけ**で、任意の言語の混在は判定しない。この repo の文書は英語版と日本語版の対で持つので、守りたいのはその 2 言語の分離である。

## 規律

この repo の文書は「英語版 `<name>.md` ＋ 日本語版 `<name>.ja.md`」の対で持つ（`docs/decisions.md` / `.ja.md`、`docs/architecture/design-rules.md` / `.ja.md`）。**1 つのファイルに両方の言語を混ぜない。** 混ざると、読み手はどちらの版を読めばよいか分からなくなり、翻訳の抜けも見えなくなる。

| 規則 | 何を違反とするか |
|---|---|
| `japanese-in-english-doc` | `*.ja.md` **以外**の Markdown の散文に日本語がある |
| `no-japanese-in-ja-doc` | `*.ja.md` に日本語が 1 文字も無い（英語のまま置かれた未翻訳の器） |

## 何を「散文」と見るか

フェンス付きコードブロック（``` と ~~~ の両方）とインラインコード（`` ` `` で囲まれた範囲）は**検査しない**。**2 つの規則はどちらもこの同じ散文で判定する**——`*.ja.md` も除去後の本文で見るので、コードの中にしか日本語が無い未翻訳の器は違反として残る。

フェンスは開始の文字と長さを覚え、同じ文字で開始以上の長さのものだけを終端として受け付ける。インラインコードは N 個のバッククォートで開いたらちょうど N 個で閉じ、行をまたぐスパンも扱う（いずれも CommonMark の規則）。

この repo のソースコメントは日本語なので、英語の文書がそれを逐語で引用することは正当である。引用がコードとして囲まれている限り違反にしない。逆に、地の文で日本語を書けば囲みの外なので検出される。

## 判定は仮名で行う

日本語の判定はひらがな（U+3040–U+309F）・カタカナ（U+30A0–U+30FF）・半角カタカナ（U+FF66–U+FF9F）の有無で行い、**漢字は見ない**。

漢字だけの語（「設計規則」など）は中国語と区別がつかず、英語の文書に技術用語や固有名として現れうる。一方、日本語の散文は実際には必ず仮名を伴うので、ファイル単位ではこれで足りる。

**限界**: 漢字だけで書かれた行は検出されない。`tests/doc-language-lint.test.ts` の green example がこの挙動を意図として固定している。

## 免除

免除は表にする。暗黙の除外や名前の部分一致による例外は作らない。

| 対象 | 理由 |
|---|---|
| `tests/fixtures/` 配下 | テストの入力データであって文書ではない。要件文書のサンプルとして日本語の本文を持つことが仕様そのもの |

走査から外すディレクトリは `node_modules` / `.git` / `tools` / `dist`（依存と生成物）。

## 使い方

```bash
bun run lint:doc-language              # パッケージルート配下を検査
bun scripts/lint-doc-language.ts --json   # 機械可読な一覧
bun scripts/lint-doc-language.ts --root <dir>   # 別のルートを検査（テスト用）
```

違反があると exit 1 で落ち、違反ごとに `パス:行 [規則] 抜粋` と直し方を出す。免除リストや既存件数を差し引く仕組みは無い——既存の違反も失敗になる。

## 直し方

1. 日本語の散文を同名の `.ja.md` へ移す。`.ja.md` が無ければ作る。
2. `.md` にはその英訳を書く。
3. 両方の 3 行目に言語切替行を置く——英語版は `English | [日本語](<name>.ja.md)`、日本語版は `日本語 | [English](<name>.md)`。
4. 文書内の相互リンクは同じ言語の版どうしを指すようにする。

## 実装とテスト

- 実装: `scripts/lint/doc-language.ts`（`lintDocLanguage(root)` と `stripCode(markdown)` を公開）
- CLI: `scripts/lint-doc-language.ts`
- テスト: `tests/doc-language-lint.test.ts` — red example（違反を検出できること）と green example（誤検出しないこと）の両方を持つ

## 参照

- [`enforcement.ja.md`](enforcement.ja.md) — 機械検査の棚卸し
- [`usecase-getter-lint.ja.md`](usecase-getter-lint.ja.md) — もう 1 つのカスタムリンター
