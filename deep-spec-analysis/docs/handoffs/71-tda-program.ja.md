# 引き継ぎ資料: issue #71 TDA プログラム（完了。2026-09-03 の裁定 8 件も実装済み）

最終更新: 2026-09-03（#71 完了後の裁定キュー 8 件も 5 単位（#120〜#124）で実装完了。#80 は #124 で close。残る作業は無い。同日、雑務の片付けを終えてこの文書を `docs/handoffs/` へ収めた）

## これは何か

`amadeus-dlc/aidlc-deep-spec-analysis-plugin` の issue #71「MECE フェンス」TDA（Tell Don't Ask）プログラム。
domain 層の getter-only データモデル（`IrBackgroundDecl` が発端）を commandable class（private `#` フィールド + private constructor + static `reconstitute`/名前つきファクトリ + 振る舞いメソッド）に反転させ、型の外に逃げたビジネスロジックを型へ移管する。
進捗の物差しは `deep-spec-analysis/tests/architecture/rules.ts` の `DATA_MODEL_DEBT` 台帳（**縮小専用**。消すことだけ許され、追加・文言変更は禁止）。

## 現在地

- 台帳: **122 → 0**（波28 の #105 で閉じた。縮小専用の規律はそのまま——空集合に足す変更は裁定違反）
- `PRIMITIVE_FIELD_DEBT`（Ruling A の機械検査）: 上限 **107 → 0**（単位 2 で空。定数の削除は #80）
- マージ済み PR（すべて squash、CI グリーン、レビュー指摘ゼロで収束）:
  - #72 波1: 属性宣言の commandable 化
  - #73 波2+3: verdict の commandable 化と seed 解散
  - #81 波4+5: 背景仮定双子、`AttributeMapping`（α置換・全域性）、`DesignTransition`/`DesignIgnore` の compile-down 移管
  - #82 波6: `Component` 系（PascalCase 判定・重複検出・自己依存・DD-5 グルーピング）
  - #83 波7: `DesignFinding`（`asRefinementViolation`/`withDetail`）、`DesignMachine`（`nonInitialCandidates`/`waivesOverlapOf`）
  - #84 波8: `QuintMachineRunVerdict`（名前つきファクトリ、`abortsMachineTargets`/`skipsFor`/`witness`/`finalState`。adapter の phase 2 ガードと interpret の kind 分岐を移管）
  - #85 波9: dead フィールド削除（`DesignIgnore.reason`、`QuintMachineComponent.frRefs`）。台帳は 99 のまま
  - #87 波10: kernel `TargetId` DP 導入、`TargetIds` を DP 集合へ、requirements 検証語彙（component id / machineTargets / skip target / QuintRuns / frRefsOf）の DP 化、`QuintMachineComponent` commandable 化。台帳 99 → 98（#86 は stacked PR の base 削除で閉じたため #87 で開き直し）
  - #88 波11: Ruling A の機械検査 `no-primitive-fields-in-domain` と縮小専用台帳 `PRIMITIVE_FIELD_DEBT`（フィールド記述子単位、68 ファイル・107 記述子、上限定数 `PRIMITIVE_FIELD_DEBT_CEILING`、陳腐化ガード）。production コード変更なし。CodeRabbit 二巡の指摘は同 PR で修正済み、三巡目は待たずにマージ（オーナー指示）
  - #89 波12: design／refinement の skip 語彙を `TargetId` へ（`DesignSkipped.target`、`DesignUnit.allTargets`、`RefinementRequirements.allTargetIds`、`SiblingVerdictFinding` の `FrRefs`／`LoweredId[]`）。PRIMITIVE_FIELD_DEBT 107 → 104
  - #90 波13: design IR の宣言 4 型（`DesignEntityDecl`／`DesignIgnoreDecl`／`DesignMachineDecl`／`DesignUnitDecl`）の commandable 化。判事の判断（属性座標と重複、初期状態の所属、ignore のセルキー、construction ディレクトリ欠落）を宣言へ移管。DATA_MODEL_DEBT 98 → 94
  - #91 波14: 残りの decl 3 型（`IrEntityDecl`／`IrTemporalDecl`／refcheck `UnitDecl`）の commandable 化。DATA_MODEL_DEBT 94 → 91、`*-decl.ts` は台帳から消えた
  - #92 波15: `*Seed` interface 25 件をドアの無名インライン署名へ解散（波2 の先例）。外部参照 4 箇所は `Parameters<typeof X.of>[0]`。DATA_MODEL_DEBT 91 → 66、PRIMITIVE_FIELD_DEBT 104 → 93
  - #93 波16: 読み手が1つの型 7 件（`Interpreted*Verdicts` 3、`*ReportComposition` 2、`DesignModelComposition`、`RemappedUnit`）を読み手の署名へ解散。DATA_MODEL_DEBT 66 → 59、PRIMITIVE_FIELD_DEBT 93 → 90
  - #94 波17: skip 記録 3 種（`VerificationSkipped`／`DesignSkipped`／refcheck `Skipped`）の commandable 化（`compareTo`、`isFor`）。DATA_MODEL_DEBT 59 → 56
  - #95 波18: finding 記録 2 種（`VerificationFinding`／refcheck `Finding`）の commandable 化（`compareWithin`、`isKind`／`implicates`、`witnessRefs`）。テストは平文へ射影して比較（bun の toEqual は #private を見ない）。DATA_MODEL_DEBT 56 → 54
  - #96 波19: 小レコード 5 種（`WitnessRef`、`InputAnchor`／`DesignInputAnchor`、`CrossCheckedEntry`／`DesignCrossCheckedEntry`）の commandable 化（`pointsAt`、`compareByArtifact`、`compareByBackend`）。DATA_MODEL_DEBT 54 → 49
  - #97 波20: lowered 記録 4 種（`LoweredObligation`／`LoweredScenario`／`LoweredBackground`／`LoweredOrigin`）の commandable 化（`isEvent`、`isAccept`、`isSyntheticProbe`／`pairRefs`）。DATA_MODEL_DEBT 49 → 45、PRIMITIVE_FIELD_DEBT 90 → 88
  - #98 波21: quint の時相／シナリオ判定 2 共用体の commandable 化（名前つきファクトリ、`skipFor`、`isViolation`／`isViolated`）。DATA_MODEL_DEBT 45 → 43
  - #99 波22: `RefinementStatus`（`isCheckable`／`gapDetail`／`skipFor`）、`RefinementProbe`（`match`）、`SiblingVerdictSkip`。43 → 40
  - #100 波23: `SiblingVerdictDocument`（`match`／`unavailableReason`）、`SiblingVerdictFinding`（`witnessWithCoreRemapped`）、`RefinementMapAcquisition`（`match`、map 成果物は `ArtifactPath`）。40 → 37、PRIMITIVE 88 → 87
  - #101 波24: refinement map の record 7 件（`RefinementUnitMap`／`EventMapping`／`UnmappedTarget`／`RefinementAttribute`／`DesignEvent`／`RefinementQuintInvariant`、`RefTokenCarrier` 解散）。誰も読まない `min`/`max` は削除。37 → 30
  - #102 波25: `AttributeDeclaration`（`match`）、`BackgroundAssumption`／`DesignBackgroundAssumption`、`FrRefClaim`（`claimInto`）、`SmtEventPairProbe`（`overlapVerdictIn`／`jointVerdictIn`／`targets`）。30 → 25
  - #103 波26: refcheck の解析結果 7 共用体（`match`、行は `LineNumber`）、`SpecBlockAssessment`（`matchIssue`）、`ContractRow`（`connects`）、`ShapeError`／`ComponentShapeError`／`EntityReference`。25 → 13、PRIMITIVE 87 → 84
  - #104 波27: doctor の行 9 件（`Check.toDocument`、`matchState`、`DigestAnchor.isStale`、`ManifestEntry.error` 等）。presenter の凍結文言は不変。13 → 4
  - #105 波28: `VerificationWitness` の class 化（面ごとのファクトリ + `toDocument`／`fromDocument`）と、`DesignValue`／`DecodedValue`／`TraceState` を published language の JSON 値の形として恒久除外 `PUBLISHED_VALUE_SHAPES` へ移す裁定。DATA_MODEL_DEBT 4 → 0、PRIMITIVE 84 → 83
  - #106 種別規律の登録（4 種別＋裁定条項）と基線監査、#107 22 件の裁定と 5 つの規律の記録
  - #108 波29: 裁定 1（`IdOrder` → 値オブジェクトの `compareTo`／コレクションの正準ソート、kernel 非公開ヘルパー `canonical-order.ts`）
  - #109 波30: 裁定 2・4・5（kernel `ExpressionTree`、`Expressions`／`ExpressionCanonicalKey`／`ExpressionEvaluation` を解体）
  - #110 波31: 裁定 3（kernel DP `NormalizedName`、`Names` を解体、`MachineSpec.entityToken` は `EntityName`）
  - #111 波32: 裁定 6（`DesignUnitDecl.wellFormednessErrors`／`DesignUnitDecls.wellFormednessErrors`、自由関数を解体）
  - #112 波33: 裁定 7・8（`SmtVerificationPlan`／`QuintMachinePlan`／`RefinementSolverPlan`、`facts`→`plan`、`FunctionalUnitScan`）
  - #113 波34: 裁定 10（`AttributeMappings` が alpha 置換を所有、`AttributeMapping` はエンティティ `isFor`。PRIMITIVE 83 → 82）
  - #114 波35: 裁定 15（`RefinementMapDefect` を `Result` で返す、`AlphaError` を解体）
  - #115 波36: 裁定 17〜21（`LoweringKind`／両 QueryStatus は内部表現へ、`CheckSeverity`／`CoverageState` は DP、`CheckExecutionMode` は usecase へ）
  - #116 波37: 裁定 22（doctor のリードモデル 7 型を `doctor/usecase/read-model/` へ。PRIMITIVE 82 → 66）
  - #117 波38: 裁定 14（`CheckFamilyLedger` を集約ルート `ReferenceCheckReport` へ吸収。`open(id, families, unit)`／`finding`／`skip`／`input` がコマンド、checked の導出と正準順はコマンド自身が守る不変条件で `compose` は消えた。`runChecks(report)`、`CheckFamilies.checkTargets`、kernel `TargetIds.excluding`。PRIMITIVE 66 のまま）
  - #118 波39: 裁定 16（`LoadedDocument<Outcome>` を `DesignRecord` の内側へ解散、視点 getter を全廃、門 `checkComponents／checkContracts／checkFunctionalDesign(reportDirectory)` が自分でレポートを開いて検査と inputs 記録を行い `Result<ReferenceCheckReport, not-applicable>` を返す。rules の interface パターンは型引数付きも拾う。PRIMITIVE 66 のまま）
  - #119 波40（最終波）: 裁定 11・12・13（3 つの `*CheckMaterials` 786 行を解体。各 `*Outcome.check` が形の判定と blocked skip、`Components.check`／`ContractRow.checkPartiesDeclared`／`SpecBlockAssessment.check`／`UnitDecls.checkEdgesCovered`／`DeclaredEntities.check`／`RuleDecls.check`／`StateMachineSketch.check`／`DomainEntitySketches.check` が中身の不変条件を書く。families は `*-check-families.ts`、`WitnessRef.at`。契約行の getter 3 つを削除。PRIMITIVE 66 のまま）
