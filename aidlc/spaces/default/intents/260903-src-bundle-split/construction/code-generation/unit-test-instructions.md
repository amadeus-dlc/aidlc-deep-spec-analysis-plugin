# ユニットテスト指示 — src/ 分離と bundle 出荷

対象は `deep-spec-analysis/` の 1 ステージ分（zero-Unit）。テスト戦略は **Minimal**、
methodology は **test-after**（`code-generation-plan.md` の Testing Contract が正）。

## テストフレームワークと設定

- ランナー: `bun:test`（bun 1.3.13、`mise.toml` と CI の `setup-bun` に固定）
- 設定: `deep-spec-analysis/bunfig.toml` の `[test]`。カバレッジ床 `coverageThreshold = 0.9`
  （行・関数）、計測対象は domain 層のみ。除外リストは Step 13 で `src/` 起点に
  書き換える。**床は下げない**
- 型検査: `bunx tsc --noEmit`（`tsconfig.json` の `include` を Step 1.8 で `src/` 起点にする）
- 新しい実行時依存は足さない。テストは `bun:test` の標準機能だけで書く
- node 24 が PATH に必要（SMT の子プロセス。`z3-solver` の WASM は bun 上で落ちる）

## 最初のテストより前に確認するコマンド（runner readiness）

Step 1 の移設直後、最初のテストステップ（Step 5）に入る前に次が起動することを確認する:

```bash
cd deep-spec-analysis && bun test tests/kernel-domain.test.ts
```

（既存の in-process スイート 1 本。移設で import が壊れていれば即座に分かる。
この時点で失敗しても runner 自体は動いている＝readiness の確認としては足りる）

## このステージのテスト実行コマンド

すべてファイルパスで範囲を限定する。プロジェクト全体の `bun test` はここでは使わない
（全スイートの回帰は Build and Test ステージが自分の手順で走らせる）。

| # | 目的 | コマンド |
|---|---|---|
| 1 | パッケージ境界（FR1.3 / NFR5） | `cd deep-spec-analysis && bun test tests/package-boundaries.test.ts` |
| 2 | アーキテクチャ規則（FR1.5 / FR5.3） | `cd deep-spec-analysis && bun test tests/architecture.test.ts` |
| 3 | bundle の drift・決定論・出荷形（FR3.2 / NFR1 / FR2.1 / NFR4） | `cd deep-spec-analysis && bun test tests/build-tools.test.ts` |
| 4 | installer の tombstone と compose（FR4.5 / FR5.5） | `cd deep-spec-analysis && bun test tests/intent-e2e.test.ts` |
| 5 | doctor の manifest 期待値（FR4.2） | `cd deep-spec-analysis && bun test tests/doctor-domain.test.ts` |
| 6 | 出荷物 spawn の golden byte 一致（FR5.2） | `cd deep-spec-analysis && bun test tests/conformance.test.ts tests/parity/parity.test.ts tests/ir-validation.test.ts tests/design-verify.test.ts tests/refcheck.test.ts tests/refinement.test.ts tests/refinement-pipeline.test.ts` |
| 7 | in-process の bare specifier 化（FR5.1） | `cd deep-spec-analysis && bun test tests/kernel-domain.test.ts tests/requirements-domain.test.ts tests/design-domain.test.ts tests/refcheck-domain.test.ts tests/refcheck-report.test.ts tests/refcheck-pipeline.test.ts tests/design-pipeline.test.ts tests/verify-smt-pipeline.test.ts tests/verify-quint-pipeline.test.ts tests/aggregate-ids.test.ts tests/kind-rank.test.ts tests/doctor-solver-probe.test.ts` |
| 8 | 型検査（全体） | `cd deep-spec-analysis && bunx tsc --noEmit` |
| 9 | 生成物の drift（テスト外の直接実行） | `cd deep-spec-analysis && bun scripts/build-tools.ts --check` |

## 新規テストの内容（Minimal: 要件ごとに 1 本）

### 1. `tests/package-boundaries.test.ts` — FR1.3 / NFR5

- **happy path**: 宣言済みの層を bare specifier で import した fixture が
  `bunx tsc --noEmit` と実行時解決の両方で通る
