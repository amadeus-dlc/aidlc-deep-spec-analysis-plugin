# 索引・辞書の契約監査

## 対象と方法

基線: `20d768cb457f90c45751b7da83f687fe7835393f`。アプリケーションソースは変更していない。

ドメイン層383ファイルのクラスフィールドと同一ファイル内の型別名をTypeScript 7のASTで走査した。KeyedIndex・KeySet・Map・Set・Record・文字列インデックスシグネチャを保持する33型を抽出した。内訳はkernel 3、design 15、requirements 12、refcheck 2、doctor 1。修正済みTraceStateと辞書状の証拠値も含む。[一覧](inventory.json)に検出基準とソースの指紋を記録した。

配列で実装した論理的な索引、RefinementPreparation、関連adapterの生成・復号・出力経路も追跡した。実測は公開APIと型の整合した入力で行い、privateフィールドの書き換えや型を消すキャストは使っていない。design、requirements/refcheck/doctor、kernel・出力境界を分担し、出力境界の候補は別担当が独立再現した。

以下は同じ原因の複数箇所をまとめた9件。P1は外部データが検査内容を変えたり検証全体を異常終了させたりするため優先するもの、P2は残る契約違反を示す。

## 確定した不具合

### R1 / P1: YAMLの特殊キーが宣言の階層を変える

場所: `src/kernel/adapter/yaml.ts:98,112,115,127,131`、`src/refcheck/adapter/functional-design-parser.ts:108`。

通常オブジェクトへ動的キーを代入するため、`__proto__`にネストしたマッピングが返却オブジェクトの継承プロパティになる。最上位にentitiesを持たないYAMLを与えると、JSON化は`{}`、`Object.hasOwn(value, "entities")`はfalseだったが、parseEntitiesDocumentは継承entitiesからGhostという実体を1件抽出した。通常のentities文書から直接到達する。

一般のObject.prototype全体の変更やコード実行を示したものではない。返却オブジェクトの構造と後段の解釈が変わるデータ整合性の問題である。

是正方向: マッピングを安全なデータプロパティとして構築し、後段も宣言された自身のフィールドを読む。

### R2 / P1: 設計モデルの重複IDがResultではなくpanicになる

場所: `src/design/adapter/design-model-parser.ts:232`。構築契約は`src/design/domain/design-unit.ts:63-71`。

設計JSONに同じDOB-1のinvariantを2件置くと、parseDesignModelがResultを返さず、IllegalArgumentException（duplicate-design-target）を送出した。DesignUnit.parseがあるのに、外部入力からDesignUnit.ofを呼んでいる。

是正方向: DesignUnit.parseの失敗を既存のモデル解析エラーへ写像する。ofの例外は捕捉しない。

### R3 / P1: 精緻化solverの不正応答が型境界を通過する

場所: `src/design/adapter/refinement-solver-client-implementation.ts:115-119,53-71`。

子応答resultsの要素を検証せずMapへ入れ、その後にQueryLabel.parseやRefinementQueryVerdict.ofへ渡している。正常なUnitRefinementPlanに対し、statusだけがsatでidを欠く応答を返すと、checkがvalue.lengthのTypeErrorで異常終了した。

是正方向: id/status/model/core等の形と、要求queryとの対応を復号境界で検証し、型付きの成功結果だけをドメインへ渡す。不適合はRefinementCheck.unavailableへ写像する。requirements側のparseSmtChildResultsを既存の参考とする。

### R4 / P2: 状態機械の見出し数超過がpanicになる

場所: `src/refcheck/adapter/functional-design-parser.ts:411`。

MarkdownへState Machineの見出しを65,537件置くと、StateMachineSketches.ofからtoo-many-state-machine-sketchesのIllegalArgumentExceptionが漏れる。戻り値のFunctionalSpecificationOutcomeで不適合を表現していない。

是正方向: StateMachineSketches.parseを使い、超過を明示的な解析不能のoutcomeへ写像する。

### R5 / P2: 外部ディレクトリ名からUnitName.ofを呼ぶ

場所: `src/doctor/adapter/doctor-workspace-client-implementation.ts:273`、`src/refcheck/adapter/design-record-repository-implementation.ts:181`。

129文字のunitディレクトリ名で、doctor.functionalCoverageとrefcheck.findByIdの両方からunit-name-too-longのIllegalArgumentExceptionが漏れた。OS上に存在し得る名前の不適合が、Resultや観測上の失敗にならない。

是正方向: UnitName.parseを使い、取得結果や診断モデルへ明示的に失敗を渡す。黙ってディレクトリを除外しない。

### R6 / P2: 検証したスナップショットと検索索引が異なる

場所: `src/requirements/domain/requirement-attribute-declarations.ts:26-27`。

