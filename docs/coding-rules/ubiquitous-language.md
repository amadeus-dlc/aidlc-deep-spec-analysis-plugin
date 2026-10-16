# 名前はドメインの共通言語に合わせる

移植元: [amadeus-ngの同名規則](https://github.com/amadeus-dlc/amadeus-ng/blob/537c4e56a838a4cb28f6564d4c0add1d4adfe915/aidlc/spaces/default/knowledge/aidlc-shared/coding-rules/ubiquitous-language.md)。2026-09-05にTypeScriptと当該の裁定へ適用し直した版。

## 規則

ドメインの型名・フィールド名・メソッド名は、仕様書・設計書・利用者との会話に現れる概念を表す。実装の都合だけで`Data`・`Info`・`Manager`・`Helper`などを名付けない。

- 同じ概念を仕様書とコードで別の名前にしない。異なる概念を同じ名前で呼ばない。
- 何が起きる操作かを表す。フィールド名をそのまま`set…`へ変換しない。
- 言語の確立した語や技術的境界の語を使う場合は、その理由と役割を明記する。
- 改名する前に利用箇所を全体から探し、特定の担当範囲だけを見て名前を二重化させない。

## 外部契約との区別

外へ出るJSONキー、CLIトークン、findingsの文言などはPublished Languageとして維持する。内部の型名やメソッド名は、外部の実装の綴りに合わせる義務はない。公開する値の互換性と、内部の呼び方を混同しない。

関連: [外部契約](upstream-contracts.md)、[生成規則](factory-naming.md)、[Gateway](gateway-taxonomy.md)。
適用範囲と優先関係は[共有規則の入口](README.md)を参照。
