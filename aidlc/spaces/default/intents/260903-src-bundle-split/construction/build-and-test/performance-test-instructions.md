# 性能テスト手順

このプラグインはサービスではなく CLI センサー群なので、レイテンシ percentile や
スループット、オートスケールといった一般的な性能指標は当たらない。測るべきは
**開発と CI のフィードバック時間**と**出荷物の大きさ**で、これは要件の NFR3・NFR4 に
対応する。負荷試験ツール（k6 等）は導入していない。

## 測定対象と目標

| 目標 ID | 内容 | 目標値 | 出典 |
|---|---|---|---|
| NFR3-a | ローカルの `bun test --coverage` | 60 秒以内（変更前 27 秒） | requirements.md NFR3 |
| NFR3-b | 全 bundle の生成 | 10 秒以内 | requirements.md NFR3 |
| NFR3-c | CI の総所要 | 変更前（約 1〜2 分）の 2 倍以内 | requirements.md NFR3 |
| NFR4-a | bundle 1 本の大きさ | 512 KiB（524,288 バイト）以下 | requirements.md NFR4（2026-09-03 オーナー裁定） |
| NFR4-b | `tools/` の総ファイル数 | 14（bundle 10＋data 4） | requirements.md NFR4 |

NFR4-a の上限は「異常な肥大化を止める」ためのものであって特定の数値ではない。
**閾値を通すために単位や解釈を選ばない**。実測が上限に迫ったら上限自体を裁定にかける。

## 実行方法

```bash
# NFR3-a
cd deep-spec-analysis && /usr/bin/time -p bun test --coverage

# NFR3-b
cd deep-spec-analysis && /usr/bin/time -p bun scripts/build-tools.ts

# NFR4-a / NFR4-b（自動判定は tests/build-tools.test.ts の出荷形テストが持つ）
cd deep-spec-analysis && bun test tests/build-tools.test.ts
cd deep-spec-analysis && ls -lS tools/*.ts | head -1
```

NFR4-a と NFR4-b は `tests/build-tools.test.ts` に表明があるので、CI で自動的に落ちる。
NFR3 は表明を置いていない（マシン差で不安定になるため）。手動測定の結果を
`test-results.md` の Target Verification Matrix に記録する。

## NFR3-c（CI 総所要）の扱い

CI の実測はこのワークフローからは取れない（GitHub Actions の実行が要る）。
`.github/workflows/ci.yml` に足したステップは `bun scripts/build-tools.ts --check` の
1 つだけで、ローカル実測 0.12 秒。既存ステップ（install / typecheck / test / validate /
7 ハーネス build）は増減していないので、**総所要の増分はこの 1 ステップ分**である。
2 倍以内という目標に対して余裕は大きいが、実測値は次回の CI 実行で確認する
（この段階では `Unverified` ではなく、増分の上界がローカル実測で確定しているため
`Met` と判定する。判定根拠は matrix に記す）。

## 回帰の見つけ方

- bundle が急に大きくなったら、まず `--external` の指定漏れ（`z3-solver` が inline された）と
  `import` の増加を疑う。生成器の出力にモジュール数が出る
- テスト時間が伸びたら、spawn 系スイートの本数と Apalache の bounded 実行を疑う。
  Apalache の孤児は「遅い」ではなく「失敗する」形で出る
- 生成時間はモジュール数にほぼ比例する（実測: 158 モジュールで 6ms、10 本合計で約 100ms）

## 測っていないもの

- センサー 1 本の実行時間（IR の大きさとソルバー次第で数十秒に達しうるが、目標値を
  定義していない）。ディスパッチャ側の `timeout_seconds`（75／85）が実質の上限
- 利用先プロジェクトでの起動時間。bundle 化で相対 import の解決が消えるぶん速くなるはずだが、
  目標値も基線も定義していないので測っていない
