# 共有コーディング規則への適合監査

対応状況: R1〜R4の修正と検証は[修正記録](fixes.md)を参照。以下は対象コミットに対する監査時点の記録。

基準: [共有規則](../../../../knowledge/aidlc-shared/coding-rules/README.md)。対象コミット: `26324f9def27e396cdcb08d11136dcf7691bf73c`。
CQS採用・CQRS不採用、型付きコンストラクタ、ofのpanic伝播、parseによるResult処理を前提とする。

## 結果

**修正すべき問題は4件（P1: 1件、P2: 3件）。いずれも公開APIが受け取る型の範囲内で再現し、再現コード自体のTypeScript strict型検査も成功した。** 型アサーションで無理に不正な引数を渡す再現ではない。

型検査とアーキテクチャ・パッケージ境界の検査は43成功・0失敗だった。これらが証明する構造的な規律と、以下の値・判定・所有権の問題は別の検査対象である。

| ID | 優先度 | 問題 | 実測 |
| --- | --- | --- | --- |
| R1 | P1 | SMT応答の欠落を正常終了とみなす | 1クエリ発行・応答0件で`solved`、`pass: true`、finding 0、skip 0 |
| R2 | P2 | IDのparseが後続操作で使えない値を受理する | `OB-invalid`と`SC-invalid`がparse成功後の`asTargetId`でpanic |
| R3 | P2 | 宣言・コレクションが入力の可変参照を共有する | 呼び出し側の変更だけで`boundsInverted`がfalse→true、欠落項目やbindingも変化 |
| R4 | P2 | JSONを扱うbindingsの型がunknownに消えている | bigintの構築が型検査を通り、診断時のJSON.stringifyでTypeError |

## R1 — SMTの応答集合に欠落があっても検証成功になる

根拠: [requirements/adapter/z3-solver-client-impl.ts:81](../../../../../../../deep-spec-analysis/src/requirements/adapter/z3-solver-client-impl.ts)、[requirements/domain/smt-verification-plan.ts:117](../../../../../../../deep-spec-analysis/src/requirements/domain/smt-verification-plan.ts)、[requirements/domain/smt-verification-plan.ts:189](../../../../../../../deep-spec-analysis/src/requirements/domain/smt-verification-plan.ts)。

子プロセスのJSONを読んだ際、`results`の欠損を空配列へ補い、発行したクエリのID集合と照合せず`solved`へ進めている。解釈側もglobalの不在を処理せず、個別クエリの不在は`continue`で落とす。結果として「返答がなかった」が「違反は見つからなかった」に変換される。

再現では、`assert: false`という矛盾する義務を含むモデルに1クエリを発行し、子プロセスを`{ results: [] }`で正常終了させた。最終レポートは`pass: true`、finding 0、skip 0になった。対照として同じモデルへ完全な`unsat`応答を返すと、conflict findingが1件生成された。異常応答だけが違う比較である。

該当規則: [upstream-contracts.md](../../../../knowledge/aidlc-shared/coding-rules/upstream-contracts.md)、[error-handling.md](../../../../knowledge/aidlc-shared/coding-rules/error-handling.md)、[gateway-taxonomy.md](../../../../knowledge/aidlc-shared/coding-rules/gateway-taxonomy.md)。

**修正方針**: 発行済みクエリに対する応答の完全性・IDの対応を、子プロセス境界の契約として検証する。欠落した結果は取得失敗または未検証として扱う。さらに解釈側の不在を明示的な未決状態へ統一し、各所の`if (!r) continue`をなくす。既存の[design/domain/refinement-solver-plan.ts:62](../../../../../../../deep-spec-analysis/src/design/domain/refinement-solver-plan.ts)は、不在もskipとして扱っており、判断を統一する先例になる。

検証すべきケースは、結果フィールド欠損、空応答、部分応答、未知・重複ID、および完全なsat/unsat/未決応答。欠落を入力失敗として処理するためにofのpanicをcatchする必要はない。

## R2 — parse成功がIDの公開操作を実行できる保証になっていない

根拠: [requirements/domain/obligation-id.ts:9](../../../../../../../deep-spec-analysis/src/requirements/domain/obligation-id.ts)、[requirements/domain/obligation-id.ts:36](../../../../../../../deep-spec-analysis/src/requirements/domain/obligation-id.ts)、[requirements/domain/scenario-id.ts:9](../../../../../../../deep-spec-analysis/src/requirements/domain/scenario-id.ts)、[requirements/adapter/formal-model-parser.ts:64](../../../../../../../deep-spec-analysis/src/requirements/adapter/formal-model-parser.ts)。

