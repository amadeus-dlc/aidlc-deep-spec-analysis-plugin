## Developer Code Scan Results

### Scan Coverage

- **Analyzed deeply**:
  - `deep-spec-analysis/scripts/install.ts`
  - `deep-spec-analysis/scripts/build-tools.ts`
  - `deep-spec-analysis/.aidlc-plugin/plugin.json`
  - `deep-spec-analysis/package.json`
  - `deep-spec-analysis/bun.lock`（workspace と固定依存の宣言部分）
  - `deep-spec-analysis/bunfig.toml`
  - `deep-spec-analysis/tsconfig.json`
  - `deep-spec-analysis/.gitignore`
  - `deep-spec-analysis/src/design/adapter/package.json`
  - `deep-spec-analysis/src/design/domain/package.json`
  - `deep-spec-analysis/src/design/usecase/package.json`
  - `deep-spec-analysis/src/doctor/adapter/package.json`
  - `deep-spec-analysis/src/doctor/domain/package.json`
  - `deep-spec-analysis/src/doctor/usecase/package.json`
  - `deep-spec-analysis/src/entries/package.json`
  - `deep-spec-analysis/src/kernel/adapter/package.json`
  - `deep-spec-analysis/src/kernel/domain/package.json`
  - `deep-spec-analysis/src/kernel/infrastructure/package.json`
  - `deep-spec-analysis/src/kernel/usecase/package.json`
  - `deep-spec-analysis/src/refcheck/adapter/package.json`
  - `deep-spec-analysis/src/refcheck/domain/package.json`
  - `deep-spec-analysis/src/refcheck/usecase/package.json`
  - `deep-spec-analysis/src/refinement/domain/package.json`
  - `deep-spec-analysis/src/requirements/adapter/package.json`
  - `deep-spec-analysis/src/requirements/domain/package.json`
  - `deep-spec-analysis/src/requirements/usecase/package.json`
  - `deep-spec-analysis/src/entries/deep-spec-analysis-doctor.ts`
  - `deep-spec-analysis/src/doctor/domain/installation-manifest.ts`
  - `deep-spec-analysis/src/doctor/domain/installed-status.ts`
  - `deep-spec-analysis/src/doctor/domain/manifest-entry.ts`
  - `deep-spec-analysis/src/doctor/domain/check.ts`
  - `deep-spec-analysis/src/doctor/domain/check-severity.ts`
  - `deep-spec-analysis/src/doctor/domain/health-verdict.ts`
  - `deep-spec-analysis/src/doctor/usecase/check-installation-usecase.ts`
  - `deep-spec-analysis/src/doctor/usecase/port/harness-file-client.ts`
  - `deep-spec-analysis/src/doctor/adapter/harness-file-client-impl.ts`
  - `deep-spec-analysis/src/doctor/adapter/doctor-presenter.ts`
  - `deep-spec-analysis/tests/intent-e2e.test.ts`（installer setup、初回導入、upgrade refresh、tombstone、冪等性の各節）
  - `deep-spec-analysis/tests/plugin.test.ts`
  - `deep-spec-analysis/tests/doctor-domain.test.ts`（installation manifest、公開 JSON、presenter の各節）
  - `deep-spec-analysis/tests/package.json`
  - `deep-spec-analysis/tests/README.ja.md`
  - `.github/workflows/ci.yml`
  - `.gitmodules`
  - `mise.toml`
  - `renovate.json`
  - `README.ja.md`（導入・開発・リポジトリ構成の各節）
  - `deep-spec-analysis/README.ja.md`
- **Skimmed only**:
  - `deep-spec-analysis/src/kernel/`（境界づけられたコンテキストと package 依存の把握のみ）
  - `deep-spec-analysis/src/requirements/`（境界づけられたコンテキストと package 依存の把握のみ）
  - `deep-spec-analysis/src/design/`（境界づけられたコンテキストと package 依存の把握のみ）
  - `deep-spec-analysis/src/refinement/`（境界づけられたコンテキストと package 依存の把握のみ）
  - `deep-spec-analysis/src/refcheck/`（境界づけられたコンテキストと package 依存の把握のみ）
  - `deep-spec-analysis/src/doctor/` のうち上記にないカバレッジ・構造負債・solver 関連実装
  - `deep-spec-analysis/tests/` のうち上記にない conformance、architecture、parity、solver 関連スイート
  - `deep-spec-analysis/stages/`（出荷物の構成と件数の把握のみ）
  - `deep-spec-analysis/sensors/`（出荷物の構成と件数の把握のみ）
  - `deep-spec-analysis/knowledge/`（出荷物の構成と件数の把握のみ）
  - `deep-spec-analysis/contributions/`（出荷物の構成と件数の把握のみ）
  - `deep-spec-analysis/docs/decisions.ja.md`（installer refresh、tombstone、14-file bundle の判断箇所のみ）
  - `deep-spec-analysis/docs/` のその他の文書
