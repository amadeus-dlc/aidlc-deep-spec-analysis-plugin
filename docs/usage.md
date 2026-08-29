# Deep Spec Analysis 使い方ガイド

インストール後の実際の使い方を、新規プロジェクト・後入れ（運用中プロジェクトへの途中導入）の両方について説明する。インストール手順そのものは [README の Quickstart](../README.md#quickstart)、仕組みの図解は [architecture.md](architecture.md) を参照。

## 前提

1. **プラグインが対象プロジェクトへ導入済みであること** — 未導入なら README の Quickstart（インストーラ1コマンド）から。
2. **ソルバーの準備（任意・推奨）** — 対象プロジェクトで:

   ```sh
   bun add z3-solver          # SMTバックエンド（プロジェクトルートに追加）
   # node >= 23 がPATHにあること（z3はnode子プロセスで実行される）
   npm i -g @informalsystems/quint   # Quintバックエンド
   # 任意: JDK 17+ を入れて quint verify を一度実行すると
   # Apalache が ~/.quint に入り、simulation → bounded 検査に格上げされる
   ```

   ソルバーが無くてもステージは止まらない。無いバックエンドは `unavailable` としてカバレッジ表に記録され、`/aidlc --doctor` が導入コマンドを提示する。
3. **確認** — 対象プロジェクトのClaude Codeセッションで `/aidlc --doctor` を実行し、プラグインのdoctor行（z3 / node / quint / Apalache の可用性）を見る。

## 新規に使う（intentを最初から）

**鍵はスコープ選択**。ステージは `scopes: [enterprise, feature]` を宣言しているので、この2スコープのintentでのみ実行される。`classic` などそれ以外のスコープでは計画時にSKIPされる（仕様）。

1. `/aidlc "作りたいものの説明"` でワークフローを開始し、スコープに **feature** または **enterprise** を選ぶ。
2. Inceptionフェーズを通常どおり進める。`requirements-analysis` ステージが `requirements.md` を確定すると、その直後に `deep-spec-analysis-verify` ステージが自動で走る:
   - product agent が各FR/NFRをEARS分類し、バックエンド中立IRを `deep-spec-analysis-formal-model.md` に書き込む
   - 書き込みを検知して3センサーが順に発火（IRスキーマ検証 → SMT → Quint）し、findingsを `deep-spec-verify/*.json` に書く
   - findingsが1件ずつ **A / B / X の質問**としてあなたに返る
3. 質問に答える:
   - **A. 現状維持** — 指摘を認識したうえで要件をそのまま維持する
   - **B. 改訂案を採用** — 承認した改訂は**ステージが `requirements.md` に適用し、センサーを再実行して解消まで確認する**。手作業は不要。適用されるのはあなたがBで承認した文面だけで、A/Xにした要件や指摘のない箇所には一切触れない
   - **X. その他** — 自由回答
4. `deep-spec-analysis-report.md` を読む。義務×バックエンドのカバレッジ表と、適用済み改訂のbefore/after（第2パスの検証結果つき）が並ぶ。
5. 続く `domain-design` ステージは、このレポートがあればコンポーネント設計の確定前にfindingsを尊重するよう指示される（プラグインのオーバーレイによる）。

## 後入れで使う（運用中のプロジェクトへ途中導入）

composeは追加合成なので、**AI-DLC運用中のプロジェクトへ途中からインストールしても他には何も影響しない**。導入タイミングとintentの関係は次の3通り。

| intentの状態 | 挙動 |
|---|---|
| 導入後に作るintent（feature/enterprise） | ステージが自動で実行計画に入る。「新規に使う」と同じ |
| **導入前から進行中のintent**（feature/enterprise） | 実行計画にはステージが無いが、単一ステージ実行で後から検査できる（下記） |
| classicスコープのintent | 通常フローでもsingleモードでも拒否される。feature/enterpriseへのスコープ変更（またはintentの作り直し）が必要 |

導入前から進行中のintentへ検査をかけるには、対象intentをアクティブにした状態で:

```
/aidlc --stage deep-spec-analysis-verify --single
```

（composeで生成される `/deep-spec-analysis-verify` スキルは同じものの包装。）このsingle実行は:

- そのintentの既存 `requirements.md`（`<record>/inception/requirements-analysis/`）を読む
- findingsとレポートをそのintentのレコード配下に書く
- **ワークフローのCurrent Stageを一切進めない** — 検査だけして止まる

つまり「最初から入れていなくても、既存の要件に対して後から検査できる」。この経路は `deep-spec-analysis/tests/intent-e2e.test.ts` のlate adoptionブロックが毎回回帰検証している。

**未検査の把握は人間の注意力に頼らない**。検査漏れは次の2箇所で自動検出される：

- **インストーラの導入直後** — compose完了後にカバレッジスキャンが走り、対象スコープで `requirements.md` があるのに検査記録が無いintentを、実行コマンド付きで列挙する：

  ```
  ⚠ Existing intents with unverified requirements:
    - deep-spec-analysis: intent default/260829-xxx has requirements with no deep-spec verification
      → Make it the active intent (...), then run `/aidlc --stage deep-spec-analysis-verify --single` ...
  ```

- **`/aidlc --doctor`（以後いつでも）** — doctorに検査カバレッジ行（`verification coverage — N/M eligible intents verified`）が出続け、未検査intentは1件ずつadvisory行として列挙される。さらに**検査後に要件が変更されたintentはstale（要再検査）として検出**される。対象スコープはハードコードではなくステージ定義の `scopes:` から読む。

## 成果物の読み方

すべて対象intentのレコード `<record>/inception/deep-spec-analysis-verify/` 配下に書かれる。

- **`deep-spec-analysis-formal-model.md`** — LLMが書いた形式化の結果（単一のJSONフェンスにIR）。検査の入力。
- **`deep-spec-verify/smt.json` / `quint.json` / `cross-check.json`** — 各バックエンドのfindings。種類は3つ:

  | kind | 意味 | 証拠（witness） |
  |---|---|---|
  | `conflict` | 要件同士が同時に満たせない | unsat core（帰責されたFR/OB）、Quintは違反へ至る実行トレース |
  | `completeness-gap` | どの要件も挙動を定めていない入力領域 | 具体的な反例状態 |
  | `scenario-violation` | 期待シナリオが要件群と両立しない | 反例モデル |

  `cross-check.json` は両バックエンドが共に検査したシナリオの判定を照合し、不一致（形式化ミスの兆候）があればfindingとして報告する。
- **`deep-spec-analysis-report.md`** — カバレッジ表と改訂案。各義務は必ず次の4状態のいずれかで現れる（沈黙のギャップは作らない）:
  `checked`（検査済み）/ `skipped`（理由付きスキップ。例: When-eventシナリオはv1未対応）/ `unavailable`（ソルバー不在）/ `unverified`（未検証と明示）。

## トラブルシューティング

- **findingsが出ない・バックエンドがunavailable** — `/aidlc --doctor` でz3/node/quint/Apalacheの可用性と導入コマンドを確認。
- **ステージが計画に現れない** — intentのスコープを確認（`<record>/aidlc-state.md` の `Stages to Skip`）。classicなどスコープ外ならSKIPが仕様。
- **同じIRで結果が変わる** — 起きない設計（固定シード・正準ソート・タイムスタンプなし）。同一IR＋同一環境なら出力はバイト一致する。変わったなら環境差分（ソルバーの有無・バージョン）を疑う。
- **`requirements.md` が勝手に書き換わる不安** — 無断の編集は起きない。書き換わるのはBで承認（個別回答＋最終サマリ確認の二重ゲート）した改訂の文面だけで、決定論的なセンサー群は読み取り専用。適用内容はレポートの Applied Revisions に before/after で記録される。
