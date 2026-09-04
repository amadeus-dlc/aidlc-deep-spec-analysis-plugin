# Rules — DDD／クリーンアーキテクチャ改善

## Source of Truth

```yaml
rules:
  - id: BR1.1
    statement: Repository境界が一つのfinalizationにつき一つのimmutable schema snapshotで一度だけconformする。
    category: constraint
    applies_to: DesignReportRepository DesignReportFinalizer
    trigger: Design report finalization
    logic: IF finalization starts THEN Finalizer invokes Repository conformance once and persists that exact conformed report without re-conformance
    violation: return save-failed and do not report verified
    source: FR1.1 FR1.2
  - id: BR1.2
    statement: Reportまたはcross-checkの失敗を成功に変換しない。
    category: validation
    applies_to: DesignReportFinalizer
    trigger: Any read render invalidate or write failure
    logic: IF any finalization step fails THEN return the typed repository failure
    violation: no verified outcome is emitted
    source: FR1.3 FR1.4 NFR2
  - id: BR2.1
    statement: 同じverify directoryへのwriterを一つずつ実行する。
    category: constraint
    applies_to: DesignReportRepository
    trigger: Store backend report with cross-check
    logic: IF another live writer owns the directory lock THEN fail immediately without waiting or retrying
    violation: return io-failed without publishing a new report
    source: FR2.2
  - id: BR2.2
    statement: Backendを公開する前に既存cross-checkを最新候補から外す。
    category: policy
    applies_to: cross-check.json
    trigger: Both candidate documents rendered successfully
    logic: IF a public cross-check exists THEN atomically move it out of the public path before backend publication
    violation: return io-failed and leave the prior backend unchanged
    source: FR2.3
  - id: BR2.3
    statement: 各JSON文書は同一directoryのtemp fileからrenameして公開する。
    category: constraint
    applies_to: DesignReportRepository
    trigger: Publish backend report or rebuilt cross-check
    logic: IF candidate bytes are complete THEN use the canonical atomic-write helper
    violation: remove temporary bytes and return io-failed
    source: FR2.1 NFR4
  - id: BR2.4
    statement: Cross-checkはlock内で観測した最新sibling setとcandidate backendから再構築する。
    category: policy
    applies_to: DesignReports
    trigger: Rebuild cross-check
    logic: IF sibling set or IR differs from the candidate THEN exclude stale inputs and rebuild from the current set
    violation: do not publish cross-check and return failure
    source: FR2.3 FR2.4
  - id: BR2.5
    statement: プロセスクラッシュ時は古いcross-checkを最新として残さない。
    category: policy
    applies_to: cross-check.json
    trigger: Process stops after cross-check invalidation
    logic: IF finalization does not complete THEN the public cross-check path remains absent until a later successful rebuild
    violation: stale cross-check must never be restored after a new backend became public
    source: FR2.3 NFR2
  - id: BR2.6
    statement: Directory lockは所有者token、PID、30秒leaseを持ち、canonical pathを所有者固有pathへatomic renameしてからだけ回復または解放する。
    category: constraint
    applies_to: DesignReportRepository
    trigger: Acquire or recover a directory lock
    logic: IF held THEN recover only after lease expiry plus definite owner-process absence by renaming to a token-specific stale path; IF releasing THEN rename to the releasing token's cleanup path and delete only that path; before every public rename require the canonical token to equal the writer token
    violation: return lock-failed and do not publish either document
    source: FR2.5 NFR2
  - id: BR2.7
    statement: Lockの取得、競合、回復、回復失敗を外部文言を変えず区別可能な内部結果にする。
    category: validation
    applies_to: DesignReportRepository
    trigger: Complete a lock operation
    logic: IF a lock operation fails or recovers stale ownership THEN preserve its typed cause for tests and diagnostics
    violation: do not collapse the cause into verified or a silent success
    source: FR2.6 NFR2 NFR4
  - id: BR3.1
    statement: 新規のmethod finding kind skip reasonはstrictな生成口を通る。
    category: validation
    applies_to: VerificationMethod FindingKind SkipReason
    trigger: Create a new domain object
    logic: IF a value is outside its contract-defined closed set THEN return a domain error
    violation: do not construct the object
    source: FR3.1 FR3.2
  - id: BR3.2
    statement: 寛容なreconstituteはadapter hydrationに限定する。
    category: constraint
    applies_to: Adapter document parser
    trigger: Read an existing or external document
    logic: IF raw persisted vocabulary is unknown THEN preserve it for degradation
    violation: do not throw and do not silently convert it to a known value
    source: FR3.3 FR3.4
  - id: BR4.1
    statement: Refinement型はDesign domain package直下へ統合する。
    category: constraint
    applies_to: design/domain
    trigger: Move refinement-domain sources
    logic: IF a refinement type is moved THEN preserve one-public-type-per-file and merge exports into the Design facade
    violation: fail architecture checks
    source: FR4.1 FR4.5
  - id: BR4.2
    statement: 旧refinement workspace packageと互換shimを残さず結果byteを維持する。
    category: constraint
    applies_to: workspace package graph
    trigger: Complete refinement integration
    logic: IF migration completes THEN old imports equal zero and existing refinement outputs remain byte-identical
    violation: fail typecheck architecture or golden tests
    source: FR4.2 FR4.3 FR4.4 NFR1
  - id: BR5.1
    statement: DesignVerificationAcquirerがmodel取得、取得失敗、IR version mismatchの共通lifecycleを一度だけ所有する。
    category: policy
    applies_to: DesignVerificationAcquirer VerifyDesignSmtUseCase VerifyDesignQuintUseCase
    trigger: Acquire version-check or finalize a Design report
    logic: IF verification begins THEN pass model id report id and a strict VerificationMethod; return ready model plus IR hash or exactly one of not-applicable acquisition-failed model-unreadable version-mismatch save-failed
    violation: duplicated decision logic remains
    source: FR5.1
  - id: BR5.2
    statement: Backend固有のsolver probe budget判断は各usecaseに残す。
    category: constraint
    applies_to: VerifyDesignSmtUseCase VerifyDesignQuintUseCase
    trigger: Execute backend-specific verification
    logic: IF behaviour exists only for one backend THEN keep it in that backend usecase
    violation: reject a generic optional-mode pipeline
    source: FR5.2 FR5.3
  - id: BR6.1
    statement: LoweredUnitはlowered値とindexの不変条件だけを所有する。
    category: constraint
    applies_to: LoweredUnit
    trigger: Construct or extend a lowered unit
    logic: IF lowered collections change THEN LoweredUnit preserves their coherent index and numbering
    violation: construction returns a domain error or test failure
    source: FR6.1
  - id: BR6.2
    statement: DesignUnitと宣言群がloweringの意味を所有する。
    category: policy
    applies_to: DesignUnit
    trigger: Lower a design unit
    logic: IF declarations are lowered THEN ask their owning Design objects to produce the lowered values
    violation: do not recreate getter-driven branching outside the owners
    source: FR6.2
  - id: BR6.3
    statement: SiblingVerdictDocumentがLoweringIndexを通してverdictをDesign語彙へ解釈する。
    category: policy
    applies_to: SiblingVerdictDocument
    trigger: Interpret a sibling backend document
    logic: IF the document variant is known THEN that variant decides the Design result
    violation: do not put document-variant branching back into LoweredUnit
    source: FR6.2
  - id: BR6.4
    statement: 新規domain serviceまたは非標準domain objectは実装前に個別裁定する。
    category: authorization
    applies_to: domain package changes
    trigger: Proposed object is outside the approved domain object kinds
    logic: IF an exceptional object is proposed THEN stop for measured evidence and human judgment
    violation: do not implement the object
    source: FR6.3
  - id: BR7.1
    statement: 本家互換の外部面をbyte単位で維持する。
    category: constraint
    applies_to: contracts findings verdict and golden outputs
    trigger: Any refactoring change
    logic: IF externally observed bytes differ THEN reject unless that exact item received prior human judgment
    violation: fail golden or compatibility checks
    source: FR7.1 NFR1
  - id: BR7.2
    statement: 設計判断の英語版と日本語版を同じ変更で更新する。
    category: policy
    applies_to: docs/decisions.md docs/decisions.ja.md
    trigger: Record the approved architecture changes
    logic: IF one decision record changes THEN update the other with equivalent decisions and alternatives
    violation: documentation parity check fails
    source: FR7.1
  - id: BR7.3
    statement: 新境界を検査する際も既存architecture rulesを削除しない。
    category: constraint
    applies_to: tests/architecture/rules.ts
    trigger: Update the package and layer graph
    logic: IF a sanctioned edge is removed or a rule is added THEN retain unrelated checks and add a red example
    violation: architecture test fails
    source: FR7.2 FR7.3 NFR5
  - id: BR7.4
    statement: 要件で列挙した失敗、競合、hydration、package edgeを個別の回帰試験で再現する。
    category: validation
    applies_to: changed production paths and regression tests
    trigger: Validate the refactoring
    logic: IF a listed NFR3 scenario is not exercised THEN the change is incomplete
    violation: fail the test gate
    source: NFR3
  - id: BR7.5
    statement: 未信頼文書はadapterで検証し、report関連pathはDesignReportIdと固定basenameだけから導出する。
    category: authorization
    applies_to: adapter hydration and report filesystem paths
    trigger: Read external content or derive a filesystem path
    logic: IF input crosses a trust boundary THEN validate it and reject any path not rooted in the report identity
    violation: return a typed boundary failure without filesystem access outside the report directory
    source: NFR4
  - id: BR7.6
    statement: 変更後のproduction fileを1,000行以上にしない。
    category: constraint
    applies_to: production TypeScript files
    trigger: Complete the refactoring
    logic: IF any changed production file has at least 1000 lines THEN split responsibility before completion
    violation: fail the maintainability check
    source: NFR5
  - id: BR8.1
    statement: 解決されたUnit集合がゼロ件ならper-Unit stageはstage-level artifact directoryを一貫して使う。
    category: constraint
    applies_to: functional-design nfr-requirements nfr-design infrastructure-design code-generation
    trigger: Resolve artifacts for a per-Unit stage
    logic: IF the resolved Unit set is empty THEN questions review and traceability use the stage-level path regardless of whether Units Generation ran or was skipped
    violation: fail artifact resolution instead of inventing a Unit name
    source: FR8.1 FR8.2
  - id: BR8.2
    statement: Stage-level questionsとreview confirmationは同じ共有判定を使う。
    category: validation
    applies_to: summaryQuestionFiles checkSummaryConfirmationEvidence
    trigger: Discover confirmation evidence
    logic: IF stage-level zero-Unit mode applies THEN discover the direct stage questions file and validate its digest
    violation: refuse only genuinely missing or stale confirmation
    source: FR8.1 FR8.4
  - id: BR8.3
    statement: Stage-level traceabilityはunit導出を要求せず、同階層のrulesと上流requirementsを解決する。
    category: validation
    applies_to: aidlc-sensor-traceability
    trigger: Validate a stage-level traceability artifact
    logic: IF stage-level zero-Unit mode applies THEN resolve rules and upstream contracts without a Unit segment
    violation: report an actual coverage failure rather than cannot derive construction unit
    source: FR8.1 FR8.2 FR8.4
  - id: BR8.4
    statement: Zero-Unit修正はcanonical core、全harness生成物、導入コピー、回帰試験、version、README badge、CHANGELOGを同期する。
    category: policy
    applies_to: aidlc-workflows distribution
    trigger: Publish the zero-Unit fix
    logic: IF canonical core changes THEN regenerate every harness and require package drift checks plus both zero-Unit regressions to pass
    violation: do not publish the release
    source: FR8.3 FR8.4 FR8.5 NFR3
```

## Rules Summary

| Area | Rules | Result |
|---|---|---|
| Finalization | BR1.1–BR2.7 | Repositoryによるconform-once、失敗伝播、非待機lock、lease回復、stale先行無効化、1ファイルatomic write |
| Domain primitives | BR3.1–BR3.2 | strict creationとtolerant hydrationを分離 |
| Refinement | BR4.1–BR4.2 | Design直下へ統合しshimを残さず、結果byteを維持 |
| Use cases | BR5.1–BR5.2 | 共通変更理由だけを具体的collaboratorへ集約 |
| Lowering/remap | BR6.1–BR6.4 | 既存の意味所有者へ移し、新規domain serviceを避ける |
| Quality and compatibility | BR7.1–BR7.6 | 本家互換、decision parity、回帰matrix、trust/path、1,000行上限 |
| Zero-Unit workflow | BR8.1–BR8.4 | stage-level質問・review・traceabilityを共有判定で解決し、全配布面を同期 |

確認済みの上流要件は [`requirements.md`](../../inception/requirements-analysis/requirements.md) のFR1〜FR8およびNFR1〜NFR5である。
