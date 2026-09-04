# Code Summary — DDD／クリーンアーキテクチャ改善

ゼロ Unit のステージ実行として、承認済み計画の 7 波（38 ステップ）を実装した。途中でオーナー裁定「Repository の語彙は保存・検索・取得・削除だけ。集約は一塊で、可変部は集約が持つ」を受けて Wave 4／5 を作り直し、同じ裁定を requirements／refcheck にも及ぼした。

## Baseline Before Changes

| 対象 | 実測（変更前） |
|---|---|
| `deep-spec-analysis` `bunx tsc --noEmit` | 0 エラー |
| `deep-spec-analysis` `bun test --coverage` | 527 pass / 1 skip / 0 fail、28 ファイル、2,855 assertions、34.30s、カバレッジ床 0.9 通過 |
| `aidlc-workflows` `bun run typecheck` | 0 エラー |
| `aidlc-workflows` `bun scripts/package.ts --check` | 7 harness すべて OK |
| `aidlc-workflows` t281／t320／t68 | 29 pass / 0 fail |
| `aidlc-workflows` `bash tests/run-tests.sh` | **基線未取得**（Wave 6 で HEAD の一時 worktree から取り直した。下記） |

## Files Created and Modified

### deep-spec-analysis（プラグイン本体）

| 領域 | 内容 |
|---|---|
| `src/kernel/domain/` | 新設 `skip-reason.ts`（契約2 の 9 値、strict `parse`・寛容 `reconstitute`・名前つきファクトリ）、`findings-schema.ts`（契約2 schema の値オブジェクト、`unreadable` 変種、`degradationReasonFor`）。`verification-method.ts` に `parse`、`finding-kind.ts` に閉集合 11 種の名前つきファクトリ |
| `src/kernel/infrastructure/` | `json.ts`・`schema.ts`（`validateSchema`）・`canonical-json.ts`（`canonicalStringify`）を `kernel/adapter` から移設。純粋で I/O を持たないため最内層へ |
| `src/kernel/adapter/` | `directory-finalization-lock.ts`（223 行）と `directory-finalization-lock-outcome.ts` を design から共有化、`process-liveness.ts` 新設。`canonical-json.ts`・`json.ts`・`schema.ts` は infrastructure へ移動、facade は再 export を残さず更新 |
| `src/design/domain/` | 集約ルート `design-verify-directory.ts`（118 行、`crossCheck: DesignReport \| null`）。Refinement の 36 ファイルを `refinement/domain` から直下へ統合（`index.ts` に明示列挙）。`design-unit.ts` 127→277 行（`lowered()`）、`sibling-verdict-document.ts` 57→206 行（`remapVerdicts`）、`lowered-unit.ts` 384→65 行。`design-report.ts` に `toDocument()`・`conformedTo(schema)`、`design-skipped.ts` の reason を `SkipReason` へ、`design-finding.ts` に strict `of` |
| `src/design/usecase/` | port `design-verify-directory-repository.ts`（`findByDirectory`／`store` のみ）。新設 `design-report-finalizer.ts`、`design-verification-acquirer.ts`、`design-acquisition-result.ts`、`design-acquisition-terminal.ts`。`verify-design-smt-usecase.ts` 252→222 行、`verify-design-quint-usecase.ts` 341→311 行（`#persist`・`#recomputeCrossCheck`・沈黙分岐を廃止） |
| `src/design/adapter/` | `design-verify-directory-repository-impl.ts`（250 行。lock・load 後の兄弟変更検知・stale 先行退避・atomic 公開・cleanup）。`design-report-serializer.ts` 155→92 行 |
| `src/requirements/` | 集約ルート `domain/verification-directory.ts`、port `usecase/port/verification-directory-repository.ts`、`usecase/verification-report-finalizer.ts`、adapter `verification-directory-repository-impl.ts`。`verification-report.ts` に `toDocument()`・`conformedTo`。usecase 2 本から `#persist`・`#recomputeCrossCheck`・沈黙分岐を廃止（111→91、122→100 行） |
| `src/refcheck/` | port から `conformedOf` を撤去（`findById`／`store` のみ）。`reference-check-report.ts` に `toDocument()`・`conformedTo`、`finding(...)` コマンドを `FindingKind` 型へ。adapter の `store` は再適合せず `writeFileAtomically`。usecase 3 本は `FindingsSchema` 注入 |
| `src/entries/` | 10 entry すべて: `readContractSchema` を 1 回だけ呼んで `FindingsSchema` を usecase へ注入。design／verify 系 4 本は実時計・実 liveness probe を lock へ配線 |
| `src/refinement/` | 削除（互換 shim なし） |
| `tests/` | 新設 `domain-primitives.test.ts`、`design-report-finalization.test.ts`、`design-usecase-collaboration.test.ts`、`verification-report-finalization.test.ts`。`architecture/rules.ts` の `SANCTIONED_CROSS_CONTEXT` を旧 4 辺→`design/domain -> requirements/domain` の 1 辺に。`architecture.test.ts` に旧 refinement package import を拒否する red example と 1,000 行検査 |
| `tools/` | `bun scripts/build-tools.ts` で 14 ファイルを再生成（生成物）。bundle 最大 321,855 bytes（上限 512 KiB）。`--check` は up to date |
| `docs/` | `decisions.md`・`decisions.ja.md` に裁定を 1 節ずつ追記（H2 は両者 47） |

