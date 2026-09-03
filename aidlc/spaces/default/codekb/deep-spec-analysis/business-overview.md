# deep-spec-analysis — ビジネス概要

## Focused scan 更新（intent: `260903-installer-tag-update`）

本 intent は、プラグインの検証機能そのものではなく、利用者が checkout や `aidlc-workflows` submodule を持たずに導入・更新できる配布ライフサイクルを対象とする。現在の `scripts/install.ts` は実行中 checkout と sibling submodule の build／target data／plugin test に依存し、導入来歴を残さず、`--update` も提供しない。tag と release script もまだ存在しない。

目標の利用者体験は、tag（既定は最新 semver tag）または明示した local checkout／branch／tag から source を取得し、**導入先 harness のツールチェーン**で projection を build した後、既存の refresh → tombstone → no-clobber compose → doctor を再利用することにある。成功時には `<harness>/tools/data/deep-spec-analysis-install.json` に version・ref・source・installed_at・payload_sha256 を記録し、`--update` と doctor が更新可否を判断できるようにする。

この配布ライフサイクルは未実装の計画を含む。現行で確認できた事実、決定済みの目標、未確定の契約は次のように区別する。

| 区分 | 内容 |
|---|---|
| 現行 | `--project` 必須の installer、checkout 側 `aidlc-workflows/core/tools` への依存、既存 refresh／tombstone／compose、doctor の5ブロック、main push／PR の CI |
| 目標として確定 | `--from > --ref > --tag > latest` の解決順、導入先 builder の利用、provenance の原子的記録、same-version update の no-op、v0.5.0 以降の tag と manifest version の一致検査 |
| 未確定 | 競合 flag の扱い、`--from` の path shape、source 種別別 update policy、prerelease／pagination／timeout、payload hash の正準化、doctor の offline skip 表現、release の commit/tag transaction |

以下の既存本文は、形式検証プラグイン本体について前回 store が保持していた知識である。今回の focused scan ではその全域を再検証していないため、現行性は `reverse-engineering-timestamp.md` の `shallow.paths` に従って扱う。

- 対象リポジトリ: `deep-spec-analysis`（ワークスペースルート）。本 codekb が扱うのはルート直下の `deep-spec-analysis/`（AI-DLC プラグイン本体）
- プラグイン名／版: `deep-spec-analysis` v0.5.0（`.aidlc-plugin/plugin.json`、`core` に依存）
- 出典: developer link の handoff（`inception/reverse-engineering/developer-scan.md`）、`README.md`、`docs/decisions.ja.md`

## 目的とドメイン

AI-DLC のワークフローに「要件と設計の形式検証」を追加する neurosymbolic なプラグイン。LLM が `requirements.md` や各ユニットの functional-design 成果物をバックエンド中立の中間表現（IR）に形式化し、決定論的なソルバーバックエンド（z3 による SMT、Quint／Apalache）がその IR を機械検査して、矛盾・完全性の欠落・シナリオ違反を検出する。検出結果は人間に A/B/X の構造化質問として返り、採択された修正だけが成果物に反映される。コア（`aidlc-workflows`）は変更せず、プラグインを外せば素のワークフローに戻る（additive）。

ドメインの語彙は 4 つの契約（JSON Schema）で固定されている:

| 契約 | 内容 | スキーマ |
|---|---|---|
| 契約 1 | 要件 IR（schema／obligations（EARS）／scenarios／background、`sourceDigest` で要件本文に固定） | `tools/data/deep-spec-ir-schema.json` |
| 契約 2 | 正規化された findings（findings／`skipped[]` と理由／`unavailable`、正準ソートで byte 決定論） | `tools/data/deep-spec-findings-schema.json` |
| 契約 3 | 設計 IR（ユニットごとの entities・rules・状態機械。契約 1 へコンパイルダウン） | `tools/data/deep-spec-design-ir-schema.json` |
| 契約 4 | refinement map（要件 IR と設計 IR を結ぶ抽象関数。人間ゲート） | `tools/data/deep-spec-refinement-map-schema.json` |

## 利用者と利用文脈

