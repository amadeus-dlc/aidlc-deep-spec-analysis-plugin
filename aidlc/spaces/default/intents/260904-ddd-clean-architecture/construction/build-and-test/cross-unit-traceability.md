# Cross-Unit Traceability — DDD／クリーンアーキテクチャ改善

ゼロ Unit のステージ実行なので、対象はステージレベルの [`traceability.json`](../code-generation/traceability.json)（Code Generation）1 件です。User Stories は `SKIP` のため `AC` は列挙対象にありません。列挙元は [`requirements.md`](../../inception/requirements-analysis/requirements.md) の FR1〜FR8（子要件 33 件を含む）と NFR1〜NFR5、合計 46 ID です。

## Verdict

**PASS with one owner-ruled exception** — FR1〜FR7 と NFR1〜NFR5 の 40 ID はすべて `OK` で target ファイルが存在。**FR8 系 6 ID は `N/A`**（オーナー裁定 2026-09-04: `aidlc-workflows/` は開発対象ではなく変更してはならない。FR8 の実装は HEAD へ戻し、この Intent では未実装）。`GAP`／`ORPHAN` 0。traceability センサー（`.claude/tools/aidlc-sensor-traceability.ts --stage code-generation`）の再実行結果は下記 Notes。

## Coverage by ID

| ID | 所有 stage | Target | 状態 |
|---|---|---|---|
| FR1 / FR1.1 | code-generation | `deep-spec-analysis/src/design/usecase/design-report-finalizer.ts` | OK |
| FR1.2 | code-generation | `deep-spec-analysis/src/kernel/domain/findings-schema.ts` | OK |
| FR1.3 | code-generation | `deep-spec-analysis/tests/design-report-finalization.test.ts` | OK |
| FR1.4 | code-generation | `deep-spec-analysis/src/design/usecase/verify-design-smt-usecase.ts` | OK |
| FR2 / FR2.1 / FR2.4 | code-generation | `deep-spec-analysis/src/design/adapter/design-verify-directory-repository-impl.ts` | OK |
| FR2.2 / FR2.5 | code-generation | `deep-spec-analysis/src/kernel/adapter/directory-finalization-lock.ts` | OK |
| FR2.3 | code-generation | `deep-spec-analysis/src/design/domain/design-verify-directory.ts` | OK |
| FR2.6 | code-generation | `deep-spec-analysis/src/kernel/adapter/directory-finalization-lock-outcome.ts` | OK |
| FR3 | code-generation | `deep-spec-analysis/src/kernel/domain/skip-reason.ts` | OK |
| FR3.1 | code-generation | `deep-spec-analysis/src/kernel/domain/verification-method.ts` | OK |
| FR3.2 | code-generation | `deep-spec-analysis/src/design/domain/design-skipped.ts` | OK |
| FR3.3 | code-generation | `deep-spec-analysis/src/design/adapter/design-report-serializer.ts` | OK |
| FR3.4 | code-generation | `deep-spec-analysis/src/kernel/domain/finding-kind.ts` | OK |
| FR4 | code-generation | `deep-spec-analysis/src/design/domain/index.ts` | OK |
| FR4.1 | code-generation | `deep-spec-analysis/src/design/domain/refinement-map.ts` | OK |
| FR4.2 | code-generation | `deep-spec-analysis/src/design/usecase/package.json` | OK |
| FR4.3 | code-generation | `deep-spec-analysis/src/design/domain/package.json` | OK |
| FR4.4 | code-generation | `deep-spec-analysis/tests/refinement-pipeline.test.ts` | OK |
| FR4.5 | code-generation | `deep-spec-analysis/src/design/domain/unit-refinement-plan.ts` | OK |
| FR5 / FR5.1 | code-generation | `deep-spec-analysis/src/design/usecase/design-verification-acquirer.ts` | OK |
| FR5.2 | code-generation | `deep-spec-analysis/src/design/usecase/verify-design-quint-usecase.ts` | OK |
| FR5.3 | code-generation | `deep-spec-analysis/src/design/usecase/design-acquisition-result.ts` | OK |
| FR6 / FR6.1 | code-generation | `deep-spec-analysis/src/design/domain/lowered-unit.ts` | OK |
| FR6.2 | code-generation | `deep-spec-analysis/src/design/domain/design-unit.ts` | OK |
| FR6.3 | code-generation | `deep-spec-analysis/src/design/domain/sibling-verdict-document.ts` | OK |
| FR7 | code-generation | `deep-spec-analysis/docs/decisions.md` | OK |
| FR7.1 | code-generation | `deep-spec-analysis/docs/decisions.ja.md` | OK |
| FR7.2 | code-generation | `deep-spec-analysis/tests/architecture/rules.ts` | OK |
| FR7.3 | code-generation | `deep-spec-analysis/tests/architecture.test.ts` | OK |
| FR8 / FR8.1 / FR8.2 / FR8.3 / FR8.4 / FR8.5 | code-generation | オーナー裁定 2026-09-04: `aidlc-workflows/` は開発対象外。実装を HEAD（a277af21）へ戻した | N/A |
| NFR1 | code-generation | `deep-spec-analysis/tests/design-verify.test.ts` | OK |
| NFR2 | code-generation | `deep-spec-analysis/tests/design-report-finalization.test.ts` | OK |
| NFR3 | code-generation | `deep-spec-analysis/tests/domain-primitives.test.ts` | OK |
| NFR4 | code-generation | `deep-spec-analysis/src/kernel/adapter/directory-finalization-lock.ts` | OK |
| NFR5 | code-generation | `deep-spec-analysis/tests/architecture.test.ts` | OK |

## Uncovered Elements

- **FR8（FR8.1〜FR8.5）**: 要件では Q5=A で同じ Intent に含めたが、Build and Test 中のオーナー裁定「`aidlc-workflows/` は開発対象ではない。変更するな」により実装を撤回した。承認ゲートで判断を仰ぐ事項。

## Notes

- `.codex/tools/` の `aidlc-lib.ts`・`aidlc-sensor-traceability.ts` はこのセッション開始前から変更されていた（前セッションの導入コピー同期）。この Intent の変更集合に含めるかはオーナーの指示待ち。
- `.claude/tools/` の同期（このセッションで人間の承認を得て実施）は、裁定を受けて HEAD へ戻した。
