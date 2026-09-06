# ドメイン上位メソッドの追加精査 — 2026-09-06

**再現できた不具合は3群、責務分担の残課題は2項目。100行以上のメソッドは0件だが、構築後の安全性・検査対象の被覆・入力の所有権には欠落がある。**

対象はmainの `67c8736afee7706ca7b7fc6a5779a13d0efd65c0`。前回の是正後に残った実装行数上位10メソッドと、そこから直接呼ばれる型・パーサ・関連テストを確認した。アプリケーションコードは変更していない。既存の関連テストは **193成功・0失敗（7ファイル、1018 assertions、終了コード0）**。追加の公開API再現器も実行・型検査とも終了コード0。

今回再現したF1〜F3の原因箇所と呼出元パーサは、前回監査時の `87f1517` から変更されていない。前回修正で新しく導入された障害ではなく、残っていた契約の欠落である。比較対象パスと結果は[検証記録](verification.json)に保存した。

## F1・高：parse成功済みの状態機械指定が、検査中にpanicを起こす

入口は[StateMachineSketch.check](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/67c8736afee7706ca7b7fc6a5779a13d0efd65c0/deep-spec-analysis/src/refcheck/domain/state-machine-sketch.ts#L64)。[MachineSpecificationのconstructor](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/67c8736afee7706ca7b7fc6a5779a13d0efd65c0/deep-spec-analysis/src/refcheck/domain/machine-specification.ts#L10)は全体4096文字以下・非空だけを保証し、[entityToken()](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/67c8736afee7706ca7b7fc6a5779a13d0efd65c0/deep-spec-analysis/src/refcheck/domain/machine-specification.ts#L30)が照会のたびに生文字列を分解して`EntityName.of`を呼ぶ。`EntityName`の上限は128文字であり、構築済みの指定値がその下位契約を保証していない。

| 公開APIへ渡した指定 | MachineSpecification.parse | 実パーサ→検査の結果 |
|---|---|---|
| `E` × 128文字 | 成功 | 例外なし。未宣言の実体として診断 |
| `E` × 129文字 | 成功 | `IllegalArgumentException: entity-name-too-long` |
| `.state` | 成功 | `IllegalArgumentException: empty-token` |

不正な文書の内容が、通常の入力エラーとして扱われず、検査中の契約違反になる。`check`はunsupported判定より先に`entityToken()`を呼ぶため、支持外の図にも影響する。

**改善**：状態機械指定の構築時に、全体サイズ→字句・構文→構成要素の契約を確定し、`EntityName`と必要な属性名のVOを保持する。`parse`はそのコンストラクタの失敗を非例外の`ParseError`へ変換し、`of`のpanicは捕捉しない。照会で新たに失敗可能なVOを生成しない。[文書パーサ](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/67c8736afee7706ca7b7fc6a5779a13d0efd65c0/deep-spec-analysis/src/refcheck/adapter/functional-design-parser.ts#L307)もparse失敗を現行の`continue`で消さず、明示的な不正宣言／skipとして運ぶ必要がある。

## F2・高：一部の実体だけに図を書くと、残りの未検査がcheckedに化ける

原因は[StateMachineSketches.check](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/67c8736afee7706ca7b7fc6a5779a13d0efd65c0/deep-spec-analysis/src/refcheck/domain/state-machine-sketches.ts#L43)の`if (this.isEmpty())`。図が一つもないときだけライフサイクル実体の欠落を記録し、図が一つでもあると各図の局所検査だけで終了する。

`Order`と`Invoice`がともに`status: enum[open]`を宣言した正常なモデルで比較した。

| 文書 | findings | skipped | checked |
|---|---:|---:|---|
| 図なし | 0 | 4（2実体×2検査） | なし |
| Orderの正常な図だけ | 0 | **0** | **FD-S1、FD-S2** |

`Invoice`の図は存在しないままなのに、検査ファミリー全体が完了扱いになる。これは[センサー契約のno-silence](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/67c8736afee7706ca7b7fc6a5779a13d0efd65c0/deep-spec-analysis/sensors/aidlc-deep-spec-refcheck-functional.md#L35)と、[checked＝失敗・skipを除いた検査](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/67c8736afee7706ca7b7fc6a5779a13d0efd65c0/deep-spec-analysis/src/refcheck/domain/reference-check-report.ts#L71)の保証を弱める。実装コメントにある「機械が一つも無ければ」は現在の動作を説明しているが、部分欠落を検査済みとする根拠にはならない。

**改善**：集合が「検査すべきライフサイクル対象」と「図が解決した対象」の被覆を所有する。個々の図は状態とallowed valuesの整合を判定し、集合が未被覆対象を明示する。全欠落・一部欠落・全被覆を同じ規則で処理する。属性指定や重複図も考慮し、単に実体名のSetを作るだけで済ませない。

## F3・中：索引と取得結果が可変入力を共有し、診断・証跡が後から変わる

[SiblingUnitIndex.of](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/67c8736afee7706ca7b7fc6a5779a13d0efd65c0/deep-spec-analysis/src/refcheck/domain/sibling-unit-index.ts#L13)がコピーするのは外側のMapだけ。内側のMapは共有され、[entityDeclaredIn](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/67c8736afee7706ca7b7fc6a5779a13d0efd65c0/deep-spec-analysis/src/refcheck/domain/sibling-unit-index.ts#L24)は変更可能なレコードをそのまま返す。

公開APIだけの再現結果は次のとおり。キャストや非公開フィールド参照は使っていない。

- 構築直後：XS診断0件。
- 呼出元が元の内側Mapから`order`を削除：同じ索引でXS-2「どのユニットにも定義されていない」が発生。
- 元に戻し、返されたレコードの`attrs`を空コレクションへ代入：同じ索引でXS-3「qtyが欠落」が発生。

横展開確認では、[RefinementMapAcquisitionのconstructor](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/67c8736afee7706ca7b7fc6a5779a13d0efd65c0/deep-spec-analysis/src/design/domain/refinement-map-acquisition.ts#L23)も入力アンカー配列を共有していた。呼出元の`splice`だけで、`match`が返す取得時の証跡が`original.md`から`replacement.md`へ変化した。[RefinementMaterials.prepare](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/67c8736afee7706ca7b7fc6a5779a13d0efd65c0/deep-spec-analysis/src/design/domain/refinement-materials.ts#L103)はこの配列を準備結果へ取り込む。実運用で変更が発生した事実までは確認していないが、型の契約として変更経路が開いていることは確認済み。

**改善**：`SiblingUnitIndex`を`UnitName`・`NormalizedName`・ドメイン固有の宣言型で構築し、入力Mapと匿名レコードを内部状態に残さない。所有元探索・属性被覆も型に依頼する。取得結果は既存の`DesignInputAnchors`を受け取り、`loaded`にだけ必要な値を持つ状態にする。互換の生Map／生配列ファクトリは残さない。件数上限を持たせる型は、コピー前の検査と`of`／`parse`の対を備える。

## F4・中：クロスチェックの概念が2か所の手続きに埋まっている

[DesignReports.crossChecked](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/67c8736afee7706ca7b7fc6a5779a13d0efd65c0/deep-spec-analysis/src/design/domain/design-reports.ts#L49)は78行、[VerificationReports.crossChecked](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/67c8736afee7706ca7b7fc6a5779a13d0efd65c0/deep-spec-analysis/src/requirements/domain/verification-reports.ts#L49)は73行。両方が、レポートを文字列キーと配列へ展開し、対象選別・バックエンド組合せ・シナリオ判定・比較対象の蓄積・診断組立てを実装する。設計側はループ4重、要件側は3重で、両方にコールバック9個がある。

`findings.some(...)`をバックエンドの組とシナリオごとに繰り返し、判定表を毎回導き直す。要件側の`scenarioById`は、すでに巡回中の`sc`から参照できる情報を取得するためだけの索引で、空配列へのフォールバックまで持つ。ここには独立した業務上の理由がない。

**改善**：各レポートが対象シナリオの判定と比較参加可否を所有する。集合は、型付きの対象とバックエンドごとの判定を比較する。要件のシナリオと設計の「ユニット＋シナリオ」の帰属を維持し、両者で意味が同じ判定比較だけを共有する。巨大な汎用比較器や、getterを置き換えただけのラッパーは作らない。

現行の互換な入力に対する誤判定は今回確認していない。シナリオだけを比較することは[明記されたv1仕様](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/67c8736afee7706ca7b7fc6a5779a13d0efd65c0/deep-spec-analysis/docs/decisions.ja.md#L66)であり、比較範囲の拡張は提案しない。Repositoryはファイル名順・backend名とファイル名の一致を保証しており、その保証を無視した不正な兄弟集合を実運用の障害とは扱っていない。

## F5・中：個別宣言への診断委譲が未完了で、所有者が不統一

[RuleDeclarations.check](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/67c8736afee7706ca7b7fc6a5779a13d0efd65c0/deep-spec-analysis/src/refcheck/domain/rule-declarations.ts#L35)は86行、if10個、ループ5個。重複IDと隣接文書の有無は集合の責務だが、必須キー・ID形式・source・applies-to・categoryの診断もすべてコレクションが組み立てる。`RuleDeclaration`には述語・不足値・getterしかなく、1規則の診断には他のクラスがその内部構成を読み取る必要がある。前回修正した`AttributeDeclaration.checkType/checkBounds/checkReference`と対照的な所有境界が残った。

[DesignUnitDeclaration.diagnostics](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/67c8736afee7706ca7b7fc6a5779a13d0efd65c0/deep-spec-analysis/src/design/domain/design-unit-declaration.ts#L120)も同様に、機械には`diagnostics(catalog)`を依頼する一方、obligationのbrRefs不足は親が文言を作り、scenarioのbindingsを取り出してカタログへ渡す。要件側の[IntermediateRepresentationModelDeclaration.diagnostics](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/67c8736afee7706ca7b7fc6a5779a13d0efd65c0/deep-spec-analysis/src/requirements/domain/intermediate-representation-model-declaration.ts#L68)にも対応する呼出形がある。ここは横展開対象として追跡した。

**改善**：個々の宣言が文脈付きの完成した診断を返す／記録する。集合には重複・全体の被覆・診断順の規則を残す。`DomainEntitySketches.check`も、所有ユニットの集合判定と1実体の属性欠落診断の所有先を整理する。単に親の長いメソッドをprivate helperへ分割しても、この問題は解消しない。

## 上位10メソッドの実測と判定

359ファイル、呼出可能なクラスメンバー2499件を走査し、実装5行以上は320件。メソッド・コンストラクタ・アクセサ・関数を保持するプロパティが対象。実装行数は本体内の非空・非コメント物理行で、署名と外側の波括弧を除き、内側の区切り行・コールバックは含む。コメント抽出のfixtureも成功した。順位は行数順であり、修正優先順ではない。

| 順位 | メソッド | 実装行 | if / 三項演算 | ループ数 / 最大入れ子 | 精査結果 |
|---|---|---:|---:|---:|---|
| 1 | [RuleDeclarations.check](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/67c8736afee7706ca7b7fc6a5779a13d0efd65c0/deep-spec-analysis/src/refcheck/domain/rule-declarations.ts#L35) | 86 | 10 / 0 | 5 / 1 | F5：個々の規則の診断組立てがコレクションに残る。 |
| 2 | [DesignReports.crossChecked](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/67c8736afee7706ca7b7fc6a5779a13d0efd65c0/deep-spec-analysis/src/design/domain/design-reports.ts#L49) | 78 | 3 / 2 | 4 / 4 | F4：要件側と判定表・比較処理を二重実装。 |
| 3 | [DesignUnitDeclaration.diagnostics](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/67c8736afee7706ca7b7fc6a5779a13d0efd65c0/deep-spec-analysis/src/design/domain/design-unit-declaration.ts#L93) | 76 | 11 / 1 | 12 / 2 | F5：重複IDと被覆は適切。個別宣言の診断委譲が不統一。 |
| 4 | [VerificationReports.crossChecked](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/67c8736afee7706ca7b7fc6a5779a13d0efd65c0/deep-spec-analysis/src/requirements/domain/verification-reports.ts#L49) | 73 | 3 / 2 | 3 / 3 | F4：設計側と同型。シナリオ取得索引も重複。 |
| 5 | [RefinementMaterials.prepare](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/67c8736afee7706ca7b7fc6a5779a13d0efd65c0/deep-spec-analysis/src/design/domain/refinement-materials.ts#L42) | 63 | 5 / 0 | 3 / 2 | F3：全体の準備判断は妥当。取得結果の入力証跡が可変。 |
| 6 | [SiblingVerdictFinding.remap](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/67c8736afee7706ca7b7fc6a5779a13d0efd65c0/deep-spec-analysis/src/design/domain/sibling-verdict-finding.ts#L49) | 57 | 5 / 2 | 0 / 0 | 現状維持：単一findingの意味変換を所有。新たな誤判定は未確認。 |
| 7 | [StateMachineSketch.check](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/67c8736afee7706ca7b7fc6a5779a13d0efd65c0/deep-spec-analysis/src/refcheck/domain/state-machine-sketch.ts#L56) | 57 | 5 / 1 | 0 / 0 | F1/F2：指定値の構築契約と機械集合の被覆に欠落。 |
| 8 | [SiblingVerdictDocument.#remapReadable](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/67c8736afee7706ca7b7fc6a5779a13d0efd65c0/deep-spec-analysis/src/design/domain/sibling-verdict-document.ts#L132) | 54 | 4 / 0 | 3 / 2 | 現状維持：委譲結果の収集・重複抑制・包摂の整理を所有。 |
| 9 | [SatisfiabilityModuloTheoriesProbe.interpret](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/67c8736afee7706ca7b7fc6a5779a13d0efd65c0/deep-spec-analysis/src/requirements/domain/satisfiability-modulo-theories-probe.ts#L70) | 51 | 5 / 8 | 0 / 0 | 現状維持：問いの目的による解釈はこの型の責務。 |
| 10 | [DomainEntitySketches.check](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/67c8736afee7706ca7b7fc6a5779a13d0efd65c0/deep-spec-analysis/src/refcheck/domain/domain-entity-sketches.ts#L52) | 49 | 6 / 0 | 1 / 1 | F3/F5：不変索引への委譲と個別診断の所属を整える。 |

ASTの件数は複雑度の代理情報であり、循環的複雑度ではない。`SatisfiabilityModuloTheoriesProbe.interpret`には三項演算が8個あるが、閉じた問いの意味の解釈は適切な所有先にある。目的別の分岐を一度にまとめる余地はあっても、行数だけを理由に4クラスへ増やす必要はない。兄弟判定の2メソッドも、前回の分離後は単一判定の解釈と集合結果の収集に役割が分かれている。

## 証拠と再実行

- [計測値と行番号](method-sizes.json)／[AST構造の計測](structure-evidence.json)
- [公開API再現器](probe.ts)／[型検査設定](probe.tsconfig.json)／[再現結果](runtime-evidence.json)
- [既存テスト・型検査・履歴比較](verification.json)／[テスト出力](test-output.txt)
- [構造計測器](measure-structure.ts)。行数の計測器は前回記録の[measure-methods.ts](../2026-09-06-domain-cohesion/measure-methods.ts)を使用。

再現器は当該コミットと`deep-spec-analysis/src`の差分がないことを確認してから実行する。現在の作業ブランチが異なる場合は、当該コミットのcheckoutに本記録を置いて実行する。今回実行した場所は`/private/tmp/deep-spec-domain-cohesion-20260906`。公開APIの結果だけをassertし、内部フィールド・Object.freeze採用・参照同一性には依存していない。例外の捕捉は再現器で観測するためのもので、プロダクションのpanic処理には追加していない。

調査範囲は上位10メソッドと直接の協調先であり、ドメイン全体の再監査ではない。既存の関連7ファイルを検証し、全スイート・CIは今回は再実行していない。実行時間の性能比較も行っていない。

## 是正の進め方

1. F1/F2の状態機械指定と被覆を、公開APIの失敗ケースから是正する。
2. F3の索引・取得結果の所有権を、ドメイン型と既存コレクションで保証する。
3. F4/F5の比較判定と個別宣言の診断を適切な所有者へ移す。要件・設計・refcheckの対応箇所を同じ観点で確認する。

1〜3を一連の是正対象とするのを推奨する。正常入力の診断文言・順序は維持し、今回再現した不正入力・未検査の扱いは意図した変更として明記する。
