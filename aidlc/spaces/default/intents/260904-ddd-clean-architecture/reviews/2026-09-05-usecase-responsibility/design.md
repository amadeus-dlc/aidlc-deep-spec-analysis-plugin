# designユースケースの責務監査

## 対象と判断基準

- 実装基線: `e743b4e`。確認時の作業ツリーHEAD `53a0530d89c673dbec81ea30c3c74aaa619bfad2` の対象ソースは、この基線と同じ。
- 対象: `deep-spec-analysis/src/design/usecase/` の全21 TypeScriptファイルと `package.json`。関連するdomain・adapter・既存テストまで追跡した。
- 実施方法: ソースの読み取り監査。以下のテストは根拠・回帰確認候補として参照したもので、この監査担当は実行していない。
- 判断基準: ユースケースはフロー制御を担当し、ドメインモデルの値を取り出して業務上の判断・加工・演算を行わない。出力形式への変換はインターフェイスアダプタ層に置く。
- 参照規則: `aidlc/spaces/default/knowledge/aidlc-shared/coding-rules/` の `use-case-rules.md`、`tell-dont-ask.md`、`command-query-separation.md`、`domain-services.md`。

単純なResult失敗の伝播、保存成功を待ってから成功を返す制御、RepositoryやGatewayの呼出順序と、値の意味を解釈して次の業務状態を決める処理を区別した。`value`という表記だけを根拠に違反とはしていない。取得した状態を解体した後、呼び手が何を決めているかを追跡した。

P1は責務移譲を優先すべき業務判断、P2は同じ方針で是正すべき境界・調整上の問題を示す。実行時の障害を再現した深刻度ではない。

## 結果

公開ユースケース3件すべてと、application collaborator 2件に指摘がある。優先する修正単位は、次の5つにまとめられる。

1. refinement材料の適用判定と結果の解釈を、その状態を所有する型へ戻す（D2・D5）。
2. 到達性の検査条件・判定結果・未実施診断をドメインへ戻す（D4・D7）。
3. lowered obligationの採番と帰属索引の同時更新を `LoweredUnit` に戻す（D3）。
4. IRの適否と検証準備の判断を材料・モデルへ戻す（D1・D8）。
5. バックエンド結果の境界変換、レポート組成、公開DTOへの射影を適切な所有者へ分ける（D6・D9）。

## D1 — 設計IRの適否と検査順序をユースケースが決めている

**優先度: P1 / 確信度: 高**

根拠: [validate-design-intermediate-representation-usecase.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/design/usecase/validate-design-intermediate-representation-usecase.ts) 34–54行。

`found.value` から材料を取得し、`irVersion().majorVersion()` を取り出して `Number.isInteger` と対応major比較を行う。対応外なら文言を生成し、schemaの `ErrorMessages` を `toArray().map(asString)` で文字列配列へ変換する。その配列が空の場合だけ意味検査を実行し、最後に `errors.length === 0` から合否を決めている。

「対応外version」「schema不適合時は意味検査しない」「診断順序」「合否」は検証の規則である。取得の成功・失敗によるフロー分岐を超えている。

- 現在の責務所有者: `ValidateDesignIntermediateRepresentationUseCase`。
- 移譲先候補: `DesignIntermediateRepresentationValidationMaterials`。現在のversion・schemaErrors・unitsのgetter中心の公開面から、検証と判定結果を返す操作へ進める。
- 再利用候補: `IntermediateRepresentationVersion.supportsMajor()`、`DesignUnitDeclarations.wellFormednessErrors()`、`ErrorMessages`。文字列配列への射影はadapterへ置く。
- 関連テスト: [ir-validation.test.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/ir-validation.test.ts) 303行（設計IR検証全体）、313行（診断順序）、358行（対応外major）、691行（意味検査）。

## D2 — refinement材料の適用・陳腐化・欠落判定が両ユースケースに重複している

**優先度: P1 / 確信度: 高**

根拠:

- [verify-design-quint-usecase.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/design/usecase/verify-design-quint-usecase.ts) 245–294行。
- [verify-design-satisfiability-modulo-theories-usecase.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/design/usecase/verify-design-satisfiability-modulo-theories-usecase.ts) 179–242行。