- 未マージの PR: なし（park 時点で main はクリーン）
- main のテスト: 472 pass / 1 skip / 0 fail（#124 マージ後）
- `PRIMITIVE_FIELD_DEBT`／`DATA_MODEL_DEBT`: 定数ごと削除済み（#124）。免除は `PUBLISHED_LANGUAGE` 表のみ
- CodeRabbit が #87 で挙げた指摘（背景制約とイベントだけのモデルでは機械フェーズが走らない）は main 以前からの凍結挙動で、リファクタ波の範囲外として返信・解決済み。挙動変更として扱うならオーナー裁定が必要（下記「残作業」）
- 作業用チェックアウト: リポジトリ内のパッケージディレクトリ `deep-spec-analysis/`（main 最新・クリーン）

## 残作業（DATA_MODEL_DEBT は完了。以下はオーナー裁定待ち）

- [x] **単位 0（#120）**: 裁定 8 件と規律 2 つを docs に記録。CodeRabbit の指摘 3 件（typed projection の byte 同一 fixture、台帳小計 65 vs 66、#80 の published language 例外）は単位 1 の PR で対応。
- [x] **単位 4（裁定 5＝#80、#124 マージ済み・#80 close）**: 両台帳と名前ベース除外を削除、`PUBLISHED_LANGUAGE` 表（11 項目: パス・名前・理由・利用可能層）、data-model 規則の締め付け（プロパティを持つ公開 interface はメソッドがあっても違反）、`domain-fields-are-private`、`published-language-layers`。実ツリーは例外なしで通過。テスト 472 pass。
- [x] **単位 3（裁定 4、#123 マージ済み）**: `hasInvariantComponents` ゲート撤去。fixture `conformance/background-events`（refund が amount を負にする）と golden、conformance 試験を追加。実測: quint 0.32 の `run` はデッドロックを報告しない（simulation で新たに捕まるのは背景制約・型境界の到達可能な違反）。既存 golden 不変。
- [x] **単位 2（裁定 3-1〜3-4、#122 マージ済み）**: kernel `KeySet`／`RequirementId`／`QueryLabel`／`FindingKind`／`VerificationMethod`／`AttributeKind`、`UnitName`／`AttributePath`／`ObligationNature` を kernel へ昇格、索引 33 件を `KeyedIndex`／`KeySet`／DP 配列に、語彙 20 件に既存 DP、`FenceCount`、prose 2 件。`PRIMITIVE_FIELD_DEBT` 66 → 0（上限 0）。生文字列の門は `reconstitute`、DP の門は `of`、境界は `toStrings`。テスト 469 pass、golden 不変。
- [x] **単位 1（裁定 2、#121 マージ済み）**: `TraceValue`／`TraceState` class（kernel `KeyedIndex`）、`DesignWitness`、`DesignUnit.entities`（`rawEntities` 追放）、`parseDesignEntities`／`renderDesignEntities`（byte 同一テストつき）、`RefinementQueryVerdict` スカラー model、`PUBLISHED_VALUE_SHAPES` 削除。テスト 465 pass、golden 不変。
- [x] **裁定 2（2026-09-03）: B. 値の意味論を値オブジェクトへ**。実測で domain ロジックが型の外に流出していた（`QuintMachineComponent.evaluate` の真偽・数値化・`JSON.stringify` 等価、`DesignUnit.rawEntities` の生 IR 走査、`LoweredUnit.remapCore`／`SiblingVerdictFinding.witnessWithCoreRemapped` の core 形判定）。対策: (1) `DesignUnit` は enum 宣言値を型付き宣言から答え `rawEntities` を追放、adapter には型付き射影。(2) `TraceState` class（`valueAt`・`toDocument`）＋`TraceValue`（`isTrue`・`asNumber`・`equals`・`toDocument`）。(3) design 側 witness を `DesignWitness`（core／model／trace、`remapCore`）へ。3 型の型別名は adapter の入口だけに残るか消える。実装は裁定キュー完了後に 1 単位で行う（`TraceState` の索引表現は裁定 3-1 に依存）。
- （旧記述）**波28 の裁定の確認**: `PUBLISHED_VALUE_SHAPES`（`DesignValue`／`DecodedValue`／`TraceState`）を恒久除外にした。オーナーが「JSON 値の形も class で包め」と裁定するなら、`TraceState` は `valueAt(path)` + `toDocument()` の class に、`DesignValue`／`DecodedValue` は kernel の `JsonValue` DP に変換できる（読み手: `expression-evaluation`、`itf-decoder`、`quint-machine-*`、design の witness）
- [x] **裁定 5（2026-09-03）: A. #80 は裁定 2〜4 の実装後に最終単位として実施し close する**。両台帳（`DATA_MODEL_DEBT`・`PRIMITIVE_FIELD_DEBT`）を上限定数・陳腐化ガードごと削除、「プロパティを持つ公開 interface／object 型はすべて data model」に締めて red example、domain class の `#` でないフィールド宣言を禁止する規則、published language と表現プリミティブの除外を「パス・理由・利用可能層」の表 1 つにして層ごとの import を検査。名前だけの例外を無くす。
- [x] **裁定 4（2026-09-03）: A. `hasInvariantComponents` ゲートを外し、不変量義務が無いモデルでも Quint の機械フェーズを走らせる**。デッドロック検出とイベント義務の verdict／skip が必ず現れる（沈黙の解消）。コンパイラは既に `invAll = true` を出す。既存 golden は不変（全 fixture に不変量あり）、「背景制約とイベントだけ」の fixture・golden・テストを 1 組追加する。挙動変更なので docs に記録し、実装はキュー完了後の単位に含める。
- [x] **裁定 3-4（2026-09-03）: A. `#found: number` 3 件は refcheck の DP `FenceCount`（`of`・`asNumber`）に**。文言は不変。台帳 3 → 0。以上で `PRIMITIVE_FIELD_DEBT` は 3-1〜3-4 の実装後に 0 になる見込み（`ears`・`WitnessRef.#value` は prose 指定で対象外）。
- [x] **裁定 3-3（2026-09-03）: A. 語彙のスカラー文字列 20 件は既存 DP を当てる**。`#unit` 5 件 → `UnitName`（kernel へ昇格して共有）、`#artifact`／`ManifestEntry.#rel` → `ArtifactPath`、`WitnessRef.#element` → `ElementPath`、`Skipped.#target` → `TargetId`、`LoweredObligation.#nature`／`#trigger` → `ObligationNature`／`TriggerName`（kernel へ昇格）、digest 4 件 → `ContentHash`、`SmtEventPairProbe.#qOverlap`／`#qJoint` → 新 DP `QueryLabel`。`WitnessRef.#value` は原文の逐語引用なので prose として `PROSE_FIELD_NAMES` へ。文書・レポートは不変。
- [x] **裁定 3-2（2026-09-03）: A. kernel の DP に因数分解**。`FindingKind`（閉集合 11 種と順位、`parse` は閉集合・`reconstitute` は逐語、`compareTo`・`isConflict`・`asString`）、`VerificationMethod`（4 種）、`AttributeKind`（`isBool`／`isInt`／`isEnum`・`label`）。単一契約の語彙なので kernel で共有。順位表 5 → 1、`kind-rank.test.ts` は不要に。文書・レポートは不変。
- [x] **裁定 3-2 補足（2026-09-03）**: `Obligation.#ears` は削除しない。契約1 の項目（EARS 正規化文、LLM が読む）なので prose として `PROSE_FIELD_NAMES` に加え、台帳から外す。残り 9 件（finding `#kind` 4、属性 `#kind` 2、`#method` 3）の DP 化の可否は裁定待ち。
- [x] **裁定 3-1（2026-09-03）: 索引・コレクションの内部表現 29 件は除外ではなく DP 化**。キーは DP、値は DP か domain オブジェクト、表には名前（例 `SmtVerificationPlan.#compiled: CompiledObligations`、`isCompiled(id: ObligationId)`）。最内層の string キー Map は kernel の表現プリミティブ `KeyedIndex<K extends { asString() }, V>`／`KeySet<K>` の 2 ファイルだけに置き、DP ラッパーの唯一の `#value` と同じ理屈で恒久除外に載せる（A）。`readonly string[]` 3 件（`FrRefs`／`BrRefs`／`CheckedUnits`）は要素 DP の配列に。同じ形の `LoweredObligation`／`LoweredScenario` の `#frRefs: readonly string[]`（既存 `FrRefs` を使う）と `#core: string[]` 2 件（unsat core ラベルの DP コレクション、裁定 2 の `DesignWitness` と同じ単位）も本裁定に含める（計 33 件）。実装はキュー完了後の単位。
- `PRIMITIVE_FIELD_DEBT`（残 83 記述子）の裁定待ち項目: DP の門の内側にある `ReadonlyMap<string, …>` 索引を表現とみなして除外するか、分類文字列（`kind` / `method` / `nature` / `pattern`）を DP 化するか、doctor の行（`space`／`intent`／`unit`／`artifact`——`IntentRef` DP 候補）、数値メタデータ（`found`／`findings`／`eligible`／`scanned`。Ruling A が保留）
- [x] 波24 で `RefinementAttribute.min`/`max`・`DesignAssignments.count`、波22 で `RefinementProbe.reqId` を「誰も読まない」として削除した件 — **裁定（2026-09-03）: A. 追認。削除のまま、必要になった検査と一緒に足す**（docs/decisions への記録はキュー完了後に 1 PR でまとめる）