- **直接の利用者**: AI-DLC のセンサーディスパッチャ（`.claude/tools/aidlc-sensor.ts fire`）。プラグインの 9 センサーは、対象成果物への書き込みまたはゲート境界で自動的に発火し、advisory な verdict を返す。人間が手で叩く CLI は doctor（`tools/deep-spec-analysis-doctor.ts`）だけ
- **間接の利用者**: プラグインが追加する 2 ステージのリードエージェント（`deep-spec-analysis-verify` は product-agent、`deep-spec-analysis-functional-verify` は architect-agent）と、contribution で refcheck センサーを注入されるコアステージ（`domain-design`・`contract-design`・`functional-design`）の担当者。findings は `[Answer]:` 質問として人間に提示される
- **配布先**: AI-DLC を導入したプロジェクトの `.claude/`（projection ビルド → `scripts/install.ts` による compose）。利用先では `bun .claude/tools/<entry>.ts` が相対 import だけで動く前提。ソルバー（`z3-solver`・`quint`・JDK）は利用先が任意で用意し、無ければ `unavailable` として明示的に縮退する
- **適用スコープ**: 追加ステージは `enterprise`・`feature` スコープで実行される（ステージ frontmatter の `scopes:`）

## 主要機能

| 機能 | 実体 | 何をするか |
|---|---|---|
| 要件 IR 検証 | センサー `deep-spec-ir-valid` | 契約 1 のスキーマ適合、`frRefs` の逆照合、`sourceDigest`（requirements.md の sha256）の再計算と drift 拒否 |
| 要件 SMT 検証 | センサー `deep-spec-verify-smt` | IR → SMT-LIB を TypeScript でコンパイルし、z3 を子プロセスで実行。矛盾（unsat core）、完全性の欠落（witness モデル）、シナリオ検査。`method: exhaustive` |
| 要件 Quint 検証 | センサー `deep-spec-verify-quint` | IR → Quint をコンパイルし `quint` CLI を実行。到達可能な不変条件違反（ステップトレース）、デッドロック、leads-to、シナリオ再検査。Apalache があれば `bounded`、無ければ seed 付き `simulation` |
| クロスチェック | 両バックエンドが書く `cross-check.json` | シナリオ判定をバックエンド間で比較し、不一致は「形式化／コンパイラの欠陥」として要件欠陥と区別する |
| 設計 IR 検証 | センサー `deep-spec-design-ir-valid` | 契約 3 のスキーマ適合、ユニットごとの意味的整合（id・参照・状態機械）、`brRefs` の逆照合、BR カバレッジ |
| 設計 SMT／Quint 検証 | センサー `deep-spec-design-verify-smt` / `-quint` | 各ユニットを契約 1 文書に lowering し、兄弟 entry（v1 バックエンド）を子プロセスで実行して設計語彙に写像。dead guard（`unreachable`）、shadowed rule（`redundancy`）、state × trigger の完全性、refinement map による要件性質の保存検査 |
| 参照・構造整合（refcheck） | センサー `deep-spec-refcheck-domain` / `-contract` / `-functional` | ソルバー不要・LLM 不要の静的検査。`components.md` の 7 規則、`contract-summary.md` のユニット／spec ブロック／依存辺、ユニットの functional-design（entities・BR・状態機械・drift）。`method: static` |
| doctor | `tools/deep-spec-analysis-doctor.ts` | インストール manifest、ソルバー可用性（z3-solver・node・quint・Apalache。8822 に listen 中のサーバがあれば trivial spec を verify して陳腐化を検出）、要件検証カバレッジ、構造負債、設計カバレッジを `{"checks":[...]}` で返す |

## 価値と設計上の約束

- **決定論**: 同じ IR と同じ環境からは byte 同一の findings（固定 seed、正準ソート、タイムスタンプ無し）。golden はテストで byte 凍結され、ソルバーの版は exact pin（技術的背景は `technology-stack.md`）
- **沈黙しない縮退**: ソルバー不在・タイムアウト・コンパイル不能は `unavailable`／`skipped[]` として必ずレポートに現れ、ワークフローを止めない（`default_severity: advisory`）
- **上流凍結**: 設計検証は要件を触らない。採択された修正は成果物を所有するステージ自身が適用し、再検証する
- **外部仕様の不変**: IR・レポート JSON・doctor 出力の項目と文言は LLM と人間が読む文書であり、内部リファクタリングで変えない（`docs/decisions.ja.md` の裁定）

## 関連成果物

- 構造とデータフロー: `architecture.md`
- 外部面（CLI・スキーマ・環境変数）: `api-documentation.md`
- 物理構成と規則: `code-structure.md`、`component-inventory.md`
- 品質と本 intent のリスク: `code-quality-assessment.md`