`materials.value` を取得し、`isActive()` に応じてrequirementsとmap取得結果を取り出す。mapの要件hashと設計hashをそれぞれ比較して `stale-input` を生成する。unit mapが欠ける場合には要件target全件を走査して `absent-input` を生成する。

`RefinementMapAcquisition.match(...)` のコールバック内に比較と診断生成が残っている。`if` が `match` に変わっても、状態の所有者へ仕事を委譲したことにはならない。

- 現在の責務所有者: SMT・Quintの両ユースケース。
- 移譲先候補: `RefinementMaterials` と `RefinementMapAcquisition`。`DesignModel` を受け、適用外・欠落・陳腐化・検証可能なunit計画を判断する。Repository等のI/Oは持たせない。
- 再利用候補: `RefinementMap.unitMapOf()`、`ContentHash.equals()`、`UnitRefinementPlan.of()`、`RefinementRequirements.allTargetIds()`。
- 関連テスト: [refinement.test.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/refinement.test.ts) 127行（map不在）、141行（陳腐化）、158行（unit欠落）。[refinement-pipeline.test.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/refinement-pipeline.test.ts) 201行（両バックエンドのgolden比較）。

関連する誤った責務の説明もある。[refinement-materials-repository.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/design/usecase/port/refinement-materials-repository.ts) 11–12行は「陳腐化（requirementsIrHash / designIrHash の不一致）の判定はユースケースのフロー制御」と明記しており、今回の基準と衝突する。

## D3 — lowering結果の採番と帰属索引をユースケースが組み直している

**優先度: P1 / 確信度: 高**

根拠: [verify-design-quint-usecase.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/design/usecase/verify-design-quint-usecase.ts) 316–326行。

`base.obligations()`、`base.index()`、`count()` を取り出し、`n += 1` で `OB-${n}` を生成してobligationへ追加する。同時にpassthrough索引も更新した後、`extendedWith(...)` で再構築している。

採番と索引の対応はlowering結果の不変条件である。二つを正しく更新する責務が呼び手に漏れている。

- 現在の責務所有者: `VerifyDesignQuintUseCase`。
- 移譲先候補: `LoweredUnit` に、refinement追加不変量を組み込んだ新しい値を返す操作を置く。
- 再利用候補: `RefinementQuintInvariant.loweredAs()`、`LoweringIndex.withPassthrough()`、`LoweredObligations.add()`。現在の `LoweredUnit.extendedWith()` は完成品を二つ受け取るだけで、対応関係を守る処理を呼び手に残している。
- 関連テスト: [design-pipeline.test.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/design-pipeline.test.ts) 452行（採番とmap）。[refinement-pipeline.test.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/refinement-pipeline.test.ts) 946行（追加不変量）、201行（統合golden比較）。

## D4 — Quintの到達性結果からfindingとskipを導く規則をユースケースが持っている

**優先度: P1 / 確信度: 高**

根拠: [verify-design-quint-usecase.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/design/usecase/verify-design-quint-usecase.ts) 184–238行。

machine ID、attribute path、enum値を取り出し、候補を取得する。`method !== "bounded"` ならcapability skipを生成し、probeの非到達結果なら `DesignFinding`、witness、detailを構築する。未検証候補を集め、最後にその理由も決めている。

`ReachabilityVerdict.match(...)` のコールバックが「非到達をどの設計findingへ変換するか」を実装している。状態のdispatchだけが型の内側にあり、その意味付けはユースケースに残っている。

- 現在の責務所有者: `VerifyDesignQuintUseCase`。
- 移譲先候補: 到達性の検査対象・帰属・探索条件を保持するドメイン側の計画と、`ReachabilityVerdict`。probeのI/O結果を渡し、finding・skipへの解釈を依頼する。
- 再利用候補: `DesignMachine.nonInitialCandidates()`、`SiblingVerdictDocument.reachabilityOf()`、`DesignFinding`、`DesignSkipped`。
- 関連テスト: [verification-boundaries.test.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/verification-boundaries.test.ts) 138行、203行、208行、246行。不完全な検査を非到達と誤認しない契約を維持する必要がある。

