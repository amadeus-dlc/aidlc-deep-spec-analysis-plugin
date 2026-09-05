# このリポジトリの実例

移植元: [amadeus-ngの同名規則](https://github.com/amadeus-dlc/amadeus-ng/blob/537c4e56a838a4cb28f6564d4c0add1d4adfe915/aidlc/spaces/default/knowledge/aidlc-shared/coding-rules/good-examples.md)。2026-09-05にTypeScriptと当該の裁定へ適用し直した版。

規則の根拠と、その実装を確認する入口をまとめる。各ファイルの全体を無条件の模範として扱わず、表に挙げた性質を確認する。

| 性質 | 実例 |
| --- | --- |
| 型付きのコンストラクタ、ofのpanic、parseのResult | [ir-version.ts](../../../../../../deep-spec-analysis/src/kernel/domain/intermediate-representation-version.ts) |
| 同じ入力に対するofとparseの契約検証 | [construction-contracts.test.ts](../../../../../../deep-spec-analysis/tests/construction-contracts.test.ts) |
| 入力のResult処理、panicの伝播、ロック解放 | [result-boundaries.test.ts](../../../../../../deep-spec-analysis/tests/result-boundaries.test.ts) |
| 有効な空コレクションと不変スナップショット | [error-messages.ts](../../../../../../deep-spec-analysis/src/kernel/domain/error-messages.ts) |
| 式の所有権と不変性 | [expression-tree.ts](../../../../../../deep-spec-analysis/src/kernel/domain/expression-tree.ts) |
| 到達・非到達・未検証の判断を型へ集約 | [reachability-verdict.ts](../../../../../../deep-spec-analysis/src/design/domain/reachability-verdict.ts) |
| Finalizerの呼び出し順に依存させない整合性 | [verification-directory.ts](../../../../../../deep-spec-analysis/src/requirements/domain/verification-directory.ts) |
| 依存方向・公開型・ファサードの検査 | [architecture.test.ts](../../../../../../deep-spec-analysis/tests/architecture.test.ts) |

リンク先が移動した場合は、対応する責務を確認してこの索引を更新する。移植元のRustコードや廃止済みのクラスを、このリポジトリの実装済み機能として引用しない。
適用範囲と優先関係は[共有規則の入口](README.md)を参照。
