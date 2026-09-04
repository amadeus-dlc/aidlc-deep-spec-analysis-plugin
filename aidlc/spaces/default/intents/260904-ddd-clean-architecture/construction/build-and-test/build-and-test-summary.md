# Build and Test Summary — DDD／クリーンアーキテクチャ改善

ゼロ Unit のステージ実行。入力は Code Generation の [`code-generation-plan.md`](../code-generation/code-generation-plan.md)（Testing Contract と Quality Targets）、[`unit-test-instructions.md`](../code-generation/unit-test-instructions.md)（波ごとのスコープ付きコマンド）、[`code-summary.md`](../code-generation/code-summary.md)（変更ファイル・判断・サンドボックス検証）です。NFR Requirements／NFR Design は `SKIP` なので、測定可能な品質目標はこの 3 つと `bunfig.toml`・`tests/build-tools.test.ts` から組み立てました。

**対象範囲の裁定**: Build and Test の途中でオーナーが「`aidlc-workflows/` はこのリポジトリの開発対象ではなく、変更してはならない」と裁定しました。要件 FR8 が含めていた `aidlc-workflows/core/` の変更は HEAD（a277af21）へ戻し、aidlc-workflows のテストと関連目標は検証対象から外しています。

## Build Status

| 項目 | 結果 |
|---|---|
| 前提 | bun 1.3.13 / node 24 / quint 0.32.0 / Apalache 0.56.1（ローカル）。`deep-spec-analysis` は `bun install --frozen-lockfile` 済み |
| `deep-spec-analysis` 型検査 | `bunx tsc --noEmit` exit 0 |
| `deep-spec-analysis` 生成物 | `bun scripts/build-tools.ts --check` 14 file(s) up to date |
| `deep-spec-analysis` プラグイン検証 | `aidlc-plugin-validate` Errors 0 / warnings 1（`compose-hook-absent`、従来どおり）。7 harness の projection build すべて OK |

ビルドは成功。手順は [`build-instructions.md`](./build-instructions.md)。

## Test Type Inventory

| 種別 | 生成 | 理由 |
|---|---|---|
| 単体テスト | Code Generation で生成済み（新規 17 件以上、[`unit-test-instructions.md`](../code-generation/unit-test-instructions.md)） | Minimal 戦略の要件駆動テスト |
| 統合テスト | 新規生成なし。既存の境界越えスイートと実サンドボックスを [`integration-test-instructions.md`](./integration-test-instructions.md) に記録 | Minimal 戦略 |
| 性能テスト | 新規生成なし。bundle 上限と atomic write の実測を [`performance-test-instructions.md`](./performance-test-instructions.md) に記録 | NFR stage が SKIP |
| セキュリティテスト | 新規生成なし。NFR4／BR7.5 に対応する既存検査を STRIDE で整理して [`security-test-instructions.md`](./security-test-instructions.md) に記録 | NFR stage が SKIP |

## Coverage Expectations