## D5 — refinementソルバの結果によって採用する診断をユースケースが決めている

**優先度: P1 / 確信度: 高**

根拠: [verify-design-satisfiability-modulo-theories-usecase.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/design/usecase/verify-design-satisfiability-modulo-theories-usecase.ts) 244–265行。

`check.result.kind` が `unavailable` ならgap・status・compile skipを捨て、要件target全件のunavailableへ置き換える。それ以外はgap、status skip、compile skipを採用し、`solved` の場合にverdictを解釈している。

どの診断を残し、どの診断を捨てるかは検証結果の業務上の意味である。判定を `match` に置き換えるだけでは責務は移らない。

- 現在の責務所有者: `VerifyDesignSatisfiabilityModuloTheoriesUseCase`。
- 移譲先候補: refinement検証結果を表す型、または結果の意味を所有する `RefinementSolverPlan` / `UnitRefinementPlan`。
- 再利用候補: `RefinementSolverPlan.interpret()`、`UnitRefinementPlan.gaps()`、`UnitRefinementPlan.smtStatusSkips()`。
- 関連契約: `port/refinement-check.ts` と `port/refinement-solver-result.ts` は計画と判定を公開データとして返し、解釈の責務を持たない。
- 関連テスト: [refinement-pipeline.test.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/refinement-pipeline.test.ts) 1041行（判定解釈）、201行（統合golden比較）。unavailable時の診断置換を直接確認するテストは、担当範囲の探索では見つけていない。

## D6 — 生のバックエンド実行結果から診断と降格内容をユースケースが決めている

**優先度: P1 / 確信度: 高**

根拠:

- [verify-design-quint-usecase.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/design/usecase/verify-design-quint-usecase.ts) 137–182行、328–357行。
- [verify-design-satisfiability-modulo-theories-usecase.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/design/usecase/verify-design-satisfiability-modulo-theories-usecase.ts) 127–171行。

`run.exit`、`run.doc`、`run.note` を読み、exit127・文書欠落・解釈不能を分類する。noteをsliceし、対象を列挙してskipを生成し、レポート全体をbackend-unavailableにするか、そのunitだけをskipするか決めている。

[sibling-lowered-run.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/design/usecase/port/sibling-lowered-run.ts) 3–7行が `exit/doc/note` を公開する契約になっており、applicationがプロセスの終了コードも理解する必要がある。

- 現在の責務所有者: SMT・Quintの両ユースケース。
- 移譲先候補: exit code・stdout等のプロセス結果の解釈は `SiblingBackendClientImplementation`。unit検証不能をfinding・skipへ反映する規則は型付き検証結果とドメイン型。
- 再利用候補: `SiblingVerdictDocument.remapVerdicts()`、`DesignReport.backendUnavailable()`。
- 比較対象: 同adapterの `probeState()` は生のexit/docを `ReachabilityVerdict` へ変換しており、`runLowered()` と責務分離の強度が違う。
- 関連テスト: [design-verify.test.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/design-verify.test.ts) 245行。[design-pipeline.test.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/design-pipeline.test.ts) 658行。[design-usecase-collaboration.test.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/design-usecase-collaboration.test.ts) 118行以降のfake siblingと共同動作テスト。

## D7 — 処理予算を診断結果へ意味付けする処理がユースケース内にある

**優先度: P2 / 確信度: 高**

根拠:

- [verify-design-quint-usecase.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/design/usecase/verify-design-quint-usecase.ts) 107–135行、201–235行、299–313行。
- [verify-design-satisfiability-modulo-theories-usecase.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/design/usecase/verify-design-satisfiability-modulo-theories-usecase.ts) 96–125行、228–239行。

残り時間とprobe使用数を計算し、未検証targetを取り出してtimeout・unavailable・capabilityの理由と文言を決めている。

時刻取得や次のI/Oを起動するかの制御自体と、予算不足によって何を未検証として記録し、どの理由を与えるかを区別する。後者がユースケースに残っている点が指摘である。

