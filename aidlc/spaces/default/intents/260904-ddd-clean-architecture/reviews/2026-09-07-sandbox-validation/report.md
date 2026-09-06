# 実サンドボックス検証と追加是正

## 結論

前回の完了報告には、実Apalacheによるbounded検証が含まれていなかった。自動統合スイートは使い捨て環境への導入・更新・ディスパッチャ実射を含むが、Quintはsimulationを使用していた。今回、独立したサンドボックスへ変更前・変更後を導入して比較し、実ソルバーによる検証と異常入力からの復旧を追加した。

実射で2件の欠陥を発見し、是正した。

1. Quintが終了コード0で`NoError`と`[ok] No violation found`を返した正常なbounded検証を、ログ中の`error`という部分文字列により`unavailable`にしていた。JDKの正常な警告文にも同じ語があった。ログの単語検索を削除し、機械・時相・シナリオの3経路でプロセス終了の事実を使う。自発的なSIGTERM/SIGKILLと予算超過も区別する。
2. リポジトリが129文字の単位名を`corrupt`として拒否しても、refcheckのユースケースが全取得失敗を`not-applicable`に丸めていた。3系統とも、不在だけを適用外にし、不正・I/O失敗は`acquisition-failed`として返す。entryは診断をstderrへ出してexit 1とし、レポート保存には進まない。

## 条件

- 基線: `20d768cb457f90c45751b7da83f687fe7835393f`。
- 前回マージ後: `eee3b3a36bf3b9d607a3004fbf636110504c37c0`。
- 最終候補: この記録と同じ変更の配布ツール。14ファイルのSHA-256を[evidence.json](evidence.json)に固定した。3環境の導入済みファイルはすべて同じ指紋である。
- Bun 1.3.13、Node 24.19.0、Quint 0.32.0、Java 26.0.2、Apalache 0.56.1。実行先cwdで測定した。
- Quintは`AIDLC_DEEP_SPEC_QUINT_METHOD=bounded`。到達性候補の検証上限は16件。既定2件での明示スキップも先に確認した。製品の既定値は変更していない。
- 要件・refcheck・設計・精緻化の4つのfeature intentに既存fixtureを配置し、導入先の`aidlc-sensor.ts fire`で9種類のセンサーを15ケース実行した。doctorは46チェックを出力した。
- LLMによる形式化・承認会話は検証対象外。既存fixtureで検証・導入・更新の実行経路を再現した。

## 比較結果

| 比較 | 報告ファイル | 差分 |
|---|---:|---|
| 変更前 → 前回マージ後へ上書き更新 | 15 | 0件 |
| 前回マージ後の更新導入 → 新規導入 | 15 | 0件 |
| 追加修正後の更新導入 → 最終コードの新規導入 | 15 | 0件 |
| 追加修正後の再実行 | 15 | 0件 |
| 異常入力を戻した後の再実行 → 健全な候補 | 15 | 0件 |

前回マージ後と今回の追加修正の差は、設計側の`quint.json`の1件のみ。`archived`の到達性が`unavailable`から、指定されたbounded探索範囲での`unreachable`へ回復した。その他14ファイルはバイト一致した。最小再現は約4秒で、修正前は未検証、修正後はbounded・findings 0・skipped 0となった。別の実行で、正常な機械不変量・leads-to時相条件・acceptシナリオの3経路も実ソルバーで成功した。

同じローカルソースからの`--update`は`Changed 0`となり、導入記録のバイトとmtimeも変化しなかった。

fixtureは意図的な欠陥を含むため、センサーの`failed`は一律に実行失敗を意味しない。要件の矛盾・設計の到達不能・精緻化違反等の検出を確認した。精緻化fixtureの要件モデルはsourceDigestを持たず、ir-validがその欠落を正しく診断することも確認した。正常な要件・設計モデルのir-validはpassedである。

## 異常入力と復旧

| ケース | 実測 |
|---|---|
| 設計の重複ID | exit 0、`pass:false`・`ir-unreadable`。panicなし |
| 状態機械見出し65,537件 | FD-S1/FD-S2を`unrecognized-format`として報告 |
| YAMLの`__proto__`内に偽のentities | 偽の実体をレポートへ混入しない |
| 単位ディレクトリ名129文字 | refcheckはstderrへ原因を出してexit 1。doctorも明示診断 |
| query IDを欠くsolver応答 | exit 127、利用不能の報告。TypeErrorなし |

入力を戻して対象センサーを再実行すると、15件の報告が元のバイトへ復元された。finalization lock、一時ファイル、cross-check staleマーカーの残留は0件だった。

## ローカル検証

- 型検査、Biome、ユースケース境界検査: 成功。
- 全体テスト: 1,351成功、既存スキップ1、失敗0、8,139 assertions。行カバレッジ99.97%。
- 回帰テスト: 正常ログ、非ゼロ終了、SIGTERM/SIGKILL、時相だけの失敗、3系統の取得失敗と保存未実行、実entryの異常終了を確認。
- 配布物: 再生成し、原本との同期を確認した。

一時検証環境と実行ログはローカルの専用ディレクトリに保持し、既存のユーザー用サンドボックスは変更していない。

## 最小再現の実行

[再現モデル](repro/deep-spec-analysis-formal-model.md)を導入済みツールへ渡す。終了コード0・`method: bounded`・findings/skippedがともに空であれば、当該不変量の検査が正常完了している。

```sh
AIDLC_DEEP_SPEC_QUINT_METHOD=bounded \
AIDLC_DEEP_SPEC_QUINT_BIN=/path/to/quint \
bun /path/to/sandbox/.claude/tools/aidlc-sensor-deep-spec-verify-quint.ts \
  --stage deep-spec-analysis-functional-verify \
  --output-path /path/to/repro/deep-spec-analysis-formal-model.md
```

Quint 0.32.0とApalache 0.56.1を使い、生成される`deep-spec-verify/quint.json`を確認する。stdoutに`NoError`が出ることはエラーの証拠ではない。