### aidlc-workflows（ゼロ Unit 経路、FR8）— オーナー裁定により撤回

> **2026-09-04 オーナー裁定（Build and Test 中、2 度目の指示）**: `aidlc-workflows/` はこのプロジェクトの開発対象ではなく、変更してはならない。要件 FR8（Q5=A）が `aidlc-workflows/core/` の改変を含めていたが、この裁定が優先する。以下に記録した core・回帰試験・dist・version 2.7.2・README・CHANGELOG の変更は**すべて HEAD（a277af21、version 2.7.1）へ戻した**（差分はセッションのスクラッチにパッチとして退避）。派生の `.claude/tools/` 同期も戻した。`.codex/tools/` の 2 ファイルはセッション開始前から変更されていたもので、扱いはオーナーの指示待ち。FR8 はこの Intent では未実装（`traceability.json` で `N/A`）。以下の表と切り分けの記述は、撤回前の経緯の記録として残す。

| 領域 | 内容（撤回済み） |
|---|---|
| `core/tools/aidlc-lib.ts` | `summaryQuestionFiles` に `stateContent` 引数とステージレベル分岐（既存差分を採用、Q1=A）。`usesStageLevelPerUnitArtifacts` を `projectDir` 任意引数つきに拡張し、18 呼出点へ渡す（Q2=A） |
| `core/tools/aidlc-sensor-traceability.ts` | `functional-design`／`nfr-requirements`／`nfr-design`／`infrastructure-design`／`code-generation` のステージレベル上流解決と、`functional-design` の同階層 `rules.md` 解決（既存差分を採用） |
| `core/tools/aidlc-orchestrate.ts`・`aidlc-state.ts`・`aidlc-sensor.ts`・`aidlc-artifact-resolution.ts` | 呼出点の `projectDir` 受け渡し |
| `tests/unit/t281-sensor-traceability.test.ts`・`t320-review-confirmation-deadlock.test.ts` | ゼロ Unit の回帰試験（`SKIP` ケース＝既存差分、`EXECUTE` かつ Unit 0 件＝追加） |
| `core/tools/aidlc-version.ts`・`README.md`・`CHANGELOG.md` | `2.7.1` → `2.7.2`、バッジ、`## [2.7.2] - 2026-09-04`（`t68` の 3 点整合） |
| `dist/<7 harness>/` | `bun scripts/package.ts` で再生成（`--check` OK） |
| ワークスペース `.codex/tools/`・`.claude/tools/` | `aidlc-lib.ts`・`aidlc-sensor-traceability.ts` の 2 ファイルだけを dist と byte 一致（`.claude/` はオーナー裁定で追加。`aidlc-version.ts` は触らない） |

