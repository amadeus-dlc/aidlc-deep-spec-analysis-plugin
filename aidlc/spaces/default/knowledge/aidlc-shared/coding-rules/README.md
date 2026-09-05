# 共有コーディング規則 — deep-spec-analysis

amadeus-ngの`coding-rules`を、このTypeScriptプロジェクト向けに移植した共有ガイド。規則を種類ごとのファイルに分け、人間とエージェントが同じ入口から参照する。

## 採用範囲

- **CQSは採用する**（2026-09-05、ユーザー確認）。個々のメソッドの状態変更と照会を分ける。[CQSの規則](command-query-separation.md)を参照。
- **CQRSは採用しない**。コマンド側・クエリ側のモジュール分離、専用DAO、リードモデルの投影、RMU、1表1DAO、JOIN禁止など、CQRSを前提にした規則は取り込んでいない。
- 移植元のイベントストア必須、1コマンド1イベント、genesis／replay／applyの構築経路固定も、当該の保存方式を変更する規則としては取り込まない。ドメインイベントという概念そのものは、既存の種別規律に従って扱える。
- Rustの構文・借用規則・Cargoやclippyの実装状況は移植しない。TypeScriptの型、private constructor、`#field`、Result、bun workspaceと既存の検査へ対応づける。

## 既存の裁定との関係

ユーザーの明示指示と[projectの裁定](../../../memory/project.md)、[既存の設計規則](../../../../../../deep-spec-analysis/docs/architecture/design-rules.ja.md)に従って適用する。移植元の履歴や別プロジェクトの前提で、現在の裁定を上書きしない。矛盾を見つけたら、正本と根拠を確認して文書上で解消する。

特に次の裁定を維持する。

1. コンストラクタの具体的な型を保持し、TypeScriptが保証する型の実行時検査を追加しない。
2. `of`の例外はpanicとして伝播する。入力の失敗は各DPの`parse`を通してResultで処理する。復元も不変条件を迂回しない。
3. `kernel/infrastructure`はI/Oを持たない純粋な言語基盤。I/O実装はadapterに置く。
4. findingsの意味・正準順・公開文書の契約は、既存のドメインによる所有を維持する。
5. 公開契約の互換性と、不要な内部APIの互換口を残さない規則を区別する。

## 規則一覧

| ファイル | 主題 |
| --- | --- |
| [abstract-data-type.md](abstract-data-type.md) | 抽象データ型 — 表現ではなく操作と契約で定義する |
| [field-visibility.md](field-visibility.md) | フィールドはprivate — 判断を外へ流出させない |
| [module-visibility.md](module-visibility.md) | モジュールの公開面をファサードで制御する |
| [domain-equality.md](domain-equality.md) | ドメインの同値関係を型自身が定義する |
| [factory-naming.md](factory-naming.md) | 生成経路をコンストラクタへ集約する |
| [error-handling.md](error-handling.md) | 予期された失敗はResult、契約違反はpanic |
| [command-query-separation.md](command-query-separation.md) | CQS — 状態変更と照会を分ける |
| [interior-mutability.md](interior-mutability.md) | 可変性と所有権を隠さない |
| [gateway-taxonomy.md](gateway-taxonomy.md) | Gatewayの責務と命名 |
| [use-case-rules.md](use-case-rules.md) | ユースケース — 契約に依存し、業務判断はドメインへ委譲する |
| [infrastructure-layer.md](infrastructure-layer.md) | infrastructureは純粋な言語基盤 |
| [domain-persistence-neutrality.md](domain-persistence-neutrality.md) | ドメインを永続化の機構から独立させる |
| [aggregate-commands.md](aggregate-commands.md) | 集約のコマンドは整合性境界を守る |
| [aggregate-references.md](aggregate-references.md) | 整合性境界をまたぐ参照はIDで表す |
| [domain-object-kinds.md](domain-object-kinds.md) | ドメインオブジェクトの種類を明確にする |
| [domain-services.md](domain-services.md) | ドメインサービスは最後の手段 |
| [tell-dont-ask.md](tell-dont-ask.md) | Tell-Don't-Ask — 判断は状態の所有者へ |
| [ubiquitous-language.md](ubiquitous-language.md) | 名前はドメインの共通言語に合わせる |
| [upstream-contracts.md](upstream-contracts.md) | 借り物の契約を自分の都合で変更しない |
| [no-backward-compatibility.md](no-backward-compatibility.md) | 内部APIに不要な互換口を残さない |
| [good-examples.md](good-examples.md) | このリポジトリの実例 |

## 検査と運用

規則の自動検査は、実装があるものだけを自動化済みと扱う。型検査、[アーキテクチャテスト](../../../../../../deep-spec-analysis/tests/architecture.test.ts)、[実装された検査規則](../../../../../../deep-spec-analysis/tests/architecture/rules.ts)が現在の確認先である。移植元の`cargo lint`やその機械化ロードマップを、当該に実装済みと記載しない。

検査を追加する場合は、違反を検出する例と正当な例を用意する。広い命名規則などを機械化する前に、既存の利用箇所と正当な例外を調べる。未実装の検査はレビュー基準として区別する。

## 移植記録

- 移植日: 2026-09-05。
- 原本: [amadeus-ng / coding-rules](https://github.com/amadeus-dlc/amadeus-ng/blob/537c4e56a838a4cb28f6564d4c0add1d4adfe915/aidlc/spaces/default/knowledge/aidlc-shared/coding-rules/)。
- 原本のコミット: `537c4e56a838a4cb28f6564d4c0add1d4adfe915`。対象ディレクトリに未コミット差分がないことを確認して取り込んだ。
- 原本24ファイルのうち、READMEと21主題を同名の22ファイルとして移植した。原文の完全複製ではなく、採用範囲と言語・既存裁定を合わせた版である。各ファイルから原文へ辿れる。
- `cqrs-boundaries.md`は不採用のため除外した。
- `CONSISTENCY-AUDIT-2026-08-24.md`は移植元の実装・採用済みCQRS・過去の是正状況の監査であり、当該の規範や実測として取り込まない。
- 混在していたCQRS前提の節と参照は、Gateway・ユースケース・永続化中立性・集約参照・生成規則などから除いた。CQSは独立した規則として保持した。
- 出典や採用範囲を変更するときは、このREADMEと対象の規則を同時に更新する。
