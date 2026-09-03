# Project-Level Rules

> Project-specific specialisation and corrections. Loaded after `org.md` and
> `team.md` as strict-additive guidance; contradictions with broader policy
> are rejected. Populated by practices-discovery and the self-learning loop.
>
> Use sparingly: most teams don't need a project layer. Reach for it
> only when this specific project needs stable, durable guidance beyond the
> team practice (for example, package-specific release checks or an additional
> regression suite for a legacy component).

## Way of Working

<!-- Project-specific specialisation. Example: -->
<!-- This monorepo requires package-scoped branch names and a package owner -->
<!-- review in addition to the team's normal merge policy. -->

## Walking Skeleton

<!-- Project-specific specialisation. Example: -->
<!-- The walking skeleton must exercise the legacy service adapter as well -->
<!-- as the new service boundary. -->

## Testing Posture

<!-- Project-specific specialisation. -->

## Deployment

<!-- Project-specific specialisation. -->

## Code Style

<!-- Project-specific specialisation. -->

## Tech Stack

<!-- Technology choices locked for this project. -->

## Decided

<!-- Decisions made in earlier stages that should not be re-asked. -->
<!-- Format: DECIDED: [decision] (Stage [slug], [date]) -->

## Scope Overrides

<!-- Custom scope rules for this project. -->

## Forbidden

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: NEVER [behavior] (affirmed [date]) -->
<!-- Example: NEVER throw exceptions across service layer boundaries (affirmed 2026-05-17) -->

## Mandated

- **ドメインオブジェクトの種別規律（2026-09-02 オーナー裁定）**: domain 層に置くドメインオブジェクトは、エンティティ（ローカルエンティティ、または集約のルートエンティティ＝グローバルエンティティ）、値オブジェクト、配列やコレクションを隠すファーストクラスコレクション、ドメインイベント（ドメインで起きた出来事の不変の記録）のいずれかを基本とする。ドメインサービスを作るときは人間の裁定が必須。これ以外の種類のドメインオブジェクト（facts／materials／context／ledger／plan 型、随伴 static class、自由関数、例外型、generic record など）を実装したい場合は、必ず実測ありの問題と対策内容を添えて人間の裁定にかけ、裁定の後にだけ実装する。裁定の記録先は `deep-spec-analysis/docs/decisions.md`（および `.ja.md`）。
- **不変条件規律（2026-09-02 オーナー裁定）**: 整合性はエンティティ／値オブジェクトに不変条件として守らせる。検査手順をオブジェクトに包んだだけのドメインサービスは作らない。
- **識別規律（2026-09-02 オーナー裁定）**: コレクションからキーで検索される要素は識別が要るのでエンティティにする。値オブジェクトは識別できないものにだけ使う。
- **命名規律（2026-09-02 オーナー裁定）**: 「事実（facts）」という語はドメインイベント（成立した事態）以外に使わない。コンパイラの対応表や解釈材料は `*Plan` 等の実体に合う名にする。
- **ドメインエラー規律（2026-09-02 オーナー裁定）**: ドメインエラー型は domain 層のモデルだが、型とバリアントがユビキタス言語に対応づくこと。予期された失敗は例外で投げず `Result` の値で返す。
- **リードモデル規律（2026-09-02 オーナー裁定）**: CQRS のリードモデル（表示・照会のための投影）は domain 層に置かず usecase（クエリ側）に置く。
- **モデル委譲規律（2026-09-03 オーナー指示）**: Fable 5 のレートリミットを早期に使い切らないため、メインセッションは要件の明確化・設計・計画・監査・レビュー・最終的な統合判断に充てる。実装中は、見込まれる資源節約が調整コストを上回るときは常に、範囲の明確な実行タスクをサブエージェントへ委譲する。境界が明確な定型的実装は Sonnet に、強い推論を要する複雑または高リスクの実装は Opus に任せ、委譲が安全にも効率的にもできない例外的に難しい・密結合な作業だけ Fable 5 が直接行う。委譲のオーバーヘッドが見込まれる節約を上回る小さく範囲の明確なタスクはメインセッションに残す。委譲プロンプトは必ずスコープ・担当ファイル・受け入れ基準・検証手順を定め、書き込み範囲は重複させない。差分全体のレビュー、最終検証の確認、統合結果を受け入れるかの判断は Fable 5 のメインセッションが責任を持つ。

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: ALWAYS [behavior] (affirmed [date]) -->
<!-- Example: ALWAYS use Result<T,E> for fallible operations in service layer (affirmed 2026-05-17) -->

## Corrections

<!-- Project-specific corrections from human feedback. -->
<!-- Format: NEVER/ALWAYS [behavior] (learned [date]) -->