## 裁定キュー（種別規律の基線監査、1 件ずつ質問して裁定する。2026-09-02 開始）

状態: `[ ]` 未裁定 / `[x]` 裁定済み（裁定内容を末尾に記す）。裁定は `docs/decisions.md` の種別規律の項へ追記する。

1. [x] `IdOrder`（kernel、static のみ。25 ファイル・62 呼び出し: compare 40 / sortedUnique 20）— **裁定: 解体。値オブジェクトへ吸収** → **実装済み: 波29 PR #108**（kernel の非公開ヘルパーへ降格し、公開面は DP の `compareTo` とコレクションの `sortedCanonically`／`sortedUnique` だけ。呼び手 25 ファイルを DP 経由へ）
2. [x] `Expressions`（kernel、static のみ。9 ファイル・15 呼び出し）— **裁定: 解体。kernel の値オブジェクト `ExpressionTree` へ吸収**（`walk`／`usesPrime`／参照パス列挙を振る舞いに。`eqRef` は `DesignTransition`／`DesignIgnore` の振る舞いへ。JSON 境界で包み、直列化で剥く） → **実装済み: 波30 PR #109**
3. [x] `Names`（kernel、static のみ。6 ファイル・7 呼び出し）— **裁定: 解体。kernel の DP `NormalizedName` へ吸収**（正規化規則と `equals` を持つ。4 つの名前 DP の `normalized()` はそれを返し、`MachineSpec.entityToken()` は `EntityName` を返す） → **実装済み: 波31 PR #110**
4. [x] `ExpressionCanonicalKey`（design、static のみ。2 ファイル・4 呼び出し）— **裁定: 解体。`ExpressionTree.isCanonicallyEqual(other)` へ吸収**（正準キー計算は非公開の内側へ。shadow 検出は効果の木どうしに問う） → **実装済み: 波30 PR #109**
5. [x] `ExpressionEvaluation`（requirements、static のみ。2 ファイル・3 呼び出し）— **裁定: 解体。値オブジェクト `QuintMachineComponent.isViolatedIn` の内側へ吸収**（評価器はモジュール非公開ヘルパーへ降格。kernel は復号値を知らない） → **実装済み: 波30 PR #109**
6. [x] `designWellFormednessErrors`（design、自由関数。usecase 1 が呼ぶ）— **裁定: 解体。整合性はエンティティ／値オブジェクトの不変条件として守らせる**（各宣言 `Design*Decl` が自分の整合性を判定し、ユニット横断分は `DesignUnitDecls` が集める。文言と発生順は凍結） → **実装済み: 波32 PR #111**
7. [x] `SmtPlanFacts`（requirements、判定解釈。adapter が構築、usecase が interpret）— **裁定: 値オブジェクトと分類し、`SmtVerificationPlan` へ改名**（コンパイラの対応表＋翻訳。イベントではない）。**併せて命名規律: 「事実（facts）」という語はドメインイベント以外に使わない** → **実装済み: 波33 PR #112**
8. [x] `QuintMachineFacts`（requirements、判定解釈。同上）— **裁定: 値オブジェクトと分類し `QuintMachinePlan` へ改名**。同形の `RefinementSolverFacts` も **`RefinementSolverPlan` へ改名**（命名規律） → **実装済み: 波33 PR #112**
9. [x] `UnitRefinementPlan`（refinement、計画。9 ファイル）— **裁定: 値オブジェクトと分類**（コード不変。台帳に種別を記録） → **記録のみ（コード不変）**
10. [x] `AlphaContext`（refinement、置換文脈。3 ファイル）— **裁定: 解体。FCC `AttributeMappings` へ吸収**（要件パスによる検索と、要素へ委ねる `substitute`／`equalityFor`）。**併せて: `AttributeMapping` はエンティティ**（要件属性パスで識別される。値オブジェクトでは識別できない） → **実装済み: 波34 PR #113**
11. [x] `ComponentCheckMaterials`（refcheck、検査走行 `runChecks`）— **裁定: 解体。各ファミリーの判定を `ComponentCatalogOutcome`／`Components`／`Component` の不変条件へ移し、集約 `DesignRecord` が `checkComponents(ledger)` で台帳に書かせる**（文言・順序は golden 凍結） → **実装済み: 波40 PR #119**
12. [x] `ContractCheckMaterials`（同上）— **裁定: 解体。CD-1／CD-3 は `ContractRow`×`UnitDecls` の不変条件、CD-2 は `SpecBlockAssessment` の不変条件へ。`DesignRecord.checkContracts(ledger)`** → **実装済み: 波40 PR #119**
13. [x] `FunctionalCheckMaterials`（同上）— **裁定: 解体。FD-E／FD-R／FD-S／XS を宣言側（`DeclaredEntities`・`RuleDecls`・`StateMachineSketch`・`DomainEntitySketches` ほか）の不変条件へ。`DesignRecord.checkFunctionalDesign(ledger)`** → **実装済み: 波40 PR #119**
14. [x] `CheckFamilyLedger`（refcheck、可変累積器。7 ファイル）— **裁定: 解体。集約ルート `ReferenceCheckReport` へ吸収**（`open(id, families, unit)` で開き、`finding`／`skip` はレポートのコマンド、checked の導出はレポートの不変条件。リードモデルではなく書き込み側） → **実装済み: 波38 PR #117**（`compose` は消え、正準順もコマンド自身が守る不変条件に。閉じる手順はない）
15. [x] `AlphaError`（refinement、例外型。5 ファイル）— **裁定: 解体。UL で名づけた抽象データ型 `RefinementMapDefect`（uncoveredAttribute／enumMappingOutsideEquality／unspecifiedMapping／effectNotAssignmentConjunction）を新設し、`Result` の値で返す**。凍結文言は各バリアントが描画、公開語彙 compile-error への対応も型が知る。throw/catch は消す → **実装済み: 波35 PR #114**
16. [x] `LoadedDocument<Outcome>`（refcheck、generic record。ルールの穴）— **裁定: 解体。集約 `DesignRecord` の内側へ解散**（文書＝アンカー＋結果を集約が持ち、検査と inputs[] の記録を自分で行う。`functional()`／`declaredUnits()` の record 露出も消す）。**data-model ルールは型引数付き interface も検出するよう修正**
17. [x] `LoweringKind`（design、分類文字列の別名）— **裁定: 値オブジェクト `LoweredOrigin` の内部表現へ閉じ込める**（ファイルと export は消し、外は `isKind`／`isSyntheticProbe` だけ） → **実装済み: 波36 PR #115**
18. [x] `CheckSeverity`（doctor、同上）— **裁定: ドメインプリミティブ（値オブジェクト）化**（`error()`／`advisory()`、`blocksDoctor()`、文書への `asString()`。`Check` と `ManifestEntry` が共有。JSON バイト不変） → **実装済み: 波36 PR #115**
19. [x] `CoverageState`（doctor、同上）— **裁定: ドメインプリミティブ（値オブジェクト）化して `CoverageRow`／`UnitCoverageRow` で共有**（`unverified()`／`stale()`、`match`） → **実装済み: 波36 PR #115**
20. [x] `CheckExecutionMode`（refcheck、同上。usecase 3 が使う）— **裁定: ドメインオブジェクトではない。refcheck/usecase の入力側へ移し、domain facade から消す** → **実装済み: 波36 PR #115**
21. [x] `RefinementQueryStatus`／`SmtQueryStatus`（refinement／requirements、同上）— **裁定: 各判定値オブジェクト（`SmtQueryVerdict`／`RefinementQueryVerdict`）の内部表現へ閉じ込める**（型別名のファイルと export は消す。境界をまたぐ共有はしない） → **実装済み: 波36 PR #115**
22. [x] **追加**: doctor の `CoverageAssessment`・`UnitCoverage`・`StructuralDebt`・各 `*Row` — **裁定: リードモデルと分類し、クエリ側（doctor/usecase）へ移す**。規律に「リードモデルは domain 層の住人ではなく usecase（クエリ側）に置く」を追記。純粋な値オブジェクト（`Check`・`CheckSeverity`・`ManifestEntry`・`DigestAnchor` など）は domain に残る → **実装済み: 波37 PR #116**