**全体スイートの切り分け**（Wave 0 で基線を取り損ねたため、HEAD の一時 worktree から取り直した）:

- 基線（HEAD）: 388 ファイル中 6 ファイル／18 assertion が赤。すべて環境要因＝分類 A（一時ディレクトリ内の `git submodule add` が `.gitignore` に弾かれる `t255`・`t314`、AWS 認証の `t19`、opencode packaging の 300 秒超 `t240`、cursor adapter の compound command `t276`、`t224`）。
- 作業ツリー（締め直し前）: 16 ファイル／43 assertion。A を除く**新規 10 ファイル／25 assertion** は 1 つの根本原因——「Bolt DAG がディスクに無くても per-Unit として正当」な既存経路が 3 つあり（`{unit-name}` プレースホルダ規約、ディスク上の `construction/<unit>/` 検出、呼出側の `runtimeUnits` override）、`resolveBoltDag` が `none` かだけを見る判定がそれを無視していた。加えて `emitUnitMajorRunStage` で判定が team ownership の fail-closed 検査より先に return していた（`t324`）。
- 締め直し（分類 C、`t328`・`t324`・`t310`・`t188` はテスト無変更で緑化）: `usesStageLevelPerUnitArtifacts(scope, state, projectDir?, stageSlug?)` として、①計画が `EXECUTE` でなければ true、②`projectDir` があれば DAG ∪ 観測 Unit（audit の `BOLT_STARTED` 等から `readAuditShardEvents`＋`boltEventUnits` で再構成する floor 非依存の `observedBoltUnits`。`reviewAttemptWindow` 経由は再帰するため直接読む）、③`stageSlug` があれば `construction/<unit>/<stage>/` のディスク検出（`discoveredStageUnits`）を順に解錠し、いずれかに Unit があれば per-Unit のまま。`malformed` はゼロ件にしない。呼出点 20 箇所すべてに `stageSlug` まで通した。`resolveArtifactInstances` は計画のみの degrade を前段に残し、projectDir 込みの degrade を `resolveArtifactRuntimeUnits`（`runtimeUnits` override → DAG → ディレクトリ走査）が空のときだけに移動。`emitUnitMajorRunStage` は team ownership の fail-closed 検査を degrade より前に評価。
- 分類 B（`t116`×3・`t118`×2・`t120`×3・`t186`・`t215`×2）: プレースホルダ `{unit-name}` は「Unit 集合は非空だが順序・構成が未解決」の表現なので、fixture に観測 Unit（audit `BOLT_STARTED`）を足して本来の主張を保った。assertion の削除・緩和 0、新規 2 件（`t186` 5c・`t215` 3b）で「DAG も観測 Unit も無ければステージレベル、`{unit-name}` 区間なし」を固定。
- 最終結果: `bash tests/run-tests.sh --verbose` 388 ファイル、9,538 assertions、赤は基線と同じ A の 6 ファイル／18 assertion のみ（新規失敗 0）。`bun run typecheck` 0、`bun run lint` 0、`bun scripts/package.ts --check` 7 harness OK、`t68` 3 点整合。単独の `bun test <file>` で `t186`・`t188` が赤になるのはランナーの環境（`AIDLC_TEST_*`）依存で、`run-tests.sh --filter` 経由では PASS。

## Key Implementation Decisions

