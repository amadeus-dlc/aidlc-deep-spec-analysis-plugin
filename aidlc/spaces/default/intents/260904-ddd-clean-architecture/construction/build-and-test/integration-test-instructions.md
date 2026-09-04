# Integration Test Instructions — DDD／クリーンアーキテクチャ改善

Test Strategy は `Minimal` なので、この Intent は統合テストの指示ファイルを新たに生成しません（Code Generation の [`unit-test-instructions.md`](../code-generation/unit-test-instructions.md) が要件駆動の単体テストを担い、[`code-generation-plan.md`](../code-generation/code-generation-plan.md) の Test Volume 表がその 17 件を列挙しています）。ただし、境界をまたぐ検証は既存の統合スイートと実サンドボックスで既に実行済みなので、ここにはその所在と再実行方法だけを記録します。

## Existing Cross-Boundary Coverage

| 境界 | 既存の検証 | 再実行 |
|---|---|---|
| installer → vanilla AI-DLC install → intent-create → 導入済み harness からのセンサー発火 | `deep-spec-analysis/tests/intent-e2e.test.ts` | `(cd deep-spec-analysis && bun test tests/intent-e2e.test.ts)` |
| usecase → Repository（集約 `store`）→ ファイルシステム → 再読込 | `tests/design-report-finalization.test.ts`、`tests/verification-report-finalization.test.ts`、`tests/design-usecase-collaboration.test.ts` | `(cd deep-spec-analysis && bun test tests/design-report-finalization.test.ts tests/verification-report-finalization.test.ts tests/design-usecase-collaboration.test.ts)` |
| SMT／Quint backend → cross-check の収束（golden byte 比較） | `tests/design-verify.test.ts`、`tests/refinement.test.ts`、`tests/conformance.test.ts`、`tests/verify-{smt,quint}-pipeline.test.ts` | `(cd deep-spec-analysis && bun test tests/design-verify.test.ts tests/refinement.test.ts tests/conformance.test.ts)` |
| プラグイン配布 → compose → ディスパッチャ | `aidlc-workflows/core/tools/aidlc-plugin-test.ts` | `bun aidlc-workflows/core/tools/aidlc-plugin-test.ts deep-spec-analysis --install <sandbox> --harness claude` |

## Live Sandbox Exercise

[`code-summary.md`](../code-generation/code-summary.md) の Sandbox Verification 節のとおり、変更前（HEAD の一時 worktree から build）と変更後のプラグインを別々のサンドボックスへ導入し、同じ intent に 10 entry を発火して byte 比較しました。再現手順は同節の記述に従い、`/tmp/dsa-sandbox/` に残置した A／B のツリーと `compare.sh` を使えます。

## Notes

- `aidlc-workflows/` submodule はこのリポジトリの開発対象ではありません（オーナー裁定 2026-09-04）。そのテストはこの Intent の検証対象に含めません。プラグイン配布の compose 検証には、変更していない既存の `aidlc-plugin-test.ts` をそのまま使います。