## 未実装の裁定: なし（波40 で完了。2026-09-03 オーナー指示「波を増やさない・意味のある単位で終わらせる」のとおり 2 単位で終了）

**波を増やさない・意味のある単位で終わらせる（2026-09-03 オーナー指示）**: 残りは裁定 11・12・13・16 の 4 件で、これが本プログラムの残作業のすべて。下の 2 単位で終了し、新しい波を足さない。裁定待ちの項目（下記「残作業」）を波として提案しない。42 まで振った波番号は取り消し、波40 が最終波。

- **波39 = 裁定 16「集約が自分の文書と検査を持つ」（実装済み）**: `LoadedDocument<Outcome>` を `DesignRecord` の内側へ（文書＝アンカー＋結果を集約が持ち、inputs[] を自分で記録）。`functional()`／`declaredUnits()` の record 露出を消し、`DesignRecord.checkComponents／checkContracts／checkFunctionalDesign(report)` の門を用意する（門は開いた `ReferenceCheckReport` に `finding`／`skip`／`input` を書く）。`tests/architecture/rules.ts` の `noDataModelsInDomain` の interface パターンを型引数付き（`export interface X<T> {`）も拾うよう修正。
- **波40 = 裁定 11・12・13「検査が宣言の不変条件になる」（最終波、#119 で実装済み）**: `ComponentCheckMaterials`／`ContractCheckMaterials`／`FunctionalCheckMaterials`（計 786 行）を解体し、各ファミリーの判定を該当する値オブジェクト／コレクションの不変条件へ（DD: `ComponentCatalogOutcome`／`Components`／`Component`、CD: `ContractRow`×`UnitDecls`・`SpecBlockAssessment`、FD/XS: `DeclaredEntities`・`RuleDecls`・`StateMachineSketch`・`DomainEntitySketches`）。文言と発生順は golden 凍結。1 つの PR で行う。

