# Security Test Instructions — DDD／クリーンアーキテクチャ改善

Test Strategy は `Minimal` で、NFR Requirements は実行していないため、セキュリティテストの指示ファイルは新規生成の対象外です。ただし要件の NFR4（未信頼入力と path 境界）と BR7.5 に対応する検査は Code Generation で単体テストとして入っているので、セキュリティエンジニアの観点で「何が守られていて、どう再確認するか」をここに記録します。入力は [`code-generation-plan.md`](../code-generation/code-generation-plan.md) の Quality Targets、[`unit-test-instructions.md`](../code-generation/unit-test-instructions.md) の注入方針、[`code-summary.md`](../code-generation/code-summary.md) の実装判断です。

## Trust Boundaries Covered by Existing Tests

| 境界（STRIDE） | 守り | 検証 | 再実行 |
|---|---|---|---|
| 外部 JSON／Markdown の hydration（Tampering／Information Disclosure） | adapter 境界だけが `reconstitute` を使い、未知 kind・reason は逐語保持して適合で降格する。domain の正常生成は strict な `parse`／`of` と閉集合ファクトリのみ | `tests/domain-primitives.test.ts`（strict 拒否・tolerant 降格）、`tests/refcheck-pipeline.test.ts`（未知 kind の降格文言） | `(cd deep-spec-analysis && bun test tests/domain-primitives.test.ts tests/refcheck-pipeline.test.ts)` |
| report 関連 path の導出（Tampering／Elevation of Privilege） | lock・temp・stale の path は `DesignReportId.directory()` と固定 basename からのみ導出し、入力文字列で任意 path を組み立てない。非公開 temp／stale は `*.json` にせず兄弟列挙に混ぜない | `tests/design-report-finalization.test.ts`、`tests/verification-report-finalization.test.ts` | `(cd deep-spec-analysis && bun test tests/design-report-finalization.test.ts tests/verification-report-finalization.test.ts)` |
| 並行 writer と lock 回復（Denial of Service／Spoofing） | 非待機の単発 exclusive create、lease 期限切れかつ所有者不在の確定時だけ回復、公開ごとの token fencing、owner 固有 cleanup path で canonical を直接消さない | 同上（Failure Matrix 9 行と回復競合） | 同上 |
| 検証結果と保存証跡の整合（Repudiation） | verdict は保存したのと同じ集約から導き、保存失敗を `verified` に変換しない | `tests/design-usecase-collaboration.test.ts`、`tests/design-report-finalization.test.ts` | `(cd deep-spec-analysis && bun test tests/design-usecase-collaboration.test.ts)` |
| 秘密情報 | コードに認証情報・鍵・トークンを持ち込まない。環境変数は quint の method と bin の指定のみ | `grep -rn "AKIA\|-----BEGIN\|password" deep-spec-analysis/src` が 0 件であることを目視確認 | 同左 |

## Dependency Posture

- ソルバー（`z3-solver`、`@informalsystems/quint`）は exact pin で、版を上げることは golden を更新する裁定。この Intent では変更していません。
- 依存の脆弱性スキャン（`bun audit` 相当）や SAST はこのリポジトリの CI に無く、この Intent の範囲外です。導入する場合は CI Pipeline（`ci-pipeline` stage）を実行する scope で扱ってください。

## Notes

- 上流ディスパッチャ `aidlc-sensor.ts` の凍結真理値表は、センサーの exit 1 を advisory の `passed` ＋ `script-error` として表示します。プラグインは失敗を `verified` にしていませんが、監視側が verdict 行の `result` だけを見ると見落とす余地があります。aidlc-workflows 側の後続候補として `code-summary.md` に記録済みです。