ゼロ Unit なので Unit 別の期待値はなく、ステージ全体で `bunfig.toml` のカバレッジ床 0.9（domain 層）を維持し、既存スイートを green に保つことを期待します。

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| T-BT-01 | Testing Contract `scope_floor`「既存スイート green」 | 0 fail | 577 pass / 1 skip / 0 fail（3,218 expect、32 files） | `bun test --coverage` 2026-09-04T13:19Z | build-and-test | Met |
| T-BT-02 | `bunfig.toml` `coverageThreshold = 0.9`（domain 層） | ≥ 90% | 関数 99.83% / 行 99.94%、exit 0 | 同上 | build-and-test | Met |
| T-BT-03 | Testing Contract `strategy_volume`（要件ごとに 1 件＋component の happy-path 下限） | FR1〜FR7・NFR1〜NFR5 の各 ID に検証可能なテストが 1 件以上（FR8 は裁定により対象外） | 計画の Test Volume 表 17 件に加え、集約の不変条件・兄弟変更検知・`FindingsSchema` 変種を追加。`traceability.json` は FR1〜FR7・NFR1〜5 の 40 ID が OK、FR8 系 6 ID は N/A | `cross-unit-traceability.md` | build-and-test | Met |
| T-BT-04 | `code-generation-plan.md` Quality Targets — 型検査 | 0 エラー | 0 エラー | `bunx tsc --noEmit` exit 0 | build-and-test | Met |
| T-BT-05 | `tests/build-tools.test.ts` — 生成物同期と bundle 上限 512 KiB | 同期済み、最大 ≤ 524,288 bytes | 14 file(s) up to date、最大 321,855 bytes | `bun scripts/build-tools.ts --check`、`code-summary.md` | build-and-test | Met |
| T-BT-06 | NFR1（`code-generation-plan.md` Quality Targets）— golden bytes 不変 | `tests/fixtures/` 無変更、実ディスパッチの出力が変更前後で byte 一致 | `git status --short -- deep-spec-analysis/tests/fixtures` 0 行。サンドボックス A／B／A→update の 10 entry すべて byte 一致 | `code-summary.md` Sandbox Verification | build-and-test | Met |
| T-BT-07 | NFR5（`code-generation-plan.md` Quality Targets）— production ファイル < 1,000 行 | 全ファイル < 1,000 行 | 最大 288 行（`design-report.ts`）。機械検査 `tests/architecture.test.ts` green | `bun test tests/architecture.test.ts` | build-and-test | Met |
| T-BT-08 | CI 相当のプラグイン検証（`.github/workflows/ci.yml`） | validate 0 エラー、7 harness build 成功 | Errors 0 / warnings 1（従来どおり）、7 harness OK | 2026-09-04T13:2xZ の実行 | build-and-test | Met |
| T-BT-09 | レビュー R-02（`deep-spec-analysis` 側の lint 実走） | — | `deep-spec-analysis` に lint の script も CI ステップも存在しない（`package.json` に scripts なし、`ci.yml` に lint なし） | `package.json`、`.github/workflows/ci.yml` | build-and-test | N/A |

FR8（ゼロ Unit 経路）に紐づく目標（aidlc-workflows のスイート・drift・version 3 点整合・導入コピー同期）は、オーナー裁定により対象外とし、行を設けない。

## Readiness Assessment

| 観点 | 判定 |
|---|---|
| build-ready | Yes — 型検査・生成物同期・プラグイン検証・7 harness build がすべて成功 |
| test-ready | Yes — deep-spec-analysis は 0 fail、すべての適用目標が Met |
| deployment-ready | 条件付き — 次の Deployment Pipeline で PR を出す。監査シャード同梱規律（`project.md`）に従い、PR 作成直前に `git status` で監査シャードの追記を確認して同じ PR に含めること。FR8 が未実装になったことを PR の説明で明示する |

## Known Limitations

- **FR8（ゼロ Unit 経路）は未実装**: 要件（Q5=A）で同じ Intent に含めたが、オーナー裁定で `aidlc-workflows/` は変更対象外となり、実装を撤回した。承認ゲートで扱いを確定する。
- `.codex/tools/` の `aidlc-lib.ts`・`aidlc-sensor-traceability.ts` はこのセッション開始前から変更されていた（前セッションの導入コピー同期）。この Intent の変更集合に残すか戻すかはオーナーの指示待ち。
- このワークスペースの導入コピー `.claude/tools/aidlc-sensor-traceability.ts`（HEAD へ復元済み）は、ゼロ Unit のステージレベル `traceability.json` に対して `cannot derive the construction unit from output path` で落ちる（advisory）。FR8 が直すはずだった不具合で、`aidlc-workflows/` を変更対象外とした裁定により本 Intent では未修正。Code Generation の traceability は修正版で `pass: true` を実測済み（`cross-unit-traceability.md`）。
- 上流ディスパッチャ `aidlc-sensor.ts` の凍結真理値表は、センサーの exit 1 を advisory の `passed` ＋ `script-error` と表示する（`code-summary.md` に記録。aidlc-workflows 側の事項であり、このリポジトリからは変更しない）。
