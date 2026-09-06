# ドメイン凝集度の是正結果

## 実装した変更

提案した5単位を実装した。基線は`87f1517`、計測対象の実装は`a42fa8b`。

1. 宣言集合が重複を診断し、設計・要件の属性カタログが曖昧な宣言を拒否する。実行用DesignUnitはカタログとUnitNameを受け取り、検証対象IDの重複も拒否する。式の構造はExpressionTree、状態機械の診断はその宣言、業務規則の被覆は規則索引が所有する。
2. DesignEventRuleがトリガー・条件・元の効果を保持する。包摂候補、観測された判定、成立した関係、関係の集合を分け、自己包摂と未証明の関係を構築できなくした。LoweredObligation/LoweredScenarioが帰属を保持し、索引を生成する。元の状態機械も保持し、遷移を持たない機械の属性照会も維持する。
3. AttributeCoverageが必要属性の排他的で漏れのない区分を保証する。写像・免除・義務・シナリオが各自の被覆を判断し、計画はその結果を保持する。
4. refinementの問い、SMTの問いとイベント対、Quintの機械結果・義務・シナリオが判定の意味を解釈する。受理期待はScenarioExpectationに統一し、期待式とは名前を分けた。問いは準備元の対象と単位に属する必要がある。
5. 属性・関係・コンポーネント・形の誤りが診断を完成させ、集合が重複・所有・対称性・循環を扱う。兄弟finding/skipも自分の帰属を写し替え、文書は結果全体を整理する。

## 構築契約と整理

- カタログはエンティティと属性の合計65,536件、被覆の必要属性と包摂関係の集合は各65,536件を上限とする。
- 不変条件の検査はコンストラクタに置き、ofはpanic、parseは非例外ParseErrorへ変換する。期待される解析失敗は呼び出し側がResultで扱う。
- カタログの重複、実行用モデルの重複ID、自己包摂、異なるトリガー・効果、未証明の包摂、被覆区分の重複・漏れを公開APIで検証した。
- DesignEventは「発生した出来事」と区別してDesignEventRuleへ改名した。内容が同じDesignObligationNatureは共通のObligationNatureへ統一し、旧型を削除した。過大なnatureのParseError名も共通語彙になる。
- 任意のpair、個別に追加できる帰属索引、rawEntitiesの再走査、文字列の診断配列、移管後に不要となったgetterを削除した。LoweredObligationにはnature/triggerのVOをそのまま渡す。
- 兄弟文書に成立の証拠がないことだけで、不成立とは断定しない。RuleSubsumptionVerdictは観測の有無と成立証拠を区別し、関係へ昇格できるのは証拠がある場合だけとした。
- [用語集](../../../../../../../deep-spec-analysis/CONTEXT.md)に概念の意味を記録した。

## メソッド行数の再計測

コメント・空行・シグネチャ・外側の括弧を除き、内部の括弧行とコールバックを含める。移管先も含むドメイン全359ファイルを再走査した。

| 元の対象に対応する現在の処理 | 変更前 | 変更後 |
| --- | ---: | ---: |
| `UnitRefinementPlan construction` | 251 | 38 |
| `DesignUnitDeclaration.diagnostics` | 200 | 76 |
| `QuintMachinePlan.interpret` | 161 | 21 |
| `Components.check` | 160 | 9 |
| `DeclaredEntities.check` | 146 | 5 |
| `SatisfiabilityModuloTheoriesVerificationPlan.interpret` | 142 | 29 |
| `SiblingVerdictDocument.#remapReadable` | 131 | 54 |
| `DesignUnit.lowered` | 129 | 45 |
| `RefinementSolverPlan.interpret` | 103 | 8 |
| `IntermediateRepresentationModelDeclaration.diagnostics` | 87 | 35 |

UnitRefinementPlanはofだけで1行と数えず、コンストラクタ36行とof/parse各1行を合わせて38行としている。宣言の検査APIはdiagnosticsへ改名した。

ドメイン層全体で最長のメソッドは`RuleDeclarations.check`の86行となった。今回の移管先も含め、実装コード100行以上のメソッドは0件。詳細は[再計測結果](measurement-after.json)を参照。

5行以上のメソッドは246件から320件へ増えた。ドメインの判断を独立した振る舞いへ移した結果であり、件数や行数の減少だけを成果とはしていない。構築契約、帰属の一致、判定規則の集約、公開結果によって評価した。

## 検証

- 重複エンティティの実センサー回帰、VOのof/parse契約、被覆とシナリオ期待の表、包摂・相互同値・死ルールの抑止を確認。
- 既存のgolden出力と決定性、欠落・未決の明示的なskipを確認。
- Biome、型検査、usecase境界（60ファイル、違反0）、生成物14ファイルの同期を確認。
- プラグイン検証はエラー0、compose hook自動注入の既存警告1。7ハーネスのビルドを確認。
- `bun test --coverage`は965成功・1スキップ・0失敗、48ファイル、終了コード0。[検証結果](verification-after.json)を保存した。監査時の再現結果は履歴として保存し、是正後に同じ不具合が残るという記録にはしない。

## 再計測

TypeScriptの依存関係をインストールした作業ツリーを指定する。計測は指定コミットのアーカイブで行い、出力先には計測用のコピーとJSONが生成される。

```sh
bun <監査ディレクトリ>/measure-methods.ts <作業ツリー> <コミット> <一時出力ディレクトリ>
```
