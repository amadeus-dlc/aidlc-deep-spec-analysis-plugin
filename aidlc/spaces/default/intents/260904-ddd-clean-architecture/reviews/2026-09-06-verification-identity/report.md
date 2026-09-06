# 検証対象の識別と演算契約の追加精査 — 2026-09-06

**再現した問題は5項目。式の検査・合成と、検証対象の識別情報が主な残課題である。** 対象はmainの`b33e6878e14652570e111815d8daaf2e4e1bf88b`。上位10メソッドとその協調先を確認し、入口の共通スキーマ検証器にも調査を広げた。

既存の関連テストは174成功・0失敗（7ファイル、809 assertions、終了0）。独立した公開API再現器と型検査も終了0。アプリケーションコードを変更せず、正常系と問題ケースを同じAPIへ渡して比較した。スキーマに適合した入力を使うケースでは、実スキーマ検証も再現器内で確認している。

## R1・高：小さな式でもスキーマ検査の処理量が急増する

[validateSchemaのoneOf評価](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/kernel/infrastructure/schema.ts#L47)は全候補を評価する。その候補の`op`が不一致でも、[親のプロパティ走査](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/kernel/infrastructure/schema.ts#L108)は子式の検査を続ける。設計IRの[expr定義](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/entries/data/deep-spec-design-ir-schema.json#L128)では、and/or・not・二項演算の3候補が同じ子式を再帰的に検査する。

同一環境で、notを入れ子にした式を各2回、別プロセスで直列実行した。起動とスキーマ読込を除いた検査時間を記録し、各プロセスには3秒の上限を設けた。

| notの深さ | 式ノード数 | JSONバイト数 | スキーマ検査の実測 |
|---:|---:|---:|---|
| 4 | 5 | 114 | 1.44〜1.87 ms |
| 8 | 9 | 202 | 29.33〜29.94 ms |
| 12 | 13 | 290 | 1774.01〜1786.22 ms |
| 16 | 17 | 378 | 2回とも3秒でプロセスを中断 |

全ケースで`ExpressionTree.parse`は成功している。深さ12まではスキーマ検査も成功し、深さ16は時間制限で検査結果を得る前に中断した。単純な入力サイズの増加に対して処理量が大きく増える再帰構造が原因である。タイムアウト値はプロセス全体の上限であり、深さ16の正確な完了時間は測定していない。

この検証器は[設計の取得境界](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/design/adapter/design-intermediate-representation-validation-materials-repository-implementation.ts#L310)と[要件の取得境界](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/requirements/adapter/intermediate-representation-validation-materials-repository-implementation.ts#L269)の両方で使われる。ドメインの意味検査へ到達する前に時間を消費するため、メソッドの行数やVOのサイズ上限だけでは防げない。

改善：`oneOf`の候補照合は、不一致が確定した時点でその候補を打ち切る。候補の一致判定と、人間向けの詳細な診断収集を整理し、捨てる候補の子式を走査しない。共通検証器へ特定の演算子の例外を散らさず、スキーマが持つconst/enum等の条件に従って汎用的に打ち切る。要件・設計の両方で判定と既存診断の整合を検証する。

証拠：[計測コード](schema-cost.ts)、[時間制限付き実行器](run-schema-cost.py)、[測定結果](schema-cost-evidence.json)。

## R2・高：入力単体では有効な式が、lowering中にpanicを起こす

[ExpressionTreeの上限](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/kernel/domain/expression-tree.ts#L25)は10,000ノード。しかし、[死ガード検査の合成](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/design/domain/design-event-rule.ts#L95)は入力のガードをimpliesで包み、[状態遷移の合成](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/design/domain/design-transition.ts#L98)は暗黙の状態条件を追加する。合成後も同じ上限のVOへ`of`で渡すため、正当な入力から契約違反を作ってしまう。

| 経路 | 入力の式ノード数 | スキーマ・式VO | lowering |
|---|---:|---|---|
| 通常の義務をSMT用の合成検査へ | 9,998 | 成功 | 成功 |
| 同上 | 10,000 | 成功 | `IllegalArgumentException: expression-too-large` |
| 状態遷移へ暗黙条件を追加、synthetics=false | 9,996 | 成功 | 成功 |
| 同上 | 10,000 | 成功 | `IllegalArgumentException: expression-too-large` |

[SMT側](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/design/usecase/verify-design-satisfiability-modulo-theories-usecase.ts#L66)と[Quint側](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/design/usecase/verify-design-quint-usecase.ts#L67)はこのloweringをバックエンド呼出前に実行する。VOのコンストラクタは上限を正しく守っているが、演算の所有者が合成による増加を扱えていない。

改善：式の合成にサイズ予算と失敗の契約を持たせる。想定できる合成不能は通常のResultとして検査計画へ返し、対象のcompile-error等を明示する。`of`の例外を呼出側で捕まえて業務エラーに偽装せず、合成操作自身が`parse`に相当する生成契約を所有する。死ガードだけでなく、包摂・遷移の暗黙ガード／効果・精緻化での式合成を同じ観点で確認する。

証拠：[runtime-evidence.json](runtime-evidence.json)の`expressionComposition`と`transitionComposition`。外部ソルバを起動せず再現している。

## R3・高：loweringの発行ID・帰属・追加採番が一つの契約になっていない

[LoweringIndex.resolveDesignTarget](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/design/domain/lowering-index.ts#L72)は索引にないIDを、そのまま設計対象として返す。[SiblingVerdictFinding.remap](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/design/domain/sibling-verdict-finding.ts#L58)はこの結果を通常のfindingとして組み立てる。

実スキーマに適合する兄弟文書を、実パーサ→`SiblingVerificationResult.recordedIn`→クロスチェックへ渡した。

| 兄弟文書の対象 | 本来の状態 | 再割当て結果 | クロスチェックの不一致件数 |
|---|---|---|---:|
| SC-1 | 発行済み | DSC-1 | 1 |
| SC-999 | 未発行 | **SC-999を素通し** | **0** |

未発行IDでも文書はreadable、再割当て結果はunavailable=nullとなり、`crossChecked`にはDSC-1を比較済みとして記録する。元バックエンドのfinding自体は残っている。誤るのは対象の帰属と、対象DSC-1についてのクロスチェックである。

関連する再構成契約も弱い。[LoweredUnit.of](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/design/domain/lowered-unit.ts#L28)はIDの一意性・連番性を確認せず、[extendedWith](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/design/domain/lowered-unit.ts#L58)は件数から次のIDを採番する。

- `OB-2 → DOB-1`だけを持つユニットは構築できる。
- 不変量を1件追加すると、ID列が`[OB-2, OB-2]`になる。
- 索引の`OB-2`は追加した要件`OB-9`へ上書きされ、元の`DOB-1`への帰属が失われる。

通常の`DesignUnit.lowered`は連番を生成するため、後半の問題は再構成APIの契約不足として確認した。前半は不正な兄弟応答を受けた処理経路の問題である。

改善：loweringの発行IDと由来を所有する型に、一意性・追加採番・応答の所属検査を集約する。未登録IDを正常なpassthroughへ補完しない。正当なpassthroughは登録済みの由来として扱い、未知の応答は明示的な不成立へする。再構成時も、一意性と採番に必要な前提を保証する。

証拠：`unissuedTarget`、`loweredIdentityCollision`。

## R4・中：比較済みの記録からユニット情報が失われる

[CodeRabbitの指摘](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/pull/155#discussion_r3942967998)が、マージ後の04:47 UTCに到着した。公開APIで独立に確認した。

[DesignReports.crossChecked](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/design/domain/design-reports.ts#L45)は途中までunitを保持するが、蓄積するのはbackend→TargetIdentifierだけである。[出力エントリの生成](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/design/domain/design-reports.ts#L68)と[直列化](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/design/domain/design-report.ts#L397)にはunitがない。

同じモデル内に`u1/DSC-1`と`u2/DSC-1`を置き、次の3ケースを比較した。

| 実際に比較した対象 | crossCheckedの対象 | 出力文書全体 |
|---|---|---|
| u1だけ | DSC-1 | 同一 |
| u2だけ | DSC-1 | 同一 |
| 両方 | DSC-1 | 同一 |

このモデルは実スキーマに適合している。比較判定とfindingのunit分離は前回のテストで確認したが、比較被覆を記録する出力まで保持する修正が漏れていた。元の実装のSetでもunitが落ちていたため、sortedUniqueの導入だけが原因ではない。

改善：ユニット内一意という[既存の識別規則](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/docs/decisions.ja.md#L206)に沿い、`DesignCrossCheckedEntry`がunitと対象を保持する。[契約2のスキーマ](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/entries/data/deep-spec-findings-schema.json#L64)、共有decoder、design serializer、golden、配布ツールまで一貫して変更する。現在のschemaはadditionalProperties=falseなので、serializerにunitを足すだけでは成立しない。

証拠：`crossCheckedScopeLoss`。[外部指摘の記録](external-review.json)。この調査ではコメントの解決状態を変更していない。

## R5・中：モデルへの帰属を、型の内部で保証できていない

二つの公開APIで、整合した値を別モデルへ組み合わせられた。

1. [ScenarioVerdict](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/kernel/domain/scenario-verdict.ts#L14)は対象ID・unit・backendを持つがモデルの識別子／hashを持たない。異なるhashの各レポートから、それぞれ正当な`scenarioVerdictFor`を取得して`ScenarioComparison.parse`へ渡すと、成功し不一致を返した。現行の`DesignReports.crossChecked`はhashを先に選別するので、この主経路では比較されないことも対照実験で確認している。
2. [RefinementMaterials.prepare](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/design/domain/refinement-materials.ts#L63)はhashを照合するが、自分の[材料識別子](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/design/domain/refinement-materials-identifier.ts#L8)に含むモデルIDを照合しない。`/records/a/model.md`用の材料に、内容hashが同じ`/records/b/model.md`を渡すと、1件の計画が作られ、a側のmapを入力証跡に持つ結果をb側へ記録できた。

これは公開APIの前提条件が弱いことの再現である。現在の通常ユースケースが別モデルの材料を混ぜているという実測ではない。

改善：検証対象にモデル／版と、必要なunit・ローカルIDを保持させる。比較結果もその対象を引き継ぐ。精緻化の準備は対応するモデルへ束縛し、別のモデルを引数で再指定できるAPIを減らす。関係の不適合を構築時・操作時の契約として明示し、各呼出元へ照合条件を散らさない。

証拠：`comparisonModelScope`、`materialModelScope`。

## 上位10メソッドの計測と判定

362ファイル、呼出可能なクラスメンバー2,531件、実装5行以上345件。最長66行、100行以上0件で、前回の再計測と一致した。署名・外側の波括弧・空行・コメントを除いた本体の物理行を数え、内側の区切り行とコールバックを含む。順位は修正優先度ではない。

| 順位 | メソッド | 実装行 | 今回の判定 |
|---|---|---:|---|
| 1 | [DesignUnitDeclaration.diagnostics](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/design/domain/design-unit-declaration.ts#L93) | 66 | 個別診断の委譲は確認。入口でR1の負荷問題が発生する。 |
| 2 | [RefinementMaterials.prepare](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/design/domain/refinement-materials.ts#L41) | 63 | R5：材料が所有するモデルIDをprepareで照合していない。 |
| 3 | [SiblingVerdictFinding.remap](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/design/domain/sibling-verdict-finding.ts#L49) | 57 | R3：未発行IDを通常の設計対象へ通す。 |
| 4 | [SiblingVerdictDocument.#remapReadable](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/design/domain/sibling-verdict-document.ts#L132) | 54 | R3：再割当てに失敗状態が届かず、文書が正常処理を続ける。 |
| 5 | [SatisfiabilityModuloTheoriesProbe.interpret](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/requirements/domain/satisfiability-modulo-theories-probe.ts#L70) | 51 | 判定の意味を持つ型に置かれている。新たな実害は未確認。 |
| 6 | [RefinementProbe.#decidedFinding](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/design/domain/refinement-probe.ts#L90) | 48 | 問いの意味に応じた診断の組立て。長さだけを理由とする分割は不要。 |
| 7 | [DesignMachineDeclaration.diagnostics](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/design/domain/design-machine-declaration.ts#L62) | 45 | 状態と遷移の集合整合は機械の責務。今回の通常入力では新たな誤判定は未確認。 |
| 8 | [DesignUnit.lowered](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/design/domain/design-unit.ts#L134) | 45 | R2：式の合成で契約を超える。R3：再構成後の識別子保証も協調先で不足。 |
| 9 | [DesignReports.crossChecked](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/design/domain/design-reports.ts#L43) | 44 | R4：比較済み対象のunitを出力まで保持できていない。 |
| 10 | [RulesOutcome.check](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/b33e6878e14652570e111815d8daaf2e4e1bf88b/deep-spec-analysis/src/refcheck/domain/rules-outcome.ts#L78) | 44 | 規則文書の取得状態に応じた診断。今回の追加不具合は未確認。 |

行数だけを減らす分割は提案しない。R1はこのランキング対象外の入口処理だが、同じ入力がドメインへ到達する前に問題を起こすため調査対象へ含めた。

## 是正の単位と証拠

全体として、二つの責務を明確にする必要がある。入力・演算の予算はスキーマ照合と式の合成が所有する。検証対象と結果の由来は、モデルからlowering・比較・出力まで失われない識別情報として所有する。R3〜R5を別々の文字列キーや局所的なifで直すと、同じ不具合を別の境界へ移すことになる。

推奨順序は、R1の候補照合、R2の合成契約、その後にR3〜R5の識別情報と出力契約の是正。いずれも公開APIの再現ケースを回帰検証へ昇格させる。

- [公開API再現器](probe.ts)／[再現結果](runtime-evidence.json)／[型検査設定](probe.tsconfig.json)
- [スキーマ処理量の再現器](run-schema-cost.py)／[実測値](schema-cost-evidence.json)
- [行数・行番号](method-sizes.json)／[AST構造](structure-evidence.json)
- [検証記録](verification.json)／[既存関連テスト出力](test-output.txt)

再現器は対象コミットとsrcの一致を確認して実行する。今回の実行環境はBun 1.3.13、macOS arm64。非公開フィールドやメモリ上の参照同一性をassertしていない。性能計測の結果は同一環境での値であり、他環境の秒数を保証するものではない。既存テストの実行範囲は関連7ファイルに限定した。アプリケーションソースは対象コミットと同一であることを確認している。
