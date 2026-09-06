# コレクション契約の実装と検証

空可110型に空判定、反復可能97型に反復契約を適用した。既存111型にFindingTargetsを加えた112型すべてについて、明示的なインターフェイス実装とファクトリ型検査を照合し、漏れは0件だった。非空はFindingTargetsと固定標準内容のInstallationManifestの2型で、どちらもisEmptyを持たない。

FindingTargetsのof・parse・コンストラクタは必須headとreadonly tailを受ける。生成側のNonEmptyFirstClassCollectionFactoryでも型検査する。対象のない診断がドメインに入り込む余地を除き、空や上限超過が起こりうる入力はResultで解釈不能へ伝える。公開センサーでもpass:falseとなることを実entryで確認した。

EffectAssignmentsとDesignAssignmentsの要素は、EffectAssignmentとDesignAssignmentへ置き換えた。前者は代入等式、後者は対象と右辺を表す。式はExpressionTreeとして受け、コレクションへ生の式やタプルを受ける互換口は残していない。

## 検証結果

- 全体テスト：1,169成功、1スキップ、0失敗。1,170件／60ファイル、6,181 assertions、終了コード0。
- TypeScript型検査：成功。
- Biome：637ファイル成功。
- ユースケース境界lint：60ファイル、違反0。
- 配布ツール：14ファイル同期。
- 行カバレッジ：12,562／12,575行、99.8966%。
- 全件監査：[実行スクリプト](audit-implementation.ts)と[結果](implementation-audit.json)。元の候補一覧は[inventory.json](inventory.json)。

## 独立レビューの是正

別担当の読取レビューで3件を検出し、すべて是正した。

1. 解釈不能のレポートでもfindingsが空ならpassesがtrueになる穴。レポート自身の判定へunavailableを含め、SMT/Quint対象欠落とSMT65,537対象の実entryでpass:falseを検証した。
2. 共有decoderが件数上限の前に対象を走査していた穴。上限はドメインの単一定義を参照し、型付き要素への変換・コピー前に拒否する。上限超過配列の要素を読むと失敗する公開境界テストで、修正前失敗／修正後成功を確認した。
3. tailへの改名で既存文言detailsまで変わった巻き込み。公開文言を復元し、全体テストで既存の期待と一致した。

GitHub上のCIとレビューは、このローカル検証後に確認する。
