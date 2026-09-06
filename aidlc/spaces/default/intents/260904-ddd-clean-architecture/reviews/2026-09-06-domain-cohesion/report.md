# 長大なドメインメソッドの凝集度監査

## 結論

上位10メソッドの精査で、**5群の構造問題**を確認した。埋もれているのは主に、属性宣言の一意性と解決規則、式の意味検査、精緻化の被覆分類、イベント規則の包摂関係、検証問いの意味である。単に文書整形で行数が増えているものもあり、10件を同じ強さの問題とは扱わない。

2件は具体的な不具合として再現した。

1. **設計IRの重複エンティティを検出せず、属性の解決結果も検査とrefinementで一致しない。** 実センサーも重複を含む文書に`pass: true`を返した。
2. **包摂プローブの対を省略して構築でき、自己包摂の診断を作れる。** 公開ドメインAPIで再現した構築契約の欠落。現在の正常なlowering経路は対を渡しているため、その経路で自然発生する不具合とは区別する。

優先するのは、宣言と関係の不変条件をモデルへ戻すこと。その後、被覆分類と検証結果の解釈を、それを説明できるドメインオブジェクトへ移す。

## 対象と方法

- 基線: `87f151776ef13dd2f564c2a60ff0d4f5968eab65`のmain。前回の行数上位10件、実装行数合計1,510行を対象にした。
- 実装行数はシグネチャ・外側の波括弧・空行・コメントを除外。内部の括弧だけの行とコールバックは含む。[行数と数えた行番号](method-sizes.json)を保存した。
- ASTで`if`・ループ・コールバック・`new Map/Set`を追加計測した。[構造計測](structure-evidence.json)は出現数であり、循環的複雑度ではない。`Map/Set`やgetterの使用を、そのまま違反件数には数えていない。
- 呼び出し元、既存の要素型・コレクション、テスト、設計判断も照合した。再現には公開インターフェイスを使い、privateフィールドへアクセスしていない。
- アプリケーションの実装変更は行っていない。以下の型名・分担は改善案であり、新たな規律や確定済みのユビキタス言語ではない。

## 全10件の判定

| 順位 | メソッド | 実装行 | if | ループ | 問題群 | 判定 |
| ---: | --- | ---: | ---: | ---: | --- | --- |
| 1 | `UnitRefinementPlan.of` | 251 | 29 | 7 | G03 | 写像検査・被覆分類・診断化が一つのファクトリに集中。既存の写像・免除モデルへの委譲が不十分。 |
| 2 | `DesignUnitDeclaration.wellFormednessErrors` | 200 | 33 | 14 | G01 | 属性カタログ、式検査、状態機械、ID一意性、BR被覆を同時に管理。属性解決の不一致を再現。 |
| 3 | `QuintMachinePlan.interpret` | 161 | 16 | 3 | G04 | 機械違反、時相義務、シナリオの三つの判定を集約。シナリオの成否規則もここにある。 |
| 4 | `Components.check` | 160 | 10 | 18 | G05 | 集合として適切な責務も多い。個体の診断生成と集合の関係検査の境界を整理すべき。 |
| 5 | `DeclaredEntities.check` | 146 | 11 | 8 | G05 | 属性・関係の述語は委譲済みだが、診断を完成させる知識が親に集中。 |
| 6 | `SatisfiabilityModuloTheoriesVerificationPlan.interpret` | 142 | 15 | 4 | G04 | 一貫性・空虚性・イベント対・完全性・シナリオの判定を一つの計画が解釈。 |
| 7 | `SiblingVerdictDocument.#remapReadable` | 131 | 10 | 5 | G02 | 帰属変換に加え、死ルール・包摂・相互同値・免除・重複抑止を担当。 |
| 8 | `DesignUnit.lowered` | 129 | 4 | 11 | G02 | 基本の変換先としては妥当。採番・帰属の整合と、死ガード・包摂プローブ生成が局所状態に埋没。 |
| 9 | `RefinementSolverPlan.interpret` | 103 | 6 | 1 | G04 | `RefinementProbe.match`のコールバック側に4種の問いの判断が残る。 |
| 10 | `IntermediateRepresentationModelDeclaration.wellFormednessErrors` | 87 | 13 | 6 | G01 | 属性カタログと式検査を別実装。設計側との共通規則と意図した仕様差の境界が明示されていない。 |

合計は`if`147個、ループ77個、コールバック等76個、`new Map/Set`24個。これらの数だけから不具合を推論していない。

## G01 — 属性カタログと意味検査が集約の局所変数になっている

**優先度: P1。再現済みの検出漏れと解決結果の不一致がある。**

対象:

