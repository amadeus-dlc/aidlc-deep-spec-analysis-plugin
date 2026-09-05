# ユースケースのgetter検査

ユースケースにはフロー制御を置き、取得したモデルの判断・加工・演算は、その状態を所有するドメイン型へ依頼する。表示やプロトコルのための値の取り出しはadapterで行う。この規律を修正の途中でも確認できるよう、既存違反を含めて失敗するリンターを用意した。

## 実行

`deep-spec-analysis/` で実行する。

```sh
bun run lint:usecase-getters
bun run lint:usecase-getters --json
bun run check
```

- `lint:usecase-getters`: 呼出箇所・規則名・呼び先の型/メソッド・宣言箇所を出力する。
- `--json`: 同じ診断をJSONで出力する。調査対象の指定には `--project <tsconfig.json>` を使う。
- `check`: Biomeが成功した後、この検査を実行する。CIも同じコマンドを使う。
- 終了コードは、違反なしが0、違反/要確認ありは1、設定・型解決を妨げるエラーは2。
- `check:biome` は整形・通常lintだけを確認する。`check:fix` はBiomeの安全な修正だけを適用する。

本番コードの是正前に導入して既存違反を記録し、その後の責務移譲で検出を解消した。現在も既存件数の差引き・ファイル単位の免除・抑制コメントは設けず、違反があれば失敗する。

## 判定

| 規則 | 対象 |
| --- | --- |
| `usecase-domain-getter` | ドメインの保持値を返すメソッド、表現のコピー/変換、その中継、公開データ属性の参照 |
| `usecase-result-unwrapping` | 共通 `ResultSuccess.value` の参照・分割代入。成功値を解体する入口として別規則で扱う |
| `unclassified-domain-access` | 循環や本体のない宣言などにより、取得用の公開面か判定できないドメインへの参照 |
| `unclassified-usecase-call` | `any`への型消去・構造型への投影等で、呼び先の実装を確定できない呼出し/参照。portの契約とは区別する |

呼び先はインストール済みTypeScript 7.0.2の非同期Compiler APIで解決する。`get`/`as`という名前や引数の数を禁止条件にはしない。private fieldを直接返すものだけでなく、ローカル変数経由、getterの中継、配列化、防御コピー、件数・文字列表現の導出も調べる。返値がVOでもgetterは検出対象である。

別名import、継承、角括弧アクセス、optional chaining、関数の別名、分割代入、`call/apply/bind`は、呼び先の宣言とメンバー参照を調べて検出する。同名のportメソッドや無関係なオブジェクトは対象にしない。

比較・predicate、ドメイン値の不変変換、結果の解釈、callbackへのdispatchは単なるgetterと区別する。`supportsMajor()`・`passes()`・`lowered()`・`interpret()`を名前だけで拒否しない。`Result.ok`による成功失敗のフロー分岐はこの検査で禁止しない。

走査対象はtsconfigに含まれる `src/<context>/usecase/**/*.ts` 全体である。`*UseCase`だけでなくFinalizer・Acquirer・read-modelも対象に含める。adapter/domain自身の変換は、この呼出元制約の対象外である。

## 限界と修正の判断

この検査は、getterの宣言に到達できる使用箇所を見つける静的検査であり、業務判断全般の正しさを証明するものではない。例えば、portの生データを数値演算して診断を決める処理は、ドメインgetterを呼ばずにも書ける。`match`のcallback内に業務判断を移しても、責務の移動にはならない。

構造型への投影・`any`・解決不能の呼出しを検出し、実装を確認できないまま成功にしない。可変ローカル変数、ループで作る配列、分割代入や引数を介するhelperの完全なデータフローは証明せず、取得か操作か確定できないものを分類保留として失敗させる。generator、fallback、Boolean変換、計算された分割代入やunionキーの使用にも回帰テストを置いている。

ドメイン型の入力結果をそのまま保持する場合と、初期値・全代入がドメインの不変操作である結果の蓄積は、getterとは区別する。helperの引数由来も伝播するため、`identity(this.#privateValue)`へ包んで内部値を取り出す回避は許可しない。

分類保留はgetter違反の断定ではない。要確認の診断を消すために型を失わせたり、getterを別名のhelperへ移したりせず、手動監査と突き合わせる。任意の反射・動的コード生成や、業務判断全般まで検出する検査ではない。

汎用ResultにQuint等の固有ロジックを入れない。取得の成否を扱う契約と、検証準備・検証結果を所有するドメイン型の操作を整え、ユースケースは取得・依頼・保存の順序を調整する。

リンター本体は `scripts/lint/`、CLIは `scripts/lint-usecase-getters.ts`、検出例・正常例・CLI終了コードのテストは `tests/usecase-getter-lint.test.ts` にある。Compiler APIはunstable公開面なので、TypeScript更新時にもこれらのテストと実ソース検査を必ず実行する。
