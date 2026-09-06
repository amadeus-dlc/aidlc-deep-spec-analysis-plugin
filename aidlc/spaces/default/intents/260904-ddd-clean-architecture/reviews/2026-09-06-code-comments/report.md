# コードコメントの実測監査

## 結論

**明確な不整合8類型、構造の誤解を招く古い説明1件、コメントだけの不要ファイル1件**を確認した。主な問題は、例外契約・責務の所有者・公開面・CLI終了条件を、古い設計のまま断定していることである。修正対象は13ファイルにまとまる。

監査基線は `ac4309c94c409b20479752f658878afbe650dcd0`。調査中に文書言語検査の別変更がコミットされたため、最終の集計はこのコミットのGitアーカイブに固定した。本番の `src/` は調査開始時の `a20d604` から変更されていない。監査時点ではコード・コメントの修正は行っていない。その後の是正内容と検証結果は[是正記録](corrections.md)を参照。

## 母集団と方法

| 範囲 | TSファイル数 | コメントトークン数 | コメントを含む行数 | 全行数 |
| --- | ---: | ---: | ---: | ---: |
| src | 517 | 2,778 | 2,783 | 31,213 |
| scripts | 10 | 213 | 234 | 2,281 |
| tests | 51 | 1,030 | 1,030 | 23,213 |
| 合計 | 578 | 4,021 | 4,047 | 56,707 |

`//`は1行を1トークン、`/* ... */`は全体を1トークンと数えた。複数行の説明を意味ごとに数えた件数ではない。全行数は末尾の空行を除いて計測した。

- 全578ファイルからASTを使ってコメントを抽出した。文字列、正規表現、テンプレートの本文は除外し、`${...}`内の実コメントは残す。抽出器はURL・正規表現・テンプレート・空ブロックを含む4コメントのfixtureで確認した。
- 抽出後、規則の断定、責務・公開面・型表現の説明、件数、移設経緯を重点的に照合した。全コメントの意味的正しさを機械的に証明したという監査ではない。
- `tools/`・`dist/`は生成物として二重計上せず、依存パッケージと`aidlc-workflows/`も対象外。Markdown本体や設定ファイルのコメントは今回の主対象に含めない。
- [全コメント・ファイル別計測・内容ハッシュ](inventory.json)、[静的照合の集計](static-evidence.json)、[実行による再現結果](runtime-evidence.json)を保存した。

## 優先して直す不整合

### C01 — 許されるthrowの説明が現在の構築契約と逆

