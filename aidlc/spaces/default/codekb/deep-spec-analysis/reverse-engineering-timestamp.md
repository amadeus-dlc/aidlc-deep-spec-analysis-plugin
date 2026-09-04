# deep-spec-analysis — リバースエンジニアリング実施記録

## 実施記録

- **実施日時（UTC）**: 2026-09-04T01:07:03Z
- **git コミット**: `64ab80aeedc9f5fb5820745ceea8382016676268`
- **source snapshot**: `git:3f728096897f31b1f489228f985b6aa433ea865d`
- **intent**: `260904-ddd-clean-architecture`（Brownfield / refactor / Depth: Minimal）
- **scan decision**: Focused scan
- **既存 store verdict**: `UNVERIFIED`（旧 timestamp に再利用可能な fingerprint なし）
- **対象**: project-root の未登録 repo。深掘り対象は `deep-spec-analysis/` 内の Design／Refinement domain、Design 検証 usecase／report repository、共有語彙、最内層 Result、関連アーキテクチャ・pipeline tests、既存裁定文書
- **対象外**: `aidlc-workflows/` submodule、`.claude/`、`sandbox/`、`dist/`、`node_modules/`

## 統合方針

既存 store の本文は配布ライフサイクルと形式検証ランタイム全体の履歴知識として9成果物に保持し、今回の深い解析結果を各成果物の先頭へ追加した。

`UNVERIFIED` 統合規則に従い、`analyzed.paths` と `analyzed.components` は今回の Developer Scan だけから構成した。前回 store の analyzed paths は、今回同じ範囲を再び深く読んだものを除き `shallow.paths` へ降格した。広い directory と、その配下で今回深く読んだ個別 file が併存する場合、directory 行は残りの領域が shallow であることを意味する。

## 検証上の注意

- focused baseline は `bun test tests/architecture.test.ts tests/design-pipeline.test.ts tests/refinement-pipeline.test.ts` が84 pass / 0 fail、`bunx tsc --noEmit` が exit 0。
- production code は変更していない。成果物は設計上の選択肢、推奨、既存裁定との衝突面を記録する。
- `kernel/infrastructure` の最内層配置、Repository の CQS、domain object 種別、公認された Refinement 横断エッジは既存の人間裁定であり、後続ステージで明示的に再裁定しない限り維持する。
- mint command の出力は逐語で `unknown`。今回の個別 path 集合に対して path-scoped fingerprint を算出できなかったためである。

## Scope of Analysis

```yaml
scope_version: 1
kind: partial
intent: 260904-ddd-clean-architecture
fingerprint: unknown
analyzed:
  paths:
    - deep-spec-analysis/src/refinement/domain/package.json
    - deep-spec-analysis/src/refinement/domain/index.ts
    - deep-spec-analysis/src/refinement/domain/refinement-status.ts
    - deep-spec-analysis/src/refinement/domain/refinement-map-defect.ts
    - deep-spec-analysis/src/refinement/domain/unit-refinement-plan.ts
    - deep-spec-analysis/src/refinement/domain/refinement-solver-plan.ts
    - deep-spec-analysis/src/refinement/domain/refinement-materials.ts
    - deep-spec-analysis/src/refinement/domain/refinement-requirements.ts
    - deep-spec-analysis/src/refinement/domain/refinement-quint-invariant.ts
    - deep-spec-analysis/src/refinement/domain/refinement-map.ts
    - deep-spec-analysis/src/design/domain/package.json
    - deep-spec-analysis/src/design/domain/index.ts
    - deep-spec-analysis/src/design/domain/design-report.ts
    - deep-spec-analysis/src/design/domain/design-reports.ts
    - deep-spec-analysis/src/design/domain/design-finding.ts
    - deep-spec-analysis/src/design/domain/design-skipped.ts
    - deep-spec-analysis/src/design/domain/lowered-unit.ts
    - deep-spec-analysis/src/design/usecase/package.json
    - deep-spec-analysis/src/design/usecase/index.ts
    - deep-spec-analysis/src/design/usecase/verify-design-smt-usecase.ts
    - deep-spec-analysis/src/design/usecase/verify-design-quint-usecase.ts
    - deep-spec-analysis/src/design/usecase/port/
    - deep-spec-analysis/src/design/adapter/design-report-repository-impl.ts
    - deep-spec-analysis/src/design/adapter/design-report-serializer.ts
    - deep-spec-analysis/src/entries/data/deep-spec-findings-schema.json
    - deep-spec-analysis/src/kernel/domain/verification-method.ts
    - deep-spec-analysis/src/kernel/domain/finding-kind.ts
    - deep-spec-analysis/src/kernel/infrastructure/
    - deep-spec-analysis/tests/architecture/rules.ts
    - deep-spec-analysis/tests/architecture.test.ts
    - deep-spec-analysis/tests/design-pipeline.test.ts
    - deep-spec-analysis/tests/refinement-pipeline.test.ts
    - deep-spec-analysis/docs/decisions.ja.md
    - deep-spec-analysis/docs/handoffs/71-tda-program.ja.md
  components:
    - Refinement Domain
    - Design Domain
    - Design Verification Use Cases
    - Design Report Repository Adapter
    - Kernel Domain Contracts
    - Kernel Infrastructure Result Foundation
    - Architecture and Pipeline Test Suite
shallow:
  paths:
    - deep-spec-analysis/src/refinement/domain/
    - deep-spec-analysis/src/design/domain/
    - deep-spec-analysis/src/design/adapter/
    - deep-spec-analysis/src/kernel/domain/
    - deep-spec-analysis/tests/
    - deep-spec-analysis/docs/decisions.md
    - deep-spec-analysis/scripts/install.ts
    - deep-spec-analysis/scripts/build-tools.ts
    - deep-spec-analysis/.aidlc-plugin/plugin.json
    - deep-spec-analysis/package.json
    - deep-spec-analysis/bun.lock
    - deep-spec-analysis/bunfig.toml
    - deep-spec-analysis/tsconfig.json
    - deep-spec-analysis/.gitignore
    - deep-spec-analysis/src/design/adapter/package.json
    - deep-spec-analysis/src/doctor/adapter/package.json
    - deep-spec-analysis/src/doctor/domain/package.json
    - deep-spec-analysis/src/doctor/usecase/package.json
    - deep-spec-analysis/src/entries/package.json
    - deep-spec-analysis/src/kernel/adapter/package.json
    - deep-spec-analysis/src/kernel/domain/package.json
    - deep-spec-analysis/src/kernel/usecase/package.json
    - deep-spec-analysis/src/refcheck/adapter/package.json
    - deep-spec-analysis/src/refcheck/domain/package.json
    - deep-spec-analysis/src/refcheck/usecase/package.json
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
    - deep-spec-analysis/tools/
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
