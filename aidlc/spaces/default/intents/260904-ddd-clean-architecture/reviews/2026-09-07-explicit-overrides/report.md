# overrideの明示化と検査

基準コミットは `c3be493a78ade966d40d0f6ceca50096b7097117`。

## 変更

- `tsconfig.json` に `noImplicitOverride: true` を設定。
- `rebuild`、`Symbol.iterator`、既存の `isEmpty` 上書きなど、234メンバーに `override` を付与。
- 具象クラスを継承するテスト用double2箇所を、インターフェイスの実装と内部委譲に変更。
- ロック操作の契約を `DirectoryFinalizationLockPort` として切り出し、実ロックとテストdoubleが明示的に実装。
- TypeScriptの型情報を使う `lint:explicit-overrides` を `check` / `lint` に組み込む。

## コンパイラとリンターの分担

TypeScript 7.0.2で実測した。`noImplicitOverride` は実装済みメンバーの上書きに必要な修飾子を検査する。設定だけを変更した時点では8件のTS4114を検出した。親に対応するメンバーがない不正な `override` もコンパイラが拒否する。

一方、抽象メソッドや抽象プロパティの実装では修飾子を省略してもコンパイラが受理する。これをリンターで補完する。コンストラクタのparameter propertyも検査する。実装を持たない `declare` による型の再宣言、別々のprivate field、新規メンバー、implementsだけの契約実装は誤検出しない。

静的メンバー、getter/setter、computed symbol、import alias、間接継承、generic継承、匿名class expressionを検証した。computed memberは表記の一致ではなくcheckerが解決したキーを比較する。

違反の終了コードは1、設定・構文・型情報の取得失敗は2。取得できない型を検査成功として扱わない。

## 実測結果

| 対象 | 検査ファイル数 | override欠落 |
| --- | ---: | ---: |
| 修正前 | 672 | 234 |
| 修正後 | 676 | 0 |

- 専用テスト: 6成功。診断対象のメンバーと位置を照合。
- 全体テスト: 1,404成功、1スキップ、0失敗、8,364 assertions。
- Biome、型検査、既存のカスタムlint、新しいoverride lint: 成功。
- `build-tools.ts --check`: 14ファイルすべて既存の生成物と一致。配布バンドルの実行コードは変化していない。

## mapの設計に関する調査

mapのAPIは今回変更していない。

Scala 2.13/3のコレクションでは、現在の要素型A、コレクションの型コンストラクタCC[_]、現在の具体型Cを分ける。filterはC、map[B]はCC[B]を返し、生成は具象コレクションのiterableFactoryへ委譲する。[公式の設計解説](https://docs.scala-lang.org/overviews/core/architecture-of-scala-213-collections.html#operations-implementation)

固定要素型のRNAについては、BaseからBaseへのmapを追加してRNAを返し、別の要素型へ変換する場合はIndexedSeqを返す公式例がある。AttributeNamesも要素型が固定されているため、この区別が参考になる。[公式のRNA実装例](https://docs.scala-lang.org/overviews/core/custom-collections.html#dealing-with-map-and-friends)

TypeScriptでの設計案は、同じ要素型を保つmapで固有型を再構築し、異なる要素型への変換は変換先ファクトリを指定するmapToとして分けること。型消去後の実装で戻り型だけを切り替える過負荷宣言や、型キャストによる偽装は使わない。
