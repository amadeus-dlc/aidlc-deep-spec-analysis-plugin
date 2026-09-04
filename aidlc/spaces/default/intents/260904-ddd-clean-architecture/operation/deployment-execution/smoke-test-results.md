# Smoke Test Results — DDD／クリーンアーキテクチャ改善

対象は PR ブランチ `refactor/ddd-clean-architecture`（コミット `b3dfecc`、PR [#139](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/pull/139)）。[`deployment-strategy.md`](../deployment-pipeline/deployment-strategy.md) の「配布前の実射」に当たる検証で、[`cd-config.md`](../deployment-pipeline/cd-config.md) 段 6 のスモークを PR ブランチに前倒しして実行した（マージはオーナーが行うため、マージ後の再実行手順も末尾に置く）。Build and Test の [`test-results.md`](../../construction/build-and-test/test-results.md) が基線。

## サンドボックス導入（2026-09-04T14:39:39Z〜14:39:41Z）

新しい空ディレクトリに `aidlc-workflows/dist/claude/` をバニラ導入し（`.claude/`・`aidlc/`・`.mcp.json`）、PR ブランチの作業ツリーからプラグインを導入した。

| 検査 | コマンド | 結果 |
|---|---|---|
| 導入 | `bun deep-spec-analysis/scripts/install.ts --project <sandbox> --from <checkout>` | exit 0。`Changed 1 — recorded 0.5.0 from local …`、「the deep-spec-analysis-verify stage is now part of Inception」 |
| compose の冪等性 | `bun aidlc-workflows/core/tools/aidlc-plugin-test.ts deep-spec-analysis --install <sandbox> --harness claude` | **`Plugin test: CLEAN`**、`Changed files (0): none`、`Drops: 0`、`Idempotent second compose: true` |
| 配布物 | `<sandbox>/.claude/tools/` | 62 ファイル（フレームワーク本体＋プラグインの bundle 10 本と `data/` 4 本） |
| doctor | `bun .claude/tools/deep-spec-analysis-doctor.ts`（sandbox 内） | exit 0。導入検査 26 行すべて pass、`version 0.5.0 … is current (latest stable tag: v0.5.0)`、node／quint／Apalache（bounded）pass。`z3-solver package present` だけ fail（advisory。バニラの sandbox に `bun add z3-solver` していないためで、導入物の欠陥ではない） |

## 作業ツリーでの事前検証（2026-09-04T14:37:26Z〜14:38:04Z）

[`cd-config.md`](../deployment-pipeline/cd-config.md) 段 0 を PR 作成前に実行した。

| 検査 | 結果 |
|---|---|
| `.codex/tools/` の 2 ファイルを HEAD へ | 完了（`git status .codex` 0 件） |
| `aidlc-workflows` submodule | 変更 0、gitlink a277af21 ＝ HEAD a277af21、`git diff --submodule` 0 行 |
| `bunx tsc --noEmit` | exit 0 |
| `bun scripts/build-tools.ts --check` | `14 file(s) up to date` |
| `bun test --coverage` | **577 pass / 1 skip / 0 fail**、32 ファイル、37.24 秒、関数 99.83% / 行 99.94%（Build and Test と同値） |
| `aidlc-plugin-validate` | `Errors: 0; warnings: 1`（`compose-hook-absent`、従来どおり） |
| 7 harness build | claude／codex／copilot／cursor／kiro／kiro-ide／opencode すべて OK |

`bun test` に含まれる `tests/intent-e2e.test.ts` は、バニラ導入した一時 sandbox で installer・センサー発火・doctor・`--single` 実行を実走するので、上のサンドボックス導入と合わせて「導入 → compose → 発火」の経路が PR ブランチで通っている。実 Apalache bounded を使った A／B／A→update の byte 比較は Code Generation で実施済み（[`code-summary.md`](../../construction/code-generation/code-summary.md) Sandbox Verification、10 entry すべて byte 一致）。

## マージ後の再実行（2026-09-04T14:57Z、squash-merge `d22606d` 後）

```bash
git switch main && git pull --ff-only
bun deep-spec-analysis/scripts/install.ts --project <sandbox> --update   # --update は導入記録の同じ source（この checkout）を再取得する。--from／--ref／--tag とは併用できない
bun aidlc-workflows/core/tools/aidlc-plugin-test.ts deep-spec-analysis --install <sandbox> --harness claude   # CLEAN を期待
```

| 検査 | 結果 |
|---|---|
| `install.ts --update` | exit 0、`Changed 1 — recorded 0.5.0 from local <checkout>` |
| `aidlc-plugin-test` | **`Plugin test: CLEAN`**、`Changed files (0): none`、`Drops: 0`、`Idempotent second compose: true` |

期待値どおり。squash-merge は内容を変えないので、結果が変わったらマージの取り違えを疑い、[`rollback-runbook.md`](../deployment-pipeline/rollback-runbook.md) R2 を見る。

補足: `--update` を `--from` と併用した最初の試行は installer が拒否し（`--update cannot be combined with --from, --ref, or --tag`）、その直後に導入し直さずに `aidlc-plugin-test` を走らせると、前回のテスト compose が残した同名 tools との衝突で `test-compose-drop` 10 件と `test-idempotency` の FAILED が出る。テスト側の手順の問題で、`--update` で導入し直してから走らせれば CLEAN になる。
