# AI-DLC State Tracking

## Project Information
- **Project**: deep-spec-analysis プラグインの tools/ を「出荷物（bundle）」と「本来のソース（src/）」に分離し、レイヤー間の依存方向をパッケージ境界で強制する。現状: deep-spec-analysis/tools/ に kernel/requirements/design/refinement/refcheck/doctor の 6 コンテキスト × infrastructure/domain/usecase/adapter の層が素のディレクトリとして並び、依存方向は tests/architecture/rules.ts の layer-direction 規則（テスト実行時）でしか検出できない。projection は tools/ をそのまま .claude/tools/ にコピーし、利用先では bun .claude/tools/x.ts が相対 import・node_modules なしで動く前提。前出しする設計判断（変更しない限りこのとおり実装する）: (1) src/<ctx>/<layer>/ に package.json を置く（name は @deep-spec/<ctx>-<layer>、exports は index.ts のみ、dependencies は許可する層だけを workspace:* で宣言）。root package.json に workspaces を足し、bun install は --linker=isolated（bunfig の [install] linker）にして宣言外の層を解決不能にする。entry（9 センサー＋doctor）は src/entries/ に置く。(2) tools/ には bun build --target=bun --external z3-solver で entry ごとに 1 本ずつ bundle した .js（10 本）と data/ だけを置く。splitting は使わない（chunk 名の揺れで manifest と doctor が不安定になるため）。minify しない。(3) tools/ は生成物としてコミットし、生成スクリプト（scripts/build-tools.ts 等）に --check を設け、CI と tests で再生成して差分ゼロを要求する（drift guard。upstream の aidlc-runner-gen check と同じ型）。projection ビルド・installer・upstream validate は無変更。(4) sensors/*.md の command の .ts パス、doctor の installed 一覧、README/knowledge のパスを .js に合わせる。(5) tests と tests/architecture/rules.ts は src/ を走査対象にし、only-sanctioned-imports は @deep-spec/* を許して層をパッケージ名から読む。既存の規則群（layer-direction、published-language-layers、no-data-models-in-domain 等）はすべて維持する。(6) 既存の 480 テスト・golden・アーキテクチャゲートを緑のまま保つ。外部仕様（IR・レポート JSON・doctor 出力の項目と文言）は不変。実サンドボックス（deep-spec-analysis-sandbox）への installer 再導入と実射（ir-valid/smt/quint、doctor）で出荷物が同じ結果を出すことを確認する。運用ステージ（deployment/observability）はこのリポジトリでは対象外（配布＝projection ビルドと PR マージ）。
- **Project Description Source**: project-description.json
- **Project Type**: Brownfield
- **Scope**: express
- **Start Date**: 2026-09-03T06:28:17Z
- **State Version**: 8
- **Active Agent**: aidlc-operations-agent
- **Worktree Path**:
- **Bolt Refs**:
- **Practices Affirmed Timestamp**:

## Scope Configuration
- **Stages to Execute**: 0.1, 0.2, 0.3, 2.1, 2.3, 3.5, 3.6, 4.1, 4.3, 4.4
- **Stages to Skip**: 1.1 (intent-capture), 1.2 (market-research), 1.3 (feasibility), 1.4 (scope-definition), 1.5 (team-formation), 1.6 (rough-mockups), 1.7 (approval-handoff), 2.2 (practices-discovery), 2.4 (user-stories), 2.5 (refined-mockups), 2.6 (domain-design), 2.7 (units-generation), 2.8 (contract-design), 2.9 (delivery-planning), 3.1 (functional-design), 3.2 (nfr-requirements), 3.3 (nfr-design), 3.4 (infrastructure-design), 3.7 (ci-pipeline), 4.2 (environment-provisioning), 4.5 (incident-response), 4.6 (performance-validation), 4.7 (feedback-optimization)
- **Depth**: Minimal
- **Test Strategy**: Minimal
- **Review Override**: 

## Workspace State
- **Project Root**: .
- **Languages**: TypeScript
- **Frameworks**: Unknown
- **Build System**: bun (package.json)

## Execution Plan Summary
- **Total Stages**: 10
- **Completed**: 7
- **In Progress**: none

## Runtime State
- **Revision Count**: 0

## Phase Progress
<!-- Status values: Pending, Active, Verified, Skipped -->

- **Initialization**: Verified
- **Ideation**: Skipped
- **Inception**: Verified
- **Construction**: Verified
- **Operation**: Verified

## Stage Progress
<!-- Checkbox states: [ ] not started, [-] in progress, [?] awaiting approval (gate open), [R] revising (user rejected gate), [x] completed, [S] skipped via --stage/--phase jump -->

### INITIALIZATION PHASE
- [x] workspace-scaffold — EXECUTE
- [x] workspace-detection — EXECUTE
- [x] state-init — EXECUTE

### IDEATION PHASE
- [ ] intent-capture — SKIP
- [ ] market-research — SKIP
- [ ] feasibility — SKIP
- [ ] scope-definition — SKIP
- [ ] team-formation — SKIP
- [ ] rough-mockups — SKIP
- [ ] approval-handoff — SKIP

### INCEPTION PHASE
- [x] reverse-engineering — EXECUTE
- [ ] practices-discovery — SKIP
- [x] requirements-analysis — EXECUTE
- [ ] user-stories — SKIP
- [ ] refined-mockups — SKIP
- [ ] domain-design — SKIP
- [ ] units-generation — SKIP
- [ ] contract-design — SKIP
- [ ] delivery-planning — SKIP

### CONSTRUCTION PHASE
Per unit: [TBD]
- [ ] functional-design — SKIP
- [ ] nfr-requirements — SKIP
- [ ] nfr-design — SKIP
- [ ] infrastructure-design — SKIP
- [x] code-generation — EXECUTE
- [x] build-and-test — EXECUTE
- [ ] ci-pipeline — SKIP

### OPERATION PHASE
- [S] deployment-pipeline — EXECUTE
- [ ] environment-provisioning — SKIP
- [S] deployment-execution — EXECUTE
- [S] observability-setup — EXECUTE
- [ ] incident-response — SKIP
- [ ] performance-validation — SKIP
- [ ] feedback-optimization — SKIP

## Current Status
- **Lifecycle Phase**: OPERATION
- **Current Stage**: observability-setup
- **Next Stage**: none
- **Status**: Completed
- **Last Updated**: 2026-09-03T10:23:39Z

## Session Resume Point
- **Last Completed Stage**: build-and-test
- **Next Action**: Workflow complete
- **Pending Artifacts**: none