ObligationIdとScenarioIdのコンストラクタは空文字しか拒否しない。一方、`asTargetId`やそれを使う`compareTo`はTargetIdの形式を要求する。同じ型が「有効」と扱う値の範囲が操作によって違っている。

`ObligationId.parse("OB-invalid")`は成功するが、その値の`asTargetId()`はIllegalArgumentExceptionを投げる。実際のモデルパーサもこのIDを受理し、SMT計画生成まで進んで同じpanicを起こした。`ScenarioId.parse("SC-invalid")`にも同じ問題がある。有効な`OB-1`は正常に変換できることも確認した。

該当規則: [factory-naming.md](../../../../knowledge/aidlc-shared/coding-rules/factory-naming.md)、[abstract-data-type.md](../../../../knowledge/aidlc-shared/coding-rules/abstract-data-type.md)、[error-handling.md](../../../../knowledge/aidlc-shared/coding-rules/error-handling.md)。

**修正方針**: ID自身のコンストラクタが、その型の通常操作に必要な形式まで保証する。契約1の義務・シナリオIDの形式と一致させれば、parseは不正な入力をResultで拒否し、ofは同じ違反をpanicとして伝播できる。比較に単なる正準順が必要なだけなら、既存の比較器を使って不要なTargetId生成も減らせる。別種IDへ変換する他のDPも同じ観点で確認する。

既存の[construction-contracts.test.ts](../../../../../../../deep-spec-analysis/tests/construction-contracts.test.ts)はObligationIdなどの「有効値」に`"value"`を与えている。空文字だけでなく、形式違反・異なるID種別・通常操作まで含めた契約テストが必要である。コンストラクタの引数型をunknownへ広げたり、型の実行時検査を足したりする対策ではない。

## R3 — private/readonlyでも入力の別名参照から宣言が変更できる

根拠: [refcheck/domain/attr-decl.ts:28](../../../../../../../deep-spec-analysis/src/refcheck/domain/attr-decl.ts)、[refcheck/domain/rule-decl.ts:22](../../../../../../../deep-spec-analysis/src/refcheck/domain/rule-decl.ts)、[requirements/domain/ir-binding-pairs.ts:12](../../../../../../../deep-spec-analysis/src/requirements/domain/ir-binding-pairs.ts)。

7種類のrefcheck宣言型が入力recordをそのまま`#seed`へ保持している。引数側のreadonlyは、呼び出し側が持つ可変なオブジェクトまで不変にしない。また、bindingsのコレクションは外側の配列だけをコピーし、組の参照は共有している。

実測では、`AttrDecl.of(seed)`後に呼び出し側で`seed.min`を0から20へ変えただけで、同じ宣言の`boundsInverted()`がfalseからtrueへ変わった。RuleDeclへ渡した`missing`配列へのpushと、IrBindingPairsへ渡したtuple要素の代入も、そのまま内部へ反映された。どれもTypeScriptで許される操作であり、privateフィールドへの侵入や型の偽装は使っていない。

同じrecord保持パターン: [attr-decl.ts](../../../../../../../deep-spec-analysis/src/refcheck/domain/attr-decl.ts), [entity-decl.ts](../../../../../../../deep-spec-analysis/src/refcheck/domain/entity-decl.ts), [rule-decl.ts](../../../../../../../deep-spec-analysis/src/refcheck/domain/rule-decl.ts), [rel-decl.ts](../../../../../../../deep-spec-analysis/src/refcheck/domain/rel-decl.ts), [state-machine-sketch.ts](../../../../../../../deep-spec-analysis/src/refcheck/domain/state-machine-sketch.ts), [domain-entity-sketch.ts](../../../../../../../deep-spec-analysis/src/refcheck/domain/domain-entity-sketch.ts), [declared-entities.ts](../../../../../../../deep-spec-analysis/src/refcheck/domain/declared-entities.ts)。tupleの問題は[binding-pairs.ts](../../../../../../../deep-spec-analysis/src/design/domain/binding-pairs.ts)にもある。

該当規則: [interior-mutability.md](../../../../knowledge/aidlc-shared/coding-rules/interior-mutability.md)、[field-visibility.md](../../../../knowledge/aidlc-shared/coding-rules/field-visibility.md)、[abstract-data-type.md](../../../../knowledge/aidlc-shared/coding-rules/abstract-data-type.md)。

**修正方針**: 不変条件の所有者が入力recordの容器と、必要な配列・tuple・宣言値のスナップショットを所有する。`#seed`という入力DTO相当の参照を持ち続ける層をなくし、型付きのprivateフィールドへ取り込む。内部のDP/VOはその型のまま保持する。構築後・add後に呼び出し側の入力を変えても、ID・判定・出力が変わらないことを回帰テストにする。