- **Not scanned by instruction**: `aidlc-workflows/`、`.claude/`、`sandbox/`、`deep-spec-analysis-sandbox/`、`deep-spec-analysis/dist/`、`node_modules/`。既存 Code KB は `UNVERIFIED` のため、この handoff には統合していない。

### Packages Found

- `deep-spec-analysis-plugin-dev` — private Bun workspace root — TypeScript — 開発・型検査・テスト用。npm 公開対象ではない（`deep-spec-analysis/package.json:1-15`）。
- `@deep-spec/{kernel,requirements,design,refcheck,doctor}-{domain,usecase,adapter}`、`@deep-spec/kernel-infrastructure`、`@deep-spec/refinement-domain` — 17 private workspace packages — TypeScript/ESM — 検証・doctor の境界づけられたコンテキスト。
- `@deep-spec/entries` — private workspace package — TypeScript/ESM — センサー 9 本と doctor の合成ルート。全内部 package を束ねる。
- `@deep-spec/tests` — private workspace package — Bun Test — unit、architecture、conformance、intent integration のテスト群。
- AIDLC plugin authored root — `.aidlc-plugin/`、`stages/`、`contributions/`、`sensors/`、`knowledge/`、`tools/` — installer が build/compose する配布元。manifest version は `0.5.0`（`deep-spec-analysis/.aidlc-plugin/plugin.json:1-18`）。

### Build System

- **Type**: Bun workspaces + TypeScript strict mode。ローカル/CI は Bun `1.3.13`、Node `24`（`mise.toml:1-6`、`.github/workflows/ci.yml:21-29`）。
- **Config Files**: `deep-spec-analysis/package.json`、`deep-spec-analysis/bun.lock`、`deep-spec-analysis/bunfig.toml`、`deep-spec-analysis/tsconfig.json`、`mise.toml`、`.github/workflows/ci.yml`、`renovate.json`。
- **Build Dependencies**: `src/entries/*.ts` → workspace packages → `scripts/build-tools.ts` → committed `tools/*.ts` bundle 10 本 + `tools/data/*.json` 4 本。生成器は `--target=bun --external z3-solver --sourcemap=none`、固定 cwd で byte 決定性を守る（`deep-spec-analysis/scripts/build-tools.ts:3-27,42-48,116-160`）。plugin projection は現状、sibling `aidlc-workflows/core/tools/aidlc-plugin-build.ts` に依存する（`deep-spec-analysis/scripts/install.ts:75-98,121-131`）。
- **External pinned dependencies**: `@informalsystems/quint 0.32.0`、`z3-solver 5.2.0`、`@types/bun 1.4.0`、`typescript 7.0.2`（`deep-spec-analysis/package.json:10-15`）。いずれも開発用で、bootstrap installer が利用先へ npm package を導入する構成ではない。

### APIs Discovered

- CLI — `scripts/install.ts` — 現行契約は `--project <path>` 必須、`--harness <name>`、`--dry-run`、`--skip-build`、`--help`。未知の引数は即失敗する（`deep-spec-analysis/scripts/install.ts:19-71`）。`--from`、`--ref`、`--tag`、`--update` は未実装。
- CLI integration — installer → plugin build/test/compose — 現行は build と dry-run の双方で source checkout 側の `aidlc-workflows/core/tools` を使い、compose は `aidlc plugin sync`、無ければ projection の `hooks/compose.ts` を実行する（`deep-spec-analysis/scripts/install.ts:75-98,125-145,270-287`）。意図する `<project>/<harness>/tools/aidlc-plugin-build.ts` 利用とは未接続。
- Filesystem contract — upgrade refresh/tombstone — 現行 dist と同名の plugin-owned payload のみを削除し、廃止済みファイル/ディレクトリは明示 tombstone で再帰削除してから no-clobber compose する（`deep-spec-analysis/scripts/install.ts:149-257`）。この順序と所有境界は新 source resolver 後も保存対象。
- Filesystem contract — install provenance — `<harness>/tools/data/deep-spec-analysis-install.json` の reader/writer、schema、atomic write は存在しない。現行の `tools/data` 出荷物は契約 schema 4 本だけ（`deep-spec-analysis/scripts/build-tools.ts:99-112,150-157`）。
- Doctor plugin API — stdout は `{"checks":[{"pass","label","fix?","severity"}]}` の単一 JSON。現行 entry は同期的な 5 ブロックを凍結順で合成する（`deep-spec-analysis/src/entries/deep-spec-analysis-doctor.ts:1-11,30-65`）。`Check` の公開形に `skip`/`status` はなく `pass: boolean` のみ（`deep-spec-analysis/src/doctor/domain/check.ts:39-41`）。
- Release CLI — `scripts/release.ts` は存在せず、`git tag --list` も空。CI に tag push trigger や manifest/tag consistency check はない（`.github/workflows/ci.yml:1-52`）。HTTP/REST endpoint、DB model は本 intent の対象コードにはない。

