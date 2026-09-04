# DDD／クリーンアーキテクチャ改善要件

## Intent Analysis

`deep-spec-analysis/` の外部仕様と形式検証結果を変えずに、Design／Refinement 検証経路の責務境界、不変条件、永続化整合性、重複実装を整理する。狙いは一般論としてのレイヤ名合わせではなく、失敗を成功に見せないこと、不正な値を正常生成できないこと、同じ変更理由を一つの所有者へ寄せることである。[desc] [Q1] [Q4]

優先順は、report finalization の完全性、strict creation と tolerant hydration の分離、Refinement の Design subdomain 化、SMT／Quint の共通処理抽出、`LoweredUnit` の責務分離とする。`kernel/infrastructure` の改名は扱わない。[Q1] [Q2] [Q3] [RE:architecture]

## Functional Requirements

### FR1. Report finalization の単一化

- **FR1.1** Design の SMT／Quint 両ユースケースは、レポート適合、backend report 保存、兄弟report読込、cross-check再構築を同じ具体的 application collaborator に委譲しなければならない。[Q1] [Q3]
- **FR1.2** 同一実行では findings schema を一度だけ読み取った immutable snapshot を用い、verdict算出と保存に同じ適合済み `DesignReport` を使わなければならない。[Q3] [RE:architecture]
- **FR1.3** backend report または cross-check の読込・生成・保存が失敗した場合、ユースケースは `verified` を返してはならず、既存の失敗チャネルにより呼出側へ失敗を返さなければならない。[Q3] [RE:architecture]
- **FR1.4** 兄弟reportを読めない場合に cross-check 更新を黙って成功扱いする現行分岐を廃止しなければならない。[RE:architecture]

**Acceptance criteria**

- Given schema snapshot の取得後に schema file が変更または読取不能になる、When Design report を確定する、Then verdict と保存文書は最初の同一snapshotから導出される。
- Given backend report 保存または cross-check 再構築が失敗する、When SMT／Quintユースケースを実行する、Then outcome は成功ではなく、既存の公開エラー処理へ到達する。

### FR2. Report file の完全性と並行更新

- **FR2.1** `DesignReportRepositoryImpl` は既存の canonical atomic-write helper を再利用し、backend report と cross-check をそれぞれ temp file から rename して公開しなければならない。[Q3] [RE:structure]
- **FR2.2** 同一 verify directory の finalization は directory 単位の lock で直列化し、兄弟reportの読込からcross-check公開までの競合を防がなければならない。[Q3]
- **FR2.3** cross-check は backend report から再生成できる派生projectionとして扱い、現在の sibling set／IR と一致しない既存cross-checkを最新の検証結果として採用してはならない。[Q3]
- **FR2.4** 契約2の別ファイル配置と既存ファイル名は維持し、versioned directory／atomic pointer は導入しない。[Q3] [Q4]

**Acceptance criteria**

- Given 同じdirectoryへSMTとQuintが並行して書く、When 両処理が完了する、Then 各JSONは完全な1文書であり、最終cross-checkは公開済み兄弟reportから再計算した内容と一致する。
- Given 古いcross-checkが存在して再構築に失敗する、When finalizationする、Then 呼出結果は成功にならず、そのcross-checkは最新結果として扱われない。

### FR3. Strict creation と tolerant hydration の分離

- **FR3.1** `VerificationMethod` と skip reason は契約2の閉集合を表す共有ドメインプリミティブとして、検証付きの正常生成口を持たなければならない。[Q1] [RE:structure]
- **FR3.2** `FindingKind`、`VerificationMethod`、skip reason を含む新規domain objectの生成は検証済み値だけを受け取り、任意の `string` を正常生成経路から受け取ってはならない。[Q1]
- **FR3.3** `reconstitute` は削除せず、既存・外部文書の寛容なhydrationを行うadapter境界に限定しなければならない。[Q4]
- **FR3.4** 未知のfinding kindを既知kindより後ろに並べて降格試験へ運ぶ既存挙動を維持しなければならない。[Q4] [RE:architecture]

**Acceptance criteria**

