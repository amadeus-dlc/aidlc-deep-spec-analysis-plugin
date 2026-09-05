# doctor・refcheckのユースケース責務監査

監査日: 2026-09-05。ソース基線: `e743b4e`。作業ツリーのHEAD `53a0530` は監査対象srcについて基線と同内容。静的監査のみを行い、ソース変更・テスト実行・commit・pushは行っていない。

適用規律は「ユースケースはフロー制御を担い、値を取り出した業務判断・加工・演算を行わない。外部表現への変換はインターフェイスアダプタが担う」。共有規則の `use-case-rules.md`、`tell-dont-ask.md`、`command-query-separation.md`、`domain-services.md` を読んで監査した。CQSを採用し、CQRSは前提としない。汎用Resultへ個別業務を入れることや、ドメインからrepository/clientへ依存させることは移譲案に含めない。

## 結果と全件範囲

40ファイルを確認した。9ユースケースの分類は、業務判断・集計の漏出4件、境界変換の残存4件、今回の観点で適合1件。read-model内の判断・集計は同じ根因の横展開先として扱い、独立したユースケース数に重複加算していない。

| ユースケース | 分類 | 根拠 |
| --- | --- | --- |
| CheckFunctionalCoverageUseCase | 業務判断・集計 | [check-functional-coverage-usecase.ts:25](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/doctor/usecase/check-functional-coverage-usecase.ts#L25) |
| CheckVerificationCoverageUseCase | 業務判断・集計 | [check-verification-coverage-usecase.ts:21](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/doctor/usecase/check-verification-coverage-usecase.ts#L21) |
| CheckStructuralDebtUseCase | 業務判断・集計 | [check-structural-debt-usecase.ts:23](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/doctor/usecase/check-structural-debt-usecase.ts#L23) |
| CheckVersionAdvisoryUseCase | 業務判断・境界変換 | [check-version-advisory-usecase.ts:20](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/doctor/usecase/check-version-advisory-usecase.ts#L20) |
| CheckInstallationUseCase | 境界変換 | [check-installation-usecase.ts:15](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/doctor/usecase/check-installation-usecase.ts#L15) |
| CheckDomainComponentsUseCase | 境界変換 | [check-domain-components-usecase.ts:40](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/refcheck/usecase/check-domain-components-usecase.ts#L40) |
| CheckContractSummaryUseCase | 境界変換 | [check-contract-summary-usecase.ts:42](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/refcheck/usecase/check-contract-summary-usecase.ts#L42) |
| CheckFunctionalDesignUseCase | 境界変換 | [check-functional-design-usecase.ts:40](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/refcheck/usecase/check-functional-design-usecase.ts#L40) |
| CheckSolversUseCase | 適合 | [check-solvers-usecase.ts:12](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/doctor/usecase/check-solvers-usecase.ts#L12) |

範囲の内訳:

- doctor 28ファイル: execute 6、read-model 8、port 12、index/package 2。
- refcheck 12ファイル: execute 3、input 3、port 2、outcome 1、execution-mode 1、index/package 2。
- 対象は両パッケージのusecase配下全ファイル。execute以外も確認し、関係するdomain、adapter、entries、testsへ処理を追跡した。
- port/input/outcome/index/packageには隠れた実行アルゴリズムはない。ただしdoctorの生値DTOとrefcheckのプリミティブoutcomeは、ユースケースへ責務を押し出す契約になっている。

## DR-1: 設計検証の完了・鮮度・refinement失効の査定をユースケースが所有

優先度: P1。確信度: 高。

根拠は [check-functional-coverage-usecase.ts:25](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/doctor/usecase/check-functional-coverage-usecase.ts#L25) から55行。`FunctionalTarget`から `modelUnits`、`completedUnits`、`hasFindings`、各mtimeを取り出し、次を判定・集計している。

- モデル台帳とbackend完了台帳の両方に存在する場合だけ検証済みとする。
- 設計成果物がモデルより新しければstaleとする。
- 要件モデルが設計モデルより新しければrefinement失効とする。
- unitを適格母数へ加算し、問題行を構築する。

これは実行手順ではなく、doctorが検証済みと認める条件そのもの。条件を変更すると、公開カバレッジと警告行が変わる。

現在の材料所有者はデータだけの [FunctionalTarget](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/doctor/usecase/port/functional-target.ts#L6)。`CoverageState`はunverified/staleという結果だけを所有し、査定APIを持たない。設計検証の観測結果を保持するドメイン型と、そのコレクションに査定を持たせる。既存 `CoverageState` は再利用できる。ドメインに `DoctorWorkspaceClient` を渡す必要はない。

横展開先: [unit-coverage.ts:39](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/doctor/usecase/read-model/unit-coverage.ts#L39) の母数判定・問題有無判定、47行の `eligible - problems.length` もusecase層での業務集計。

既存テスト: [doctor-domain.test.ts:292](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/doctor-domain.test.ts#L292)、[intent-e2e.test.ts:922](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/intent-e2e.test.ts#L922)、同1002行・1104行。モデル台帳とbackend証拠の両立、未検証から検証済みへの遷移、成果物更新とrefinement失効を保護する。

## DR-2: 要件検証の未検証判定と集計がユースケースに残る

優先度: P1。確信度: 高。

根拠は [check-verification-coverage-usecase.ts:21](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/doctor/usecase/check-verification-coverage-usecase.ts#L21) から28行。`VerificationTarget.hasModel/hasFindings`を読み、どちらか不在ならunverifiedを選ぶ。その後 `VerificationStaleness.isStale()` の答えからstale行を構築し、`targets.length`を母数へ渡している。

鮮度自体は `VerificationStaleness` と `DigestAnchor` へ委譲済みだが、モデル・証拠の充足と鮮度を合わせた最終査定の所有者がない。要件検証の観測型が最終査定を所有し、コレクションが母数と結果をまとめる。既存 [VerificationStaleness.isStale](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/doctor/domain/verification-staleness.ts#L22) は内部から再利用できる。

横展開先: [coverage-assessment.ts:31](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/doctor/usecase/read-model/coverage-assessment.ts#L31) の問題有無判定と35行の検証済み件数の減算。単なる表示データの運搬ではない。

既存テスト: [doctor-domain.test.ts:65](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/doctor-domain.test.ts#L65)、同76行・216行、[intent-e2e.test.ts:273](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/intent-e2e.test.ts#L273)、同365行。直接のusecase単体テストは見当たらず、主にE2Eで保護されている。

## DR-3: 構造負債の計上条件と集計をユースケースが決める

優先度: P1。確信度: 高。

根拠は [check-structural-debt-usecase.ts:22](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/doctor/usecase/check-structural-debt-usecase.ts#L22) から27行。backendの `number | null` を読み、nullは母数に入れず、非nullなら母数を加算し、`findings > 0`だけ負債行とする。

nullで次のI/Oへ進むだけならフロー制御だが、「数えられなかった」と「0件」を区別して母数・負債を算定する処理は業務判断である。

現在の契約は [ReferenceCheckBackendClient.reportOnlyFindings](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/doctor/usecase/port/reference-check-backend-client.ts#L6)。取得不能と査定済みを表せるドメイン結果を返し、その観測結果コレクションへ集計を依頼する形にする。既存 `StructuralDebt` の集計責務をドメインへ整理できる。

横展開先: [structural-debt.ts:20](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/doctor/usecase/read-model/structural-debt.ts#L20) の `scanned > 0`、28行の行から件数を取り出すreduce。別のusecase配下クラスへ集計を移すだけでは層の責務違反を解消しない。

既存テスト: [doctor-domain.test.ts:91](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/doctor-domain.test.ts#L91)、同245行、[intent-e2e.test.ts:726](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/intent-e2e.test.ts#L726)、同740行。直接のusecase単体テストは見当たらない。

## DR-4: 安定版選別・最新版選択・更新判定をユースケースが所有

優先度: P1。確信度: 高。

根拠は [check-version-advisory-usecase.ts:20](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/doctor/usecase/check-version-advisory-usecase.ts#L20) から54行。来歴のversionをparseし、release tagsを走査してparse失敗を捨て、`isOlderThan`で最大のstable版を選択する。導入版との比較でcurrent/update-availableを決め、`asString()`と`asTag()`で表示値へ変換している。

`PluginVersion`は比較を所有しているが、stable版だけを対象とする最新版選択と更新査定がユースケースに残る。`ReleaseTagsRead`は文字列配列、`InstallationProvenanceRead`は文字列DTOなので、その状態にタスクを依頼できない。

移譲先は安定版コレクションと導入来歴・更新査定のドメイン型。既存 [PluginVersion](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/doctor/domain/plugin-version.ts#L30) の `parse/isOlderThan/equals` を再利用する。HTTP・JSONから型への変換と表示文字列化はadapter、ネットワーク呼出し順はusecaseに残せる。

既存テスト: [doctor-version-advisory.test.ts:80](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/doctor-version-advisory.test.ts#L80)。欠落・破損時にGitHubを呼ばない107行の契約は、フローを保護するテストとして維持すべき。

## DR-5: refcheckの3ユースケースがレポートを返却DTOへ分解

優先度: P2。確信度: 高。

根拠:

- [check-domain-components-usecase.ts:40](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/refcheck/usecase/check-domain-components-usecase.ts#L40) から45行。
- [check-contract-summary-usecase.ts:42](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/refcheck/usecase/check-contract-summary-usecase.ts#L42) から47行。
- [check-functional-design-usecase.ts:40](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/refcheck/usecase/check-functional-design-usecase.ts#L40) から45行。
- 共通出力契約: [check-outcome.ts:8](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/refcheck/usecase/check-outcome.ts#L8)。

`conformed.passes()/findingsCount()/skippedCount()`を呼び、boolとnumberのDTOへ分解している。上記4件とは異なり、業務判断の再実装ではなく、usecaseが境界変換を所有する違反である。

一方、`record.value.check...()`と`checked.value.conformedTo()`は、取得したモデルへそのまま作業を依頼している。内部値を取り出して検査を再実装してはいない。`record.ok`、`checked.ok`、保存モード、保存成功失敗の分岐もフロー制御として区別する。

適合済み `ReferenceCheckReport`、またはそのドメイン判定値を保持したoutcomeを返し、adapterで公開verdictへ変換する。既存 [ReferenceCheckReport.passes/findingsCount/skippedCount](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/refcheck/domain/reference-check-report.ts#L209) が使えるため、新しい業務判断は不要。保存したものと返した判定が一致する契約は維持する。

既存テスト: [refcheck-pipeline.test.ts:101](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/refcheck-pipeline.test.ts#L101)、同149行・178行、[refcheck.test.ts:73](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/refcheck.test.ts#L73)。

## DR-6: 設置検査でドメインのパスを文字列へ変換

優先度: P2。確信度: 高。

根拠は [check-installation-usecase.ts:15](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/doctor/usecase/check-installation-usecase.ts#L15)。`entry.rel()`は [ManifestEntry.rel](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/doctor/domain/manifest-entry.ts#L19) 内の `ArtifactPath.asString()`まで降りる。

usecaseは取得したboolを `InstalledStatus` に結び付けるだけで、設置有無の判断を再実装してはいない。しかし、パスの生文字列化は残っている。

[HarnessFileClient.isInstalled(rel: string)](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/doctor/usecase/port/harness-file-client.ts#L3) を `ManifestEntry` または `ArtifactPath` を受け取る契約に変え、文字列化を `HarnessFileClientImplementation` へ移す。domainにfilesystemやportの依存を入れる必要はない。

既存テスト: [doctor-domain.test.ts:36](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/doctor-domain.test.ts#L36)、同146行、`tests/intent-e2e.test.ts`のcompose・doctor検証。

## DR-7: 表示ラベルの加工がusecase/read-modelに配置

優先度: P2。確信度: 高。

根拠:

- [coverage-row.ts:24](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/doctor/usecase/read-model/coverage-row.ts#L24): spaceとintentの連結。
- [unit-coverage-row.ts:27](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/doctor/usecase/read-model/unit-coverage-row.ts#L27): space、intent、unitの連結。
- [debt-row.ts:25](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/doctor/usecase/read-model/debt-row.ts#L25): 所在とartifactの連結。
- [refinement-stale-row.ts:20](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/doctor/usecase/read-model/refinement-stale-row.ts#L20): spaceとintentの連結。

業務判断の再実装ではなく表示加工である。既存 `DoctorPresenter` を使い、表示投影とラベル生成をadapterへ整理する。

[VersionAdvisory.match](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/doctor/usecase/read-model/version-advisory.ts#L58) 自体は状態の所有者によるdispatchだが、同クラスは既に文字列化された表示情報を保持する。ドメイン査定と表示投影を分ける際の対象になる。

既存テスト: [doctor-domain.test.ts:216](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/doctor-domain.test.ts#L216)、同245行・268行。公開文言と順序を維持するテストとして利用する。

## 適合した処理と残すべき境界

[CheckSolversUseCase.execute](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/doctor/usecase/check-solvers-usecase.ts#L12) は `SolverProbeClient.availability()` へ依頼し、`SolverAvailability`をそのまま返す。取得結果の分解、独自判断、表示変換はなく、今回の観点で適合する。

refcheck3件の検査・適合は `DesignRecord` と `ReferenceCheckReport` に委譲済み。境界変換が残るためユースケース全体を適合とはしないが、`.value`という記法だけで既存の委譲を業務判断の再実装と誤認しない。

`usecase/read-model`への配置を正当化する旧コメントは現在のユーザー方針と整合しない。集計を単に別のusecase配下クラスへ移す、getterを別名へ置き換える、汎用Resultのコールバックへ判断処理を包むだけでは解消しない。判断の所有者、値の表現、変換する層を合わせて修正する必要がある。