### Frameworks & Libraries

- Bun `1.3.13` — runtime、workspace、bundler、test runner。
- Node `24` — z3 child process runtime。
- TypeScript `7.0.2` — strict/noUnused の型検査（`deep-spec-analysis/tsconfig.json:2-16`）。
- Bun Test — 24 個の `*.test.ts` ファイル。Jest/Vitest 等の追加 test framework はない。
- GitHub Actions — typecheck、bundle drift、coverage、plugin validate、7 harness build。現状 `actions/checkout@v5` は `submodules: true`（`.github/workflows/ci.yml:16-19`）。
- AIDLC plugin mechanism — `.aidlc-plugin/plugin.json` の `contributes` から stages/overlays/sensors/knowledge/tools を projection/compose する（`deep-spec-analysis/.aidlc-plugin/plugin.json:8-18`）。

### Test Coverage

- **Test Directories**: `deep-spec-analysis/tests/`（24 test files）、`deep-spec-analysis/tests/fixtures/`、`deep-spec-analysis/tests/parity/`、`deep-spec-analysis/tests/architecture/`。
- **Test Frameworks**: Bun Test、子プロセス経由の CLI/integration tests、byte-exact golden、architecture rules。
- **Coverage Config**: present。`bunfig.toml` は domain 層の line/function `0.9` floor を設定し、scripts、entries、adapter/usecase 等を除外する（`deep-spec-analysis/bunfig.toml:1-35`）。本 scan ではテストを実行していない。
- 現行 intent E2E は vanilla AI-DLC dist を submodule からコピーし、installer の初回 compose を検証するため、テスト自体も submodule 必須（`deep-spec-analysis/tests/intent-e2e.test.ts:35-40,117-169`）。upgrade 回帰は stale schema refresh、file/directory tombstone、再実行後の payload byte 不変を検証する（同 `:688-786`）。source selection、remote archive、provenance、same-version `--update` no-op、network failure、release/tag consistency の検査はない。
- `plugin.test.ts` は `AIDLC_WORKFLOWS_CHECKOUT` または sibling submodule がない場合に skip する（`deep-spec-analysis/tests/plugin.test.ts:15-38`）。CI の VALID/CLEAN 受け入れ条件を維持するには、新 installer E2E と既存 framework validator/test の責務を分離して残す必要がある。

### Code Quality Indicators

- **Linting**: ESLint/Prettier/Biome 設定は見つからない。代わりに TypeScript `strict`、`noUnusedLocals`、`noUnusedParameters` と architecture test が品質ゲート（`deep-spec-analysis/tsconfig.json:2-16`）。
- **CI/CD**: `.github/workflows/ci.yml` の単一 CI workflow。main push/PR のみを trigger とし、typecheck → generated tools drift → `bun test --coverage` → plugin validate → 7 harness build を行う（`:3-52`）。release workflow はない。
- **Documentation**: root/plugin/test の英日 README と decisions がある。現行 Quickstart は `git clone --recurse-submodules` を要求し、再実行を upgrade path と説明する（`README.ja.md:19-37`）。plugin README の build 手順も `<checkout>/core/tools` 前提（`deep-spec-analysis/README.ja.md:41-47`）で、tag bootstrap/`--update`/provenance の利用契約は未記載。

### Technical Debt Signals