- 現在の責務所有者: SMT・Quintの両ユースケース。
- 移譲先候補: 検証計画・検証対象集合へ中断理由を渡し、未実施分の診断を生成させる。時刻取得やソルバ呼び出しをドメインへ移す提案ではない。
- 再利用候補: `DesignSkips`、`RefinementQuintInvariants`、`DesignUnit.allTargets()`。
- 関連テスト: [verification-boundaries.test.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/verification-boundaries.test.ts) 138行周辺にprobe数・未検証結果のテストがある。段階別の3,000/5,000ms境界とrun全体の上限を直接確認するテストは、担当範囲の探索では見つけていない。

## D8 — 共通Acquirerにもモデル適合判定と降格結果の生成責務が残っている

**優先度: P2 / 確信度: 高**

根拠: [design-verification-acquirer.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/design/usecase/design-verification-acquirer.ts) 41–60行。

`acquired.value` からモデルを取得し、hashを取り出して `supportsMajor()` で判定する。不適合ならmismatch reportを構築し、skip件数を取り出してterminal outcomeを組み立てる。

`supportsMajor()` 自体はドメインの振る舞いだが、「不適合ならこのreportと終了判定」という処理はapplication collaboratorにある。ユースケースから補助クラスへ移しただけの責務も監査対象になる。

- 現在の責務所有者: `DesignVerificationAcquirer`。
- 移譲先候補: 取得されたモデルから検証準備結果を生成するドメイン側の操作。取得失敗の受け渡しと保存手順はapplicationに残す。
- 再利用候補: `DesignModel.supportsMajor()`、`DesignReport.versionMismatch()`、`DesignReport.irUnreadable()`。
- 関連契約: [design-acquisition-result.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/design/usecase/design-acquisition-result.ts) 9–11行はreadyの `model/irHash` を公開するだけで、後続の判断を依頼する公開面がない。
- 関連テスト: [design-usecase-collaboration.test.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/design-usecase-collaboration.test.ts) 321行（terminal5変種）、422行（ready）。[design-verify.test.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/design-verify.test.ts) 259行。

## D9 — レポート組成と外部向け値の取り出しがapplicationに残っている

**優先度: P2 / 確信度: 高**

根拠:

- [verify-design-quint-usecase.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/design/usecase/verify-design-quint-usecase.ts) 179–182行、363–378行。
- [verify-design-satisfiability-modulo-theories-usecase.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/design/usecase/verify-design-satisfiability-modulo-theories-usecase.ts) 169–171行、272–285行。
- [design-report-finalizer.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/design/usecase/design-report-finalizer.ts) 52–68行。

両ユースケースはdomain collectionを配列へ展開して蓄積し、`unit:${u.name()}` を組み立て、モデルversion・hash・入力証跡と再合成する。Quintでは最初に取得したmethodを採用し、未取得ならsimulationへfallbackする規則もある。

Finalizerは保存済みcandidateを取り出し、`passes/findingsCount/skippedCount/method` から公開DTOを組み立てる。この部分は業務判定の再実装というより、adapterに限定すべき出力変換がapplicationにある問題である。前半のload→`finalizedWith`→storeは調整責務として区別できる。

- 現在の責務所有者: SMT・Quintの両ユースケースと `DesignReportFinalizer`。
- 移譲先候補: 検証結果を蓄積・完成させるreport側の操作。公開DTOへの射影はpresenter・adapter。
- 再利用候補: `DesignReport.compose()`、`DesignVerifyDirectory.finalizedWith()`、`DesignFindings`、`DesignSkips`、`CheckedUnits`。
- 関連テスト: [design-usecase-collaboration.test.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/design-usecase-collaboration.test.ts) 261行・280行（適合・保存と公開値の一致）。[design-pipeline.test.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/design-pipeline.test.ts) 837行（正準化）。

付随する契約違反の扱いもある。Finalizerの53–60行は「到達しない」とコメントしたcandidate欠落を `io-failed` へ変換している。ここは実I/O失敗ではなく構築・最終化契約の破れであり、panic相当のdefectを業務失敗へ丸めないという既存方針から、requirements側の同型箇所と合わせて扱う必要がある。

