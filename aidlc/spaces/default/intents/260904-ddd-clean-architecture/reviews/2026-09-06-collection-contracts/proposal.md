# ファーストクラスコレクションの契約 — 承認済み実装方針

ユーザーの選択1に基づき、空・非空の契約を実装する。結合操作の共通化は今回の対象に含めない。その後の指摘に従い、非空型のisEmptyを撤回し、生成引数をheadとtailに統一した。

## 空を許す型と反復の契約

```ts
interface FirstClassCollection {
  isEmpty(): boolean;
}

interface IterableFirstClassCollection<T extends object> extends Iterable<T> {}
```

空判定は所有する要素数で決める。判定が一つあって比較の組がない場合や、発行済み台帳に空きがない場合を空とはしない。反復を公開しない型には空判定だけを適用する。

## 非空の契約

```ts
interface NonEmptyFirstClassCollectionFactory<Element extends object, Collection extends object> {
  of(head: Element, tail: readonly Element[]): Collection;
  parse(head: Element, tail: readonly Element[]): Result<Collection, ParseError>;
}
```

FindingTargetsは必須headを受け、非空を保証する。空判定は公開しない。上限はheadを含め65,536件。コピー前と読取中に件数を確認し、検査したスナップショットを保持する。引数なし・nullable head・プリミティブhead・配列だけの呼出は型検査で拒否する。ofの上限違反はpanic、parseの上限違反は非例外のParseErrorとなる。

一般配列から診断を構築する境界では、対象の欠落や上限超過を明示的な失敗として扱う。共有decoderは、要素の走査・VO生成より前に上限を確認する。requirementsの解釈結果はResultを返し、失敗時は公開レポートのunavailableとセンサーのpass:falseまで伝える。

## 適用範囲と担当

修正前の[全件一覧](inventory.json)は353クラス・363 TypeScriptファイルを調査した記録。既存の候補111型を、kernel＋requirements 30型、design 49型、refcheck＋doctor 32型に分け、3人の実装担当へ委譲した。親が統合・既存テストの移行・共通境界・独立レビューの是正・最終検証を担当する。

実装後はFindingTargetsを加え112型。空可110型と非空2型、反復可能97型と非反復15型となる。固定の標準内容を生成するInstallationManifestも非空であり、isEmptyや不要なof/parseは追加しない。[実装監査](implementation-audit.json)で適用とファクトリ型検査の漏れを照合する。

CoverageAssessmentとUnitCoverageはスコープ付きの査定結果、LoweringIndexは複数の対応関係を関連付ける複合索引として、本体を単一コレクションへ分類しない。後者が保持するIssuedLoweredIdentifiersには契約を適用する。DesignModel、MachineReachability、RefinementPreparation、RefinementSolverPlanも集約・評価状態・準備結果・実行計画として区別する。KeySetとKeyedIndexは内部の汎用表現プリミティブである。

## 要素型と生成契約

EffectAssignmentsが保持していたタプルと、DesignAssignmentsが保持していた構造型の式を、EffectAssignment（効果の代入等式）とDesignAssignment（設計属性への代入）へ置き換える。要素型はAttributePathとExpressionTreeを受ける。式からの抽出はfromEffectで行い、代入等式と右辺を混同しない。旧入力の互換口は残さない。

static側は具体的なファクトリ型契約でも照合し、構築失敗があり得る型にはparseを要求する。型・戻り値だけで不変条件を保証したとは扱わず、空/非空、入力変更後の不変性、上限、順序、ofのpanicとparseの非例外エラーを公開APIから検証する。

共通原則はClaude・Codex両方のknowledge/aidlc-shared/first-class-collections.mdへ同じ内容で反映する。
