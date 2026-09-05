# 生成契約の再確認（2026-09-05）

ユーザー指示に従い、型の保証はTypeScriptに任せ、値の不変条件をコンストラクタに集約した。[PR #147](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/pull/147)の追加修正。

## 修正と確認

| 観点 | 確認結果 |
|---|---|
| 引数の型 | `string`・`number`・`readonly string[]`・型付きpropsを維持。追加した引数の`typeof`・`Array.isArray`検査と汎用JSON型検査は削除した。既存の外部文書decoderは維持する |
| 値の事前条件 | 既存のparseを持つ47種類のプリミティブとPluginVersionについて、形式・非空・値域の検査をコンストラクタへ集約した |
| 通常生成 | `of`は値を直接返し、契約違反の`IllegalArgumentException`を送出する |
| 入力の解析 | `parse`は同じコンストラクタを呼び、契約違反だけを`Result`へ変換する。Error・TypeErrorなどの予期しない例外は送出する |
| 復元 | ソース内の`reconstitute`を廃止。findingsのkind・method・skip reasonなどは復元時にも検証済みの値を要求する |
| 不正な宣言 | DeclaredBound・DeclaredDigest・DeclaredRuleIdを使い、診断対象の原文と検証済みの値を区別した |
| 集合 | ErrorMessagesの空配列は「エラーなし」として有効。入力のコピーと凍結でスナップショットを保持する |
| ドメイン外の並び | 任意の文字列の比較のために不正なTargetIdを生成しない。純粋な比較器を言語基盤へ移し、参照元の記述はFrRefClaimsが保持する |

`compose`は検査結果を正準順にする操作として残し、`of`へ委譲する。型付きの文書を保持する`of`とは操作の意味が異なる。空配列を禁止するなど、根拠のない事前条件は追加していない。

証拠文書のコンストラクタも型付き入力を維持する。外部文書の型への変換は既存のadapter境界に置き、ドメインに実行時の型検査を追加しない。今回の確認は既存の値の事前条件と生成経路が対象であり、新しい業務ルールを定義するものではない。

## 回帰確認

- `construction-contracts.test.ts`: 48種類の有効値・同じ型の不正値について、ofの送出とparseのエラー変換を確認。予期しない例外の送出、ErrorMessagesの有効な空と不変性も確認（50テスト）。
- `architecture.test.ts`: 復元専用の生成口の再導入を検出するルールと、検出力を示す正常・異常の例を追加。
- 全体: **662成功・1スキップ・0失敗**、663テスト、35ファイル、3649 assertions。スキップは明示的なスナップショット指定を要するparity harness。
- TypeScript型検査、14生成ファイルの同期確認、plugin validation、7ハーネス向けビルドに成功。plugin validationは既存のcompose hook未同梱警告1件、エラー0件。
- lcov合算方式の相対ゲート: head **99.85%**、main（`6aa82e5`）**99.86%**。絶対90%と相対許容差0.01ポイントの両ゲートに成功。除外・しきい値は変更していない。
- 正常系goldenと契約スキーマは変更していない。従来不正なドメイン値を直接組み立てていたテストは、有効な値、契約違反、原文の宣言をそれぞれ意図に合わせて用意した。FR6の手書きfixtureは空triggerを未宣言へ修正し、そのfixtureのハッシュ期待値だけを更新した。
- `aidlc-workflows/`に差分なし。比較用worktreeは`mise trust`を実行し、計測後に削除した。