- Given 未知のmethodまたはskip reason、When 正常生成APIへ渡す、Then `Result` のerrorとなりdomain objectは生成されない。
- Given 未知kindを含む既存文書、When adapterがhydrationする、Then 現行どおり読み取り・降格でき、例外を投げない。

### FR4. Refinement の Design subdomain 化

- **FR4.1** 現在の `@deep-spec/refinement-domain` の実装を Design context 内の refinement subdomain へ統合し、独立workspace packageとしてのRefinementを廃止しなければならない。[Q2]
- **FR4.2** `design-usecase → refinement-domain`、`design-adapter → refinement-domain`、`refinement-domain → design-domain` の公認横断エッジを、Design package内部の依存へ置き換えなければならない。[Q2] [RE:architecture]
- **FR4.3** Requirements domain との関係は、Design refinement subdomain が要件語彙を消費する既存意味を維持しなければならない。[RE:architecture]
- **FR4.4** Design finding／skip／loweringへの変換結果、文言、発生順を変更してはならない。[Q4]

**Acceptance criteria**

- Given workspace install と typecheck、When package graphを検査する、Then `@deep-spec/refinement-domain` への依存宣言とimportは0件になる。
- Given既存refinement fixtures、When SMT／Quintのrefinement検証を実行する、Then findings、skips、cross-checkは変更前とbyte同一になる。

### FR5. SMT／Quint の重複オーケストレーション削減

- **FR5.1** acquisition、version mismatch、report finalizationなど、両ユースケースで同じ変更理由を持つ処理を小さな具体的application collaboratorへ集約しなければならない。[Q1] [RE:structure]
- **FR5.2** SMT固有solver queryとQuint固有probe／budget／refinement extrasは各ユースケースに残さなければならない。[RE:architecture]
- **FR5.3** 多数のoptional flagを持つgeneric backend strategyまたは巨大template pipelineを導入してはならない。[RE:architecture]

**Acceptance criteria**

- Given SMT／Quintユースケース、When共通失敗経路を変更する、Then同じfinalization実装1か所の変更で両方へ反映される。
- Given backend固有テスト、Whenリファクタリング後に実行する、Then固有のtimeout、probe、solver判定は従来どおり動作する。

### FR6. `LoweredUnit` の変更理由分離

- **FR6.1** `LoweredUnit` はlowered collectionsとindexの不変条件および再構成を所有し、設計モデルからのbuildと兄弟verdictの解釈を同じclassへ集中させてはならない。[Q1] [RE:structure]
- **FR6.2** lowering判断は `DesignUnit`／設計宣言群へ、兄弟verdictの解釈は `SiblingVerdictDocument` と `LoweringIndex` の既存domain objectへ移し、getterで取り出した値を外側で判定する構造にしてはならない。[RE:structure]
- **FR6.3** 新しいdomain service、自由関数、`*Plan`型が必要になった場合は、実測した問題と代替案を示して実装前に個別の人間裁定を得なければならない。[Q4] [memory]

**Acceptance criteria**

- Given既存lowering／remap fixtures、When分割後のdomain objectを実行する、Then生成するlowered documentとfinding／skipはbyte同一になる。
- Given architecture tests、When実装ツリーを走査する、Then既存のdomain object種別、private field、Tell-Don't-Ask規則をすべて通る。

### FR7. 設計判断と構造ゲートの同期

- **FR7.1** Refinement統合、strict creation、report finalizationの裁定を `deep-spec-analysis/docs/decisions.md` と `deep-spec-analysis/docs/decisions.ja.md` に同じ意味で記録しなければならない。[Q2] [Q3] [Q4]
- **FR7.2** `tests/architecture/rules.ts` とpackage manifestsを新しい境界へ更新し、禁止edgeのred exampleと実ツリーのgreen検査を追加・維持しなければならない。[RE:structure]
- **FR7.3** 既存の検査規則を削って変更を通してはならない。[memory]

**Acceptance criteria**

- Given統合後のpackage graph、Whenarchitecture testsを実行する、Then旧Refinement横断edgeは許可表から消え、同種の新規越境をred exampleが検出する。
- Given英語版と日本語版のdecision record、When該当節を比較する、Then判断、代替案、帰結が一致する。

## Non-Functional Requirements

### NFR1. Backward compatibility

