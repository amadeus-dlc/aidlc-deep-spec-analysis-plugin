# 結合テスト手順

Test Strategy は **Minimal** なので、本来この段階では追加のテスト指示は作らない。
ただしこのプロジェクトの結合テストは**既に存在し、今回の変更で対象が変わった**
（`code-generation-plan.md` の Step 11 で spawn 先を出荷物に切り替えた）ので、
何がどこを繋いでいるかを記録する。新しいスイートは足していない。

## この変更で境界がどう変わったか

`code-summary.md` に書いたとおり、`tools/` は `src/entries/` から機械生成した出荷物に
なった。したがって結合テストの「相手」はソースではなく**出荷物**である。
`unit-test-instructions.md` の実行コマンド 6 番がこの群にあたる。

```
tests (in-process)  ──import──▶  @deep-spec/<ctx>-<layer>   （層の facade）
tests (spawn)       ──spawn──▶   tools/<entry>.ts           （bundle 済み出荷物）
installer           ──copy──▶    <project>/.claude/tools/   （14 ファイル）
dispatcher          ──spawn──▶   .claude/tools/<entry>.ts   （利用先での実行）
```

## テストフレームワークと設定

`bun:test`（bun 1.3.13）。追加のフレームワークもモックライブラリも入れていない。
外部プロセス（z3・quint・Apalache・installer）は差し替えず実際に起動する。

## 結合テストの区分と実行コマンド

| 区分 | 何を繋ぐか | コマンド |
|---|---|---|
| conformance | 出荷物 bundle を spawn し、findings JSON を凍結 golden と byte 比較する | `cd deep-spec-analysis && bun test tests/conformance.test.ts` |
| parity | 出荷物 bundle の spawn 出力をスナップショットと比較する | `cd deep-spec-analysis && AIDLC_PARITY=1 bun test tests/parity` |
| pipeline（in-process） | 層をまたぐ UseCase・Repository・Client の結線を facade 経由で検証する | `cd deep-spec-analysis && bun test tests/refcheck-pipeline.test.ts tests/design-pipeline.test.ts tests/verify-smt-pipeline.test.ts tests/verify-quint-pipeline.test.ts tests/refinement-pipeline.test.ts` |
| entry spawn | entry の配線（フラグ解釈・`data/` 解決・兄弟 entry / 子プロセスの spawn）を検証する | `cd deep-spec-analysis && bun test tests/ir-validation.test.ts tests/design-verify.test.ts tests/refcheck.test.ts tests/refinement.test.ts` |
| installer / compose | 一時サンドボックスへの導入・tombstone・再導入の冪等性を検証する | `cd deep-spec-analysis && bun test tests/intent-e2e.test.ts` |
| projection | ハーネス投影の内容を検証する | `cd deep-spec-analysis && bun test tests/plugin.test.ts` |
| パッケージ境界 | 宣言外の層が実行時にも型検査でも解決できないことを検証する | `cd deep-spec-analysis && bun test tests/package-boundaries.test.ts` |

## 期待するカバレッジ

結合テストはカバレッジ計測の対象外である。`tools/` は全て子プロセス実行なので
in-process 計測に乗らず、`bun test --coverage` の出力に一切現れない（実測）。
実効的な網は golden の byte 一致とスナップショットが担う。数値の床は domain 層の
0.9（行・関数）だけで、これは単体テストが支える。

## テストデータと環境

- golden は `tests/fixtures/*/expected/*.json`。**更新しない**。差分が出たらそれは退行
- parity スナップショットも更新しない
- 新規 fixture は `mkdtemp` で一時ディレクトリに作り、テスト終了時に消す。`tools/` にも
  `src/` にもテスト用 payload を置かない（`no-test-payloads` 規則）
- `intent-e2e` の `beforeAll` は engine プロセスを spawn するので明示のタイムアウト
  （`{ timeout: 300_000 }`）を持つ。新しいセットアップも同じ扱いにする
- Apalache は 8822 を再利用する。孤児が残っていると無関係な spec でも失敗するので、
  結合テストが Quint で不可解に落ちたらまず `lsof -nP -iTCP:8822 -sTCP:LISTEN` を見る
