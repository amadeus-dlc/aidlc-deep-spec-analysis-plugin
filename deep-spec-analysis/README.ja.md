# deep-spec-analysis — AIDLC プラグイン

[English](README.md) | 日本語

AI-DLC v2 のための Kiro 流 **Deep Spec Analysis**：追加合成プラグインとしてのニューロシンボリック要件検証。LLM が `requirements.md` をバックエンド中立の IR に形式化し、決定論的なソルバーバックエンド（z3/SMT と Quint）が矛盾・完全性ギャップ・シナリオ違反を検査し、すべての finding は構造化された A/B 質問として人間に戻る。core は一切変更しない——プラグインを無効化すれば素のワークフローが残る。Kiro の [Deep Spec Analysis](https://kiro.dev/blog/deep-spec-analysis/) に着想を得ている。

## 追加されるもの

| 部品 | ファイル | 目的 |
|---|---|---|
| ステージ | `stages/inception/deep-spec-analysis-verify.md` | `requirements-analysis` 直後の Inception ステージ（scopes: `enterprise`, `feature`）。`deep-spec-analysis-formal-model` + `deep-spec-analysis-report` を生成 |
| 契約1（IR） | `tools/data/deep-spec-ir-schema.json` | バックエンド中立の形式モデル：schema / obligations（EARS nature）/ scenarios / background。`sourceDigest`（requirements.md の sha256）で正確なソーステキストにアンカーされる。SMT-LIB や Quint は一切含まない |
| 契約2（findings） | `tools/data/deep-spec-findings-schema.json` | `<record>/inception/deep-spec-analysis-verify/deep-spec-verify/<backend>.json` の正規化された各バックエンド結果：findings、理由付き `skipped[]`（無沈黙）、`unavailable`、正準ソート |
| IR センサー | `sensors/aidlc-deep-spec-ir-valid.md` + `tools/aidlc-sensor-deep-spec-ir-valid.ts`（`src/entries/` と `src/requirements/{domain,usecase,adapter}/` から束ねた配布物） | スキーマ適合＋意味検査＋frRefs の requirements.md 逆引き検証＋`sourceDigest` の再計算照合（ソースドリフトを拒否。エラーが期待値を提示） |
| SMT バックエンド | `sensors/aidlc-deep-spec-verify-smt.md` + `tools/aidlc-sensor-deep-spec-verify-smt.ts` | TypeScript で IR→SMT-LIB へコンパイルし、z3（`z3-solver` WASM）を子プロセス実行。矛盾（unsat core）・完全性ギャップ（witness モデル）・シナリオ検査。`method: exhaustive` |
| Quint バックエンド | `sensors/aidlc-deep-spec-verify-quint.md` + `tools/aidlc-sensor-deep-spec-verify-quint.ts` | TypeScript で IR→Quint へコンパイルし、`quint` CLI にシェルアウト。到達可能な不変条件違反（ステップトレース）・デッドロックギャップ・leads-to temporal（bounded）・シナリオ再検査。Apalache 検出時 `method: bounded`、それ以外はシード固定の `simulation` |
| クロスチェック | 両バックエンドが書く | `deep-spec-verify/cross-check.json` — シナリオ判定をバックエンド間で照合。`cross-check-disagreement` は要件の欠陥ではなく形式化/コンパイラの欠陥を示す（FR8.2） |
| Knowledge | `knowledge/aidlc-product-agent/deep-spec-ir-authoring.md` | product agent 向けの IR 著述規則 |
| 下流連携 | `contributions/inception/domain-design.md` | core の `domain-design` に `deep-spec-analysis-report` を任意 consume として追加し、受容済み findings を尊重するステップを合流 |
| refcheck センサー（設計フェーズ①） | `sensors/aidlc-deep-spec-refcheck-{domain,contract,functional}.md` + `tools/aidlc-sensor-deep-spec-refcheck-*.js`（`src/refcheck/` と `src/kernel/` から束ねた配布物） | 設計成果物のソルバー不要・LLM 不要な参照/構造整合：`components.md` カタログ（DD-0 のブロック形状＋散文の 7 整合規則 DD-1..7）、`contract-summary.md` のユニット/spec ブロック/DAG エッジ検査、ユニットごとの functional-design 検査（エンティティの型/範囲/リレーション、BR ルール id + FR source、状態機械 ↔ allowed values、コンポーネントカタログとのドリフト）。contributions の `adds.sensors` + fix-or-record フラグメントでコア設計ステージへ合流。findings は `deep-spec-refcheck/*.json`（契約2、`method: static`、自己検証済み） |
| 設計検証ステージ（フェーズ②） | `stages/construction/deep-spec-analysis-functional-verify.md` | `functional-design` 後の Construction 集約ステージ（scopes: `enterprise`, `feature`）：全ユニットのエンティティ/ルール/状態機械を設計 IR（契約3、`tools/data/deep-spec-design-ir-schema.json`——遷移・`ignores[]`・`initial` を持つネイティブ状態機械）へ形式化し、設計バックエンドを実行、A/B/X ゲート、承認済み設計改訂の適用（上流凍結：requirements には決して触れない） |
| 設計バックエンド（フェーズ②） | `sensors/aidlc-deep-spec-design-{ir-valid,verify-smt,verify-quint}.md` + `tools/aidlc-sensor-deep-spec-design-*.js`（`src/design/{domain,usecase,adapter}/` から束ねた配布物） | コンパイルダウン再利用：各ユニットを契約1 文書へロワリングし、実証済み v1 バックエンドを子プロセス実行。findings は設計語彙（DOB/TR/SM/DSC、ユニット帰責）へリマップ。合成 vacuity 相乗りによる新 kind：`unreachable`（デッドガード；bounded モードの到達不能状態も、予算キャップ付き）と `redundancy`（シャドーイング、相互ペアは畳み込み）。`deterministic: false` の機械は `waived` skip |
| refinement（フェーズ③） | `tools/data/deep-spec-refinement-map-schema.json` + `src/refinement/domain/` + knowledge | 人間がゲートする抽象化関数（契約4：attrMap 式／全域 enumMap、eventMap、無沈黙台帳 unmapped[]、二重コンテンツハッシュアンカー）と、それが設計バックエンド内で可能にする検査：ᾱ 代入した要件不変条件（静的は v1 z3 子プロセス、到達可能は Quint トレース）、イベントの enabledness と抽象フレーム付き 1 ステップ模擬、シナリオ再生、`mapping-gap` 閉包 findings。写像の欠如・陳腐化は明示 skip になり、決して沈黙しない |
| doctor | `tools/deep-spec-analysis-doctor.ts` | 可用性の advisory 検査（z3-solver・node・quint・Apalache、導入コマンド付き。Apalache 行は 8822 番に既にサーバが待ち受けているときだけ trivial spec を verify するので、検証できなくなった孤児サーバでは fail する）、要件検証カバレッジ（unverified/stale intent——stale 判定は `sourceDigest` のコンテンツハッシュ、mtime はレガシーフォールバックのみ）、既存設計成果物の report-only 構造負債スキャン |

## インストールと前提

AI-DLC v2 を導入済みのプロジェクトへ、安定版の不変タグから直接インストールします。

```sh
VERSION=v0.5.0
curl -fsSL "https://raw.githubusercontent.com/j5ik2o/deep-spec-analysis/${VERSION}/deep-spec-analysis/scripts/install.ts" |
  bun - --project <your-aidlc-project> --tag "${VERSION}"   # 必要に応じて --harness codex, kiro, … を追加
```

取得元を指定しない場合は、最新の安定版 SemVer タグを解決します。`--tag <tag>` は不変のリリースを固定し、`--from <repo-root>` はローカルのチェックアウトを使います。`--ref <branch>` は移動する開発ブランチを追従するためのオプションであり、再現可能な導入には使わないでください。`--update` は前回記録した取得元を再利用します。latest は最新タグを再解決し、local と ref は同じ取得元を取り直し、固定タグは `Changed 0` で終了します。`--update` と取得元オプションは併用できません。

導入の来歴は、対象プロジェクトの `<harness>/tools/data/deep-spec-analysis-install.json` に保存されます。`<harness>` は `.claude` や `.codex` などのハーネスツリーで、記録にはバージョン、解決済みの取得元、導入日時、ペイロードのダイジェストが含まれます。プラグインの配布に npm パッケージや GitHub Release のアセットは使いません。リモート導入では GitHub のソースアーカイブを直接取得します。

必須ランタイムは **bun** のみ。バックエンドは優雅に劣化する——以下はすべて任意かつ advisory（`/aidlc --doctor` が教えてくれる）：

```bash
# SMT バックエンド（z3）：プロジェクトにパッケージ + 子プロセス用の node ランタイム
bun add z3-solver          # AIDLC プロジェクトのルートで
# node >= 23 が PATH にあること（z3-solver の pthread WASM ビルドは現行 bun ではプロセス内で abort する）

# Quint バックエンド
npm i -g @informalsystems/quint
# 任意（simulation → bounded モデル検査への格上げ）：
#   JDK 17+ を入れて `quint verify` を一度実行（Apalache が ~/.quint にダウンロードされる）
```

ローカルのチェックアウトから開発する場合、検証とビルドは通常の AIDLC プラグインと同じです：

```bash
bun <checkout>/core/tools/aidlc-plugin-validate.ts .
bun <checkout>/core/tools/aidlc-plugin-build.ts . claude       # dist/claude/
bun <checkout>/core/tools/aidlc-plugin-test.ts . --install <project> --harness claude
```

## ステージの動き方

1. product agent が各 FR/NFR を EARS 分類し、IR を `deep-spec-analysis-formal-model.md`（単一の ```json フェンス）に書く。
2. write 発火の 3 センサーが順に走る：IR 検証、続いて両バックエンドが契約2 の findings を `deep-spec-verify/` 配下に書く。
3. ステージは `deep-spec-verify/*.json` を glob で収集し（バックエンド非依存）、各 finding を `[Answer]:` 質問——`A.` 現状維持 / `B.` 改訂案を採用 / `X.` その他——に変換して人間の決定を記録する。
4. `deep-spec-analysis-report.md` にカバレッジ表（義務×バックエンドごとの checked / 理由付き skipped / unavailable / unverified）と適用済み改訂が載る。`B.` 承認済みの改訂はステージ自身が `requirements.md` へ適用し（上流でこの成果物を所有するのと同じ product-agent ペルソナとして）、第 2 センサーパスで再検証する。人間が承認した文面以外が編集されることはない。

失敗がブロックすることはない：ソルバー欠如・タイムアウト・コンパイル不能な義務は `unavailable`/`skipped` の記録とレポートの 1 行になる。決定論：同一 IR + 同一環境 ⇒ バイト同一のセンサー出力（固定シード・正準ソート・タイムスタンプなし）。

## テスト

```bash
bun install   # conformance 用に z3-solver + @informalsystems/quint を固定
bun test
```

`tests/conformance.test.ts` は正典 fixture（`tests/fixtures/conformance/`）で両バックエンドを駆動し、期待 findings とバイト単位で 2 回照合する。劣化（ソルバー欠如・IR バージョン不一致）と偽造クロスチェック不一致も検査する。

ソースと出荷物はツリーが分かれている。TypeScript は `src/` にあり、5 つの境界づけられたコンテキスト（kernel / requirements / design / refinement / refcheck）×4 層（infrastructure / domain / usecase / adapter）に層化され、これに合成ルート10 本（9 センサー + doctor の entry）の `src/entries/` が加わる。契約スキーマは entry と同階層の `src/entries/data/` に置く——entry は自ファイルからの相対で `data/` を引くので、ソースツリーと出荷物で相対関係が一致する。`tools/` は出荷物だけを置くツリーで、`bun scripts/build-tools.ts` が生成してコミットした `.ts` バンドル 10 本（entry ごとに 1 本）＋ `data/` のスキーマ 4 本ちょうどしか無い。出荷される `tools/<entry>.ts` は「`.ts` という名前を着た bundle 済み JavaScript」である——AI-DLC のセンサーディスパッチャが manifest の `command` から `.ts` で終わるトークンを探して起動スクリプトを決めるため、ファイル名は契約の一部だが中身は TypeScript ではない。`--check` が再生成してバイト比較するので、陳腐化したバンドルは CI で落ちる。層 DAG・スタイル規律（domain の private constructor・get/enum/非 null 表明の禁止など）は `tests/architecture.test.ts` が red example つきで強制し、移行基底とのバイトパリティは `tests/parity/` が固定する（詳細は `tests/README.ja.md` と `docs/decisions.ja.md`）。

## 将来の分割（NFR4）

内部構造は「バックエンド 1 = センサー 1 + ツール 1」の厳密な対応を保っているため、後日の 3 分割（`deep-spec-analysis` core / `-smt` / `-quint`）は機械的作業で済む：各バックエンドのマニフェスト＋ツールのペアを独自のプラグインルートへ移し、`plugin.json` を追加し、ステージの `sensors:` リスト（バックエンドごとに 1 行）を付け替えるだけ。結合は契約1 と契約2 のみ：バックエンド同士は決して import し合わず、クロスチェックは sibling ファイルを汎用的に読む。

スパイク結果（bun 下の z3、quint の決定論）、未解決事項の決着、当初要件ドラフトからの逸脱は [docs/decisions.ja.md](docs/decisions.ja.md) を参照。

ソースが従う DDD とクリーンアーキテクチャの設計規則は [docs/architecture/](docs/architecture/README.ja.md) にある——35 の規則、新しい型を作るときの決定手続き、どの規則が機械検査で守られているかの棚卸し、そしていま残っている逸脱。他の AI-DLC プラグインへ持っていける形で書いてある。
