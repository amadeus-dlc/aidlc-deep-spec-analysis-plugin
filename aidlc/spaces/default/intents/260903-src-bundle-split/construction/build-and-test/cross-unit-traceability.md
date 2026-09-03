# 横断トレーサビリティ（ステージゲート）

`requirements.md` の全 FR・NFR が、Code Generation の
`construction/code-generation/traceability.json` で覆われているかを検査した。
express スコープは Units Generation と User Stories を SKIP しているので、Unit は 0、
AC も存在しない。Unit ごとの `traceability.json` は無く、ステージレベルの 1 本だけが対象。

## 判定

**PASS。** 列挙した 33 件（FR サブ要件 27・NFR 6）すべてが覆われており、未カバーは 0。
`OK` の target ファイルはすべて実在を確認した。

## 列挙の範囲

| 種別 | 件数 | 出典 |
|---|---|---|
| FR サブ要件（`FR<n>.<m>`） | 27 | `inception/requirements-analysis/requirements.md` |
| NFR（`NFR<n>`） | 6 | 同上 |
| FR グループ見出し（`FR1`〜`FR7`） | 7 | 同上。要件の実体ではなく節の見出しなので、配下のサブ要件がすべて覆われていることをもって充足とする |
| AC（`AC<n>.<m>.<seq>`） | 0 | User Stories は SKIP。存在しない |

## カバレッジ

出典は `construction/code-generation/traceability.json`（owning stage は
すべて code-generation）。target の実在は `test` コマンドで確認済み。

| ID | Status | Target | 実在 |
|---|---|---|---|
| FR1.1 | OK | `deep-spec-analysis/src/kernel/domain/package.json` | ○ |
| FR1.2 | OK | `deep-spec-analysis/src/design/usecase/package.json` | ○ |
| FR1.3 | OK | `deep-spec-analysis/bunfig.toml` | ○ |
| FR1.4 | OK | `deep-spec-analysis/src/entries/package.json` | ○ |
| FR1.5 | OK | `deep-spec-analysis/tests/architecture/rules.ts` | ○ |
| FR1.6 | OK | `deep-spec-analysis/src/kernel/domain/index.ts` | ○ |
| FR2.1 | OK | `deep-spec-analysis/scripts/build-tools.ts` | ○ |
| FR2.2 | OK | `deep-spec-analysis/scripts/build-tools.ts` | ○ |
| FR2.3 | OK | `deep-spec-analysis/src/entries/data/deep-spec-ir-schema.json` | ○ |
| FR2.4 | OK | `deep-spec-analysis/src/entries/aidlc-sensor-deep-spec-design-verify-smt.ts` | ○ |
| FR3.1 | OK | `deep-spec-analysis/scripts/build-tools.ts` | ○ |
| FR3.2 | OK | `.github/workflows/ci.yml` | ○ |
| FR3.3 | OK | `deep-spec-analysis/tests/build-tools.test.ts` | ○ |
| FR4.1 | OK | `deep-spec-analysis/sensors/aidlc-deep-spec-ir-valid.md` | ○ |
| FR4.2 | OK | `deep-spec-analysis/src/doctor/domain/installation-manifest.ts` | ○ |
| FR4.3 | OK | `deep-spec-analysis/src/entries/deep-spec-analysis-doctor.ts` | ○ |
| FR4.4 | OK | `deep-spec-analysis/stages/construction/deep-spec-analysis-functional-verify.md` | ○ |
| FR4.5 | OK | `deep-spec-analysis/scripts/install.ts` | ○ |
| FR5.1 | OK | `deep-spec-analysis/tests/kernel-domain.test.ts` | ○ |
| FR5.2 | OK | `deep-spec-analysis/tests/conformance.test.ts` | ○ |
| FR5.3 | OK | `deep-spec-analysis/tests/architecture.test.ts` | ○ |
| FR5.4 | OK | `deep-spec-analysis/bunfig.toml` | ○ |
| FR5.5 | OK | `deep-spec-analysis/tests/doctor-domain.test.ts` | ○ |
| FR6.1 | OK | `.github/workflows/ci.yml` | ○ |
| FR6.2 | N/A → 本ステージで実行済み | 実装ファイルではなく検証活動。証跡は `test-results.md`「実サンドボックスでの検証」節 | — |
| FR7.1 | OK | `deep-spec-analysis/docs/decisions.md` | ○ |
| FR7.2 | OK | `aidlc/spaces/default/knowledge/aidlc-shared/aidlc-engine-operations.md` | ○ |
| NFR1 | OK | `deep-spec-analysis/tests/build-tools.test.ts` | ○ |
| NFR2 | OK | `deep-spec-analysis/tests/conformance.test.ts` | ○ |
| NFR3 | OK | `deep-spec-analysis/scripts/build-tools.ts` | ○ |
| NFR4 | OK | `deep-spec-analysis/tests/build-tools.test.ts` | ○ |
| NFR5 | OK | `deep-spec-analysis/tests/package-boundaries.test.ts` | ○ |
| NFR6 | OK | `deep-spec-analysis/README.md` | ○ |

## FR6.2 の扱い

Code Generation の時点では `N/A`（実装ファイルに対応しない検証活動）と記録されていた。
Build and Test で実際に実行し、次を確認した:

- installer 再導入後の `.claude/tools/` が bundle 10 本＋`data/` 4 本で、層ディレクトリ
  6 本が消えている
- 配布物 10 本が `deep-spec-analysis/tools/` と byte 同一
- 実ディスパッチャ経由の実射で findings 3 ファイルが基線と byte 同一
  （ir-valid pass／SMT 5・skipped 2・exhaustive／Quint 2・skipped 3・bounded／
  cross-check SC-3・SC-5 で不一致 0）
- doctor 31 checks fail 0、`aidlc-plugin-test` CLEAN

したがって **FR6.2 は未カバーではなく、owning stage が build-and-test に移った上で充足**
している。自動化された近似（一時サンドボックスでの installer・センサー・doctor の実走）は
`tests/intent-e2e.test.ts` が持ち、これは CI で毎回走る。

## 未カバーの要素

**なし。** 承認ゲートで報告すべき所見は無い。

## 注記

- FR グループ見出し `FR1`〜`FR7` は節の見出しであって独立した要件ではない。配下の
  サブ要件がすべて `OK` なので充足とみなした
- Unit ごとの `traceability.json` は存在しない（Unit が 0）。ステージレベルの 1 本が
  唯一の出典である
