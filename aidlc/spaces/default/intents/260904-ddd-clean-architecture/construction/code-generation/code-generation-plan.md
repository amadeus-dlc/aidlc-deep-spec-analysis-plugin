# Code Generation Plan — DDD／クリーンアーキテクチャ改善

対象スコープ `refactor`、Depth `Minimal`、Test Strategy `Minimal`、ゼロ Unit のステージ実行。成果物ディレクトリは `aidlc/spaces/default/intents/260904-ddd-clean-architecture/construction/code-generation/`、アプリケーションコードはワークスペース直下（`deep-spec-analysis/` と `aidlc-workflows/`、および導入コピーの `.codex/tools/`）へ書きます。

上流は [`requirements.md`](../../inception/requirements-analysis/requirements.md) の FR1〜FR8／NFR1〜NFR5、[`functional-spec.md`](../functional-design/functional-spec.md) の Workflow 1〜6、[`rules.md`](../functional-design/rules.md) の BR1.1〜BR8.4、[`entities.md`](../functional-design/entities.md) の分類表です。

## Confirmed Answers

このステージの [`code-generation-questions.md`](./code-generation-questions.md) で確定した 3 点を、以下の全ステップの前提に置きます。

- **Q1 = A**: 作業ツリーに既にあるゼロ Unit 修正（`aidlc-lib.ts` の `summaryQuestionFiles`、`aidlc-sensor-traceability.ts` のステージレベル解決、t281／t320 の回帰試験、7 harness の配布物、`.codex/tools/` の同期）を土台として採用し、判定条件の拡張・回帰試験の追加・リリース情報の更新だけを積み増す。
- **Q2 = A**: 共有判定 `usesStageLevelPerUnitArtifacts` を「Units Generation が `EXECUTE` でない、**または** 解決 Unit 集合が `none`」へ拡張し、`aidlc-workflows/core/` 配下 18 箇所すべてに同じ意味を及ぼす。
- **Q3 = C**: 既存 golden fixture の被覆範囲を先に洗い出し、覆われていない経路（cross-check 再構築の失敗系、同一ディレクトリの並行 writer）にだけ比較試験を足す。

## Measured Baseline of the Current Tree

計画の根拠として実測した現状です。ステップの見積りはこの数値に基づきます。

