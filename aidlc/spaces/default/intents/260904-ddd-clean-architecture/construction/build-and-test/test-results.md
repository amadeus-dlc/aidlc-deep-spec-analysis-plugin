# Test Results — DDD／クリーンアーキテクチャ改善

実行日時 2026-09-04T13:19Z〜。手順は [`build-instructions.md`](./build-instructions.md)、コマンドは Code Generation の [`unit-test-instructions.md`](../code-generation/unit-test-instructions.md) と [`code-generation-plan.md`](../code-generation/code-generation-plan.md) の Quality Targets から採り、同一コマンドは 1 回だけ実行した。変更ファイルの一覧は [`code-summary.md`](../code-generation/code-summary.md)。

**対象範囲の裁定**: Build and Test の途中でオーナーが「`aidlc-workflows/` はこのリポジトリの開発対象ではなく、変更してはならない」と裁定した（2 度目の指示）。要件 FR8 が含めていた `aidlc-workflows/core/` の変更は HEAD（a277af21）へ戻し、aidlc-workflows のテストは検証対象から外した。以下は **deep-spec-analysis と、その配布に使う既存の aidlc-workflows ツール（変更なし）** についての結果である。

## Build Status

| コマンド | 結果 |
|---|---|
| `(cd deep-spec-analysis && bunx tsc --noEmit)` | exit 0（エラー出力なし） |
| `(cd deep-spec-analysis && bun scripts/build-tools.ts --check)` | `build-tools: 14 file(s) up to date` |
| `(cd deep-spec-analysis && bun ../aidlc-workflows/core/tools/aidlc-plugin-validate.ts .)` | `Errors: 0; warnings: 1`（`compose-hook-absent`、従来どおり） |
| `aidlc-plugin-build.ts . <harness>` × 7 | claude／codex／copilot／cursor／kiro／kiro-ide／opencode すべて OK |

**Build: SUCCESS**

## Unit Test Results

### deep-spec-analysis（全体、カバレッジつき）

```
bun test --coverage
All files | 99.83 % Funcs | 99.94 % Lines
577 pass / 1 skip / 0 fail / 3218 expect() calls
Ran 578 tests across 32 files. [29.98s]
```

基線（変更前）は 527 pass / 1 skip / 0 fail、28 ファイル、2,855 assertions。新規テスト +50、回帰 0。カバレッジ床 0.9（domain 層）は exit 0 で維持。

### deep-spec-analysis（`unit-test-instructions.md` のスコープ付きコマンド、各 1 回）

| 波 | コマンド | 結果 |
|---|---|---|
| Wave 1 | `bun test tests/domain-primitives.test.ts tests/kind-rank.test.ts` | 17 pass / 0 fail（248 expect） |
| Wave 2 | `bun test tests/architecture.test.ts tests/package-boundaries.test.ts tests/design-pipeline.test.ts` | 64 pass / 0 fail（410 expect） |
| Wave 4 | `bun test tests/design-report-finalization.test.ts tests/domain-primitives.test.ts tests/design-pipeline.test.ts` | 54 pass / 0 fail（385 expect） |
| Wave 5 | `bun test tests/design-pipeline.test.ts tests/design-report-finalization.test.ts` | 40 pass / 0 fail（282 expect） |
| Wave 4／5 追加（requirements・refcheck） | `bun test tests/verification-report-finalization.test.ts tests/design-usecase-collaboration.test.ts tests/refcheck.test.ts tests/refcheck-pipeline.test.ts tests/refcheck-report.test.ts` | 70 pass / 0 fail（327 expect） |
| Wave 7 | `bun test tests/architecture.test.ts`（Wave 2 の実行に含む） | 38 pass / 0 fail |

Wave 3（`tests/design-pipeline.test.ts` 単独）は Wave 4／5 のコマンドに含まれるため重複実行していない。Wave 6（aidlc-workflows）は上記の裁定により対象外。

## Integration and Other Checks

- 統合・性能・セキュリティの指示ファイルは Minimal 戦略のため新規生成せず、既存の検証の所在と再実行方法を記録した（[`integration-test-instructions.md`](./integration-test-instructions.md)、[`performance-test-instructions.md`](./performance-test-instructions.md)、[`security-test-instructions.md`](./security-test-instructions.md)）。それらが指す既存テストは上の全体実行に含まれ、すべて green。
- 実サンドボックス検証（実 Apalache の bounded）は Code Generation で実施済み。変更前 A／変更後 B／A→update の 10 entry すべてで verdict・exit code・出力が byte 一致、2 回目発火は収束、lock／temp／stale の残留 0、`aidlc-plugin-test` CLEAN（[`code-summary.md`](../code-generation/code-summary.md) Sandbox Verification 節）。
- traceability センサーは Code Generation 時点で `pass: true`、findings 0。裁定後は FR8 系 6 ID を `N/A`（理由つき）に改めた（[`cross-unit-traceability.md`](./cross-unit-traceability.md)）。

## Failure Details

deep-spec-analysis: 0 fail。

裁定前に aidlc-workflows の全体スイートを 1 回走らせていた（`Result: FAIL`、赤は HEAD 基線と同じ環境要因 6 ファイル／18 assertion、新規失敗 0）が、対象外となったため結果は採用しない。実行で作った `tests/logs/` と `node_modules` は削除し、submodule は a277af21 の pristine な状態に戻した。

## Coverage Report

`deep-spec-analysis` All files: 関数 99.83%／行 99.94%（床 0.9、domain 層のみ計測）。今回新設した `design-verify-directory.ts`・`verification-directory.ts`・`findings-schema.ts`・`skip-reason.ts`・`design-report-finalizer.ts`・`verification-report-finalizer.ts` はいずれも 100%。

## Target Verification Matrix

[`build-and-test-summary.md`](./build-and-test-summary.md) の表と同じ。T-BT-01〜08 は Met、T-BT-09（`deep-spec-analysis` 側の lint 実走）は N/A（lint が存在しない）、FR8 関連の目標は裁定により対象外。