- [DesignUnitDeclaration.wellFormednessErrors](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/87f151776ef13dd2f564c2a60ff0d4f5968eab65/deep-spec-analysis/src/design/domain/design-unit-declaration.ts#L108)
- [IntermediateRepresentationModelDeclaration.wellFormednessErrors](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/87f151776ef13dd2f564c2a60ff0d4f5968eab65/deep-spec-analysis/src/requirements/domain/intermediate-representation-model-declaration.ts#L48)

設計側は各エンティティの属性を`Map<string, DesignAttributeDeclaration>`へ登録し、同じ座標があれば後の宣言で上書きする（115〜131行）。[DesignEntityDeclaration.inspectAttributes](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/87f151776ef13dd2f564c2a60ff0d4f5968eab65/deep-spec-analysis/src/design/domain/design-entity-declaration.ts#L46)が検出する重複は、一つのエンティティ内だけである。[DesignEntityDeclarations](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/87f151776ef13dd2f564c2a60ff0d4f5968eab65/deep-spec-analysis/src/design/domain/design-entity-declarations.ts#L3)は配列の保持・追加・列挙が中心で、エンティティ名の一意性と座標解決を所有していない。

一方、[DesignUnitの属性照会](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/87f151776ef13dd2f564c2a60ff0d4f5968eab65/deep-spec-analysis/src/design/domain/design-unit.ts#L294)は最初の一致を返す。属性を表すVOがあっても、**宣言の集合として何を一意に定めるか**がモデル化されていない。

再現結果:

| 入力・操作 | 観測結果 |
| --- | --- |
| `ticket.status = enum[open]`の後に、同名エンティティで`ticket.status = enum[closed]`を宣言 | 検査用カタログは後の宣言を採用。 |
| 義務で`ticket.status == closed`を検査 | `wellFormednessErrors()`は空配列。重複も報告されない。 |
| 同じ宣言集合を持つ`DesignUnit.declaredEnumValuesOf("ticket.status")` | `["open"]`を返す。 |
| 正常fixtureのエンティティを複製して実設計IR検証センサーを実行 | 正常時と同じく`pass: true, findings_count: 0`。 |

関連する責務の集中もある。

- 式の参照解決、primeの合法性、enum所属をローカル`checkExpr`が検査する。`ExpressionTree`は既に存在するが、呼び出し側がノードを解体して意味を判定している。
- 状態機械の初期状態・遷移・ignoreの整合を、ユニットが属性・遷移集合を取り出して検査する（216〜264行）。
- `rulesMarkdown`からBR索引を作り、使用参照・未形式化対象との差分をここで計算する（295〜329行）。

**改善案**:

- `DesignEntityDeclarations`が重複宣言の診断と、属性座標の解決規則を所有する。`DesignUnit`の照会も同じ規則を使う。診断対象である不正な文書宣言を保持することと、それを検証済みカタログとして使用することを区別する。
- 属性宣言カタログと、文脈に束縛された式の意味検査を明示する。IDの重複は各宣言集合、遷移とignoreの関係は`DesignMachineDeclaration`側へ寄せる。
- アダプタが規則文書から作った`BusinessRuleReferenceIndex`を渡し、ドメインでは「参照済み・未形式化・未被覆」の分類を扱う。

**意図した仕様差**: 要件側はenum値がいずれかの属性に属すれば受け入れ、設計側は比較相手の属性に束縛する。この差は[設計判断](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/87f151776ef13dd2f564c2a60ff0d4f5968eab65/deep-spec-analysis/docs/decisions.ja.md#L221)に明記されている。実行でも差を確認したが、未対応バグとは扱わない。共通化ではこの差を明示的に保持する。

## G02 — イベント規則と包摂関係が変換処理の両側に分散している

**優先度: P2。構築契約の欠落を再現。構造改善の効果も大きい。**

対象:

- [DesignUnit.lowered](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/87f151776ef13dd2f564c2a60ff0d4f5968eab65/deep-spec-analysis/src/design/domain/design-unit.ts#L144)
- [SiblingVerdictDocument.#remapReadable](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/87f151776ef13dd2f564c2a60ff0d4f5968eab65/deep-spec-analysis/src/design/domain/sibling-verdict-document.ts#L133)

loweringはローカル`EventCandidate`へ設計ID・trigger・guard・effectを詰め、同トリガ・同効果の候補対を作り、死ガードと包摂の検証式を組む（148〜159、209〜261行）。帰り側では、`vac-dead`・`vac-shadow`を読み、死ルールの包摂を抑止し、逆向きの証拠を相互同値へ畳む（156〜192、237〜261行）。

この間の重要な関係が、`LoweredOrigin`の`kind`と任意の`pair`、ローカル配列・Map・Setで運ばれる。[LoweredOrigin](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/87f151776ef13dd2f564c2a60ff0d4f5968eab65/deep-spec-analysis/src/design/domain/lowered-origin.ts#L10)は`vac-shadow`でも`pair`を必須にせず、省略時に自分自身との対へ置き換える。

公開APIで`LoweredOrigin.of({kind: "vac-shadow", design: DOB-1})`を構築し、兄弟判定をリマップすると、次の診断が生成された。

```text
kind: redundancy
DOB-1 is subsumed by DOB-1
```

現在の`DesignUnit.lowered`は正しい対を渡す。したがってこれは「正常な生成経路で誤診断を確認した」事例ではなく、**重要な不変条件を特定の呼び出し手順だけが守っている**事例である。

また、生成した義務と帰属を別配列にpushする箇所が複数ある。両者が必ず対応することも型の構築契約より手順に依存する。

**改善案**:

- 「ガードと効果を持つイベント規則」と「方向を持つ規則の包摂関係」をドメイン概念として表す。後者は異なる二つの対象を必須とする。
- 包摂関係のコレクションが、死要素の除外、片方向の包摂、相互同値を判定する。生成と解釈の両側が同じ関係を使う。
- `LoweredObligation`と`LoweredOrigin`を不可分に構築し、帰属索引はその集合から導出する。
- 契約違反はコンストラクタで拒否し、`of`はpanic、想定内入力を扱う`parse`は非例外`ParseError`を返す。

既存の`DesignObligation.loweredAs`、遷移・ignoreの変換、`DesignMachine.waivesOverlapOf`への委譲は活かす。採番・出力順と[合成プローブの意味](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/87f151776ef13dd2f564c2a60ff0d4f5968eab65/deep-spec-analysis/docs/decisions.ja.md#L184)も保持する。

## G03 — 精緻化の被覆分類を計画ファクトリが独占している

**優先度: P2。251行、if29個、Map/Set生成7個。**

対象: [UnitRefinementPlan.of](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/87f151776ef13dd2f564c2a60ff0d4f5968eab65/deep-spec-analysis/src/design/domain/unit-refinement-plan.ts#L75)

このメソッドは、属性写像の重複と全域性、参照解決、属性閉包、義務の種類別可否、イベント写像、シナリオの被覆、診断生成をまとめている。診断の順序を決めること以上の判断を持つ。

具体的な委譲漏れ:

- `byReq`を別途作るが、[AttributeMappings](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/87f151776ef13dd2f564c2a60ff0d4f5968eab65/deep-spec-analysis/src/design/domain/attribute-mappings.ts#L34)は既に最後の写像を使う検索と`covers`を所有している。
- ファイル内の`exprRefs`とローカル`attrsCovered`で参照集合を再構築するが、[ExpressionTree.referencedPaths](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/87f151776ef13dd2f564c2a60ff0d4f5968eab65/deep-spec-analysis/src/kernel/domain/expression-tree.ts#L86)が既にある。
- 不変量義務・イベント義務・シナリオで、「欠落なし→検査可能、欠落がすべて明示免除→免除、それ以外→gap」をそれぞれ組み立てる。
- [RefinementStatus](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/87f151776ef13dd2f564c2a60ff0d4f5968eab65/deep-spec-analysis/src/design/domain/refinement-status.ts#L7)は分類された結果とskip化を持つが、分類に必要な写像・免除の関係はファクトリのローカル状態に残る。

**改善案**:

- 属性写像の集合が参照集合の被覆を判定し、`UnmappedDeclarations`との関係から明示免除と欠落を区別する。
- 各`AttributeMapping`が要件属性・設計属性に対する適合を診断する。イベントの写像整合は`EventMapping`側へ置く。
- 義務・シナリオの適用条件と被覆の判定を分け、計画は分類済みのドメイン値を保持する。診断の順序は集約側で保証する。

## G04 — 検証問いをオブジェクト化しても、意味の解釈が計画に残る

**優先度: P2。3メソッド、計406実装行。**

対象:

- [QuintMachinePlan.interpret](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/87f151776ef13dd2f564c2a60ff0d4f5968eab65/deep-spec-analysis/src/requirements/domain/quint-machine-plan.ts#L68)
- [SatisfiabilityModuloTheoriesVerificationPlan.interpret](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/87f151776ef13dd2f564c2a60ff0d4f5968eab65/deep-spec-analysis/src/requirements/domain/satisfiability-modulo-theories-verification-plan.ts#L72)
- [RefinementSolverPlan.interpret](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/87f151776ef13dd2f564c2a60ff0d4f5968eab65/deep-spec-analysis/src/design/domain/refinement-solver-plan.ts#L90)

`RefinementProbe.match`は種類を選ぶが、SAT/UNSATをどの診断へ変換するかは渡されたコールバックが所有している。検査の意味を問いへ委譲し切れていない。`match`の使用自体が問題なのではなく、問いの不変の意味まで呼び出し側が定義している点が問題である。

同様に、[SatisfiabilityModuloTheoriesEventPairProbe](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/87f151776ef13dd2f564c2a60ff0d4f5968eab65/deep-spec-analysis/src/requirements/domain/satisfiability-modulo-theories-event-pair-probe.ts#L63)は二つの判定を取得するだけで、「ガードが重なるのに効果が両立しない」という判定は計画の155〜172行に残る。accept/rejectシナリオの解釈も3メソッドへ分散する。

**改善案**:

- `RefinementProbe`が自分の問いに対する結果を解釈する。シナリオの問いには期待する受理・拒否など、判断に必要なドメイン値を構築時に持たせる。
- イベント対のプローブが二つの判定を合成し、衝突・未決・問題なしを決める。
- `Scenario`の期待と検証された充足性の関係を一か所で表す。証拠がcoreかtraceか、検証とrefinementで文言が違うことは保持する。
- `QuintMachinePlan`の`method: string`を既存`VerificationMethod`のまま渡し、機能制約をその語彙で判断する。

大域UNSATで派生する空虚性診断を抑止すること、コンパイル時skip済みの義務を再検査しないことなど、複数結果を見渡す規則は計画・集合側の責務として残る。

## G05 — 要素の述語と、診断を作る責務が離れている

**優先度: P2。ただし上の4群より後でよい。**

対象:

- [Components.check](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/87f151776ef13dd2f564c2a60ff0d4f5968eab65/deep-spec-analysis/src/refcheck/domain/components.ts#L139)
- [DeclaredEntities.check](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/87f151776ef13dd2f564c2a60ff0d4f5968eab65/deep-spec-analysis/src/refcheck/domain/declared-entities.ts#L53)

この2件を全面的に貧血モデルとは判定しない。`Component`の自己参照検出、`AttributeDeclaration`の範囲・既定値適合、`RelationshipDeclaration`の多重度適合は既に各型が判断している。長さの相当部分は複数行の診断生成である。

残る問題は、親が要素の述語を呼んだ後、再び属性値・パスを取り出し、findingの種類・対象・証拠・文言を組み立てること。たとえば属性の境界を変更すると、`AttributeDeclaration`と`DeclaredEntities.check`の両方に変更が及ぶ。

**改善案**:

- `AttributeDeclaration`が型区分・境界・既定値に関する診断を完結させ、関係宣言が端点・多重度を診断する。所属するエンティティや成果物の座標は型付きで渡す。
- `Component`と`ComponentEntity`が個体としての診断を持つ。
- 名前の重複、単一所有、依存対称性、参照先の存在、循環は集合の不変条件として`Components`等に残す。
- DD/FDファミリーと宣言順による診断発生順を保つ。ファイル名だけを変えたchecker/helperを増やすことは改善に数えない。

## 推奨する是正順

1. **G01: 宣言カタログの一意性・解決規則。** 重複を通すセンサーの回帰テストを先に追加し、診断用の未検証宣言と検証済みの属性解決を区別する。
2. **G02: 包摂関係と生成結果の帰属。** 不完全な関係を構築できない契約を作り、生成・解釈の両方向に適用する。
3. **G03: 被覆分類。** 写像、明示免除、欠落、バックエンドの能力不足の意味を型と振る舞いへ戻す。
4. **G04: 検証問いの解釈。** シナリオ・イベント対・refinementの各問いに判断を持たせる。
5. **G05: 要素単位の診断。** 親が表示用の値を再取得して意味を組み直す箇所を減らす。

変更の評価は、行数に加え、同じ規則を何か所で定義するか、無効な状態を構築できるか、変更が何型へ波及するかで行う。ドメイン判断はドメインに置き、ユースケースはフロー制御を維持する。

## 実行検証と再実行

[公開API・実センサーの再現結果](runtime-evidence.json)と[既存テスト結果](verification.json)を保存した。関連7ファイルのテストは210成功・0失敗、終了コード0。この合格と、追加の再現で発見した穴は併記する。

再現スクリプトは基線と`src/`に差分がないことを確認してから動く。基線をチェックアウトし、`deep-spec-analysis/`で`bun install --frozen-lockfile`を済ませた作業ツリーを指定する。

```sh
audit=aidlc/spaces/default/intents/260904-ddd-clean-architecture/reviews/2026-09-06-domain-cohesion
bun "$audit/measure-structure.ts" /path/to/checkout
bun "$audit/probe.ts" /path/to/baseline-checkout
```

構造計測はGitアーカイブに固定したソースを使う。公開APIの再現はその作業ツリーのコードを使う。センサーの入力文書は一時ディレクトリのfixture複製のみを変更し、終了時に片付ける。
