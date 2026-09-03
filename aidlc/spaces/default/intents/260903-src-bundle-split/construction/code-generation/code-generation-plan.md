# Code Generation 実装計画 — tools/ を出荷物（bundle）と src/ に分離する

対象リポジトリ: `deep-spec-analysis/`（ワークスペースルート直下）。Unit 分解は
express スコープで行っていないため、この計画はステージ全体（zero-Unit）を 1 回で
実装する。上流は `../../../inception/requirements-analysis/requirements.md`（FR1〜FR7、
NFR1〜NFR6）。

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "org",
  "ordering": "implement each applicable testable layer, then write and run",
  "scope": "express",
  "test_strategy": "minimal",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    }
  ],
  "obligations": {
    "strategy": "minimal",
    "strategy_volume": [
      "One verifiable test per requirement at the narrowest effective level.",
      "At least one happy-path unit test per component.",
      "Unit tests are the default; a bugfix/security scope floor may require an integration or E2E regression when that is the narrowest level that reproduces the defect."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:c8f84e35190e007d9863fad236154d0269ab9bf633fc2a3ff106ed965ba4a9b9",
  "contract_sha256": "sha256:cf2eef8b9f71187a11438a738813c67aafd28633be2dfb628802e70e19d7e1fd"
}
```

**この契約の適用**: methodology は `test-after`、ordering は「適用可能な各層を実装し、
その層のテストを書いて走らせる」。`plan_profile.steps` を本プロジェクトの層に読み替えて
下の順序を組んだ。読み替えの対応と、当たらない層を落とした理由:

| contract の層 | この計画での読み替え | 備考 |
|---|---|---|
| Project structure and production configuration skeleton | Step 1（src/ パッケージ骨格と workspaces 配線） | |
| Verify the existing test runner ... record the exact command | Step 2（既存 runner の確認とコマンド記録） | 最初のテスト実行より前に置く |
| Data model / database behavior | 該当なし（DB を持たない。契約スキーマは JSON 資産で挙動を持たない） | 落とす |
| Repository / data access | Step 3〜4（層パッケージ化と bare specifier 化＝ソースの移設面）＋ Step 5（そのテスト） | 「データアクセス面」に相当するのは層境界の解決経路 |
| Business logic | Step 6（アーキテクチャ規則の src/ 移行と新規則）＋ Step 7（red/green テスト） | 本プロジェクトの「業務ロジック」は境界を判定する規則群 |
| API / endpoint | Step 8（entry の bundle 生成＝出荷物の公開面）＋ Step 9（drift check と決定論テスト） | 利用先が叩く面 |
| Frontend behavior | 該当なし（UI を持たない） | 落とす |
| Environment/build configuration | Step 10〜13（配布経路・installer・カバレッジ設定）＋ Step 12（そのテスト） | |
| Documentation and traceability | Step 15〜16 | |

methodology は変えていない（各実装ステップの直後にその層のテストステップを置く
test-after のまま）。

## 前提の確認（最初に潰す）

- **A1 の実測**: Step 8 の最初に `bun build` を 2 回走らせて byte 一致を確認する。
  破れた場合は NFR1 の判定方法（`--check` の比較単位）を見直し、人間の裁定にかける。
- **A2 の実測**: Step 1 直後に `bunx tsc --noEmit` が isolated linker 下で
  `exports` と宣言外依存を尊重するかを red example で確認する。

## 実装ステップ

### Step 1. `src/` パッケージ骨格と workspaces 配線 — FR1.1 / FR1.2 / FR1.3 / FR1.4

- [ ] 1.1 `git mv tools src`（468 本の `.ts` と `data/` が履歴を保って移る）
- [ ] 1.2 `mkdir src/entries` し、entry 10 本（`aidlc-sensor-deep-spec-*.ts` 9 本と
      `deep-spec-analysis-doctor.ts`）を `src/entries/` へ `git mv`
- [ ] 1.3 17 層それぞれに `src/<ctx>/<layer>/package.json` を作る。
      `name: "@deep-spec/<ctx>-<layer>"`、`private: true`、
      `"exports": { ".": "./index.ts" }`（深い import を解決不能にする）、
      `type: "module"`
- [ ] 1.4 各層の `dependencies` を `workspace:*` で宣言する。許可辺は
      `tests/architecture/rules.ts` の現行表と一致させる:
      `ALLOWED_LAYER_TARGETS`（infrastructure→infrastructure、domain→domain/infrastructure、
      usecase→usecase/domain/infrastructure、adapter→adapter/usecase/domain/infrastructure）、
      同一コンテキストと `kernel`、`SANCTIONED_CROSS_CONTEXT` の 4 辺
      （`refinement/domain→requirements/domain`、`refinement/domain→design/domain`、
      `design/usecase→refinement/domain`、`design/adapter→refinement/domain`）。
      実際に import している辺だけを宣言する（許可辺の上位集合は宣言しない）
- [ ] 1.5 `src/entries/package.json`（`@deep-spec/entries`）を作り、entry が配線する
      層だけを依存宣言する
- [ ] 1.6 root `package.json` に `"workspaces": ["src/*/*", "src/entries"]` を足す
      （`src/data` は package ではないのでパターンから外れることを確認する）
- [ ] 1.7 `bunfig.toml` に `[install]\nlinker = "isolated"` を足す
- [ ] 1.8 `tsconfig.json` の `include` を `["scripts/**/*.ts", "src/**/*.ts", "tests/**/*.ts"]`
      に変える。入れ子 `node_modules` が既定で除外されることを確認し、されなければ
      `exclude` を明示する（A2）
- [ ] 1.9 `bun install` で `bun.lock` を再生成しコミットする（CI は
      `--frozen-lockfile`）
- [ ] 1.10 `tests/` と `scripts/` が `@deep-spec/*` を解決できるようにする。
      root `package.json` の `dependencies` に必要な層を `workspace:*` で列挙する方式を
      既定とし、解決できない場合のみ `tests` を workspace メンバーにする
      （requirements の未解決事項 1 をここで決める。採った方式を Step 16 で記録する）

### Step 2. テスト runner の確認とコマンド記録 — Testing Contract の runner ステップ

- [ ] 2.1 `cd deep-spec-analysis && bun test` が Step 1 の状態で起動すること（個々の
      失敗は Step 5 まで許容する。runner 自体が動くことの確認）
- [ ] 2.2 このステージのユニットスコープのコマンドを `unit-test-instructions.md` に
      記録済みであることを確認する（新規テストごとの正確なファイルパス指定）

### Step 3. パッケージ間 import を bare specifier に置き換える — FR1.5 / FR1.6

- [ ] 3.1 `src/` 配下の層またぎ・コンテキストまたぎの相対 import をすべて
      `@deep-spec/<ctx>-<layer>` に置き換える（facade 非経由の直接 import 23 本も
      この置き換えで facade 経由に揃う）
- [ ] 3.2 同一パッケージ内の import は相対のまま残す。`index.ts` の再輸出台帳は
      現状どおり（`export *` 禁止）
- [ ] 3.3 `src/entries/*.ts` の層 import も bare specifier にする

### Step 4. テスト側の in-process import を bare specifier に揃える — FR5.1

- [ ] 4.1 in-process テスト（`aggregate-ids` / `kernel-domain` / `requirements-domain` /
      `design-domain` / `refcheck-domain` / `refcheck-report` / `refcheck-pipeline` /
      `design-pipeline` / `verify-smt-pipeline` / `verify-quint-pipeline` / `kind-rank` /
      `doctor-domain` / `doctor-solver-probe` ほか）の `../tools/<ctx>/<layer>/index.ts`
      を `@deep-spec/<ctx>-<layer>` にする
- [ ] 4.2 `tests/doubles/` の 2 本も同様に置き換える

### Step 5. Step 1〜4 のテスト（test-after） — FR1.3 / FR6.1

- [ ] 5.1 `bunx tsc --noEmit` が通ること
- [ ] 5.2 `bun test` の in-process スイートが緑になること（spawn 系は Step 11 まで
      赤でよい。この時点の赤の一覧を記録する）
- [ ] 5.3 **新規テスト（FR1.3・NFR5 の検証、1 本）**: 宣言していない層への bare import が
      解決できないことを固定する。`tests/package-boundaries.test.ts` に、一時的な
      red example（宣言外の `@deep-spec/*` を import する fixture）を `bunx tsc --noEmit`
      と実行時解決の両方で失敗させ、green example が両方通ることを表明する

### Step 6. アーキテクチャ規則を `src/` に移す — FR5.3

- [ ] 6.1 `rules.ts` の `locationOf` を `src/` 基点にする。`src/<ctx>/<layer>/...` を層に、
      `src/entries/<name>.ts` を `entry` に、`src/data/...` を `data` に分類する。
      `ENTRY_FILES` の値を `entries/<name>.ts` 形式に更新する
- [ ] 6.2 `only-sanctioned-imports` に `@deep-spec/*` を許可として足す（それ以外の
      bare specifier は従来どおり違反。`ALLOWED_NPM` は `z3-solver` のまま）
- [ ] 6.3 `layer-direction` を bare specifier の辺でも判定できるようにする
      （`@deep-spec/<ctx>-<layer>` からコンテキストと層を読む）。相対 import の判定は
      同一パッケージ内に限る
- [ ] 6.4 **新規規則 `no-cross-package-relative-imports`**: パッケージディレクトリの
      外へ出る `../` 相対 import を違反にする（FR1.5 の穴を塞ぐ）
- [ ] 6.5 `PUBLISHED_LANGUAGE` の 11 項目の鍵を `src/` 基点のパスに更新する
- [ ] 6.6 `architecture.test.ts` の `walkToolsFiles` を `src/` 走査に変え、
      `node_modules` と isolated linker が各パッケージ直下に作る symlink を除外する。
      `tools/*.js` は走査対象に入れない
- [ ] 6.7 既存 18 規則（`no-data-models-in-domain`、`domain-fields-are-private`、
      `published-language-layers`、`process-only-in-entries`、`no-io-in-pure-layers`、
      `no-entry-imports`、`one-public-type-per-file`、`ports-live-in-port-dir`、
      `commands-return-void` ほか）は挙動を変えずに維持する
- [ ] 6.8 `rules.ts` 冒頭の古い LEGACY コメント（7〜8 行目・16〜21 行目）を除去する（FR5.4）

### Step 7. Step 6 のテスト（test-after） — FR5.3 / FR1.5

- [ ] 7.1 新規規則 `no-cross-package-relative-imports` の red example と green example を
      `architecture.test.ts` に足す（カスタム検査の DoD）
- [ ] 7.2 `layer-direction` の bare specifier 版 red/green example を足す
- [ ] 7.3 実ツリー走査（`src/` 全 `.ts`）が違反ゼロであることを表明する
- [ ] 7.4 `ENTRY_FILES.size === 10` と `PUBLISHED_LANGUAGE` の 11 項目の検査が
      新パスで通ること

### Step 8. bundle 生成器 — FR3.1 / FR2.1 / FR2.2 / FR2.3 / FR3.3 / NFR1 / NFR4

- [ ] 8.1 **A1 の実測**: `bun build --target=bun --external z3-solver --sourcemap=none`
      を同じ entry に 2 回かけ、byte 一致することを確認する（破れたら停止して裁定）
- [ ] 8.2 `scripts/build-tools.ts` を書く。10 本の entry それぞれを
      `bun build --target=bun --external z3-solver --sourcemap=none --outfile tools/<entry>.js`
      で 1 本ずつ生成する（code splitting なし、minify なし）
- [ ] 8.3 同スクリプトが `src/data/*.json` 4 本を `tools/data/` に同期する
- [ ] 8.4 `--check` モード: 一時ディレクトリに再生成し、コミット済み `tools/` と
      比較する。差分があれば差分ファイル名を出して非ゼロ終了する
- [ ] 8.5 生成を実行し、`tools/` を `.js` 10 本＋`data/` 4 本の計 14 ファイルにする
      （旧 `.ts` と層ディレクトリは `git rm`）。生成物として git にコミットする
- [ ] 8.6 bundle が `import.meta.url` 相対で `data/` を解決できることを 1 本の entry で
      手動実行して確認する（FR2.3）

### Step 9. Step 8 のテスト（test-after） — FR3.2 / FR3.3 / NFR1 / NFR4

- [ ] 9.1 **新規テスト（drift guard、1 本）**: `tests/build-tools.test.ts` が
      `scripts/build-tools.ts --check` を spawn し、exit 0 と差分ゼロを表明する
- [ ] 9.2 **新規テスト（決定論、1 本）**: 同一ソースから 2 回生成した bundle が
      byte 一致することを表明する（NFR1）
- [ ] 9.3 **新規テスト（出荷形、1 本）**: `tools/` の内容が `.js` 10 本＋`data/` 4 本
      ちょうどであること、各 bundle が 300 KB 以下であることを表明する（FR2.1・NFR4）
- [ ] 9.4 CI（`.github/workflows/ci.yml`）に `bun scripts/build-tools.ts --check` の
      ステップを typecheck の後に足す

### Step 10. 配布経路の `.ts` 固定パスを `.js` にする — FR4.1〜FR4.4

- [ ] 10.1 `sensors/*.md` 9 本の frontmatter `command` を
      `bun {{HARNESS_DIR}}/tools/<entry>.js` にする
- [ ] 10.2 `tools/doctor/domain/installation-manifest.ts`（移設後は
      `src/doctor/domain/`）を entry `.js` 10 本＋`data/` 4 本＋sensors／knowledge の
      列挙にし、17 本の `index.ts` canary 行を削除する。行順（doctor stdout の凍結順）は
      残った項目について維持する
- [ ] 10.3 entry 内・adapter 内の兄弟 tool 名を `.js` にする:
      `sibling-backend-client-impl.ts` の兄弟 entry 名、design-verify-smt entry の
      `childHostPath`（`--smt-child` 自己再起動）、`doctor-workspace-client-impl.ts` の
      refcheck tool 名。可能なものは entry からの注入に寄せる（`process-only-in-entries`）
- [ ] 10.4 `stages/construction/deep-spec-analysis-functional-verify.md` の refcheck 3 本の
      コマンド例、`stages/inception/deep-spec-analysis-verify.md`、
      `knowledge/aidlc-product-agent/deep-spec-ir-authoring.md`（`data/` 参照は不変）、
      `scripts/smt-stress.ts` の entry パスを更新する
- [ ] 10.5 `README.md`／`README.ja.md` の構成表を新しい形（`src/` がソース、`tools/` が
      出荷物）に書き換える。`tests/README.md`／`README.ja.md` の経路説明も更新する

### Step 11. spawn 系テストの対象を出荷物にする — FR5.2 / FR5.5

- [ ] 11.1 entry を spawn するテスト（`conformance` / `parity/snapshot.ts` /
      `ir-validation` / `design-verify` / `refcheck` / `refinement` /
      `refinement-pipeline`）の entry パスを `tools/<entry>.js` にする
- [ ] 11.2 `tests/doctor-domain.test.ts` の manifest 期待値を新構成に合わせる
- [ ] 11.3 `tests/intent-e2e.test.ts` の compose 検査リスト（entry 3 本＋canary 17 本）を
      bundle＋`data/` の構成に合わせる
- [ ] 11.4 `tests/plugin.test.ts` の projection 期待値を確認・更新する
- [ ] 11.5 golden（`tests/fixtures/*/expected/*.json`）と parity スナップショットが
      byte 同一のまま緑であることを確認する（**golden は更新しない**。差分が出たら
      それは退行であり、停止して原因を特定する）

### Step 12. installer の tombstone をディレクトリ単位に拡張 — FR4.5

- [ ] 12.1 `scripts/install.ts` の `REMOVED_PAYLOADS` を、ファイルとディレクトリの
      両方を扱える形にする（ディレクトリは `rmSync(..., { recursive: true, force: true })`）
- [ ] 12.2 旧 entry 10 本（`tools/aidlc-sensor-deep-spec-*.ts` 9 本と
      `tools/deep-spec-analysis-doctor.ts`）と 6 コンテキストのディレクトリ
      （`tools/{kernel,requirements,design,refinement,refcheck,doctor}/`）を登録する。
      既存の 4 項目は残す
- [ ] 12.3 **新規テスト（tombstone、1 本）**: `tests/intent-e2e.test.ts` の tombstone 検査を
      拡張し、旧構成（層ディレクトリと `.ts` entry）を植えた導入先に installer を
      再実行すると `tools/` が bundle 10 本＋`data/` だけになることを表明する

### Step 13. カバレッジと除外設定 — FR5.4

- [ ] 13.1 `bunfig.toml` の `coveragePathIgnorePatterns` を `src/` 起点に書き換える
      （`tools/aidlc-sensor-*.ts` → `src/entries/**`、各層パターンも `src/` 起点）
- [ ] 13.2 存在しない除外 2 件（`tools/deep-spec-lib.ts`、
      `tools/deep-spec-refinement-lib.ts`）を除去する
- [ ] 13.3 生成物 `tools/**` をカバレッジ計測から除外する
- [ ] 13.4 domain 層の床 0.9（行・関数）が維持されることを確認する。**床は下げない**

### Step 14. 全体検証 — FR6.1

- [ ] 14.1 `bun install --frozen-lockfile`
- [ ] 14.2 `bunx tsc --noEmit`
- [ ] 14.3 `bun test --coverage`（既存 480 テスト＋新規が緑、床 0.9 維持）
- [ ] 14.4 `bun ../aidlc-workflows/core/tools/aidlc-plugin-validate.ts .` が VALID
- [ ] 14.5 7 ハーネス分の `aidlc-plugin-build.ts` が成功し、`dist/claude/tools` が
      14 ファイルになること

### Step 15. 実サンドボックスでの実射 — FR6.2

- [ ] 15.1 `bun scripts/install.ts --project ../deep-spec-analysis-sandbox` を実行し、
      `.claude/tools/` が bundle 10 本＋`data/` だけになる（旧 `.ts` が消える）ことを
      確認する
- [ ] 15.2 実ディスパッチャ経由でセンサーを実射し（`260829-feature` fixture）、
      ir-valid pass／SMT findings 5／Quint findings 2 が 2.7.1 検証時と一致すること
- [ ] 15.3 `doctor` の checks が全 pass であること
- [ ] 15.4 `bun ../aidlc-workflows/core/tools/aidlc-plugin-test.ts deep-spec-analysis --install ../deep-spec-analysis-sandbox`
      が `Plugin test: CLEAN` かつ `Changed files (0) / Drops: 0 / Idempotent second compose: true`

### Step 16. 記録 — FR7.1 / FR7.2

- [ ] 16.1 `docs/decisions.md` と `docs/decisions.ja.md` に「tools/ は生成物、src/ が
      ソース」への配布モデル変更を段落として足す（同 PR 表記、PR 番号は書かない）。
      Step 1.10 で採った tests／scripts の解決方式もここに記録する
- [ ] 16.2 `aidlc/spaces/default/knowledge/aidlc-shared/aidlc-engine-operations.md` の
      「インストール先の後入れアップグレード」節と、同ディレクトリ `README.md` の
      構成表を新しい出荷形に更新する
- [ ] 16.3 `code-summary.md`・`source-manifest.json`・`traceability.json` を書く

## 要件との対応（トレーサビリティ）

| 要件 | 実装ステップ | テストステップ |
|---|---|---|
| FR1.1 / FR1.2 / FR1.4 | 1.3 / 1.4 / 1.5 | 5.1 / 7.3 |
| FR1.3 | 1.6 / 1.7 / 1.9 | 5.3 |
| FR1.5 | 3.1 / 3.3 / 6.4 | 7.1 |
| FR1.6 | 3.2 | 7.3 |
| FR2.1 / FR2.2 | 8.2 / 8.5 | 9.3 |
| FR2.3 | 8.3 / 8.6 | 11.5 |
| FR2.4 | 10.3 | 11.1 |
| FR3.1 / FR3.2 | 8.2 / 8.4 / 9.4 | 9.1 |
| FR3.3 | 8.1 | 9.2 |
| FR4.1 | 10.1 | 11.4 |
| FR4.2 | 10.2 | 11.2 |
| FR4.3 | 10.3 | 11.1 |
| FR4.4 | 10.4 / 10.5 | 14.4 |
| FR4.5 | 12.1 / 12.2 | 12.3 |
| FR5.1 | 4.1 / 4.2 | 5.2 |
| FR5.2 | 11.1 | 11.5 |
| FR5.3 | 6.1〜6.7 | 7.1 / 7.2 / 7.3 / 7.4 |
| FR5.4 | 6.8 / 13.1 / 13.2 / 13.3 | 13.4 |
| FR5.5 | 11.2 / 11.3 | 14.3 |
| FR6.1 | — | 14.1〜14.5 |
| FR6.2 | — | 15.1〜15.4 |
| FR7.1 / FR7.2 | 16.1 / 16.2 | — |
| NFR1 | 8.1 / 8.4 | 9.2 |
| NFR2 | 10.2（唯一の例外） | 11.5 |
| NFR3 | 8.2 | 14.3 |
| NFR4 | 8.2 | 9.3 |
| NFR5 | 1.6 / 1.7 / 6.4 | 5.3 / 7.1 |
| NFR6 | 1.3 / 1.4 | 16.1 |

## 新規テストの一覧（Minimal 戦略: 要件ごとに 1 本）

| # | ファイル | 検証する要件 |
|---|---|---|
| 1 | `tests/package-boundaries.test.ts` | FR1.3 / NFR5（宣言外の層が型検査・実行時とも解決不能） |
| 2 | `tests/architecture.test.ts`（追加ケース） | FR1.5（パッケージ外への相対 import の red/green） |
| 3 | `tests/architecture.test.ts`（追加ケース） | FR5.3（bare specifier での layer-direction の red/green） |
| 4 | `tests/build-tools.test.ts`（drift） | FR3.2（`--check` が差分ゼロ） |
| 5 | `tests/build-tools.test.ts`（決定論） | NFR1 / FR3.3（2 回生成で byte 一致） |
| 6 | `tests/build-tools.test.ts`（出荷形） | FR2.1 / NFR4（14 ファイル・1 本 300 KB 以下） |
| 7 | `tests/intent-e2e.test.ts`（tombstone 拡張） | FR4.5（旧構成が再導入で消える） |

既存 480 テストは緑のまま維持する。golden とスナップショットは更新しない。

## 品質目標（下げない）

- domain 層のカバレッジ床 0.9（行・関数、`bunfig.toml`）
- 既存アーキテクチャ規則 18 本すべて維持
- golden 4 種と parity スナップショットの byte 一致
- 外部仕様（IR・findings JSON・refcheck レポート・doctor 出力・verdict 行・exit code）は
  不変。唯一の例外は doctor の installed 行のファイル名（FR4.2、裁定済み）

これらは入力であって提案ではない。ステップを通すために閾値・除外・golden を
緩めることはしない。詰まったら差分を報告して止める。
