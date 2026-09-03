# 横断トレーサビリティ

expressスコープのzero-Unit実装であり、Unit別成果物とUser StoriesのACは存在しない。`construction/code-generation/traceability.json` の全40 IDをRequirementsと照合し、target fileの実在を確認した。

## 判定

**PASS。** 未カバー0件、`GAP`／`ORPHAN` 0件。

## カバレッジ

| ID | Status | Target |
|---|---|---|
| FR1 | OK | `deep-spec-analysis/scripts/install.ts` |
| FR1.1 | OK | `deep-spec-analysis/scripts/install.ts` |
| FR1.2 | OK | `deep-spec-analysis/tests/installer.test.ts` |
| FR1.3 | OK | `deep-spec-analysis/scripts/install.ts` |
| FR1.4 | OK | `deep-spec-analysis/tests/installer.test.ts` |
| FR1.5 | OK | `deep-spec-analysis/tests/installer.test.ts` |
| FR1.6 | OK | `deep-spec-analysis/tests/installer.test.ts` |
| FR2 | OK | `deep-spec-analysis/scripts/install.ts` |
| FR2.1 | OK | `deep-spec-analysis/scripts/install.ts` |
| FR2.2 | OK | `deep-spec-analysis/scripts/install.ts` |
| FR2.3 | OK | `deep-spec-analysis/tests/intent-e2e.test.ts` |
| FR2.4 | OK | `deep-spec-analysis/tests/intent-e2e.test.ts` |
| FR2.5 | OK | `README.md` |
| FR3 | OK | `deep-spec-analysis/scripts/install.ts` |
| FR3.1 | OK | `deep-spec-analysis/scripts/install.ts` |
| FR3.2 | OK | `deep-spec-analysis/scripts/install.ts` |
| FR3.3 | OK | `deep-spec-analysis/tests/installer.test.ts` |
| FR3.4 | OK | `deep-spec-analysis/scripts/install.ts` |
| FR3.5 | OK | `deep-spec-analysis/tests/intent-e2e.test.ts` |
| FR3.6 | OK | `deep-spec-analysis/scripts/install.ts` |
| FR4 | OK | `deep-spec-analysis/src/entries/deep-spec-analysis-doctor.ts` |
| FR4.1 | OK | `deep-spec-analysis/src/doctor/usecase/check-version-advisory-usecase.ts` |
| FR4.2 | OK | `deep-spec-analysis/tests/doctor-version-advisory.test.ts` |
| FR4.3 | OK | `deep-spec-analysis/tests/doctor-version-advisory.test.ts` |
| FR5 | OK | `deep-spec-analysis/scripts/release.ts` |
| FR5.1 | OK | `deep-spec-analysis/tests/release.test.ts` |
| FR5.2 | OK | `deep-spec-analysis/scripts/release.ts` |
| FR5.3 | OK | `deep-spec-analysis/.aidlc-plugin/plugin.json` |
| FR5.4 | OK | `.github/workflows/ci.yml` |
| FR6 | OK | `deep-spec-analysis/tests/intent-e2e.test.ts` |
| FR6.1 | OK | `deep-spec-analysis/tests/intent-e2e.test.ts` |
| FR6.2 | OK | `deep-spec-analysis/tests/installer.test.ts` |
| FR6.3 | OK | `README.ja.md` |
| FR6.4 | OK | `deep-spec-analysis/tests/architecture.test.ts` |
| NFR1 | OK | `deep-spec-analysis/tests/intent-e2e.test.ts` |
| NFR2 | OK | `deep-spec-analysis/tests/intent-e2e.test.ts` |
| NFR3 | OK | `deep-spec-analysis/tests/installer.test.ts` |
| NFR4 | OK | `deep-spec-analysis/tests/installer.test.ts` |
| NFR5 | OK | `deep-spec-analysis/tests/architecture.test.ts` |
| NFR6 | OK | `deep-spec-analysis/scripts/install.ts` |

## 未カバー

None.