- **Repository の語彙**（オーナー裁定 2026-09-04）: 3 つの report repository から `conformedOf` と store の変種を撤去し、port を `find` と `store(aggregate)` に閉じた。適合は `FindingsSchema` 値オブジェクトと各 report の `conformedTo(schema)` へ、cross-check の有無は集約の `crossCheck: Report | null` へ。lock・兄弟変更検知・stale 退避・atomic 公開は adapter の `store` の実装詳細。
- **候補を先に適合させてから cross-check を導く**: 旧実装と同じ順序にして、降格した候補が比較から外れる挙動と cross-check の byte を保った。schema は値オブジェクトなので `conformedTo` を 2 回呼んでも I/O は 1 回。
- **`findByDirectory` の寛容さ**: verify directory が未作成なら空の集約を返す。導出物の `cross-check.json` だけは寛容に読み、壊れた兄弟 backend 文書は typed failure で返す。
- **lock の共有化**: `DirectoryFinalizationLock` を `kernel/adapter` に置き、context ごとにファイル名を注入（design は凍結名 `.deep-spec-design-finalization.lock`、requirements は `.deep-spec-finalization.lock`）。`kernel/adapter` は `ArtifactPath` のため `kernel-domain` に下向き依存。
- **純粋部品の最内層移設**: `Json`・`isObject`・`validateSchema`・`canonicalStringify` を `kernel/infrastructure` へ。domain から使えるようにするためで、adapter には I/O だけを残した。互換 shim は作らず、28 ファイルの import を向け直した。
- **requirements の Finalizer は `VerificationReport` を返す**: SMT と Quint で verified の形が違う（Quint だけ `method`）ため、新しい verdict 型を作らず保存した集約の候補を返し、各 interactor が outcome を組む。
- **`CONTEXTS` に `refinement` を残す**: 外すと旧パッケージへの import が層規律の対象外として素通りする。残すことで red example が効く。
- **`PUBLISHED_LANGUAGE` は 11 鍵のまま**: 移設で鍵の path だけ揃え、`size` の表明は生きている。
- **`FindingKind.parse` の振り分け**: 「その kind を誰が選んだか」を軸に、プログラムが閉集合リテラルから選ぶ 21 箇所は `of`、書かれた文書が運ぶ 5 箇所（3 serializer・sibling parser・sibling からの写し替え）は `reconstitute` のまま。
- **ゼロ Unit 判定**: `usesStageLevelPerUnitArtifacts` を「units-generation が `EXECUTE` でない、または `resolveBoltDag` が `none`」へ拡張し、18 呼出点すべてに同じ意味を及ぼす（Q2=A）。`malformed` はゼロ件扱いにしない。

## Deviations from the Plan

- **計画のチェックボックスは実行中に更新しなかった**: Plan Approval の指紋が計画の byte を含み、更新すると承認が失効して委譲が拒否される（実測）。進捗は `memory.md` と本ファイルで追い、チェックボックスは全波完了後に一括で更新する。
- **Wave 4／5 を作り直した**: 初回承認版（`conformedOf` 維持＋`storeConformed` 変種）はオーナー裁定で撤回。同じ段階への `redo` ジャンプで新しい試行を開始し、改訂計画を再承認した。
- **requirements／refcheck を範囲に加えた**: 要件の Out of Scope より裁定を優先すると人間が決めた（「今回揃える」）。
- **Wave 0 で `aidlc-workflows` の全体スイート基線を取らなかった**: Wave 6 の全体スイートが赤で戻り、HEAD の一時 worktree から基線を取り直して A／B／C に分類した（結果は Wave 6 節）。
- **IR unreadable の経路も集約を load する**: 壊れた兄弟があればこの経路も `save-failed` になる（従来は兄弟を読まなかった）。集約 I/O の必然的な帰結。
- **`DesignMachines.attrPathOf(sm)` は触っていない**: Tell-Don't-Ask に反する既存の逸脱だが、2 呼出点へ波及するため今 intent の範囲外とした。

## Test Coverage Summary

| 対象 | 結果 |
|---|---|
| `deep-spec-analysis` `bun test` | **577 pass / 1 skip / 0 fail**、3,218 expect、32 ファイル（基線 527 から +50） |
| `deep-spec-analysis` `bun test --coverage` | exit 0、All files 99.83%（関数）／99.94%（行）、集約・値オブジェクト・Finalizer はいずれも 100% |
| `deep-spec-analysis` `bunx tsc --noEmit` | 0 エラー |
| `deep-spec-analysis` `bun scripts/build-tools.ts --check` | 14 file(s) up to date |
| `deep-spec-analysis` plugin validate | 0 エラー・1 警告（compose hook 不在、従来どおり） |
| `deep-spec-analysis` 7 harness projection build | claude／codex／copilot／cursor／kiro／kiro-ide／opencode すべて OK |
| golden fixture | `git status --short -- tests/fixtures` は空（byte 同一、NFR1） |
| 削除・緩和した既存 assertion | 全波を通じて 0 件 |

