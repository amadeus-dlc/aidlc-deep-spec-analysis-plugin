# deep-spec-analysis — リバースエンジニアリング実施記録

## 実施記録

- **実施日時（UTC）**: 2026-09-03T13:54:05Z
- **git コミット**: `4758cbfa35a2b9a7c49a787be96ca593cad254b9`
- **intent**: `260903-installer-tag-update`（Brownfield / express / Depth: Minimal / Test Strategy: Minimal）
- **scan decision**: Focused scan
- **既存 store verdict**: `UNVERIFIED`（fingerprint 未記録）
- **対象**: project-root の未登録 repo。深掘り対象は `deep-spec-analysis/` の installer、build、manifest、workspace package 宣言、doctor installation path、installer/doctor tests、release/CI/docs 周辺
- **対象外**: `aidlc-workflows/`、`.claude/`、`sandbox/`、`deep-spec-analysis-sandbox/`、`deep-spec-analysis/dist/`、`node_modules/`

## 統合方針

前回 store の本文は、形式検証ランタイム全体の履歴知識として9成果物に保持した。今回の scan で確認した領域は各成果物の `Focused scan 更新` と component inventory の先頭へ追加し、前回の全体数値・構造は未再検証であることを明示した。

`UNVERIFIED` 統合規則に従い、`analyzed.paths` と `analyzed.components` は今回の Developer Scan だけから構成した。前回 store の広い deep coverage は再検証できないため、今回改めて同一ファイルを深く読んだものを除き `shallow.paths` へ降格した。広いディレクトリと、その中で今回深く読んだ個別ファイルが併存する場合、ディレクトリ行は「残りの領域は shallow」、個別ファイル行は verified deep を意味する。

## 検証上の注意

- 今回はテスト・typecheck・network probe を実行していない。前回 store にある pass 数・coverage・ファイル数は現行値として再検証していない。
- source resolver、install provenance、`--update`、version advisory、`scripts/release.ts`、tag consistency CI は未実装であり、成果物では目標または未確定契約として記載した。
- mint command の出力は逐語で `unknown`。この workspace の path-scoped fingerprint が今回の個別ファイル集合を計算できなかったためである。

## Scope of Analysis

```yaml
scope_version: 1
kind: partial
intent: 260903-installer-tag-update
fingerprint: unknown
analyzed:
  paths:
    - deep-spec-analysis/scripts/install.ts
    - deep-spec-analysis/scripts/build-tools.ts
    - deep-spec-analysis/.aidlc-plugin/plugin.json
    - deep-spec-analysis/package.json
    - deep-spec-analysis/bun.lock
    - deep-spec-analysis/bunfig.toml
    - deep-spec-analysis/tsconfig.json
    - deep-spec-analysis/.gitignore
    - deep-spec-analysis/src/design/adapter/package.json
    - deep-spec-analysis/src/design/domain/package.json
    - deep-spec-analysis/src/design/usecase/package.json
    - deep-spec-analysis/src/doctor/adapter/package.json
    - deep-spec-analysis/src/doctor/domain/package.json
    - deep-spec-analysis/src/doctor/usecase/package.json
    - deep-spec-analysis/src/entries/package.json
    - deep-spec-analysis/src/kernel/adapter/package.json
    - deep-spec-analysis/src/kernel/domain/package.json
    - deep-spec-analysis/src/kernel/infrastructure/package.json
    - deep-spec-analysis/src/kernel/usecase/package.json
    - deep-spec-analysis/src/refcheck/adapter/package.json
    - deep-spec-analysis/src/refcheck/domain/package.json
    - deep-spec-analysis/src/refcheck/usecase/package.json
    - deep-spec-analysis/src/refinement/domain/package.json
    - deep-spec-analysis/src/requirements/adapter/package.json
    - deep-spec-analysis/src/requirements/domain/package.json
    - deep-spec-analysis/src/requirements/usecase/package.json
    - deep-spec-analysis/src/entries/deep-spec-analysis-doctor.ts
    - deep-spec-analysis/src/doctor/domain/installation-manifest.ts
    - deep-spec-analysis/src/doctor/domain/installed-status.ts
    - deep-spec-analysis/src/doctor/domain/manifest-entry.ts
    - deep-spec-analysis/src/doctor/domain/check.ts
    - deep-spec-analysis/src/doctor/domain/check-severity.ts
    - deep-spec-analysis/src/doctor/domain/health-verdict.ts
    - deep-spec-analysis/src/doctor/usecase/check-installation-usecase.ts
    - deep-spec-analysis/src/doctor/usecase/port/harness-file-client.ts
    - deep-spec-analysis/src/doctor/adapter/harness-file-client-impl.ts
    - deep-spec-analysis/src/doctor/adapter/doctor-presenter.ts
    - deep-spec-analysis/tests/intent-e2e.test.ts
    - deep-spec-analysis/tests/plugin.test.ts
    - deep-spec-analysis/tests/doctor-domain.test.ts
    - deep-spec-analysis/tests/package.json
    - deep-spec-analysis/tests/README.ja.md
    - .github/workflows/ci.yml
    - .gitmodules
    - mise.toml
    - renovate.json
    - README.ja.md
    - deep-spec-analysis/README.ja.md
  components:
    - Installer CLI / Transaction
    - Tool Bundle Builder
    - Plugin Manifest / Version
    - Doctor Installation Status
    - Installer / Doctor Test Suites
    - CI / Release Gate
    - Runtime / Workspace Configuration
    - Installation Documentation
shallow:
  paths:
    - deep-spec-analysis/tools/
    - deep-spec-analysis/tests/
    - deep-spec-analysis/scripts/
    - deep-spec-analysis/sensors/
    - deep-spec-analysis/knowledge/
    - deep-spec-analysis/stages/
    - deep-spec-analysis/contributions/
    - deep-spec-analysis/docs/
    - deep-spec-analysis/README.md
    - deep-spec-analysis/src/kernel/
    - deep-spec-analysis/src/requirements/
    - deep-spec-analysis/src/design/
    - deep-spec-analysis/src/refinement/
    - deep-spec-analysis/src/refcheck/
    - deep-spec-analysis/src/doctor/
    - aidlc/spaces/default/knowledge/aidlc-shared/
    - aidlc-workflows/core/tools/aidlc-plugin-build.ts
    - aidlc-workflows/core/tools/aidlc-plugin-validate.ts
```