契約1〜4、findings JSON、stdout verdict、公開ファイル名、文言、正準順、golden bytes、solver pinは変更前と同一でなければならない。変更が不可避な項目は、実装前に項目単位の人間裁定を受けなければならない。[Q4]

### NFR2. Determinism and reliability

同じ入力、固定solver版、同じ実行modeからはbyte同一の成果物を生成しなければならない。失敗、timeout、読込不能、並行競合をcleanまたはverifiedとして扱ってはならない。[Q3] [Q4]

### NFR3. Testability

変更前に全テストとtypecheckの基線を記録し、変更後も全既存テストをgreenに保つ。少なくともschema二重観測、cross-check読込／保存失敗、同一directoryの並行writer、strict creation拒否、tolerant hydration、Refinement統合後のpackage edgeを再現する回帰テストを追加する。[RE:architecture] [RE:structure]

### NFR4. Security and auditability

外部JSON／Markdownはadapter境界で未信頼入力として検証し、pathは既存の `DesignReportId` から導出されるdirectory／filename境界を越えてはならない。検証結果と保存証跡が食い違う可能性を残してはならない。[RE:architecture]

### NFR5. Maintainability

production fileを1,000行以上へ拡大してはならない。重複削減は条件分岐をgeneric abstractionへ移すだけでなく、同じ変更理由を一つの具体的所有者へ集約しなければならない。[Q1] [RE:structure]

## Constraints

- 改変対象は `deep-spec-analysis/` のみとし、`aidlc-workflows/` submodule、`.claude/`、`sandbox/`、`dist/`、`node_modules/` を変更しない。
- `kernel/infrastructure` の名称と最内層としての配置は今回維持する。
- domain層の新規domain service、自由関数、既存4種以外のdomain objectは、人間裁定なしに追加しない。
- 予期された失敗は `Result` で返し、例外を通常制御に使用しない。
- コマンドの戻り値とCQSに関する既存裁定は、項目単位の人間裁定なしに反転しない。
- テスト方法はtest-after、Test StrategyはMinimalとする。

## Out of Scope

- `kernel/infrastructure` から `foundation` 等への改名。
- 契約1〜4のschema変更、solver版更新、goldenの意図的更新。
- requirements／refcheck report repository全体の横断再設計。ただし共有DPやatomic-write helperの互換な利用は対象内とする。
- 新しい認証、個人情報、ネットワークAPI、UI、デプロイ基盤。
- installer、doctor、release、CIの機能変更。

## Assumptions & Open Questions

None.

## Sources

- [desc] Initial description: DDD／クリーンアーキテクチャのレビュー指摘を修正する
- [scope] Workflow-selected scope: `refactor`、Depth `Minimal`、Test Strategy `Minimal`
- [Q1] `requirements-analysis-questions.md` Q1: A. 主要課題をまとめて修正
- [Q2] `requirements-analysis-questions.md` Q2: A. Design subdomain へ統合
- [Q3] `requirements-analysis-questions.md` Q3: A. 派生projectionとして明示
- [Q4] `requirements-analysis-questions.md` Q4: A. 既存外部面をすべて維持、および個別の人間裁定条件
- [RE:business] `aidlc/spaces/default/codekb/deep-spec-analysis/business-overview.md`
- [RE:architecture] `aidlc/spaces/default/codekb/deep-spec-analysis/architecture.md`
- [RE:structure] `aidlc/spaces/default/codekb/deep-spec-analysis/code-structure.md`
- [memory] `aidlc/spaces/default/memory/project.md` のドメインオブジェクト、不変条件、CQS、既存裁定に関する規則

## Review

**Verdict:** READY
**Reviewer:** aidlc-product-lead-agent
**Iteration:** 1

### Evidence

- 7つの機能要件群と5つの非機能要件は、初期説明、4件の確認回答、または3つのReverse Engineering成果物へ追跡できる。
- 各機能要件群は正常系と失敗系を含む検証可能なacceptance criteriaを持つ。
- `deep-spec-analysis/` 限定、本家互換、契約・golden維持、例外時の個別人間裁定が制約と要件の両方に反映されている。
- Refinement統合、派生cross-check、strict creation、重複削減、`LoweredUnit`責務分離の範囲に未解決の矛盾はない。

### Findings

None.
