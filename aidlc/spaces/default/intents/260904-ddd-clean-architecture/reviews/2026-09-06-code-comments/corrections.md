# コードコメントの是正記録

監査で指摘したC01〜C10を是正した。変更はアプリケーションの14ファイルに及ぶ。コメントとテストの説明名を訂正し、コメントだけの未参照モジュールを削除した。

## 是正内容

| 監査項目 | 対応 |
| --- | --- |
| C01 | `unreachable`の説明を、その関数に到達した場合のpanicに限定。「唯一許されるthrow」を削除した。 |
| C02 | 比較器がkernelの公開facadeを通して共有されることと、現在の比較順を記した。 |
| C03 | 契約適合・文書形・キー順・降格理由のドメイン所有を明記。集約冒頭の重複した誤説明も削除し、テストの説明名2か所を訂正した。 |
| C04 | 3つのCLIで、通常のverdictはstdout・exit 0、不正な出力パスや保存失敗はstderr・exit 1と記した。 |
| C05 | fixtureがモデルと結果ファイルの存在を補うこと、doctorがsourceDigestも検査することを記した。後始末のコメントも、実際に行うソースの復元に限定した。 |
| C06 | 結果型とパーサ本体を区別し、実装の所在を記した。 |
| C07 | 外部文書を型付き宣言へ変換する責務と、意味的整合性をドメインが検査する分担を記した。 |
| C08 | 固定の層数を削除し、パッケージ定義の所在を記した。 |
| C09 | 廃止済みコンテキストの説明を削除。各型の所属は現在のfacadeとモジュールで示す。 |
| C10 | AST文・実行関数・export・静的import参照が0だった`refcheck/domain/functional-design.ts`を削除した。 |

監査で整理候補に挙げた`read-if-exists.ts`の移設元コメントも削除した。出力順・ハッシュ・検証予算など、現在の契約を説明するコメントは残している。

## 実測

是正コードのコミットは`3c588ff`。比較元mainは`5d56ef2`、元の監査基線は`ac4309c`である。両基線間の`src/`差分は0だった。監査基線には別件の文書言語検査が含まれるため、scripts・testsを含めた総数は単純比較しない。

| srcの指標 | 是正前 | 是正後 |
| --- | ---: | ---: |
| TSファイル | 517 | 516 |
| コメントトークン | 2,778 | 2,758 |
| コメントを含む行 | 2,783 | 2,763 |
| 全行数（末尾空行を除く） | 31,213 | 31,192 |

- [修正後の計測値](metrics-after.json)を保存した。コメント数の減少を品質の代理指標にはせず、是正内容との対応を上表に記した。
- [実行コードの比較](correction-evidence.json)では、mainのsrc・scripts・testsのTSファイル575個を確認した。残る574個は、テスト説明名2か所の変更を正規化したうえでBunの変換後コードが一致。削除した1個の変換結果は空だった。これは実行コードの比較であり、型契約の検査には別途typecheckと差分レビューを用いた。
- [実行結果](runtime-after.json)では、ofの例外とparseの非例外Result、比較器の公開、ドメイン内の降格、CLI3種の保存失敗時のexit 1と空stdout、doctorのハッシュ一致・不一致・anchorなしの判定を再確認した。削除対象は不在となり、ほかの観測結果は監査時と一致した。

## 検証結果

| 検証 | 結果 |
| --- | --- |
| `bun run check` | Biome・import整列・Lintが成功。usecase境界は60ファイル、違反0。 |
| `bun run typecheck` | 成功。 |
| `bun scripts/build-tools.ts --check` | 配布用14ファイルのバイト一致。 |
| `bun test --coverage` | 950成功・1スキップ・0失敗、終了コード0。 |
| `bun test tests/refcheck-report.test.ts` | 最後の説明名変更後に11成功・0失敗。 |
| プラグイン検証 | エラー0。compose hook自動注入の既存警告1。 |
| 全ハーネスのビルド | claude・codex・copilot・cursor・kiro・kiro-ide・opencodeが成功。 |

## 再実行

依存関係をインストール済みの是正コミットの作業ツリーで、ルートから実行する。比較スクリプトはこの是正専用であり、将来の実装変更後も合格を求めるCI規則ではない。出力先を別ディレクトリにして保存済みの証拠を保持する。

```sh
audit=aidlc/spaces/default/intents/260904-ddd-clean-architecture/reviews/2026-09-06-code-comments
out=$(mktemp -d)
bun "$audit/measure-comments.ts" "$PWD" "$out"
bun "$audit/verify-corrections.ts" "$PWD" "$out/correction-evidence.json"
bun "$audit/reproduce.ts" "$PWD" "$out/runtime-after.json"
```

是正前の再実行方法は[監査報告](report.md)に記載した。報告中のソースリンクは基線コミットに固定してある。