保持配列はboundedCollectionSnapshotで作るが、#byPathは元のvalues.mapから作る。型付き配列のindex getterが1回目にE.first、2回目にE.secondを返す入力で、toArrayはE.first、byPath(E.first)はundefined、byPath(E.second)はE.secondになった。

是正方向: 検証して保持するthis.#valuesから索引も構築する。追加の条件分岐で帳尻を合わせず、同じスナップショットを唯一の入力にする。

### R7 / P2: 実際に保持する反復結果の上限を確認しない

場所: `src/design/domain/machine-reachability.ts:34-38`、`src/design/domain/refinement-preparation.ts:20-24`。

配列lengthだけを確認してからspreadする。lengthが1でも型付きiteratorが65,537件を返す配列を与えると、MachineReachabilityは65,537 probe、RefinementPreparationは65,537 planを受理した。各型が明記する65,536件上限と一致しない。

是正方向: 既存のboundedCollectionSnapshotで、保持する反復結果を検査する。MachineReachabilityのobservationsもsizeと反復結果が対応する検証が必要だが、こちらは同型のソース上の懸念であり、独立の上限超過再現件数には数えていない。

### R8 / P2: combineResultsが成功結果の型と内容を維持しない

場所: `src/kernel/infrastructure/result-composition.ts:19-26`。

空の通常オブジェクトへfor-inで代入し、最後にTへキャストしている。

- 自身の__proto__フィールドに成功結果を渡すと、全体はokだがキーが消える。
- symbolキーの成功結果は、型上は保持されるのに実行時には消える。
- 数値Resultの配列を渡すと、型上はnumber[]だが実行時は配列ではない`{"0":2,"1":3}`になる。

これらの入力と返り値の型は、TypeScript 7のstrict検査にも通過した。現行の内部呼出しは固定された文字列キーのレコードが中心であり、通常のパーサ入力からの直接到達は確認していない。公開ジェネリックAPIの契約不整合として扱う。

是正方向: 成功時に保持するキーと形を明示し、実装で保持するか、サポートしない入力を型で拒否する。特殊キーを特例で捨てたり、Tへのキャストで形の不一致を隠したりしない。

### R9 / P2: モデル復号の公開APIでも特殊キーが欠落する

場所: `src/requirements/adapter/satisfiability-modulo-theories-plan.ts:123-145`、`src/design/adapter/refinement-query-plan.ts:206-227`。

decodeSolverModelとdecodeDesignModelも通常オブジェクトへの動的代入を行う。公開APIに、受理される__proto__属性パスとtrueのモデル値を渡すと、両方とも出力が`{}`になり当該キーが欠落した。

通常のモデルパーサーは実体名と属性名をドットで結ぶため、このパスが通常の形式モデル文書から生成される経路は確認していない。入力文書経由の到達性と公開APIの問題を区別する。

是正方向: 任意の受理済みキーを安全なデータプロパティとして出力する。R1/R8のキー欠落と同じ原因を各所で別々に特例処理しない。

## 契約判断が必要な点

FunctionalRequirementReferenceIndexに7 claim × 各10,000個の異なる参照を渡すと、70,000個の索引キーを受理した。外側のclaim数と各claim内の参照数は上限内だが、索引全体の展開数の上限は未定義である。具体的な既存数値上限への違反とは数えていない。共通のサイズ規律に従い、全体の処理予算を決める必要がある。

## 問題と判定しなかった事項

- KeyedIndexとKeySetは特殊キーを保持し、入力タプル配列の変更とwithによる更新から元の索引を保護した。
- RequirementIdentifiersは65,536件で既存キーのaddを許し、新規追加を拒否した。filter後も元の集合を保持した。
- AttributeMappingのenum cases、RefinementQueryVerdictのdecoded recordsは、既存の安全なコピーと自身のキー列挙を使っていた。
- DesignAssignments/EffectAssignments、両属性カタログ、DesignEventRuleCatalog、QueryVerdicts、SiblingUnitIndex等の通常の再構築はキー・所有者・検索面を保った。
- 宣言列やprobe列の順序は診断順に意味を持つため、TraceStateと同じ順序非依存の等価性へ機械的には変更しない。
- TraceValueのネストJSONの比較と、JSON数値キーの列挙順は既存契約として扱った。

## 検証の範囲

design担当は限定テスト24件・519 assertions、requirements/refcheck/doctor担当は40件・265 assertionsを実行し成功した。これに加えて、各findingの公開API再現、親による型検査、出力境界の独立再現を行った。既存テストが成功していても、今回の反例を排除できることは意味しない。修正と回帰テストの追加はまだ行っていない。


## 監査後の是正

この報告は基線での監査記録である。承認後の修正内容と最終検証は[是正記録](remediation.md)を参照。