## 再開手順

1. 上記チェックアウトで `git checkout main && git pull --ff-only`
2. 波のブランチを切る（例: `refactor/tda-wave11-...`）。**stacked PR は避ける**（base ブランチが削除されると PR が閉じ、force-push 後は reopen もできない——波10 で経験）
3. 残作業からスコープを決める（これまではオーナー裁定制。波8 で `QuintMachineRunVerdict` は完了）
4. 下記「流儀」に従って実装・検証・コミット
5. push → PR 作成 → CI（約2分）+ レビューボット確認 → squash マージ
6. `docs/decisions.md` / `docs/decisions.ja.md` 両方に波の段落を追記（「同 PR」表記、PR番号は書かない、台帳カウントを更新）

## 流儀（波1–7 で確立。守ること）

- **リードモデル規律（2026-09-02 裁定）**: CQRS のリードモデル（表示や照会のために書き込み側の状態を畳み込んだ投影）は domain 層の住人ではない。usecase（クエリ側）に置く。
- **不変条件規律（2026-09-02 裁定）**: 整合性はエンティティ／値オブジェクトに不変条件として守らせる。検査手順をオブジェクトに包んだドメインサービスは作らない。
- **ドメインエラー規律（2026-09-02 裁定）**: ドメインエラー型は domain 層のモデルだが、型とバリアントがユビキタス言語に対応づくこと。予期された失敗は例外ではなく `Result` の値で返す。
- **識別規律（2026-09-02 裁定）**: コレクションからキーで検索される要素は識別が要るのでエンティティ（例: `AttributeMapping` は要件属性パスで識別されるローカルエンティティ）。値オブジェクトは識別できないものにだけ使う。
- **命名規律（2026-09-02 裁定）**: 「事実（facts）」という語はドメインイベント（成立した事態）以外に使わない。計画の対応表や解釈材料は `*Plan` 等の実体に合う名にする。
- **ドメインオブジェクトの種別規律（2026-09-02 裁定）**: 置いてよいのはエンティティ（ローカル／集約ルート）・値オブジェクト・ファーストクラスコレクション・ドメインイベントだけ。ドメインサービスは人間の裁定必須、それ以外の種類は実測ありの問題と対策を添えて裁定にかける。基線監査の逸脱リストは `docs/decisions.md` の同日付の項に記録済み（裁定待ち）。
- **外部仕様不変の規律（2026-09-03 オーナー指示）**: 外部仕様（IR・refinement map・レポート JSON・doctor 出力など、LLM と人間が読む文書の項目）は変えない。ツールが読まないことは文書項目や、それを運ぶ domain のフィールドを消す理由にならない（例: `Obligation.ears` は EARS 正規化文で LLM が読む——保持し、prose として `PROSE_FIELD_NAMES` に載せる）。削除してよいのは、文書項目に対応しない in-memory のフィールド／getter で、読み手が I/O にも domain にもゼロのものだけ（波22・24・40 の削除はすべてこれに該当し、スキーマ・執筆ガイド・golden は不変）。
- **getter の基準（2026-09-03 オーナー確認）**: getter は I/O 境界（Repository／serializer／presenter）が永続化・描画のために読むものだけ残す。domain 側のロジックが getter で中身を引き出して外で判断するのは禁止で、その判断はオブジェクトの振る舞いにする。読み手が I/O にも domain にもいない getter は消す。全廃できるならそれが理想だが、I/O が読む getter を無理に消さない。エンティティの `id()` は識別として残す。
- **commandable class の形**: private `#` フィールド、private constructor、ドアは `static reconstitute`（匿名 props 型のインライン署名が波6以降のスタイル。seed ファイルがある型は seed 経由）。振る舞いメソッド + 必要な reader のみアクセサ公開。
- **golden は byte-frozen**: finding の文言・並び・witness 参照は逐語移植。発生順を変えない（レポート合成で `sortedCanonically()` される場合のみループ分割可）。
- **カバレッジの罠**: bun のカバレッジ床（`bunfig.toml`、0.9）は**行と関数の両方**に掛かり、domain 層のみ計測。class 化でメソッドが増えたらアクセサのラウンドトリップテストを足さないと床が落ちる。追加先は `tests/refcheck-domain.test.ts` / `tests/design-domain.test.ts` / `tests/requirements-domain.test.ts` の既存パターン。
- **TS の罠**: `#private` フィールドの narrowing はクロージャ内に持ち越せない。`const variant = this.#variant;` でローカルに受ける。
- **検証**: `cd deep-spec-analysis && bun test`、`bunx tsc --noEmit`、`bun test --coverage`（触れた domain ファイルは 100/100 目標、既存の未カバー分は main ベースラインと比較して退行でないことを示す）。
- **コミット**: Conventional Commits・英語・叙事スタイル。例: `refactor: design findings and machines own their verdict logic (owner ruling, #71 wave 7)`。attribution/co-author 行なし。
- **マージ**: squash（件名に `(#番号)` が付く形式がリポジトリ慣例）。
- **レビューボット待ちは言い訳にしない（2026-09-03 オーナー指示）**: CodeRabbit がレートリミット（review 枠切れ）なら待たずにマージへ進む。CI グリーンと、既に付いている指摘の解決が条件で、来ていないレビューを待つ理由にはしない。報告でも「待ち」を留意点として書かない。
- **レビュー対応**: コメント取得は `gh api repos/amadeus-dlc/aidlc-deep-spec-analysis-plugin/pulls/<N>/comments`（オーナー環境では個人スキル `j5ik2o-gh-pr-review-follow-up` の `fetch_comments.py` で同じ API を叩いている）。返信は `gh api repos/.../pulls/N/comments -X POST -F in_reply_to=<数値id>`、解決は GraphQL `resolveReviewThread`。
- **`gh pr view` の罠**: `headRefOid` が古いまま詰まることがある。PR の close/reopen で直る（波3で経験）。

## 未了の雑務

- [x] リモートブランチの残骸（波2／4／6／7 の 4 本と、それ以前の `feature/phase*`／`fix/phase2-review-followup`／`refactor/ddd-*` 6 本）と、squash マージ済みのローカルブランチ 18 本は 2026-09-03 に削除した。残るリモートブランチは `main` と `renovate/configure`（open PR #1）だけ。過去波のコミットは各 PR に残っている。
- [x] issue #71 は 2026-09-03 に完了報告コメントつきで close 済み。子 Issue #74〜#79 も対応 PR を記して close 済み。#80（最終アーキテクチャゲート）は単位 4（#124）で完了条件（`DATA_MODEL_DEBT` 定数の削除・一メソッド同居 interface の red example・public mutable state の検出・published language の利用可能層検査）をすべて満たして close 済み。open issue は 0 件。
