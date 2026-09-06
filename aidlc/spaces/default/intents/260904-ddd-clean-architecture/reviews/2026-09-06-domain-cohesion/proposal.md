# ドメインモデルの具体的な改善案

## 方針

[監査結果](report.md)の5群を、属性宣言、イベントと包摂、精緻化の被覆、検証問い、診断の順で是正する。既存型の振る舞いを拡充し、新設する型には独立した意味と不変条件を持たせる。

以下は設計案であり、型名・API名は候補。アプリケーションにはまだ適用していない。

共通の構築契約は次のとおりとする。

- コンストラクタは具体的なTypeScript型を受け、値の制約と型間の関係を検査する。
- `of`は同じコンストラクタを通り、契約違反をpanicとして伝播させる。
- コンストラクタが契約違反を送出しうる型には`parse`を設け、自分の構築契約違反を非例外の`ParseError`へ変換する。
- 通常処理で不適合が起こりうる入力は`parse`から生成する。集合はドメイン要素を保持する。
- クエリは状態を変更せず、レポートへ記録するコマンドは`void`を返す。
- 呼び出し側まで一括で変更し、役割を失った旧APIを削除する。

## 1. 属性宣言の一意性と解決規則を固定する

対象は`DesignUnitDeclaration.wellFormednessErrors`と`IntermediateRepresentationModelDeclaration.wellFormednessErrors`。最初に、重複宣言を通過させる不具合を塞ぐ。

### 所有者と不変条件

| 型 | 担当 |
| --- | --- |
| 既存`DesignEntityDeclarations` | 入力文書の宣言を保持し、同名エンティティ・同名属性・同一座標の重複を列挙する。 |
| 新設`DesignAttributeCatalog`（VO） | 一意に解決できる設計属性のカタログ。エンティティ名・属性座標の重複を拒否し、照会を一つの規則に固定する。 |
| 既存`DesignUnit` | カタログを受け取り、refinement向けの判断をそのカタログへ依頼する。 |

`DesignEntityDeclarations`では、診断すべき文書として重複を保持できる。カタログは重複した宣言から構築できない。この違いを型で表す。

重複を列挙する規則は宣言集合に一度だけ実装し、診断とカタログのコンストラクタが共有する。カタログ構築に失敗した場合は重複の診断を返す。曖昧な座標を使う検査は進めず、ID一意性やBR被覆など独立して実行できる検査は継続する。

### APIの変更案

| API | 契約 |
| --- | --- |
| `DesignAttributeCatalog.parse(declarations)` | `Result<DesignAttributeCatalog, ParseError>`。通常の文書入力からの生成口。 |
| `DesignAttributeCatalog.of(declarations)` | 同じ不変条件を検査。重複を指定した呼び出しの誤りはpanic。 |
| `DesignUnit.parse({ unit, catalog, obligations, machines, scenarios, background })` | 属性に依存する操作では、構築済みカタログを必須とする。 |
| 各宣言の`diagnostics(...)` | `ErrorMessages`で診断を返す。既存の`ErrorMessage.parse`・`ErrorMessages.collect`で表示予算も扱う。 |

`DesignUnit`内の最初の一致を探す`#attributeAt`と、検査メソッド内の最後の一致で上書きする`attrTypes`を置き換える。シリアライズに必要な元のエンティティ宣言・説明文はカタログから取得できる境界を残す。

### 同時に移す責務

- 式の構造・参照の列挙は`ExpressionTree`に集約し、各コンテキストの宣言がその契約に従って意味を検査する。kernelからdesign/requirementsへの依存は作らない。
- 状態集合、遷移、ignoreの整合は`DesignMachineDeclaration`が担当する。
- アダプタが`rulesMarkdown`から`BusinessRuleReferenceIndex`を作り、ドメインへ渡す。ドメインは規則の被覆を判定する。
- 要件側にも同じ所有境界を適用する。要件と設計で意図されているenum検査の差は、各コンテキストの契約として維持する。

### 検証

- 同名エンティティ、同名属性、同一座標の競合を診断できる。
- 問題のfixtureは実センサーで`pass: false`になる。
- カタログの`of`は重複を例外で拒否し、`parse`は非例外エラーを返す。
- 正常な宣言では、検証・lowering・refinementが同じ属性定義を使う。
- エラー収集は`ErrorMessage`を保持し、要件/設計のenum仕様差はそれぞれの期待値で確認する。

## 2. イベント、包摂候補、証明された関係をモデル化する

対象は`DesignUnit.lowered`と`SiblingVerdictDocument.#remapReadable`。前回の「包摂関係をVO化」を、検証前後で具体化する。

### 既存イベントモデルの拡充

