# 値の構築契約とコレクションの横断是正

## 対象と採用した契約

アプリケーションのdomain層を横断し、文字列を直接受け取るVO、宣言値、式・証拠のスナップショット、およびプリミティブを要素に持っていたコレクションを調べた。

固定長はContentHashの64桁、閉集合は最長の語に基づく。従来上限のなかった可変長には、今回の改修で処理予算を定めた。128などの数値は既存スキーマや外部標準からの引用ではない。識別子と長い宣言文・パス・診断文を区別し、サイズはJavaScriptのstring.lengthで計測するUTF-16コード単位とする。超過値は切り詰めず拒否する。

- 識別名・ID・IRバージョン: 128。
- 属性パス全体: 257（実体名128、区切り1、属性名128を収める予算）。各名前の制約は対応する名前VOが所有する。
- 複合参照・対象ID: 1,024。ソルバの複合ラベル: 2,048。
- パス・自由文の宣言・列挙リテラル: 4,096。
- 診断1件: 65,536。
- PluginVersionは本体128に加え、Git tagのv接頭辞1文字を受け付ける。最大長でasTag→parseが成立する。

## 文字列VOの確認表

以下56型に先行する長さ検査を追加し、別途ContentHash、BindingValue、EnumMember、InitialState、ErrorMessageも検査した。既存の非空・正規表現・閉集合の検査より先に長さを確認する。NormalizedNameの正規化はコンストラクタへ移し、長さを測る前に文字を除去しない。

| 型 | 上限 | ソース |
| --- | ---: | --- |
| BrRef | 128 | design/domain/br-ref.ts |
| DesignAttributeName | 128 | design/domain/design-attribute-name.ts |
| DesignBackgroundId | 128 | design/domain/design-background-id.ts |
| DesignEntityName | 128 | design/domain/design-entity-name.ts |
| DesignMachineId | 128 | design/domain/design-machine-id.ts |
| DesignObligationId | 128 | design/domain/design-obligation-id.ts |
| DesignObligationNature | 128 | design/domain/design-obligation-nature.ts |
| DesignObligationOrigin | 128 | design/domain/design-obligation-origin.ts |
| DesignScenarioId | 128 | design/domain/design-scenario-id.ts |
| DesignTransitionId | 128 | design/domain/design-transition-id.ts |
| DesignUnitId | 128 | design/domain/design-unit-id.ts |
| LoweredId | 128 | design/domain/lowered-id.ts |
| LoweredOriginRef | 1024 | design/domain/lowered-origin-ref.ts |
| TransitionRef | 128 | design/domain/transition-ref.ts |
| UnmappedTargetRef | 1024 | design/domain/unmapped-target-ref.ts |
| PluginVersion | 128 + v | doctor/domain/plugin-version.ts |
| ArtifactPath | 4096 | kernel/domain/artifact-path.ts |
| AttributeKind | 128 | kernel/domain/attribute-kind.ts |
| AttributePath | 257 | kernel/domain/attribute-path.ts |
| BackendName | 128 | kernel/domain/backend-name.ts |
| DeclaredDigest | 4096 | kernel/domain/declared-digest.ts |
| FindingKind | 24 | kernel/domain/finding-kind.ts |
| IrVersion | 128 | kernel/domain/ir-version.ts |
| NormalizedName | 4096 | kernel/domain/normalized-name.ts |
| ObligationNature | 128 | kernel/domain/obligation-nature.ts |
| QueryLabel | 2048 | kernel/domain/query-label.ts |
| RequirementId | 128 | kernel/domain/requirement-id.ts |
| SkipReason | 19 | kernel/domain/skip-reason.ts |
| TargetId | 1024 | kernel/domain/target-id.ts |
| TriggerName | 128 | kernel/domain/trigger-name.ts |
| UnitName | 128 | kernel/domain/unit-name.ts |
| VerificationMethod | 10 | kernel/domain/verification-method.ts |
| AllowedValue | 4096 | refcheck/domain/allowed-value.ts |
| AppliesTo | 4096 | refcheck/domain/applies-to.ts |
| AttributeDefault | 4096 | refcheck/domain/attribute-default.ts |
| AttributeName | 128 | refcheck/domain/attribute-name.ts |
| BusinessRuleId | 128 | refcheck/domain/business-rule-id.ts |
| CardinalityNotation | 128 | refcheck/domain/cardinality-notation.ts |
| CheckFamily | 128 | refcheck/domain/check-family.ts |
| ComponentName | 128 | refcheck/domain/component-name.ts |
| ContractId | 128 | refcheck/domain/contract-id.ts |
| ContractParty | 4096 | refcheck/domain/contract-party.ts |
| DeclaredRuleId | 128 | refcheck/domain/declared-rule-id.ts |
| ElementPath | 4096 | refcheck/domain/element-path.ts |
| EntityName | 128 | refcheck/domain/entity-name.ts |
| MachineSpec | 4096 | refcheck/domain/machine-spec.ts |
| ReferenceTarget | 4096 | refcheck/domain/reference-target.ts |
| RuleCategory | 128 | refcheck/domain/rule-category.ts |
| SourceId | 128 | refcheck/domain/source-id.ts |
| StateName | 128 | refcheck/domain/state-name.ts |
| TypeName | 4096 | refcheck/domain/type-name.ts |
| BackgroundAssumptionId | 128 | requirements/domain/background-assumption-id.ts |
| IrAttributeName | 128 | requirements/domain/ir-attribute-name.ts |
| IrEntityName | 128 | requirements/domain/ir-entity-name.ts |
| ObligationId | 128 | requirements/domain/obligation-id.ts |
| ScenarioId | 128 | requirements/domain/scenario-id.ts |

