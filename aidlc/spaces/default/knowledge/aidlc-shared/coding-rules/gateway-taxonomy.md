# Gatewayの責務と命名

移植元: [amadeus-ngの同名規則](https://github.com/amadeus-dlc/amadeus-ng/blob/537c4e56a838a4cb28f6564d4c0add1d4adfe915/aidlc/spaces/default/knowledge/aidlc-shared/coding-rules/gateway-taxonomy.md)。2026-09-05にTypeScriptと当該の裁定へ適用し直した版。

## 責務を区別する

| 責務 | 契約 | 配置 |
| --- | --- | --- |
| 集約の保存・取得 | 集約名を冠する`XxxRepository` | portはusecase、実装はadapter |
| 外部システムとの協調 | 相手と用途を表す`XxxClient` | portはusecase、実装はadapter |
| 時計・ファイル操作・ロックなどの機構 | 必要な注入契約と実装 | 既存の層規則に従う。I/O実装はadapter |

- Repositoryは集約単位で命名する。保存媒体やファイル名だけでドメインの境界を決めない。
- 同じ集約の保存・取得を`Store`・`Reader`・`Writer`というポートへ機械的に分解しない。
- ポートは利用者が必要とする契約を表す。具体的な保存媒体、パスの組み方、プロトコルの詳細を漏らさない。
- 外部クライアントをRepositoryと呼んだり、同じシステムのドメインを便宜的に外部システム扱いしたりしない。
- 保存時の業務判断や不変条件は集約が持つ。Repositoryに`storeConformed`など業務判断込みの変種を増やさない。
- 合成ルートで実装とテスト用実装を選ぶ。内部の機構シームと、ユースケースが利用するポートを区別する。

## このリポジトリでの適用

読むだけのユースケースも通常のusecase層に置ける。Repositoryを利用するために書き込みを強制しない。DTO専用の別系統や投影の更新機構を、Gatewayの必須分類として追加しない。

時計などの既存port、インメモリのテストダブル、ファイルを使うRepositoryは、現在の契約と層規則に従う。移植元の保存ライブラリやポート接尾辞のlintを導入済みとは扱わない。

関連: [ユースケース](use-case-rules.md)、[永続化中立性](domain-persistence-neutrality.md)。
適用範囲と優先関係は[共有規則の入口](README.md)を参照。
