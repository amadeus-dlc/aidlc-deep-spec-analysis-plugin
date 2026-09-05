# 生成経路をコンストラクタへ集約する

移植元: [amadeus-ngの同名規則](https://github.com/amadeus-dlc/amadeus-ng/blob/537c4e56a838a4cb28f6564d4c0add1d4adfe915/aidlc/spaces/default/knowledge/aidlc-shared/coding-rules/factory-naming.md)。2026-09-05にTypeScriptと当該の裁定へ適用し直した版。

## 基本コンストラクタ

コンストラクタは`private`とし、具体的な引数型を維持する。`unknown`へ広げたり、TypeScriptが保証する型を実行時に再検査したりしない。非空・形式・値域・フィールド間の関係など、型だけでは表せない不変条件をコンストラクタで検査する。

すべての生成経路は同じコンストラクタを通る。setterの呼び出し順に依存した初期化や、検証を省略する復元専用の入口を作らない。

単純な引数型はnumber・string・具体的なVO型を明記し、Parameters<typeof X.of>[0]による逆算をしない。複合引数は未検証のXParam型としてconstructor・of・parseで共有し、VO本体とは区別する。constructor・of・parseは複数行の通常表記に揃える。

## ofとparse

| 入口 | 用途 | 失敗の扱い |
| --- | --- | --- |
| `of` | データベース等の保存状態から再構成する。検証済みVOから契約が保証される組み立てにも使う | 契約違反の`IllegalArgumentException`はpanicとして伝播する |
| `parse` | 通常のドメインロジックで、不適合が起こりうる値を生成する | 自分のコンストラクタの契約違反だけを`Result`のエラーへ変換する |

`of`の例外をadapterやRepositoryで捕捉して入力エラーに変換してはならない。入力境界では最初から各DPの`parse`を呼び、そのResultを明示的に処理する。`parse`も想定外の実装例外は伝播させる。検証条件はコンストラクタに一度だけ記述する。

`reconstitute`などの名前で別の契約を持つ入口を作らない。保存されていたことは、値の不変条件を免除する理由にならない。

すべての値が有効な正規化・宣言値や、内部で導出する個数には、形だけの`parse`を強制しない。空配列を禁止するかどうかも意味で判断する。`ErrorMessages`の空は「エラーなし」という有効な値である。

長さ上限などの値の制約を追加した宣言値は、もはや「すべての値が有効」ではない。通常の生成には`parse`を用意し、呼び出し側もResultを処理する。`Declaration`のサイズ超過がその例である。`DeclaredBindingValue`は検証済みのDeclarationを受け取り、型別名や生のJSONを受ける互換口は持たない。

コンストラクタが契約違反の例外を送出しうる場合、公開parseは必須である。他のVOや共通処理への委譲も含めて横断監査する。ErrorMessages・FunctionalRequirementReferences等のコレクションも、空が有効という理由で件数超過の失敗を見落とさない。

## 意味のある生成操作

`compose`の正準化、`ofText`のハッシュ計算、`timeout`などの名前付き生成は、操作の意味が違う場合に残せる。最終的には共通のコンストラクタを通す。名前を一般的な動詞へ揃えるために、正確なドメイン語を失わせない。

ビルダーを使う場合も`build`が共通のコンストラクタへ委譲する。不変な値から変更後の新しい値を返す`with…`は、その場で書き換えるsetterとは区別する。引数が多い場合は、先に責務や値オブジェクトのまとまりを見直す。

関連: [エラーハンドリング](error-handling.md)、[CQS](command-query-separation.md)。
適用範囲と優先関係は[共有規則の入口](README.md)を参照。