場所: [result.ts:14–15](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/ac4309c94c409b20479752f658878afbe650dcd0/deep-spec-analysis/src/kernel/infrastructure/result.ts#L14)

> 予期される失敗ではない — domain 層で唯一許される throw。

実測ではdomainの98ファイルに163個のThrowStatementがあり、155個は`new IllegalArgumentException(...)`である。`ContentHash.of("invalid")`はその例外を送出し、同じ入力の`parse`は`not-a-sha256-hex`という非例外エラーを返した。

現在の原則は、コンストラクタ・ofの契約違反をpanicとし、parseが自分の構築契約違反をResultへ変換することである。コメントに従って他のthrowを禁止・除去すると、値の不変条件を壊す。

**対応**: 「閉じた変種の網羅性が破れた場合のpanic」というこの関数の責務だけを書く。「唯一許される」を削除する。

### C02 — 非公開と説明された比較器が公開され、他コンテキストも直接利用

場所: [canonical-order.ts:4–6](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/ac4309c94c409b20479752f658878afbe650dcd0/deep-spec-analysis/src/kernel/infrastructure/canonical-order.ts#L4)

コメントは「facadeからは出さず」「他の文脈は必ずDP/コレクションの門を通る」としている。しかし、[公開facade](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/ac4309c94c409b20479752f658878afbe650dcd0/deep-spec-analysis/src/kernel/infrastructure/index.ts#L9)は`compareCanonically`と`sortedUniqueCanonically`をexportしている。

実行時importでも2関数とも公開を確認した。src内の直接importは12ファイルで、kernel外は7ファイル（design 5、refcheck 1、requirements 1）だった。

**対応**: 実際の公開契約に合わせ、共通の正準比較アルゴリズムとして説明する。非公開化する設計変更が別途必要かどうかと、誤ったコメントの訂正を混同しない。

### C03 — 契約適合と降格文言の所有者をadapterと誤記

場所:

- [reference-check-report.ts:92–93](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/ac4309c94c409b20479752f658878afbe650dcd0/deep-spec-analysis/src/refcheck/domain/reference-check-report.ts#L92)
- [refcheck-report.test.ts:13–14](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/ac4309c94c409b20479752f658878afbe650dcd0/deep-spec-analysis/tests/refcheck-report.test.ts#L13)

前者は降格文言を「emitter（アダプタ）が組む」、後者は「直列化・契約適合・降格文言はadapterのserializerが持つ」と説明している。

実際には、[ReferenceCheckReport.conformedTo](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/ac4309c94c409b20479752f658878afbe650dcd0/deep-spec-analysis/src/refcheck/domain/reference-check-report.ts#L278)が[FindingsSchema.degradationReasonFor](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/ac4309c94c409b20479752f658878afbe650dcd0/deep-spec-analysis/src/kernel/domain/findings-schema.ts#L52)へ依頼し、ドメイン内で降格する。文書のキー順も`ReferenceCheckReport.toDocument`が所有し、[renderReportBytes](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/ac4309c94c409b20479752f658878afbe650dcd0/deep-spec-analysis/src/refcheck/adapter/reference-check-report-serializer.ts#L26)はJSON.stringifyと改行の付加だけである。

実行でも、adapterを呼ばずにドメインの`conformedTo(FindingsSchema.unreadable("audit-probe"))`だけで、passがtrueからfalseに変わり、`findings schema unreadable: audit-probe`という理由が生成された。

**対応**: 「適合・文書形・降格理由はdomain、byte描画はadapter」に揃える。テスト名の古い説明も併せて見直す。

### C04 — 3つのCLIが「常にexit 0」と説明されている

場所:

- [refcheck-domain entry:17–19](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/ac4309c94c409b20479752f658878afbe650dcd0/deep-spec-analysis/src/entries/aidlc-sensor-deep-spec-refcheck-domain.ts#L17)
- [refcheck-contract entry:15–17](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/ac4309c94c409b20479752f658878afbe650dcd0/deep-spec-analysis/src/entries/aidlc-sensor-deep-spec-refcheck-contract.ts#L15)
- [refcheck-functional entry:16–18](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/ac4309c94c409b20479752f658878afbe650dcd0/deep-spec-analysis/src/entries/aidlc-sensor-deep-spec-refcheck-functional.ts#L16)

3ファイルとも`always exit 0`としている。しかし実装は引数不成立や`save-failed`でexit 1を返す。

正常なrefcheck fixtureを一時ディレクトリへ複製し、保存先の`deep-spec-refcheck`だけを通常ファイルで占有して実行した。**3つすべてでexit 1、stdoutは空、stderrはfailed to write / io-failed**だった。実リポジトリ内の成果物は変更していない。

**対応**: 「通常の検査結果はexit 0。不正な起動引数・保存失敗はexit 1」と、stdoutの有無も含めて説明する。コメントに合わせて失敗を成功扱いにしてはならない。

### C05 — doctorを「存在だけの検査」と誤記

場所: [intent-e2e.test.ts:309–311](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/ac4309c94c409b20479752f658878afbe650dcd0/deep-spec-analysis/tests/intent-e2e.test.ts#L309)

> file — the doctor only checks presence

現在は[VerificationObservation.problemState](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/ac4309c94c409b20479752f658878afbe650dcd0/deep-spec-analysis/src/doctor/domain/verification-observation.ts#L31)が、モデル・結果の存在だけでなく`VerificationStaleness`の内容ハッシュ照合も使う。

hasModel=true・hasFindings=trueを固定した実測では、ハッシュ一致はverified、不一致はstale、anchorなしもstaleになった。このコメントは、sourceDigestを維持すべきfixtureの条件を隠してしまう。

**対応**: ここでfixtureが補っている条件だけを書く。検証済み判定全体を「存在だけ」と説明しない。

### C06 — 結果型のファイルをパーサ本体・エラー文言の発生点と説明

場所: [refinement-map-parse.ts:3–4](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/ac4309c94c409b20479752f658878afbe650dcd0/deep-spec-analysis/src/design/adapter/refinement-map-parse.ts#L3)

コメントは「共有パーサ」「ここが唯一の発生点」としている。しかしこのファイルはtype importと結果unionだけで、実行関数は0、実行時exportも0である。

実際の処理と文言は[parseRefinementMapDocument](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/ac4309c94c409b20479752f658878afbe650dcd0/deep-spec-analysis/src/design/adapter/refinement-materials-repository-implementation.ts#L266)が所有する。同関数へJSON fenceのない文書を渡すと、そこで`refinement map does not contain exactly one ... fence`というmalformed結果が作られることを確認した。

**対応**: 「共有パーサの結果型」とし、処理本体の所在を指す。コメントだけで実装の場所を誤認させない。

### C07 — AttributeDeclarationが生Jsonを保持するとの古い説明

場所: [functional-design-parser.ts:3–5](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/ac4309c94c409b20479752f658878afbe650dcd0/deep-spec-analysis/src/refcheck/adapter/functional-design-parser.ts#L3)

「AttributeDeclarationの生Jsonフィールド」と説明するが、現在の[AttributeDeclaration](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/ac4309c94c409b20479752f658878afbe650dcd0/deep-spec-analysis/src/refcheck/domain/attribute-declaration.ts#L27)にはJson識別子が0個。11個のprivateフィールドは型付きVO・不在値・宣言有無のbooleanで構成される。

**対応**: 現在行っている「外部のJsonを型付き宣言へ変換する」責務を書く。削除済みの生Jsonフィールドを例外として復活させる誘因をなくす。

### C08 — 層パッケージ数の17が古い

場所: [architecture/rules.ts:36](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/ac4309c94c409b20479752f658878afbe650dcd0/deep-spec-analysis/tests/architecture/rules.ts#L36)

コメントは17層とするが、`src/<context>/<layer>/package.json`は16個。entriesとtestsを加えたワークスペース数は18個である。[テスト本体](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/ac4309c94c409b20479752f658878afbe650dcd0/deep-spec-analysis/tests/architecture.test.ts#L923)も16層を表明しており、コメントと検査の間で数が割れている。

**対応**: 変更されやすい固定個数をコメントから外し、構造と列挙元を記す。数が必要なら自動集計・テストの値を参照する。

## 古い説明とノイズ

### C09 — 統合済みのrefinementを独立したコンテキスト/サービス群のように説明

場所: [design/domain/index.ts:121–123](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/ac4309c94c409b20479752f658878afbe650dcd0/deep-spec-analysis/src/design/domain/index.ts#L121)

「このコンテキストはadapterを持たない」「ドメインサービス群」という説明が、designのfacadeに残る。現在`src/refinement`は存在せず、refinementの実装はdesignへ統合済み。design/adapterには22 TSファイルがあり、要件取得・map復号・クエリ生成・外部実行を含む。

「旧」とは書かれているため、現行design全体についての誤記と一律断定するより、**参照先が曖昧な古い分類**として扱うべきである。それでも、現在の型の所属やdomain service導入の判断を誤らせる。

**対応**: 「designに属するrefinementの公開語彙」と記す。現在の型を一括でドメインサービスと呼ばない。

### C10 — コメントだけのfunctional-design.ts

場所: [refcheck/domain/functional-design.ts:1](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/ac4309c94c409b20479752f658878afbe650dcd0/deep-spec-analysis/src/refcheck/domain/functional-design.ts#L1)

9行の説明と末尾の空行だけで、AST文・実行関数・runtime exportはいずれも0。src/scripts/testsからの静的import参照も0だった。「ここは宣言が自分の整合性判定を所有する」と説明するが、当該ファイルにはそれを行う型がない。

**対応**: ファイルを削除し、必要な原則は規律文書や実際の所有型へ置く。空のモジュールをドメインモデルの所在として残さない。

## 一律削除にしない整理候補

srcのコメントには「旧/逐語/移設」を含むものが229トークン・125ファイル、「PR/issue/波/裁定」の記録を含むものが236トークン・173ファイルあった。両集合には重複があり、この数をそのまま誤り・ノイズ件数にはしていない。

たとえばread-if-exists.ts冒頭の移設元名は、現在の処理内容を説明する文と分けて削減できる。一方で、出力バイト順や到達性の過大近似が必要な理由は保守時に重要であり、古い経緯に触れていても残す価値がある。

残すべき例として、ContentHashのサイズ→字句→構文と発生源の限界、reachability-variantの設計不変量を外す理由、bounded-value-snapshotの一度だけ読み取る契約を確認した。最後の例はgetterを持つ入力で実行し、読取1回・保持値checkedを再現できた。

整理時は、実装の逐語説明や移設履歴を削り、**現在の契約・理由・観測可能な制約**を残す。コードを誤コメントに合わせて戻す修正はしない。

## 再実行

基線コミットをチェックアウトした別作業ツリーにこの監査ディレクトリをコピーし、`deep-spec-analysis/`で`bun install --frozen-lockfile`を実行してから、その作業ツリーのルートで次を実行する。基線の結果を上書きしないよう、再実行にはコピーを使う。

```sh
bun aidlc/spaces/default/intents/260904-ddd-clean-architecture/reviews/2026-09-06-code-comments/measure-comments.ts
bun aidlc/spaces/default/intents/260904-ddd-clean-architecture/reviews/2026-09-06-code-comments/derive-static-evidence.ts
bun aidlc/spaces/default/intents/260904-ddd-clean-architecture/reviews/2026-09-06-code-comments/reproduce.ts
```

1本目は開始時のHEADをアーカイブして母集団を固定する。2本目はその集計から静的な照合結果を作る。3本目は現在のsrcを使って公開APIと一時fixtureのCLIを確認するため、基線のコードで実行する。実測結果には実行時HEADを記録する。修正後に再実行して期待値が変わることは、当時の測定の失敗とは区別する。

この報告は是正前の監査記録である。ソースへのリンクは監査基線に固定し、削除・行移動の後も当時の根拠を参照できるようにしている。
