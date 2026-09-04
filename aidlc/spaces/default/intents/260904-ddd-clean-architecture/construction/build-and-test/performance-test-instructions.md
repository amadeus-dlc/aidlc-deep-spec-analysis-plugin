# Performance Test Instructions — DDD／クリーンアーキテクチャ改善

Test Strategy は `Minimal` で、NFR Requirements／NFR Design の stage はこの Intent では実行していません（`refactor` スコープ）。したがって性能テストの指示ファイルは新規生成の対象外です。ただし [`code-generation-plan.md`](../code-generation/code-generation-plan.md) の Quality Targets と [`code-summary.md`](../code-generation/code-summary.md) に、性能に関わる実測と上限が 2 点あるので、それを再測定できる形でここに残します。

## Measurable Targets Carried from Code Generation

| 目標 | 期待 | 実測（Code Generation 時点） | 再測定 |
|---|---|---|---|
| bundle サイズ上限（`tests/build-tools.test.ts`） | 各 entry bundle ≤ 512 KiB | 最大 321,855 bytes（`design-verify-smt`） | `(cd deep-spec-analysis && bun test tests/build-tools.test.ts)` |
| finalization の atomic write コスト（functional-spec の根拠） | 64 KiB × 2 文書の temp＋rename が p99 < 1 ms | 設計時の 1,000 回実測 p99 0.534 ms、最大 2.026 ms | 設計段階の実測。本 Intent では再測定していない（下記） |

## Notes

- directory lock の追加により finalization は「lock 取得 → 兄弟読み直し → render → atomic 公開 ×2 → cleanup」になりましたが、`unit-test-instructions.md` のとおりテストは時計と PID liveness probe を注入し、実時間待ちを持ちません。lock の lease（30 秒）は回復判定の起点であって待機時間ではなく、競合時は待たずに失敗します。
- 実サンドボックスでの 10 entry 発火（実 Apalache の bounded 検証を含む）は、変更前後で verdict・exit code・出力が byte 一致し、2 回目の発火も収束しました。所要時間は測定対象にしていません。
- 性能の目標値を新たに設ける場合は NFR Requirements を実行する scope（`feature` 以上）で行ってください。
