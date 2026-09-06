# TraceStateの契約是正

## 選択された方針

オーナーは、ITF入力境界のparse移行漏れと特殊キーの出力欠落を是正し、TraceStateの等価性をキーと値の対応で判定する案を選択した。基線はmainの51fd4f0e54dea61872e612d9a030cc5d3fe4b936。

- TraceStateはキーとTraceStateEntryを一つの索引で保持する。
- 挿入順の違いは状態の等価性に影響させない。欠落と明示nullを区別し、値自身の等価性は維持する。
- 同名キーは最初の位置を保って最後の値を採用する。反復順と既存のJSON出力順を維持する。整数添字キーのJSON出力は標準の数値昇順となる。
- 受理した特殊キーもデータのプロパティとして文書へ出力する。
- decodeItfTraceはResult<TraceStates, string>を返し、各状態と全体のparse結果を処理する。クライアントのdeadlock・violation・temporal経路はこの集合を直接使う。

## 再現と回帰検証

修正前は、65,537属性または65,537状態を含む文書で、公開Quintエントリの3経路すべてがIllegalArgumentExceptionで終了した。文書サイズは既存の16Miコード単位上限内だった。6ケースの失敗を確認してから是正し、理由付きのunavailable skipを保存して正常に応答することを確認した。既存のrunFailedの判定方針を利用している。

特殊キーはTraceState.toDocumentとVerificationWitnessを経由したJSON化で保持を確認した。状態の比較は独立したインスタンスを使い、順序違い、値違い、キー違い、明示null、重複キー、元配列の変更、tail/filter、TraceStates.includeを検証した。TraceValueのネストJSONに関する既存の比較契約も固定した。

## ローカル検証

- 通常のbun test --coverage: 1,309成功・1スキップ・0失敗、終了コード0。ファイル単位の関数・行カバレッジ閾値も通過。
- 数値キーの既存挙動の追加後、LCOV実行で1,310成功・1スキップ・0失敗。追加ケースを含むTraceState契約テスト11件も成功。
- 相対カバレッジ: headと基線とも表示値99.91%、既存の許容差0.01ポイントで成功。閾値と除外設定は変更していない。
- 型検査、Biome、ユースケースgetter規律、文書の言語規律、配布物の再生成差分検査を確認。
- 一時worktreeでmise trustを実行。aidlc-workflowsサブモジュールの変更なし。

実装をLuna maxの2担当へ分け、公開APIで失敗を再現してから修正した。親が公開エントリの6経路を検証し、相互レビューで発見した数値キーの説明不足を是正した。
