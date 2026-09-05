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

## CIで見つかった確認漏れと補正

[失敗したCI](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/actions/runs/33939543281/job/101234125289)は662成功・0失敗を表示したものの、`IrVersion`の関数カバレッジが87.5%で、`bun test --coverage`の終了コードは1だった。上記のテスト件数とlcov合算ゲートの成功だけでは、ファイルごとのカバレッジ条件を満たした証明になっていなかった。

`IrVersion.equals`について、同値・対称性・major/minor/patchの相違・原文の先行ゼロの扱いを検証するテストを追加した。修正後は関数・行カバレッジとも100%。全体は663成功・1スキップ・0失敗（664テスト、3656 assertions）で、コマンドの終了コード0を確認した。しきい値と実装は変更していない。

また、全DPの生成契約の整備完了を意味しないことを確認した。`RequirementId`と`BrRef`は現在、型付きstringを保持するだけで、空文字・形式違反を拒否しない。`NormalizedName`の全域的な正規化や宣言値の保存とは異なり、これらのIDには生成契約を整備する余地が残っている。既存parseを持つ48型の修正と、全DPの契約監査は区別して扱う。

## parseの入力失敗とofのpanicを分離（追加裁定への対応）

`of`を呼んでその例外をResultに変換していた`decodeDomainValues`は削除した。各DPのparseだけが自分のコンストラクタを呼び、契約違反をResultに変換する。入力境界ではそのResultを処理してから、型付きの材料で集約を組み立てる。モデルパーサも文字列とのunionからResultへ移行した。

- レポート、要求・設計モデル、IR検査材料、refinement材料、コンポーネント・機能設計・ユニット宣言の生値を、各DPのparseへ接続した。
- 先の節で指摘したRequirementId・BrRefの不足を解消し、QueryLabel・DesignUnitIdにもコンストラクタの不変条件とparseを追加した。ソルバが返すクエリラベル・coreの不正もResultとして処理する。FenceCountは内部で導出する個数として安全な非負整数を要求し、違反はpanicになる。
- RepositoryのI/O捕捉からドメインの生成・描画・値取得を外した。公開中のpanicは伝播させ、finallyでロックを解放する。コンパイラも自分のコンパイルエラーだけを処理し、その他の例外を業務エラーに読み替えない。
- 正規化名、任意の記述を保持する宣言値、有効な空コレクションには、理由のない拒否条件や形だけのparseを追加していない。コンストラクタの型は維持し、型の実行時検査も追加していない。

`result-boundaries.test.ts`は、生のskip reasonにofを呼ばないこと、不正入力をResultで返すこと、レポート組み立て・Repository生成・描画のpanicを伝播すること、panic時にロックを解放することを検証する。Resultの合成は例外を捕捉しない。`construction-contracts.test.ts`の検査対象は52種類のparseを持つDPになった。

最終ローカル検証は**675成功・1スキップ・0失敗、676テスト、36ファイル、3708 assertions、終了コード0**。TypeScript型検査、生成14ファイルの同期、plugin validation、7ハーネス向けビルドに成功した。しきい値・除外・正常系golden・契約スキーマは変更していない。`BR-1`など形式に合わなかった手書きテスト値を`BR1.1`へ修正し、未知kindを検査するfixtureはそのkind以外のバージョンを有効値にした。`aidlc-workflows/`は変更していない。