`DesignEvent`と`DesignEventCatalog`が既にあるため、ここを共通の所有者にする。現在の`DesignEvent`はguardと代入表が中心で、loweringの`EventCandidate`が持つtrigger・元のeffect・設計上の識別が不足している。

- `DesignEvent`が設計上の識別、trigger、guard、元のeffectを保持する。
- 元のeffectを`ExpressionTree`として保持し、代入表はそこから導出する。代入表への変換で失われる表現を、包摂候補の比較に使用しない。
- 義務と状態機械からイベントを作る責務を、それぞれの型へ移す。`DesignEventCatalog`はイベントの検索・集合としての操作を持つ。
- 同トリガ・正準表現で同じ効果かどうかはイベント同士の振る舞いにする。

### 検証前後の型

| 候補型 | 意味・不変条件 |
| --- | --- |
| `RuleSubsumptionProbe`（VO） | 「AがBを包摂するか」という方向付きの問い。異なる二つのイベント、同トリガ、正準表現で一致する効果が必須。まだ包摂が成立したとは扱わない。 |
| `RuleSubsumptionVerdict`（VO） | 問いに対する成立・不成立・未決の判定。問いとの対応と証拠を保持する。 |
| `RuleSubsumption`（VO） | 成立が確認された方向付きの関係。検証結果から生成する。 |
| `RuleSubsumptions`（FCC） | 成立した関係を保持し、死ルールの関係を除外し、逆方向の関係と合わせて相互同値を判定する。 |

候補構築の引数は次の形とする。

```ts
type RuleSubsumptionProbeParam = {
  subsumer: DesignEvent;
  subsumed: DesignEvent;
};
```

`of(props)`と`parse(props)`は同じコンストラクタを通る。自己関係は値の契約違反として拒否する。同トリガ・同効果の検査もコンストラクタに集約する。

`LoweredOrigin`は種類ごとの必要な値を持つ閉じた変種にする。包摂用の変種には`RuleSubsumptionProbe`を必須とし、任意の`pair`を廃止する。識別子を`"A|B"`へ連結して関係の代わりに使う処理も置き換える。

### 義務と帰属を不可分にする

- `LoweredObligation`が自分の`LoweredOrigin`を必須で保持する。
- `LoweredScenario`も設計シナリオへの帰属を保持する。
- `LoweringIndex`は変換済み要素から導出する。義務配列と帰属配列を別々にpushする処理を削除する。
- `LoweredUnit.extendedWith`にも同じ構築経路を適用し、追加不変量だけが別規則にならないようにする。
- 遷移の機械・属性への帰属も、遷移用の`LoweredOrigin`から導出する。

### 検証

- 対の省略はTypeScriptの呼び出し契約で防ぎ、自己関係は`of`/`parse`双方で拒否する。
- 候補段階では包摂診断を生成しない。成立、不成立、未決の結果を区別する。
- 片方向包摂、相互同値、死ルールの包摂抑止を確認する。
- 生成された全義務・シナリオに帰属があり、追加不変量にも同じ性質が成り立つ。
- 採番、出力順、効果の正準比較、元の式から代入表を作るときの既存の扱いをfixtureで確認する。

## 3. 写像の適合と、属性の被覆分類を分担する

対象は251行の`UnitRefinementPlan.of`。

| 型 | 追加する振る舞い |
| --- | --- |
| `AttributeMapping` | 要件属性と設計カタログに対する適合を診断する。enumMapの全域性・出力値域・式の参照解決を完結させる。 |
| `AttributeMappings` | 属性参照集合の被覆を計算する。`ExpressionTree`の参照列挙を利用する。 |
| `UnmappedDeclarations` | 明示免除の対象と理由を型付きで答える。 |
| 新設`AttributeCoverage`（VO） | 必要な属性を、写像済み・明示免除・未被覆へ分類した結果を保持する。区分の重複や漏れを許さない。 |
| `EventMapping` | 必要なイベント写像と遷移参照の整合を診断する。 |
| `RefinementObligation`／`RefinementScenario` | 自分の式・binding・種類から必要な被覆を求め、`RefinementStatus`へ分類する。 |

候補APIは`AttributeMappings.coverageOf(paths: AttributePaths, unmapped: UnmappedDeclarations): AttributeCoverage`とする。区分は`AttributePaths`などのドメインコレクションで保持する。

**部分的な免除の扱いも固定する。** 必要な未写像属性がすべて明示免除ならwaived、未被覆が一つでも残ればgap。すべて写像済みならcheckable。バックエンドの能力不足は属性の被覆とは別の条件として、義務・シナリオ側で判定する。

`UnitRefinementPlan`は分類済みの対象、写像、遷移対応、診断を保持する。現在のローカル`byReq`、`exprRefs`、`attrsCovered`、義務・イベント・シナリオで繰り返す分類処理を置き換える。