## 全ファイルの確認台帳

| 区分 | ファイル | 判定 |
| --- | --- | --- |
| 公開ユースケース | `verify-design-quint-usecase.ts` | D2・D3・D4・D6・D7・D9 |
| 公開ユースケース | `verify-design-satisfiability-modulo-theories-usecase.ts` | D2・D5・D6・D7・D9 |
| 公開ユースケース | `validate-design-intermediate-representation-usecase.ts` | D1 |
| 補助クラス | `design-verification-acquirer.ts` | D8 |
| 補助クラス | `design-report-finalizer.ts` | D9。保存順序の調整自体は適切 |
| 取得結果型 | `design-acquisition-result.ts` | 実行ロジックなし。D8の公開データ契約に関連 |
| 終端結果型 | `design-acquisition-terminal.ts` | 実行ロジックなし |
| 入力型 | `verify-design-input.ts` | 型付きIDと保存先の入力。業務判断なし |
| 出力型 | `verify-design-outcome.ts` | 実行ロジックなし。D9の出力契約変更に連動 |
| 出力型 | `validate-design-intermediate-representation-outcome.ts` | 実行ロジックなし。D1の判定結果変更に連動 |
| 公開面 | `index.ts` | 明示exportのみ。業務判断なし |
| Repository契約 | `port/design-model-repository.ts` | 型付き集約の取得・保存。interface自体は適切 |
| Repository契約 | `port/design-verify-directory-repository.ts` | 型付き集約の取得・保存。interface自体は適切 |
| Repository契約 | `port/refinement-map-repository.ts` | 型付き集約の取得・保存。interface自体は適切 |
| Repository契約 | `port/refinement-materials-repository.ts` | 取得interface自体は適切。11–12行の責務コメントがD2と関連 |
| Repository契約 | `port/design-intermediate-representation-validation-materials-repository.ts` | 型付き集約の取得・保存。interface自体は適切 |
| Gateway契約 | `port/sibling-backend-client.ts` | `runLowered`の返却契約がD6と関連 |
| Gateway返却型 | `port/sibling-lowered-run.ts` | 生のexit・doc・noteを公開。D6 |
| Gateway契約 | `port/refinement-solver-client.ts` | 返却結果の解釈がD5と関連 |
| Gateway返却型 | `port/refinement-solver-result.ts` | 判定変種を公開するだけ。D5 |
| Gateway返却型 | `port/refinement-check.ts` | planとresultを公開するだけ。D5 |

`package.json` の依存先はdomain・kernelの各層であり、adapter実装への依存はない。

## 既に適切な委譲と、修正時の制約

`DesignUnit.lowered()`、`SiblingVerdictDocument.remapVerdicts()`、`RefinementSolverPlan.interpret()`、`RefinementQuintInvariants.interpret()`、`DesignVerifyDirectory.finalizedWith()` は、既にドメインへ置けている責務として再利用する。

一方、getterを別名へ変える、`if` を `match` へ置換する、applicationの別クラスへ処理を移すだけでは、ここで挙げた問題は解決しない。次の制約を維持して責務を戻す。

- generic `Result` に検証固有の業務処理を混ぜない。
- domainからRepository・Gateway・Clockのapplication portへ依存させない。
- 不変変換と照会を使い、CQSのために内部可変状態を隠して導入しない。
- 状態を所有する既存の型を優先し、共通化だけを理由に無関係なサービスを新設しない。
- 診断の内容・順序・保存結果と公開判定の一致は、既存の公開インターフェイスとgolden比較で確認する。

なお [design-pipeline.test.ts](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/design-pipeline.test.ts) 173–223行には、method採用・checked生成・到達性capability skipの組成をテスト側でも再実装する経路がある。外部結果のgolden確認としての役割を保ちつつ、移譲したドメインの公開操作を直接確認するテストと、ユースケースの呼出順序・失敗伝播を確認するテストを分ける必要がある。
