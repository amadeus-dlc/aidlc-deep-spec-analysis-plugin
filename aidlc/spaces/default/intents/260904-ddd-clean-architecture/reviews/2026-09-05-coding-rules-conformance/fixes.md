# 共有規則への適合監査 — 修正記録

## 追補: VO・コレクション・解析エラーの横断是正

2026-09-05の追加指示に基づき、[値の構築契約と横断是正](value-contracts.md)を実施した。以下のR1〜R4は最初の是正時点の記録として残す。特にR4のJsonによる束縛は、今回のドメイン固有型へ置き換えた。

- 文字列VOは長さを先行検査し、式・宣言値・証拠はサイズ検査後にコピーする。型をunknownへ広げない。
- ErrorMessagesをErrorMessageのコレクションに変更。列挙値・初期状態・属性パスも型付き要素へ移行し、プリミティブを許す7件の検査除外を削除した。
- 束縛はBindingDeclaration/DeclaredBindingsとScenarioBinding/ScenarioBindingsへ移行し、シナリオ・lowering・SMT・Quint・直列化まで対応した。旧BindingPairs/IrBindingPairsは削除した。
- FrRefsなど4型、メソッド、構築引数をFunctionalRequirementの正式名へ変更した。公開JSONのfrRefsキーは維持する。
- parseの失敗は例外に依存しないParseError型とした。コンストラクタの契約違反だけを独立した不変値へ変換する。
- 原理原則はClaude/Codex両方のknowledge/aidlc-sharedへ配置し、ユーザーの加筆も同期した。org.mdへの変更は残していない。

最終のローカル検証: **787成功・1スキップ・0失敗、788テスト、39ファイル、終了コード0**。TypeScript型検査、生成14ファイルの同期、plugin validation、7ハーネスのビルドが成功した。validationには従来のcompose-hook-absent警告が1件ある。lcov合算line coverageは**99.87637671386828%（8887 / 8898）**で、しきい値と除外は変更していない。正常系golden、契約スキーマ、aidlc-workflows submoduleに差分はない。

基線資料の実行環境は[再現手順](baseline-reproduction.md)で対象コミットへ固定する。監査シャードのHuman Turn見出しはツールの記録形式であり、Markdownの重複警告を解消する目的で過去のイベント見出しを改変しない。

[監査結果](review.md)のR1〜R4を修正した。監査の基線は`26324f9`であり、[再現コード](reproduce.ts)と[結果](results.jsonl)は修正前の事実を保存している。修正後の期待動作は以下の回帰テストで検証する。

## 修正内容

| 指摘 | 修正 | 回帰確認 |
| --- | --- | --- |
| R1: 応答欠落を成功扱い | 子プロセスの応答と発行済みIDを一対一に照合し、欠損・部分応答・未知ID・重複ID・不正な応答をResultで拒否する。SMT判定には未応答を明示し、未検証のskipへ変換する | 実際の子プロセスが空応答で正常終了してもunavailableになる。完全な各状態、順序が異なる完全応答、欠損・不正応答を検証 |
| R2: IDの受理範囲と操作が不一致 | 義務・シナリオ・背景・設計義務・設計シナリオ・設計背景・状態機械・遷移の8種類を各スキーマの形式へ一致させる | 有効IDの通常操作、空・形式違反・他種IDをparseが拒否し、ofがpanicとして送出することを検証 |
| R3: 入力参照の共有 | 7種類の宣言型の`#seed`を廃止し、型付きprivateフィールドへ取り込む。missing配列、bindingsの組・JSON値は独立したスナップショットにする | 入力record、配列、tuple、ネストした値、add後の入力、toArray・iterator経由の変更が内部へ伝わらないことを検証 |
| R4: bindingsのunknown | IrBindingPairs・BindingPairsの全公開面とコンストラクタを既存のJson型へ限定する | bigint・関数・undefinedが値型へ適合しないことをTypeScriptの型検査で固定する |

SMTでは未発行の前件空虚クエリを未応答と誤認しないように、発行済みの`vacuityQueries`を計画が保持する。応答の有無から発行の有無を推測していた分岐を削除した。実際に返ったunknown/budget/errorの既存文言は維持し、未応答は`unrecognized-format`として区別する。

IDの厳密化により、LoweringIndexが義務IDなどを遷移IDに包んで問い合わせていた箇所も顕在化した。種類の異なる候補を調べる操作はparseのResultを使い、不該当ならfalse/nullを返す。ofのpanicをcatchする形にはしていない。

コンストラクタの引数をunknownへ広げず、本来の型に限定した。コンストラクタに型の実行時検査は追加していない。JSONの外部応答はadapterのデコーダーで扱う。O1の寛容なモデル読込の方針は今回の4件と分け、監査記録の追加観測として残す。

## 検証

- [coding-rules-conformance.test.ts](../../../../../../../deep-spec-analysis/tests/coding-rules-conformance.test.ts): 新しい回帰テスト39件に成功。R1の外部応答・未発行との区別、R2の8種類のID、R3の7宣言型と2bindings、R4の型制約を確認する。
- [verify-smt-pipeline.test.ts](../../../../../../../deep-spec-analysis/tests/verify-smt-pipeline.test.ts): global・vacuity・event-pair・gap・scenarioの未応答を確認。個別判定を試す既存fixtureも、ほかの発行済みクエリに完全な応答を用意する形へ変更した。
- 全体は**715成功・1スキップ・0失敗、716テスト、37ファイル、終了コード0**。スキップは明示的なスナップショット指定を要するparity harness。
- `bunx tsc --noEmit`: 成功。bindingsの型制約もこの検査に含まれる。
- lcovの合算line coverage: **99.86%**（8649 / 8661）。しきい値と除外は変更していない。
- 生成14ファイルの同期、plugin validation、7ハーネス向けビルドに成功。validationはエラー0、既存のcompose hook未同梱警告1件。
- 正常系golden、契約スキーマ、`aidlc-workflows/`は変更していない。

手書きfixtureで用いられていた`DO-1`・`DS-1`・`T-1`・`BG-A`などは、該当する型の正しいIDへ変更した。異なる種類に同じ`X-1`を与えていた重複テストは、各種類の有効なIDを重複させる形に直した。検査対象の性質を維持し、不正なドメイン値を正常fixtureとして構築しない。