- **error 1**: `dependencies` に宣言していない `@deep-spec/*` を import した fixture が
  実行時に解決できず、型検査でも落ちる
- **error 2**: `exports` に無い深いパス（`@deep-spec/kernel-domain/expression.ts`）が
  解決できない
- fixture は一時ディレクトリに書いて `spawnSync` で検査する。`tools/` にも `src/` にも
  テスト用 payload を置かない（`no-test-payloads` 規則）

### 2. `tests/architecture.test.ts` の追加ケース — FR1.5 / FR5.3

- **red example**: `src/kernel/domain/x.ts` から `../../requirements/domain/index.ts` へ
  出る相対 import が `no-cross-package-relative-imports` 違反として検出される
- **green example**: 同一パッケージ内の `./y.ts` は違反にならない
- **red example**: `@deep-spec/requirements-domain` を `kernel/domain` から import する
  （方向違反）が `layer-direction` 違反になる
- **green example**: `@deep-spec/kernel-domain` を `requirements/domain` から import する
  のは通る
- 実ツリー走査（`src/` 全 `.ts`）が違反ゼロ

### 3. `tests/build-tools.test.ts` — FR3.2 / NFR1 / FR3.3 / FR2.1 / NFR4

- **happy path（drift）**: `bun scripts/build-tools.ts --check` が exit 0
- **error（drift 検出）**: `tools/<entry>.js` を 1 バイト書き換えた一時コピーに対して
  `--check` が非ゼロで終了し、差分ファイル名を出す
- **決定論**: 同じソースから一時ディレクトリへ 2 回生成し、10 本すべてが byte 一致
- **出荷形**: `tools/` の中身が `.js` 10 本＋`data/*.json` 4 本ちょうど、
  各 bundle が 300 KB 以下、`.ts` が 0 本
- テスト内で `tools/` を書き換えない（一時ディレクトリで比較する）

### 4. `tests/intent-e2e.test.ts` の tombstone 拡張 — FR4.5

- **happy path**: 新規導入先の `.claude/tools/` が bundle 10 本＋`data/` 4 本になる
- **error/edge 1**: 旧構成（`tools/aidlc-sensor-*.ts` と `tools/kernel/` 等の層
  ディレクトリ）を植えた導入先に installer を再実行すると、旧 `.ts` と層ディレクトリが
  消えて bundle＋`data/` だけになる
- **error/edge 2**: 2 回目の実行が冪等（差分ゼロ、drop ゼロ）
- 既存の `beforeAll` は明示のタイムアウト（`{ timeout: 300_000 }`）を持つこと。
  新しいセットアップを足す場合も同じ扱いにする

## カバレッジ目標

- `bunfig.toml` の `coverageThreshold = 0.9` を維持する（行・関数、domain 層のみ）
- 触った domain ファイルは 100/100 を目標にする。既存の未カバー分が残る場合は
  `main` と比較して退行でないことを示す
- 生成物 `tools/**` は計測から除外する（子プロセス実行で in-process 計測に乗らない。
  実効カバレッジは golden／parity／e2e スイートが担う）
- **閾値・除外の緩和でステップを通さない**。床を割ったらテストを足して埋める

## モック・スタブの方針

- 既存の `tests/doubles/`（in-memory Repository 2 本）を使う。新しいモックライブラリは
  入れない
- 外部プロセス（z3・quint・Apalache・installer）は実行するか、`spawnSync` の呼び出しを
  一時ディレクトリで実射する。挙動を差し替えるスタブは作らない
- bun の `toEqual` は `#private` フィールドを見ない。class 化した値の比較は
  `toDocument()` で平文に射影してから行う

## テストデータの扱い

- golden（`tests/fixtures/*/expected/*.json`）は **更新しない**。差分が出たらそれは退行
- 新規 fixture は一時ディレクトリ（`mkdtemp`）に書き、テスト終了時に消す。
  `tools/` と `src/` にはテスト用 payload を置かない（`no-test-payloads` 規則）
- parity スナップショット（`tests/parity/`）も更新しない。entry パスの `.ts` → `.js`
  変更でスナップショット内容が変わらないことを確認する（スナップショットは entry 名を
  含まない前提。含んでいた場合は停止して報告する）