新規テストは計画の 17 件を、集約化に伴う不変条件・兄弟変更検知（changed／added）・IR unreadable の lock 経路・`FindingsSchema` の変種で上回っている。NFR3 が名指しする 8 シナリオ（schema 二重観測、cross-check 読込／保存失敗、同一 directory の並行 writer、strict creation 拒否、tolerant hydration、Refinement 統合後の package edge、zero-Unit traceability、zero-Unit review confirmation）はすべて個別の試験で再現している。

## Sandbox Verification

オーナーの指示で、単体・統合テストに加えて実サンドボックスでの実ディスパッチを行った（`/tmp/dsa-sandbox/` に残置）。環境は bun 1.3.13 / node 24.19.0 / quint 0.32.0 / JDK 26、Apalache 0.56.1 あり。quint は自動判定で **bounded（実 Apalache）**。

- **行列**: HEAD の一時 worktree から build した変更前プラグインをサンドボックス A へ、作業ツリーの変更後を B へ導入し、`intent-create --scope feature` で同じ intent（`260904-intent-e2e-feature`）を作って fixture を配置、導入済み `.claude/tools/` のディスパッチャから 10 entry を発火。A／B／A→update の 3 者で **verdict 行・exit code・出力ファイルがすべて byte 一致**（requirements の `smt.json`・`quint.json`・`cross-check.json`、design の同 3 つ、refcheck の 3 report、ir-valid／design-ir-valid の pass、doctor 41 checks / 9 fail）。不一致 0 件。
- **収束と残留**: B で SMT→Quint を 2 回目発火し、6 ファイルすべて 1 回目と byte 同一。verify directory には `smt.json`・`quint.json`・`cross-check.json` のみで、lock・`.cross-check.stale`・temp の残留は record 全体で 0。
- **更新経路**: installer は `--update` と `--from` の併用を拒むため、導入元を in-place で新しくしてから `--update`（実運用の `git pull` → `--update` と同形）。`upgrade refresh: removed 28 previously composed plugin file(s)`、`.claude/` は 299→299 ファイル、byte が変わったのは entry bundle 9 本＋doctor＋provenance の 11 本。契約スキーマ 4 本は byte 不変。更新後の A の再発火は B と全一致。
- **compose**: `aidlc-plugin-test.ts . --install B --harness claude` → CLEAN、Changed files (0)、Drops: 0、Idempotent second compose: true。
- **新しい振る舞い（B）**: `quint.json` を壊して SMT を発火 → exit 1、stderr に兄弟の絶対パスと `corrupt (JSON Parse error: …)`、`smt.json`・`cross-check.json` は発火前と byte 同一（公開なし）。design IR を読めなくして design-verify-smt を発火 → `smt.json` に凍結の降格文書、既存の `cross-check.json` は**削除されて存在しない**（stale が残らない）。IR を戻して再発火すると 3 ファイルとも元の byte に復元。
- **観察（今回の変更ではない）**: 上流ディスパッチャ `aidlc-sensor.ts` の凍結された真理値表は、センサーの exit 1 を `"result":"passed","note":"script-error: exit-1"` と表示する。プラグイン側は verified を返しておらず要件は満たすが、advisory の見え方として `passed` が出る。aidlc-workflows 側の後続候補として記録する。

## Verification Commands

```bash
(cd deep-spec-analysis && bunx tsc --noEmit)
(cd deep-spec-analysis && bun test --coverage)
(cd deep-spec-analysis && bun scripts/build-tools.ts --check)
(cd deep-spec-analysis && bun ../aidlc-workflows/core/tools/aidlc-plugin-validate.ts .)
(cd aidlc-workflows && bun run check)
(cd aidlc-workflows && bash tests/run-tests.sh)
```
