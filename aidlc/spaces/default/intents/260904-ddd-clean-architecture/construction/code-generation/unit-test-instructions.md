# Unit Test Instructions — DDD／クリーンアーキテクチャ改善

このステージはゼロ Unit のステージ実行です。ここに書く実行コマンドは、このステージが触るテストファイルだけに絞ってあります。プロジェクト全体を無条件に走らせる裸のコマンド（`bun test` 単体など）は使いません。全体実行は Build and Test が受け持ちます。

方法論は Testing Contract の `test-after` に従います。各層を実装してから、その層のテストを書いて走らせます。実行環境は node 24 / bun 1.3.13、`deep-spec-analysis` の `bunfig.toml` は `linker = "isolated"`、`coverageThreshold = 0.9`（除外設定により実質 domain 層のみ）です。

## Runner Readiness

最初のテストステップより前に、以下を確認します。

- `deep-spec-analysis` のルート `package.json` に `scripts` フィールドは無く、実行はリポジトリルートの `.github/workflows/ci.yml`（`working-directory: deep-spec-analysis`）に直書きされたコマンドを手で打ちます。
- `aidlc-workflows` は `package.json` に `typecheck` / `lint` / `check` があり、テストは `tests/run-tests.sh` から走ります。
- `cd` を伴うコマンドは必ずサブシェルで囲みます。ワークフローのツールを呼ぶときの相対パスが壊れるためです。

準備確認コマンド:

```bash
(cd deep-spec-analysis && bun install --frozen-lockfile)
(cd deep-spec-analysis && bunx tsc --noEmit)
(cd aidlc-workflows && bun run typecheck)
```

## Scoped Commands per Wave

### Wave 1 — ドメインプリミティブ（Step 7）

```bash
(cd deep-spec-analysis && bun test tests/kind-rank.test.ts tests/domain-primitives.test.ts)
```

`tests/domain-primitives.test.ts` はこのステージで新設します（新規テスト #1〜#3）。既存の `tests/kind-rank.test.ts` は `FindingKind` の正準順と未知 kind の順位 99 を守るため同時に走らせます。

### Wave 2 — Refinement 統合（Step 14）

```bash
(cd deep-spec-analysis && bun test tests/architecture.test.ts tests/package-boundaries.test.ts tests/design-pipeline.test.ts)
```

新規テスト #4（旧 import と依存宣言が 0 件）と #5（旧横断 4 辺の red example）は `tests/architecture.test.ts` と `tests/package-boundaries.test.ts` に足します。`tests/design-pipeline.test.ts` は refinement の golden 照合を含むため、byte 同一の確認に同時に走らせます。

### Wave 3 — lowering と verdict（Step 19）

```bash
(cd deep-spec-analysis && bun test tests/design-pipeline.test.ts)
```

`LoweredUnit.of` と `remapVerdicts` の呼出はテスト側 14 箇所すべてがこの 1 ファイルに集中しているため、対象はこの 1 本です（新規テスト #15）。

### Wave 4 — 集約と Repository（Step 25）

```bash
(cd deep-spec-analysis && bun test tests/design-report-finalization.test.ts tests/domain-primitives.test.ts tests/design-pipeline.test.ts)
```

`tests/design-report-finalization.test.ts` はこのステージで新設します（新規テスト #6〜#13）。集約 `DesignVerifyDirectory` の不変条件と `conformedTo(schema)`、`FindingsSchema` の違反検出は `tests/domain-primitives.test.ts` へ足します。Failure Matrix の 9 行と「load 後に兄弟が変わっていたら `store` が失敗する」は fault injection で再現し、時計と PID liveness probe は注入して実時間待ちを入れません。

### Wave 5 — usecase の共通化（Step 29）

```bash
(cd deep-spec-analysis && bun test tests/design-pipeline.test.ts tests/design-report-finalization.test.ts)
```

新規テスト #14（共通 finalization 1 か所の変更が SMT／Quint 両方へ効く）をここに足します。backend 固有の timeout・probe・solver 判定は既存テストで非退行を確認します。