| 対象 | 実測 |
|---|---|
| `src/refinement/domain/` | `.ts` 37 ファイル（`index.ts` 含む）、2,114 行、公開クラス 36 |
| `@deep-spec/refinement-domain` を import する TS | 19 ファイル（production 15、tests 4） |
| 同を宣言する package.json | 3 件（`design/usecase`、`design/adapter`、`tests`）＋自身 |
| `src/design/domain/` | 既存 85 ファイル。移設時の名前衝突は `index.ts` のみ |
| `verify-design-smt-usecase.ts` | 252 行 |
| `verify-design-quint-usecase.ts` | 341 行 |
| 逐語同一の重複ブロック | `#persist`（3 行）、`#recomputeCrossCheck`（8 行）、Phase 3 materials 取得＋`skipAll`、`acq.match` の stale-input 2 判定、`unitMap` 欠落の absent-input skip |
| `design-report-repository-impl.ts` | 85 行。`conformedOf` が毎回 schema を読み、`store` が `conformedOf` を再呼出（**二重観測**）。`writeFileSync` 直書きで atomic write 未使用 |
| 兄弟が読めないときの沈黙 | `verify-design-smt-usecase.ts:246-247` と `verify-design-quint-usecase.ts:335-336` に逐語同一の `if (!siblings.ok) return ok(undefined);` |
| 個別 sibling の沈黙 | `design-report-repository-impl.ts:63-65` の `catch {}` |
| directory lock | `src/` 全体に存在しない（0 件） |
| `VerificationMethod` | `kernel/domain/verification-method.ts` 23 行。`reconstitute` のみ。閉集合検査なし |
| `FindingKind` | `kernel/domain/finding-kind.ts` 68 行。`parse`（Result）＋`reconstitute`。**`parse` は production 未使用**（呼出は `tests/kind-rank.test.ts` のみ） |
| skip reason | 素の `string`（`design/domain/design-skipped.ts` 50 行）。`SkipReason` 型は存在しない |
| 契約2 の 9 値 | `src/entries/data/deep-spec-findings-schema.json:221-234` の JSON Schema `enum` のみ。TS 側に列挙なし |
| `lowered-unit.ts` | 384 行。`buildLowering` は 224-384（161 行）の**モジュールスコープ自由関数**、`LoweredUnit.of` からのみ呼ばれる |
| `remapVerdicts` | public 89-100（12 行）＋ private `#remapReadable` 103-221（119 行） |
| `design-unit.ts` / `sibling-verdict-document.ts` / `lowering-index.ts` | 127 / 57 / 94 行 |
| 呼出点 | `LoweredUnit.of` 本番 3・テスト 6、`remapVerdicts` 本番 3・テスト 8、`extendedWith` 本番 1 |
| `tests/architecture/rules.ts` | 883 行。`SANCTIONED_CROSS_CONTEXT`（745-752）は 4 辺すべて refinement 関連 |
| `docs/decisions.md` / `.ja.md` | 2,499 行／2,185 行、H2 とも 46 |
| `usesStageLevelPerUnitArtifacts` | `aidlc-lib.ts:21933-21938`。`effectivePlanAction("units-generation") !== "EXECUTE"` のみ。呼出 18 箇所 |
| `resolveBoltDag` | 依存成果物が無ければ `{ state: "none" }`。`parseBoltDag` が空 `units:` を `malformed` で弾くため `{ ok, units: [] }` は到達不能 |
| `aidlc-version.ts` | `2.7.1`。README バッジ・CHANGELOG 先頭と一致。`t68-version-changelog-sync.test.ts` が 3 点整合を強制 |

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "project",
  "ordering": "Implement each testable layer, then write and run that layer's tests.",
  "scope": "refactor",
  "test_strategy": "minimal",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "project",
      "text": "- Testing Contract の plan_profile の層は実体に合わせて読み替える。DB と UI を持たないプロジェクトではその 2 層を落とし、Repository/data access を「層境界の解決経路」、Business logic を「境界を判定するアーキテクチャ規則」、API/endpoint を「出荷物の公開面」に対応づける。methodology（test-after）は変えない (learned 2026-09-03) \n- 生成物 tools/** をカバレッジ除外に足す必要はない。bun test --coverage の実測で tools/ は計測に一切現れない（すべて子プロセス実行で in-process 計測に乗らない） (learned 2026-09-03)"
    }
  ],
  "obligations": {
    "strategy": "minimal",
    "strategy_volume": [
      "One verifiable test per requirement at the narrowest effective level.",
      "At least one happy-path unit test per component.",
      "Unit tests are the default; a bugfix/security scope floor may require an integration or E2E regression when that is the narrowest level that reproduces the defect."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:dc36a3ab0df5f07972cf637be1aaee9102f6724c3a7fe48ba05746f3b9888324",
  "contract_sha256": "sha256:9a990b1d456fe58d5186e1aa388373140503e3295b9206868f1243dbb888739c"
}
```

### 契約の層をこのプロジェクトへ読み替える

`project.md` の Testing Posture の指示に従い、`plan_profile.testable_layers` を実体へ対応づけます。methodology（`test-after`）と ordering は変えません。

| 契約の層 | このプロジェクトでの実体 | 該当ステップ |
|---|---|---|
| Data model / database behavior | `kernel/domain` のドメインプリミティブと `design/domain` のエンティティ・値オブジェクト | 3〜7、8〜14、15〜19 |
| Repository / data access | `design/adapter` の永続化と directory lock（実ファイルシステム） | 20〜25 |
| Business logic | `design/usecase` の finalization／acquisition と、ゼロ Unit 判定の境界規則 | 26〜29、30〜31 |
| API / endpoint | 出荷物の公開面（findings JSON、stdout verdict、golden、7 harness の配布物） | 32〜34 |
| Frontend behavior | **該当なし**。UI を持たないため落とす | — |

ordering は各層で「実装 → その層のテストを書いて走らせる」です。テストランナーの確認（Step 2）は最初のテストステップより前に置いています。

## Test Volume

Minimal 戦略の要求は「要件ごとに 1 件の検証可能なテスト＋コンポーネントごとの happy-path 下限」で、`refactor` スコープは新規テストの追加下限を課さず、既存スイートを green に保つことを要求します。加えて NFR3 が 8 つの再現シナリオを名指ししており、これは戦略と加算関係にあるため落とせません。

新規テストの内訳（合計 17 件）:

| # | 対象 | 上流 |
|---|---|---|
| 1 | strict creation が未知 method を `Result` error にする | FR3.1／FR3.2、BR3.1 |
| 2 | strict creation が未知 skip reason を `Result` error にする | FR3.1／FR3.2、BR3.1 |
| 3 | tolerant hydration が未知値を逐語保持し降格する | FR3.3／FR3.4、BR3.2 |
| 4 | 旧 refinement package への import と依存宣言が 0 件 | FR4.2、BR4.2 |
| 5 | 旧横断 4 辺を拒否する architecture red example | FR7.2、BR7.3 |
| 6 | schema は合成ルートで 1 回だけ読まれ、同じ `FindingsSchema` で candidate と cross-check が適合される | FR1.2、BR1.1 |
| 7 | cross-check 読込失敗が `verified` にならない | FR1.3／FR1.4、BR1.2 |
| 8 | backend 保存失敗が `verified` にならない | FR1.3、BR1.2 |
| 9 | live lock 保持時に待機せず失敗する | FR2.5、BR2.1／BR2.6 |
| 10 | lease 期限切れ＋所有者不在で回復し、PID が live なら奪取しない | FR2.5、BR2.6 |
| 11 | publish 直前の token fencing と異ディレクトリ非干渉 | FR2.5、BR2.6 |
| 12 | 各 JSON が temp＋rename で公開され途中 bytes を見せない | FR2.1、BR2.3 |
| 13 | 古い cross-check が最新結果として採用されない。load 後に兄弟が変わっていれば `store` は失敗する | FR2.3、BR2.2／BR2.4／BR2.5 |
| 14 | 共通 finalization 1 か所の変更が SMT／Quint 両方へ効く | FR5.1、BR5.1 |
| 15 | lowering／remap の生成物が移管前と byte 同一 | FR6.1／FR6.2、BR6.1〜BR6.3 |
| 16 | Units Generation 実行済みかつ Unit 0 件でステージレベルへ解決する | FR8.1／FR8.2、BR8.1〜BR8.3 |
| 17 | 変更した production ファイルが 1,000 行未満 | NFR5、BR7.6 |

既存の t281／t320 に入っている `SKIP` ケースと per-Unit 非退行は維持し、#16 はそのマトリクスへ 1 行足す形にします。

## Implementation Steps

依存順に 7 波へ分けます。波の内側は 1 サブエージェントへまとめて委譲し、波をまたぐ書き込み範囲は重複させません。各ステップは完了時にこのファイルのチェックボックスを更新します。

### Wave 0 — 基線とランナー（契約 steps 1-2）

- [x] **Step 1**: 変更前基線を記録する。`deep-spec-analysis` で `bunx tsc --noEmit` と `bun test --coverage`、`aidlc-workflows` で `bun run typecheck`・`bash tests/run-tests.sh`・`bun scripts/package.ts --check` を走らせ、件数とカバレッジを `code-summary.md` の基線節に控える。（NFR3）
- [x] **Step 2**: テストランナーと設定を確認し、このステージのスコープ付き実行コマンドを [`unit-test-instructions.md`](./unit-test-instructions.md) へ確定記録する。あわせて既存 golden fixture（`tests/fixtures/{conformance,design}/expected/`）の被覆範囲を洗い出し、覆われていない経路の一覧を作る。（Q3 = C の前半、NFR1）

### Wave 1 — ドメインプリミティブの strict/tolerant 分離（Data model 層、FR3）

- [x] **Step 3**: `kernel/domain/verification-method.ts` に閉集合 4 値を検査する `static parse(raw): Result<VerificationMethod, DomainError>` を足す。`reconstitute` は逐語のまま残す。（FR3.1、BR3.1）
- [x] **Step 4**: `kernel/domain/skip-reason.ts` を新設し、契約2 の 9 値を持つ共有ドメインプリミティブにする。`parse` は検証済み値のみ、`reconstitute` は逐語、`compareTo` は現在の文字列比較と同順を返す。（FR3.1、BR3.1）
- [x] **Step 5**: production の正常生成経路を `FindingKind.parse` へ寄せ、`reconstitute` は adapter の文書 hydration に限定する。未知 kind の順位 99 と降格挙動は変えない。（FR3.2／FR3.4、BR3.1／BR3.2）
- [x] **Step 6**: `design/domain/design-skipped.ts` の `reason: string` を `SkipReason` へ差し替え、`reason()` の出力文字列と `compareTo` の並びを維持する。呼出側（usecase 9 箇所＋13 箇所、`lowered-unit.ts` 5 箇所ほか）を検証済み生成へ更新する。（FR3.2、NFR1）
- [x] **Step 7**: この層のテストを書いて走らせる（新規 #1〜#3）。既存の `tests/kind-rank.test.ts` は green のまま。

### Wave 2 — Refinement の Design 統合（Data model 層の続き、FR4）

- [x] **Step 8**: `src/refinement/domain/` の `index.ts` を除く 36 ファイルを `src/design/domain/` 直下へ移す。`design/domain/refinement/` のような例外階層は作らない。（FR4.1／FR4.5、BR4.1）
- [x] **Step 9**: `design/domain/index.ts` に 36 の公開 symbol を明示追加する。旧 `refinement/domain/index.ts` にあった `requirements-domain` からの pass-through 2 行（`FormalModelId` と `AttributeBound` ほか 4 種）も統合する。`export *` は使わない。（BR4.1）
- [x] **Step 10**: 19 ファイルの import を `@deep-spec/design-domain` または同一 package 内 relative へ変更する。（FR4.2）
- [x] **Step 11**: 依存 manifest 3 件から `@deep-spec/refinement-domain` を除去し、`design/domain/package.json` に `@deep-spec/requirements-domain` を足す。ルート `package.json` の workspaces は `src/*/*` の glob なので変更不要。（FR4.2）
- [x] **Step 12**: `src/refinement/` を削除する。互換 shim は作らない。（FR4.2、BR4.2）
- [x] **Step 13**: `tests/architecture/rules.ts` の `SANCTIONED_CROSS_CONTEXT` から旧 4 辺を削除し、`design/domain -> requirements/domain` の 1 辺だけを明示する。旧 refinement package import を拒否する red example を `architecture.test.ts` に足し、既存判定は 1 つも外さない。（FR7.2／FR7.3、BR7.3）
- [x] **Step 14**: この層のテストを走らせる（新規 #4〜#5）。`architecture.test.ts`・`package-boundaries.test.ts`・refinement golden が green で、findings／skips／cross-check が byte 同一であることを確認する。（FR4.4、NFR1）

### Wave 3 — lowering と verdict の責務分離（Data model 層の続き、FR6）

- [x] **Step 15**: `buildLowering`（`lowered-unit.ts:224-384` の自由関数 161 行）の採番・候補生成・machine／scenario／background lowering を `DesignUnit` と既存宣言オブジェクトの振る舞いへ移す。`DesignUnit` が lowered collections と `LoweringIndex` を組成し、`LoweredUnit` の検証済み生成口へ渡す。（FR6.2、BR6.2）
- [x] **Step 16**: `#remapReadable`（119 行）の document variant 分岐・synthetic finding・waiver・dedupe を `SiblingVerdictDocument` へ移す。`LoweringIndex` と `DesignUnit` の識別・名前を使い、`DesignFinding`／`DesignSkipped` を byte 同一で返す。（FR6.2、BR6.3）
- [x] **Step 17**: `LoweredUnit` を collections・index・`extendedWith` の一貫した再構成だけに絞る。getter で取り出した値を外側で判定する構造にしない。（FR6.1、BR6.1）
- [x] **Step 18**: 本番 6 呼出点（`verify-design-smt-usecase.ts:109/135`、`verify-design-quint-usecase.ts:111/136/246/264`）とテスト 14 呼出点（すべて `tests/design-pipeline.test.ts`）を新しい所有 API へ更新する。新しいドメインサービス・自由関数・pass-through wrapper は作らない。（FR6.3、BR6.4）
- [x] **Step 19**: この層のテストを走らせる（新規 #15）。既存 lowering／remap fixtures が byte 同一で通ることを確認する。

### Wave 4 — 集約の再設計と Repository の語彙（Data model ＋ Repository 層、FR1／FR2）

> **オーナー裁定（2026-09-04、この計画の初回承認後）**: Repository の語彙は保存・検索・取得・削除だけで、Repository の interface はこの語彙にしか依存できない。他の語彙が欲しければ集約の設計を見直す。集約は一塊であり、可変部は `employeeAggregate.deptIdOpt: Option<DeptId>` のように集約自身が持つ——Repository のメソッド変種で吸収しない。この裁定により、初回承認版の `conformedOf`・`storeConformed(report, model)`・`storeConformedWithoutCrossCheck` は**すべて撤去**し、以下へ置き換える。functional-spec の Decisions 表「Schema conformance owner: Repository の `conformedOf` を維持」は本裁定で覆る（Step 35 で記録する）。

- [x] **Step 20**: `design/domain` に集約ルート `DesignVerifyDirectory` を新設する。識別は verify directory（`ArtifactPath`）。メンバは backend ごとの `DesignReport`（既存 FCC `DesignReports`。backend 名で検索されるので要素はエンティティ）、この実行が置く `candidate`、および **`crossCheck: DesignReport | null`**（導けないときは不在——可変部は集約が持つ）。振る舞いは `finalizing(report)`（同じ backend の旧 report を置換し、ファイル名順を保つ。adapter の `withCandidate` をここへ移す）、`crossChecked(model, irHash)`（既存 `DesignReports.crossChecked` で導く）、`withoutCrossCheck()`（IR unreadable 用）、`conformedTo(schema)`（candidate と cross-check の両方を適合させる）。不変条件は「backend ごとに 1 report」「cross-check は不在か、現在の reports から導いたもの」。新しいドメインサービス・自由関数は作らない。（FR1.1／FR2.3、BR1.1／BR2.4）
- [x] **Step 21**: `kernel/domain` に値オブジェクト `FindingsSchema` を新設し、契約2 の JSON Schema を包んで `violationsOf(document)` を持たせる。読めなかった schema は `FindingsSchema.unreadable(cause)` の変種で表し、すべての文書を「`findings schema unreadable: <cause>`」で降格させる。`kernel/adapter/schema.ts` の純粋な `validateSchema` を `FindingsSchema` の private な検査へ移し、adapter の既存呼出（ir-valid 系）は新しい所在へ向け直す（互換 shim は作らない）。`DesignReport` に `toDocument()`（serializer の `orderedDocument` を逐語で domain へ移す。正準順は契約2 の知識で domain の所有）と `conformedTo(schema)`（違反があれば既存の凍結文言 `self-validation against deep-spec-findings-schema.json failed: <first error>` で `degraded`）を足す。serializer の `renderDesignReportBytes` は `toDocument()` を `JSON.stringify(…, null, 2) + "\n"` するだけにし、byte を変えない。（FR1.2、BR1.1、NFR1）
- [x] **Step 22**: `design/usecase/port/design-report-repository.ts` を集約 `DesignVerifyDirectory` の Repository に改める。メソッドは **`findByDirectory(directory): Result<DesignVerifyDirectory, RepositoryError>` と `store(aggregate: DesignVerifyDirectory): Result<void, RepositoryError>` の 2 つだけ**。`conformedOf`・`storeConformed`・`storeConformedWithoutCrossCheck`・`store(report)`・`findAllByDirectory`・`findById` を撤去する（`findById` は usecase から未使用と実測済み。fixture seed が使う経路は test double か `store(aggregate)` へ寄せる）。schema path は Repository のコンストラクタから外す。（オーナー裁定、FR1.1）
- [x] **Step 23**: adapter の `store(aggregate)` に Workflow 1 の 5〜15 を**実装詳細として**閉じ込める。lock 取得 → candidate 以外の兄弟が load 時から変わっていないことを disk と突き合わせて検査（変わっていれば typed failure `io-failed` の cause `conflict: …` で返し、stale な cross-check を公開しない）→ candidate と cross-check（あれば）を render → 既存 `cross-check.json` を非公開 stale 名へ先行退避 → `writeFileAtomically` で candidate 公開 → cross-check があれば同じく公開、無ければ欠落のまま → `finally` で cleanup。各公開の直前に token 一致を検査する。`DirectoryFinalizationLock` は実装済みのものをそのまま使う。非公開 temp／stale は `*.json` にせず兄弟列挙へ混ぜない。（FR2.1／FR2.2／FR2.3／FR2.5、BR2.1〜BR2.6、NFR4）
- [x] **Step 24**: `findByDirectory` は壊れた兄弟 `*.json` を黙って除かず typed failure で返す（実装済みの挙動を集約 load に引き継ぐ）。lock 取得・競合・stale 回復・回復失敗・load 後の兄弟変更は区別可能な内部結果として持ち、外部向け文言は変えない。（FR2.6、BR2.7）
- [x] **Step 25**: この層のテストを集約と新 port に合わせて書き直して走らせる（新規 #6〜#13、#6 は「schema は合成ルートで 1 回だけ読まれ、`conformedTo` が同じ `FindingsSchema` で candidate と cross-check を適合させる」の主張に改める。#13 に「load 後に兄弟が変わっていたら store が失敗し stale な cross-check を公開しない」を足す）。Failure Matrix の 9 行を fault injection で再現し、Q3 = C で洗い出した golden 未被覆経路をここで埋める。

### Wave 5 — usecase の共通化（Business logic 層、FR1／FR5）

- [x] **Step 26**: `design/usecase` の `DesignReportFinalizer` を集約に合わせて書き直す。`findByDirectory` → `finalizing(report)` → `crossChecked(model, irHash)` または `withoutCrossCheck()` → `conformedTo(schema)` → `store(aggregate)` の順で 1 か所に持ち、`store` の成功後にだけ、**保存したのと同じ集約**の candidate から pass／findings count／skipped count を導いて `verified` を返す。`FindingsSchema` は合成ルート（entry）が `readContractSchema` で 1 回だけ読んで usecase へ注入し、Repository には渡さない。（FR1.1／FR1.2／FR1.3、BR1.1／BR1.2）
- [x] **Step 27**: `design/usecase` の `DesignVerificationAcquirer` は形を保つ（入力は `modelId`・呼出側生成の `DesignReportId`・strict 生成済み初期 `VerificationMethod` の 3 つのみ。返却は `DesignAcquisitionResult`。compile-time の `never` 検査）。IR unreadable の保存は Finalizer の `withoutCrossCheck()` 経路を使い、Repository のメソッド変種には依存しない。（FR5.1、BR5.1）
- [x] **Step 28**: SMT／Quint usecase と entry 2 本を新しい Finalizer と schema 注入へ追随させる。`#persist`・`#recomputeCrossCheck`・「兄弟が読めなければ黙って成功」分岐の廃止は実装済みなので維持する。solver query・probe・budget・refinement extras は各 usecase に残し、generic backend strategy や巨大 template pipeline は導入しない。（FR1.4／FR5.2／FR5.3、BR1.2／BR5.2）
- [x] **Step 29**: この層のテストを書き直して走らせる（新規 #14）。backend 固有の timeout・probe・solver 判定が従来どおり動くことを既存テストで確認する。

> **同じ裁定が及ぶ範囲（承認時に決める）**: `requirements` の `VerificationReportRepository` と `refcheck` の `ReferenceCheckReportRepository` にも同じ `conformedOf` があり、usecase 7 箇所が verdict をそこから導いている。要件の Out of Scope は「requirements／refcheck report repository 全体の横断再設計」を除外しているが、本裁定は Repository 一般の語彙についてのものなので、(a) この intent で同じ形（集約の `conformedTo(schema)` ＋ `store` のみ）へ揃える、(b) 逸脱として記録し後続 intent へ送る、のどちらかをこの Plan Approval で決める。

### Wave 6 — ゼロ Unit 経路と配布（Business logic ＋公開面、FR8）

- [x] **Step 30**: `aidlc-workflows/core/tools/aidlc-lib.ts` の `usesStageLevelPerUnitArtifacts` を「`effectivePlanAction("units-generation") !== "EXECUTE"`、または `resolveBoltDag` が `state: "none"`」へ拡張する。`projectDir` を任意引数で受け、渡されない既存呼出は現行の意味のまま動く。`malformed` は従来どおり誤りとして表面化させ、ゼロ件扱いしない。18 呼出点すべてに `projectDir` を渡す。（FR8.1／FR8.2、BR8.1〜BR8.3）
- [x] **Step 31**: `tests/unit/t281-sensor-traceability.test.ts` と `t320-review-confirmation-deadlock.test.ts` に「Units Generation が `EXECUTE` かつ解決 Unit 集合が `none`」のケースを足し、既存の `SKIP` ケースと per-Unit 非退行を維持したマトリクスにする。（FR8.4、BR8.2／BR8.3）
- [x] **Step 32**: `bun scripts/package.ts` で 7 harness の配布物を再生成し、ワークスペース直下の `.codex/tools/aidlc-lib.ts` と `aidlc-sensor-traceability.ts` を `dist/codex/.codex/tools/` と一致させる。（FR8.3、BR8.4）
- [x] **Step 33**: `core/tools/aidlc-version.ts` を `2.7.1` から `2.7.2` へ上げ、README のバージョンバッジを同じ値にし、`CHANGELOG.md` へ `## [2.7.2] - 2026-09-04` の見出しとゼロ Unit 修正の箇条書きを足す。`AGENTS.md` の Changelog Policy はバグ修正を patch として累積させるため、minor cut は行わない。（FR8.5、BR8.4）
- [x] **Step 34**: この層のテストを走らせる（新規 #16）。`bun scripts/package.ts --check`・`bun run typecheck`・`bun run lint`・`bash tests/run-tests.sh` を通し、`t68-version-changelog-sync.test.ts` が green であることを確認する。

### Wave 7 — 記録・構造ゲート・最終検証（契約 steps 13-14、FR7／NFR5）

- [x] **Step 35**: `deep-spec-analysis/docs/decisions.md` と `docs/decisions.ja.md` へ、Refinement の Design 統合・strict creation と tolerant hydration の分離・report finalization と directory lock の 3 裁定を、判断／代替案／帰結が一致する形で同じ変更に足す。H2 数は両者で一致させる。（FR7.1、BR7.2）
- [x] **Step 36**: 変更した production ファイルが 1,000 行未満であることの機械検査を architecture テストへ足す。（NFR5、BR7.6、新規 #17）
- [x] **Step 37**: 全体検証を通す。`deep-spec-analysis` で `bunx tsc --noEmit`・`bun test --coverage`（domain 層 90% 床）・`bun scripts/build-tools.ts --check`・`bun ../aidlc-workflows/core/tools/aidlc-plugin-validate.ts .`・7 harness の projection ビルド。`aidlc-workflows` で `bun run check` と `bash tests/run-tests.sh`。閾値は 1 つも緩めない。（NFR3）
- [x] **Step 38**: [`code-summary.md`](./code-summary.md)、`source-manifest.json`、[`traceability.json`](./traceability.json) を書く。source-manifest には shell・生成器が書いたものを含め、変更・追加・削除したすべてのアプリケーションソースパスを列挙する。

## Delegation

`project.md` のモデル委譲規律に従い、波ごとにサブエージェントへ委譲します。波の内側は 1 エージェントが担当し、書き込み範囲は波をまたいで重複させません。

| 波 | 担当 | 根拠 |
|---|---|---|
| Wave 0 | メインセッション | 小さく範囲が明確。委譲のオーバーヘッドが節約を上回る |
| Wave 1 | Sonnet | 境界が明確な定型実装（DP 追加と呼出側の置換） |
| Wave 2 | Sonnet | 機械的な移設・import 置換・manifest 更新。衝突は `index.ts` のみと実測済み |
| Wave 3 | Opus | 161 行と 119 行の責務移管。byte 同一を保ちながら所有者を変える強い推論が要る |
| Wave 4 | Opus | lock プロトコルと失敗行列。高リスク |
| Wave 5 | Opus | 閉じた結果型と失敗伝播の再編。Wave 4 と密結合 |
| Wave 6 | Sonnet | 判定 1 箇所の拡張と呼出点の機械的更新、生成とリリース情報 |
| Wave 7 | メインセッション | 裁定記録と最終検証の判断 |

差分全体のレビュー、最終検証の確認、統合結果を受け入れるかの判断はメインセッションが持ちます。

## Quality Targets

以下は入力であって提案ではありません。ステップを通すために緩めたり無効化したりしません。

- 契約1〜4、findings JSON、stdout verdict、公開ファイル名、文言、正準順、golden bytes、solver pin は変更前と同一。（NFR1、BR7.1）
- 失敗・timeout・読込不能・並行競合を clean や verified として扱わない。（NFR2、BR1.2）
- `deep-spec-analysis` の domain 層カバレッジ 90% 床（`bunfig.toml` の `coverageThreshold`）。Refinement の 36 ファイルは統合後も計測対象に残るため、床を下回らないこと。
- 変更後の production ファイルは 1,000 行未満。（NFR5、BR7.6）
- 既存の architecture 判定を 1 つも削除しない。（FR7.3、BR7.3）
- 未信頼 JSON／Markdown は adapter 境界で検証し、report 関連 path は `DesignReportId` と固定 basename からのみ導出する。（NFR4、BR7.5）

## Traceability

各要件を実装ステップへ対応づけます。

| 上流 | 実装ステップ | テスト |
|---|---|---|
| FR1.1 | 20, 22, 26 | #6 |
| FR1.2 | 21, 26 | #6 |
| FR1.3 | 26, 28 | #7, #8 |
| FR1.4 | 28 | #7 |
| FR2.1 | 23 | #12 |
| FR2.2 | 22, 23 | #9 |
| FR2.3 | 23 | #13 |
| FR2.4 | 23 | #12 |
| FR2.5 | 22 | #9, #10, #11 |
| FR2.6 | 24 | #9, #10 |
| FR3.1 | 3, 4 | #1, #2 |
| FR3.2 | 5, 6 | #1, #2 |
| FR3.3 | 5 | #3 |
| FR3.4 | 5 | #3 |
| FR4.1 | 8 | #4 |
| FR4.2 | 10, 11, 12 | #4 |
| FR4.3 | 11 | #4 |
| FR4.4 | 8, 9 | #15 |
| FR4.5 | 8, 9 | #4 |
| FR5.1 | 26, 27 | #14 |
| FR5.2 | 28 | 既存 backend 固有テスト |
| FR5.3 | 28 | 既存 backend 固有テスト |
| FR6.1 | 17 | #15 |
| FR6.2 | 15, 16 | #15 |
| FR6.3 | 18 | #15 |
| FR7.1 | 35 | 目視の対訳一致 |
| FR7.2 | 13 | #5 |
| FR7.3 | 13, 36 | #5, #17 |
| FR8.1 | 30 | #16 |
| FR8.2 | 30 | #16 |
| FR8.3 | 32 | Step 34 の drift check |
| FR8.4 | 31 | #16 |
| FR8.5 | 33 | `t68-version-changelog-sync.test.ts` |
| NFR1 | 2, 14, 19 | #15 と既存 golden |
| NFR2 | 23, 24, 28 | #7〜#13 |
| NFR3 | 1, 37 | 全 17 件 |
| NFR4 | 23, 24 | #12, #13 |
| NFR5 | 17, 36 | #17 |

承認は [`code-generation-questions.md`](./code-generation-questions.md) の Plan Approval で受けます。

## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Iteration:** 1

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | `aidlc/spaces/default/intents/260904-ddd-clean-architecture/construction/code-generation/code-generation-plan.md` > Step 30 | 実装は `code-summary.md`（Wave 6 節）で説明されるとおり、Step 30 の文面（`effectivePlanAction !== "EXECUTE"` または `resolveBoltDag` が `state: "none"`）より広い判定（`stageSlug` 引数と `discoveredStageUnits`／`observedBoltUnits` の 3 経路の union）へ実測に基づき締め直されている。理由は `code-summary.md` の Deviations と Wave 6 節に正直に記録されており、`aidlc-workflows/core/tools/aidlc-lib.ts` の実装（`usesStageLevelPerUnitArtifacts(scope, state, projectDir?, stageSlug?)`）と符合することを実測で確認したが、計画本文の Step 30 自体は当初の狭い文面のまま更新されていない。 | 次回以降、計画とその後の実装差分に乖離が生じた場合は、`code-summary.md` の参照だけでなく計画本文（またはその節への注記）も実装確定後の姿に合わせて更新する。 | New |
| R-02 | Minor | `deep-spec-analysis/src/design/domain/design-verify-directory.ts`、`deep-spec-analysis/src/design/adapter/design-verify-directory-repository-impl.ts` | `aidlc-sensor.ts fire linter` はこの 2 ファイルに対して `tool-unavailable`（lint バイナリが PATH に無い）を返し、advisory 扱いで `passed` になった。`type-check` センサーは両ファイルとも green。lint 自体の実走はこのレビュー環境では確認できていない。 | Build and Test またはこのレビューを実行する環境で `bun run lint`（`deep-spec-analysis` 側の実 lint コマンド）が green であることを別途確認する。 | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `aidlc-sensor.ts fire required-sections`（`code-generation-plan.md`／`code-summary.md`／`unit-test-instructions.md`） | 3 件とも `passed` | H2 2 つ以上の床を満たす |
| `aidlc-sensor.ts fire traceability`（`traceability.json`） | `passed` | gap／orphan／invalid target なし |
| `aidlc-sensor.ts fire type-check`（`design-verify-directory.ts`、`design-verify-directory-repository-impl.ts`） | 2 件とも `passed` | 集約と adapter 実装は型検査を通る |
| `aidlc-sensor.ts fire linter`（同 2 ファイル） | 2 件とも `passed` with `note: tool-unavailable` | advisory。lint バイナリ未検出のためこのレビュー環境では実走できていない（R-02） |

### Verification Performed

- **Repository 語彙のオーナー裁定適合**: `design/usecase/port/design-verify-directory-repository.ts`、`requirements/usecase/port/verification-directory-repository.ts`、`refcheck/usecase/port/reference-check-report-repository.ts` を実読し、いずれも `find*`／`store` の 2 メソッドだけであることを確認。`grep -rn "conformedOf|storeConformed|findAllByDirectory" deep-spec-analysis/src` は 0 件。
- **集約の可変部**: `DesignVerifyDirectory`／`VerificationDirectory` はともに `#crossCheck: *Report | null` を private field として持ち、`finalizing`／`crossChecked`／`withoutCrossCheck`／`conformedTo` の振る舞いで不変条件（backend ごとに1 report、cross-check は不在か現在の reports から導いたもの）を守ることを実読で確認。
- **Adapter の store()**: `design-verify-directory-repository-impl.ts` を全文読み、lock 取得 → 兄弟変更検知（`#siblingsUnchanged`）→ render → 古い cross-check の stale rename → token fencing（`holdsOwnership` を 3 回の公開直前each）→ backend atomic 公開 → cross-check atomic 公開 → stale cleanup → lock release の順序が functional-spec Workflow 1 の 5〜15 と Failure Matrix に一致することを確認。
- **strict/tolerant 分離**: `finding-kind.ts` の diff は名前つき static ファクトリの追加のみ（`git diff` で確認）で、正常生成経路が string を受け取らないことを確認。`FindingsSchema`（`kernel/domain/findings-schema.ts`）の凍結降格文言 `self-validation against deep-spec-findings-schema.json failed: <first error>` と `findings schema unreadable: <cause>` を実読で確認。
- **domain 層の自由関数**: `grep -n "^function |^export function |^const .* = ("` を domain ディレクトリへ実行。ヒットした関数はすべて非 export のモジュール内 private ヘルパーで、`git status`／`git diff --stat` と突き合わせるとこの intent の diff 対象外（既存 baseline、または Refinement 統合で逐語移設されたファイル内）であり、この diff が新規に自由関数を追加した箇所ではないことを確認。`lowered-unit.ts` の旧 161 行 `buildLowering` 自由関数は消滅し、ファイルは 65 行になっている。
- **Refinement 統合**: `@deep-spec/refinement-domain` への import／依存宣言は `src` 配下 0 件（grep 実測）。`tests/architecture/rules.ts` の `SANCTIONED_CROSS_CONTEXT` は `design/domain -> requirements/domain` の 1 辺のみで、旧 green fixture は red へ、新 green fixture が追加されていることを diff で確認（既存判定関数自体は 1 つも削除されていない）。
- **決定記録の対称性**: `git diff --stat` で `decisions.md` +162／`decisions.ja.md` +133、`grep -c "^## "` で両ファイルとも 47 と H2 数が一致することを確認。
- **1,000 行上限**: 変更対象の主要ファイル（`design-verify-directory-repository-impl.ts` 248、`directory-finalization-lock.ts` 223、`verify-design-quint-usecase.ts` 313 ほか）はすべて上限未満。新規テスト（`tests/architecture.test.ts` の `MAX_PRODUCTION_FILE_LINES` 検査）が機械検査として追加されていることを diff で確認。
- **NFR1（本家互換）**: `git status --short -- deep-spec-analysis/tests/fixtures` は空（golden byte 同一）。
- **source-manifest.json の正確性**: `source-manifest.json` の 300 件を prefix 別に集計すると `deep-spec-analysis/` 230、`aidlc-workflows/` 66、`.codex/` 2、`.claude/` 2。`aidlc-workflows` は submodule 内 `git status --short` の実件数 66 と完全一致、`.codex/`・`.claude/` も実際に変更された各 2 ファイル（`aidlc-lib.ts`／`aidlc-sensor-traceability.ts`）と完全一致。
- **既存テストの非退行**: `git diff` で `tests/refcheck-report.test.ts` 等の `expect(conformToContract(...))` 削除箇所は同一 diff 内で `expect(report.conformedTo(...))` へ 1 対 1 で置換されていることを確認し、緩和ではなくリネームであることを確認。
- **リリース情報同期（FR8.5）**: `aidlc-workflows/core/tools/aidlc-version.ts` = `2.7.2`、`README.md` バッジ = `2.7.2`、`CHANGELOG.md` 先頭見出し = `## [2.7.2] - 2026-09-04` の 3 点一致を実読で確認。

### Summary

Repository の語彙をオーナー裁定どおり保存・検索・取得・削除へ閉じ、集約 `DesignVerifyDirectory`／`VerificationDirectory` が可変部（cross-check）を自身で持つ設計は、実装（adapter の `store()`、domain の振る舞い）まで一貫している。strict creation と tolerant hydration の分離、Refinement の Design 統合、lowering／verdict の責務分離、ゼロ Unit 経路の拡張、NFR1（golden byte 同一）と NFR5（1,000 行上限の機械検査）もすべて実測で裏づけが取れた。Critical／Major 相当の欠陥は見つからず、Minor 2 件（計画文面と実装の軽微な乖離、lint 実走の未確認）はいずれも READY を妨げない。