## R4 — bindingsのunknownが、扱うはずのJSON型を失わせている

根拠: [ir-binding-pairs.ts:5](../../../../../../../deep-spec-analysis/src/requirements/domain/ir-binding-pairs.ts)、[binding-pairs.ts:2](../../../../../../../deep-spec-analysis/src/design/domain/binding-pairs.ts)、[ir-model-decl.ts:127](../../../../../../../deep-spec-analysis/src/requirements/domain/ir-model-decl.ts)。

IrBindingPairsはコメント上「契約1が許すJSON値」を運ぶ型だが、コンストラクタ・of・add・公開面の値型はunknownになっている。BindingPairsにも同じ署名がある。これにより、JSON値としては扱えないbigintなどが、型の偽装なしに入力できる。

再現では`IrBindingPairs.of([["e.count", 1n]])`を構築し、その宣言を通常のwellFormednessErrorsへ渡した。strict型検査は成功するが、診断のJSON.stringifyでTypeErrorになった。通常のJSONファイルからbigintが生じるという指摘ではなく、ドメインの公開APIが必要な型制約を失っている指摘である。

該当規則: [factory-naming.md](../../../../knowledge/aidlc-shared/coding-rules/factory-naming.md)、[abstract-data-type.md](../../../../knowledge/aidlc-shared/coding-rules/abstract-data-type.md)。

**修正方針**: bindingsが運ぶ宣言値を、既存のJsonなど本来の型で表す。非JSON値はコンパイル時に拒否し、構文上JSONであって属性に適合しない値は、従来どおりドメインの検査で診断する。unknownを受け続けてコンストラクタにtypeof検査を追加する対策は採らない。R3の別名参照と異なり、こちらは入力型の制約の問題である。

## O1 — 仕様との関係を整理してから扱う追加観測

[requirements/adapter/formal-model-parser.ts:32](../../../../../../../deep-spec-analysis/src/requirements/adapter/formal-model-parser.ts)は`{ irVersion: "1.0.0" }`だけでも空モデルとして受理する。契約1スキーマはschema・obligations・scenarios・backgroundを必須にしている一方、このパーサには「旧実装の寛容パースを維持し、厳密検査は別センサーが担う」というコメントがある。

これは再現済みだが、既存の互換性上の裁定との関係があるため、R1〜R4と同じ未承認の実装違反には数えていない。単独実行されるverifyセンサーの入力保証を含め、どの境界で契約を満たすことを要求するかを整理する。参照: [deep-spec-ir-schema.json](../../../../../../../deep-spec-analysis/src/entries/data/deep-spec-ir-schema.json)。

## 確認範囲と検証

- 全原本497 TypeScriptファイル、26,103行を機械走査した。入力・ソルバ応答・生成・所有権・判定処理を重点精読した。規則別の範囲と結果は[対応表](rule-matrix.md)。
- `aidlc-workflows/`、node_modules、dist、生成bundleは原本監査の対象外。最大の原本ファイルはrefinement-query-plan.tsの404行で、1,000行超の原本はない。
- TypeScript型検査: 成功。
- アーキテクチャ・パッケージ境界: **43成功、0失敗、270 assertions**。
- 再現コードのstrict型検査: 成功。
- 再現: **R1・R2・R3・R4、追加観測O1がすべて成立**。[結果](results.jsonl)、[コード](reproduce.ts)。コードのassertは現状の不具合を確認するためのもので、修正後に維持する期待動作ではない。
- バックエンド間比較は、skip対象を比較から除く既存処理を確認した。その候補は指摘から除外し、比較前のSMT結果欠落をR1として扱った。
- この記録は監査成果物であり、上記の修正を実装した記録ではない。

再現コマンド（リポジトリルート）:

```sh
bun aidlc/spaces/default/intents/260904-ddd-clean-architecture/reviews/2026-09-05-coding-rules-conformance/reproduce.ts
```

## 推奨する修正順

1. R1: 応答欠落を検証成功へ変換する経路を閉じる。
2. R2: IDの生成契約と通常操作を一致させる。
3. R3: 宣言型とbindingsの所有権を修正する。
4. R4: bindingsの入力を本来のJSON型へ制限する。

R1は出力の信頼性、R2は入力失敗とpanicの分離、R3は型の不変性、R4は入力型の制約が対象であり、それぞれ独立した受け入れ条件を持つ。正常系goldenを維持し、不正入力・欠損・別名参照の回帰ケースを追加する。
