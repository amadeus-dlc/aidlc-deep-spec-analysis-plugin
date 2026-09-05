# ユースケース — 契約に依存し、業務判断はドメインへ委譲する

移植元: [amadeus-ngの同名規則](https://github.com/amadeus-dlc/amadeus-ng/blob/537c4e56a838a4cb28f6564d4c0add1d4adfe915/aidlc/spaces/default/knowledge/aidlc-shared/coding-rules/use-case-rules.md)。2026-09-05にTypeScriptと当該の裁定へ適用し直した版。

## DIPと配線

ユースケースはportのinterfaceとドメインに依存する。`XxxRepositoryImpl`などadapterの実装へ依存しない。具体的な実装を選ぶのは`src/entries/`の合成ルートである。

TypeScriptのinterfaceを通じた型付きのコンストラクタ注入を使う。Rustの単相化や`dyn`の選択を、そのままTypeScriptの規則にはしない。

## 入出力と取得

- 公開入力はユースケースが必要とするID・値・型付き入力で表す。
- 外部の生値は適切な境界で`parse`し、Resultの失敗を明示的に処理する。
- ユースケースが必要な集約はportから取得し、その判断を集約へ委譲する。
- Controllerや合成ルートへRepositoryの利用手順や業務判断を分散させない。
- 読むだけのユースケースも認める。照会のために書き込みを発生させない。

## ユースケース間の呼び出し

別のユースケースを呼んで業務手順を使い回さない。業務上の共通部分は、それを所有するドメイン型へ置く。複数ユースケースの起動を調整する責務は上位のController・合成ルートへ置く。

保存の最終化など、既存のapplication collaboratorが担当しているアプリケーション上の調整は、その責務を維持する。共通化のためだけにドメインサービスを新設しない。

関連: [Gateway](gateway-taxonomy.md)、[CQS](command-query-separation.md)。
適用範囲と優先関係は[共有規則の入口](README.md)を参照。