## 構造化された値

- DeclaredBindingValue: 文字列4,096、総文字数65,536、4,096ノード、深さ32をコピー前に検査する。通常生成はparseでParseErrorを返し、無効な論理値の宣言そのものは診断用に保持する。
- BindingValue: 列挙リテラル4,096、安全整数をコンストラクタで検査する。宣言からのresolveは自分のコンストラクタの違反をResultへ変換する。ofの例外は捕捉しない。
- ExpressionTree: 10,000ノード、深さ128、演算子128、パス257、文字列リテラル4,096をコピー前に検査する。
- TraceValue・VerificationWitness・DesignWitness: 100,000ノード、深さ128、文字列65,536、総文字数16,777,216をコピー前に検査する。TraceValueの入出力にも独立したスナップショットを持たせた。

## コレクションと要素の責務

ErrorMessagesはErrorMessage、列挙の4コレクションはEnumMember、InitialStatesはInitialState、AttrPathsはAttributePathを受け取る。生の文字列を受けるof/addは削除した。宣言値のコレクションはBindingDeclaration、実行用の束縛はScenarioBindingを内包する。IrBindingPairs・BindingPairsは削除し、DeclaredBindingsへ統合した。

要素は自身の値の契約を持ち、コレクションは件数と配列の所有権を持つ。新しく契約を整えた列挙・初期状態・束縛・要件参照は10,000件、診断は65,536件を上限とする。ScenarioBindingsは同じ属性への二重束縛を拒否する。入力配列を直接凍結せず、要素のドメイン型を保った配列をコピーして所有する。VOをstructuredCloneしてクラスの性質を失わせる実装は除去した。

旧来のプリミティブコレクション7件に対するアーキテクチャ検査の除外を撤回した。残るPublished Languageの4件はExpression、KeyedIndex、KeySet、FunctionalRequirementReferenceClaimであり、今回のコレクションを再びプリミティブへ戻す免除には使わない。

## 通常生成・再構成・命名

parseの公開契約はResult<Value, ParseError>とする。ParseErrorは例外を継承しない独立したreadonlyデータ型で、IllegalArgumentExceptionの内部プロパティから型を借用しない。変換時も例外のpayloadとは別の不変値を作る。コンストラクタの違反だけを変換し、TypeErrorなどの予期しない例外は伝播する。

通常のドメインロジックでは想定内の不適合をparseのResultで処理し、データベース等の再構成にはofを使う。検証済み要素からの安全な組み立てに互換用の生値ファクトリを追加しない。

FrRefs、FrReferenceIndex、FrRefClaim、FrRefClaimsはそれぞれFunctionalRequirementReferences、FunctionalRequirementReferenceIndex、FunctionalRequirementReferenceClaim、FunctionalRequirementReferenceClaimsへ改名した。内部のメソッド・構築引数・ファイル名も展開した。公開文書のfrRefsキーはシリアライズ境界に残し、旧型名のalias/re-exportは残さない。

## 検証と記録

value-size-contracts.test.tsは型ごとの超過値と代表的な境界値を確認する。binding-and-collection-contracts.test.tsは所有権・要素型・重複束縛・異常宣言のResult処理を確認する。construction-contracts.test.tsはParseErrorの独立性とpanicの伝播も確認する。最終のテスト件数・coverage・配布ビルド・CI結果はfixes.mdへ追記する。

原理原則は.claude/knowledge/aidlc-sharedと.codex/knowledge/aidlc-sharedに配置し、org.mdには追記していない。ユーザーの追記した原則本文と、ユーザーが削除した.codex/knowledge/aidlc-shared/ai-dlc-principles.mdは勝手に復元しない。