### Wave 6 — ゼロ Unit 経路（Step 34）

```bash
(cd aidlc-workflows && bun test tests/unit/t281-sensor-traceability.test.ts tests/unit/t320-review-confirmation-deadlock.test.ts tests/unit/t68-version-changelog-sync.test.ts)
(cd aidlc-workflows && bun scripts/package.ts --check)
(cd aidlc-workflows && bun run typecheck)
(cd aidlc-workflows && bun run lint)
```

新規テスト #16（Units Generation 実行済みかつ Unit 0 件）は t281 と t320 のマトリクスへ 1 行ずつ足します。`t68-version-changelog-sync.test.ts` は version・README バッジ・CHANGELOG の 3 点整合を検査するので、Step 33 の直後に必ず走らせます。

### Wave 7 — 構造ゲート（Step 36）

```bash
(cd deep-spec-analysis && bun test tests/architecture.test.ts)
```

新規テスト #17（変更した production ファイルが 1,000 行未満）をここに足します。

## Coverage Targets

- `deep-spec-analysis`: `bunfig.toml` の `coverageThreshold = 0.9`。`coveragePathIgnorePatterns` が `tests/**`・`scripts/**`・`src/entries/**` と全 context の `adapter/**`・`usecase/**` を除外するため、床は実質 domain 層に掛かります。Refinement の 36 ファイルは `design/domain` へ移った後も計測対象に残るので、統合前後で床を下回らないことを確認します。
- この閾値は緩めません。カバレッジが不足した場合は、閾値ではなくテストを足します。
- `aidlc-workflows`: カバレッジ床の設定はありません。`tests/run-tests.sh` の全 green と `bun run check` の通過が判定です。

カバレッジを含む確認は次のコマンドで行います。

```bash
(cd deep-spec-analysis && bun test --coverage)
```

これは Wave 7 の全体検証（Step 37）でのみ使い、各波のスコープ付き実行では使いません。

## Mocking and Stubbing

- **時計と PID liveness probe**: `DirectoryFinalizationLock` は両方を注入で受けます。lease 境界値と「live owner が 30 秒超停止」の判定は、実時間を待たずに注入した時計で再現します。所有者プロセスの生死は probe の戻り値で決めます。
- **filesystem の fault injection**: 兄弟読み、cross-check 無効化、backend 書き込み、cross-check 書き込み、cleanup rename の各点で失敗を注入し、Failure Matrix の Public backend／Public cross-check／Outcome の 3 列が表どおりになることを確認します。既存の `tests/doubles/` にあるテストダブルを再利用し、新しい抽象は増やしません。
- **schema 観測回数**: `conformedOf` の呼出回数と `storeConformed` が再 conformance しないことを、Repository のテストダブルで数えて検証します。
- **並行 writer**: 同一ディレクトリへの 2 writer を同一プロセス内で interleave させ、待機・再試行が起きないこと、独立ディレクトリの writer が影響を受けないことを確認します。実プロセスは起動しません。
- `aidlc-workflows` 側は既存 t281／t320 の流儀に合わせ、一時ディレクトリに state ファイルと成果物を組み立てる方式を維持します。

## Test Data

- golden fixture は `deep-spec-analysis/tests/fixtures/<suite>/expected/` にあります（`conformance` と `design` に `smt.json`・`quint.json`・`cross-check.json`、`background-events/` ほか）。Step 2 でこの被覆範囲を洗い出し、覆われていない経路にだけ比較を足します。
- golden は意図的に更新しません。byte が動いた場合は実装側の誤りとして扱います。
- 契約2 の skip reason 閉集合の正本は `deep-spec-analysis/src/entries/data/deep-spec-findings-schema.json:221-234` です。`SkipReason` の 9 値はここと一致させ、テストでも同じ出典を参照します。
- `aidlc-workflows` のゼロ Unit テストは、`## Stage Progress` の `units-generation — EXECUTE` / `— SKIP` の別と、`unit-of-work-dependency.md` の有無の組み合わせでマトリクスを作ります。