- `scripts/install.ts` は 346 行の単一実行スクリプトで、argument parse、workspace/target 解決、build、refresh、tombstone、compose、verify、doctor 表示を一体化している。source resolution と provenance を直接追加すると責務と失敗時状態がさらに絡む。特に `pluginRoot = dirname(import.meta.dir)` はファイル checkout 実行を前提としており、`curl ... | bun -` では取得済み plugin source の場所を表せない（`deep-spec-analysis/scripts/install.ts:73-83`）。
- submodule 依存は builder だけではない。harness→leaf/kind の `plugin-targets.json` と `--dry-run` の `aidlc-plugin-test.ts` も source checkout 側から読む（`deep-spec-analysis/scripts/install.ts:85-108,133-145`）。導入先 toolchain への切替では、この 3 契約をまとめて解決する必要がある。
- 現行 installer は build 完了後に refresh を始めるため source/build failure では導入先を変えないが、refresh 後の compose failure には rollback がない（`deep-spec-analysis/scripts/install.ts:121-131,149-287`）。remote source を加えても「取得・検証・build 完了前は target を変更しない」境界を崩さないこと。
- provenance の `payload_sha256` は対象集合と正準化方式が未定義。archive bytes ではなく、compose 対象 payload の相対パス + content digest を正準順で hash しないと harness 間/再取得間の比較が不安定になる。`installed_at` を持つため、same-version `--update` は provenance を書き直す前に no-op しなければ Changed 0 を満たせない。
- source precedence `--from > --ref > --tag > latest` は、競合 flag を許して上位を採るのか、複数指定を入力エラーにするのか未確定。`--from` が repo root と plugin root のどちらを受けるか、`--ref` の slash、semver prerelease、GitHub tags API pagination、HTTP timeout も契約化が必要。
- `--update` の意味が source 種別ごとに未確定。local `--from`、mutable branch `--ref`、fixed `--tag` に対して「記録 source を再解決」と「最新 tag と比較」のどちらを優先するかを分けないと、来歴と取得物が一致しない。
- doctor の current/public JSON に skip 状態がないため、「ネット不可は skip」を新しい JSON field で表すと host contract を変更する。互換的には advisory row を `pass: true` とし label に skip 理由を閉じる等の明示判断が必要。さらに entry は 5 usecase の順序を凍結しているため、version status をどこへ挿入するかもテスト更新を伴う（`deep-spec-analysis/src/entries/deep-spec-analysis-doctor.ts:9-11,45-64`、`deep-spec-analysis/src/doctor/adapter/doctor-presenter.ts:5-9`）。
- release の「version bump → tag → push」だけでは、未 commit の manifest 変更を tag が指せない。自動 release なら clean tree/branch 検査 → manifest 更新 → commit → `v<version>` tag → commit/tag push の transaction と失敗時案内が必要。CI は現在 tag push を受けないため、tag consistency check は `on.push.tags` と tag ref 条件を足さなければ実行されない（`.github/workflows/ci.yml:3-7`）。
- archive 展開を外部 `tar`/`unzip` に依存させると、README の「必須 runtime は bun のみ」と衝突する（`deep-spec-analysis/README.ja.md:26-39`）。bootstrap の raw URL を `main` に固定するか tag に固定するかも supply-chain/trust の差になる。mutable `--ref` は開発用途として provenance に明示し、既定の tag 経路と混同しないこと。

### Active Intent Gap / Impact

| 領域 | 現行 | active intent との差分・影響 |
|---|---|---|
| source | 実行中 checkout の `deep-spec-analysis/` 固定 | local/branch/tag/latest の resolver、temp lifecycle、archive extraction、manifest/version 検証が必要 |
| toolchain | sibling submodule の build/test/target data | 導入先 harness の build/test/target data へ移す。harness leaf を見つける bootstrap 規則が必要 |
| upgrade | installer 再実行で常に refresh/compose | `--update` は provenance を読んで same-version no-op、更新時だけ既存 refresh/tombstone/compose を再利用 |
| provenance | なし | 成功後の atomic write、schema/version、source 種別、selected ref、canonical payload digest が必要。出荷 `contributes.tools` と tombstone から除外 |
| doctor | installation/solver/coverage/debt の 5 blocks | provenance vs latest tag advisory を別 block として追加。offline skip の既存 JSON への写像が必要 |
| release | version `0.5.0` のみ、tag/release script なし | commit を含む release transaction、`v0.5.0` tag、CI tag trigger と manifest/tag equality check が必要 |
| tests/docs | checkout/submodule 前提の E2E と Quickstart | `--from` fixture、source resolver unit tests、same-version `--update` Changed 0、offline/error tests、tag bootstrap README へ更新。既存 14-file/golden/architecture assertions は保持 |

## Handoff Summary

- **Intent-relevant finding**: 現行 installer の checkout 依存は `aidlc-plugin-build.ts` だけでなく、`plugin-targets.json` と `aidlc-plugin-test.ts` にも及ぶ（`deep-spec-analysis/scripts/install.ts:75-108,121-145`）。しかも source root を `import.meta.dir` から導出するため、予定する stdin bootstrap と取得済み source root を分離する seam がない（同 `:73-83`）。最小の安全な分解は、(1) CLI/options、(2) source resolver、(3) destination toolchain resolver、(4) build済み projection に対する既存 refresh/tombstone/compose、(5) provenance/update、の順である。
- **Risks / follow-up**: architect は、flag 競合、`--from` path shape、source 種別別の update policy、semver/prerelease/pagination、archive 展開 runtime、provenance hash/atomicity、doctor offline skip 表現、release commit/tag transaction を contract として固定する必要がある。CI の submodule は開発時 validate/build 用として残せるが、installer runtime と新 E2E の `--from`/`--update` 経路は submodule 不要であることを別に証明する。既存 refresh/tombstone の所有境界（`deep-spec-analysis/scripts/install.ts:149-257`）、14-file 出荷形（`deep-spec-analysis/scripts/build-tools.ts:3-13`）、doctor JSON shape（`deep-spec-analysis/src/doctor/domain/check.ts:39-41`）は破壊しない。
