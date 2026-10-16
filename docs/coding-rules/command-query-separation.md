# CQS — 状態変更と照会を分ける

移植元: [amadeus-ngの同名規則](https://github.com/amadeus-dlc/amadeus-ng/blob/537c4e56a838a4cb28f6564d4c0add1d4adfe915/aidlc/spaces/default/knowledge/aidlc-shared/coding-rules/command-query-separation.md)。2026-09-05にTypeScriptと当該の裁定へ適用し直した版。

**採用方針**: CQSは採用する（2026-09-05、ユーザー確認）。個々のメソッドの責務についての規則である。

## 規則

| 操作 | 責務 | 戻り値の基本形 |
| --- | --- | --- |
| Query | 状態を変更せず答えを返す | 値 |
| Command | 状態を変更する | `void`または`Result<void, E>` |

- 照会に見える操作の中で状態を書き換えない。
- 分離できる状態変更と照会は分離する。便利だからという理由だけで混在させない。
- 既存の値を変更せず新しい値を返す不変変換は、その場の状態変更と区別する。
- コマンドの契約は型自身が所有する。setterを順に呼んで業務操作を再構成しない。
- シグニチャだけを整えるために、内部可変性で状態変更を隠さない。

## 既存の例外

イテレータの状態前進など、操作の意味上、変更と返値を分離できない場合は理由を明記する。このリポジトリでは、保存内容と呼び出し元へ返す判定を一致させるFinalizerの戻り値が既に例外として認められている。既存の設計規則P4に従う。

Rustの`&self`／`&mut self`をTypeScriptへ持ち込まず、状態変更の有無・型・メソッド名・不変性のテストで契約を示す。

関連: [内部可変性](interior-mutability.md)、[集約コマンド](aggregate-commands.md)。
適用範囲と優先関係は[共有規則の入口](README.md)を参照。
