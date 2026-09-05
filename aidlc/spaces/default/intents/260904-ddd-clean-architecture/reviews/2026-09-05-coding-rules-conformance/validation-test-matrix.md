# VOの検証観点と生成契約のテスト

## 対応表

| 観点 | テストする内容 | 主な対象 |
| --- | --- | --- |
| 発生源 | 自己申告されたダイジェストと独立に計算した取得内容を区別する。送信元の認証はVO単体では証明しない | ContentHash、DeclaredDigest、SourceAnchor |
| サイズ | 上限超過、固定長の直前・境界・直後、長大かつ字句不正な入力でサイズ検査が先行すること | 文字列VOの一覧、ContentHash、RequirementId、構造化した束縛値 |
| 字句的内容 | 全角・別文字体系の数字、ゼロ幅文字、制御文字、孤立サロゲートを、ASCII契約の文字と誤認しない | ハッシュ、要件・業務規則・義務・シナリオ・背景・設計・機械・遷移ID、バージョン |
| 構文 | 接頭辞、区切り、欠けた数値部分、余分な構成要素、バージョンの先行ゼロ・接尾辞 | 同上。IrVersionとPluginVersionの異なる仕様も保持する |
| 意味 | 閉集合の所属、安全整数・有限実数・正の位置・非負の個数の違い、境界の逆転、列挙メンバーへの適合、診断値を検証済み値と混同しないこと | VerificationMethod、SkipReason、FindingKind、AttributeBound、NumericBound、LineNumber、BlockIndex、FenceCount、BindingValue、DeclaredBound、DeclaredBindingValue |

主な追加先は`deep-spec-analysis/tests/secure-by-design-contracts.test.ts`。サイズの横断一覧は`value-size-contracts.test.ts`、生成経路の横断確認は`construction-contracts.test.ts`、要素型・所有権・束縛の不変条件は`binding-and-collection-contracts.test.ts`で確認する。

## ofとparseの対

同じ型の契約違反値を両方へ渡す。ofはIllegalArgumentExceptionを送出し、parseはok:falseとParseErrorを返す。ParseErrorがErrorのインスタンスでないことも確認する。TypeScriptの型違反をas unknown等で作らず、文字列には文字列、数値にはnumberを渡す。

VOの非公開フィールド、内部表現、Object.freezeの採用には依存しない。asString・asNumber・equals・parseなどの公開APIを観測する。入力や公開されたDTOの変更を試す所有権テストも、書き込みが内部でどう防がれたかではなく、公開APIを通して元の内容が保たれるかを確認する。

## 適用範囲

ContentHashは送信元の認証情報を持たない。ハッシュの形式や内容一致だけで、正当な送信元の保証をテストしたことにはしない。発生源の確認は受信・取得境界の責務として明記した。

数値VOは復号済みnumberを受け取るため、文字のエンコーディングや数値文字列の構文をコンストラクタで再検査しない。意味として必要な有限性・安全性・範囲を確認する。

宣言値は不適合な記述も診断対象として保持する。DeclaredBound.parse(0.5)が成功しても、安全整数境界への適合が成立するわけではない。自由文を許す名前・宣言値に、未定義のASCII限定規則をテスト都合で追加しない。

## テストで検出し修正した不具合

LineNumberとBlockIndexはNumber.isIntegerだけで判定しており、Number.MAX_SAFE_INTEGERを超える値を受け入れていた。追加テストが失敗することを確認し、両コンストラクタをNumber.isSafeIntegerに修正した。1と最大安全整数を受け入れ、0・負数・小数・NaN・Infinity・安全整数範囲外を拒否する。

FenceCount、DeclaredBound、BindingValueにも数値のparse経路を揃えた。ErrorMessage・NormalizedNameも、サイズ違反を通常生成でResultとして扱えるようparseを備える。いずれも検証条件はコンストラクタに置く。