検証では、必要参照が空、全件写像済み、全件免除、写像と免除の混在、未被覆を含む場合、イベント写像不在、能力不足を表で確認する。既存の明示免除と能力判定の優先順も固定する。

## 4. 検証問いが自分の結果を解釈する

対象は3つの`interpret`、計406行。

- `RefinementProbe`のinvariant・scenario・enabledness・simulationそれぞれが、判定を診断へ変換する責務を持つ。
- scenario用の問いは、単なるIDに加え、期待する受理・拒否、対象、要件参照を構築時に持つ。simulation用の問いは、要件義務と設計遷移を必須で持つ。
- `SatisfiabilityModuloTheoriesEventPairProbe`が重なりと効果両立の判定を組み合わせ、衝突・未決・問題なしを決める。
- `Scenario.isViolatedBySatisfiability`に既にある規則を利用する。`Scenario`、`DesignScenario`、`RefinementScenario`にまたがる受理・拒否の共通規則は、必要な共通VO`ScenarioExpectation`へ集約する。
- 未決の判定をbooleanのfalseへ変換せず、skipとして扱う。
- `QuintMachinePlan`には`VerificationMethod`を渡す。boundedの能力判定もこの型の振る舞いにする。

計画側に残すのは、発行した問いと結果の対応、コンパイル時skipの取り込み、結果全体の整理である。大域UNSATで空虚性の派生診断を抑止する規則や、既にskip済みの対象を再評価しない規則もここで扱う。

問いの意味を呼び出し側のコールバックへ渡している`RefinementProbe.match`を置き換え、adapterのクエリ生成側も新しい問いを構築するよう同時に変更する。SAT/UNSATの意味は問い合わせごとに異なるため、プロトコルの判定値を読み取る処理と、ドメイン上の意味づけを分担する。

検証は、各問いについてSAT・UNSAT・未決・結果欠落を網羅し、accept/rejectと充足可能性の組み合わせを確認する。core・model・traceの証拠と診断の対象も公開インターフェイスで検証する。

## 5. 要素が自分の診断を完成させる

対象は`Components.check`と`DeclaredEntities.check`。既存の判定メソッドを活かし、findingの種類・対象・証拠・文言も適切な所有者へ集める。

| 所有者 | 担当 |
| --- | --- |
| `AttributeDeclaration` | 型区分、境界、既定値の診断。属性名・境界値を親が取り直して文言を組む処理を移す。 |
| `RelationshipDeclaration` | 関係の端点と多重度の診断。対象集合との参照解決もここから依頼する。 |
| `Component`／`ComponentEntity` | 個体の名前・自己参照・identifier等の診断。 |
| `Components`／`EntityDeclarations` | 重複、所有、依存対称性、参照解決、循環といった集合の規則。 |

API例は`AttributeDeclaration.checkBounds(report: ReferenceCheckReport, entity: EntityName, artifact: ArtifactPath): void`。必要なドメイン型を渡し、要素が自分の診断をレポートへ記録する。

診断順序は既存のDD/FDファミリー順・宣言順を保つ。種類別の診断を要素に依頼できるようにし、親は順序を調整する。単純に一要素ずつ全検査を実行して、現在の診断順序を変えないようにする。

## 実施単位と完了条件

| 順序 | 実施単位 | 完了条件 |
| ---: | --- | --- |
| 1 | 宣言カタログと重複検出 | 実センサーの回帰テストが成功し、最初・最後で異なる属性解決が消える。 |
| 2 | 包摂候補と成立した関係、帰属の一体化 | 不完全な関係を構築できず、自己包摂の誤診断が消える。 |
| 3 | 被覆分類 | 分類規則が一か所になり、義務・イベント・シナリオで一貫する。 |
| 4 | 検証問いの解釈 | 判定の意味を問いが所有し、計画のコールバックに判断が残らない。 |
| 5 | 個体の診断 | 親が値を取り直して診断を組む処理が減り、集合としての規則が明確になる。 |

各単位でadapter・公開facade・生成物・テストまで更新する。引数だけを合わせる互換メソッドや、使われなくなったgetter・ローカル型・補助関数は削除する。

最終確認は、再現した2件の回帰テスト、VOの構築契約、関連golden、usecase境界のLint、型検査、全テストとカバレッジ、生成物の同期、各ハーネスのビルドで行う。正常入力の観測結果を確認し、新たに拒否する重複宣言は意図した変更として記録する。

上位10件の実装行数・if数も再計測する。短くなった呼び出し元だけでなく、移した先を含めて、同じ規則の重複、不変条件の抜け、責務の集中が減ったことを確認する。
