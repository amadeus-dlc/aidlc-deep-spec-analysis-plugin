# aidlc-deep-spec-analysis-plugin

[English](README.md) | 日本語

[AI-DLC v2](https://github.com/awslabs/aidlc-workflows) 向けのニューロシンボリック要件検証を、追加合成（additive）プラグインとして提供します。LLM が `requirements.md` をバックエンド中立の IR に形式化し、決定論的なソルバーバックエンド——z3（SMT）と [Quint](https://quint-lang.org/)——が矛盾・完全性ギャップ・シナリオ違反を検査し、すべての finding は構造化された A/B 質問として人間に戻ります。core は一切変更しません：プラグインを無効化すれば素のワークフローに戻ります。Kiro の [Deep Spec Analysis](https://kiro.dev/blog/deep-spec-analysis/) に着想を得ています。

これは開発ワークスペースです。プラグイン本体は [`deep-spec-analysis/`](deep-spec-analysis/) にあります——設計の全体像はその [README](deep-spec-analysis/README.ja.md) を参照してください。

## ハイライト

- **初日から 2 つのソルバーバックエンド** — SMT（z3、exhaustive）と Quint（bounded/simulation）。シナリオ判定を相互照合し、要件の欠陥だけでなく形式化自体の欠陥も検出します。
- **沈黙のギャップを作らない** — すべての義務は「検査済み」「理由付きスキップ」「`unavailable`」のいずれかとして必ず現れ、カバレッジ表が「何を検証し、何を検証しなかったか」を正確に示します。
- **決定論** — 同一 IR + 同一環境 ⇒ バイト同一のセンサー出力（固定シード・正準ソート・タイムスタンプなし）。バイト一致の conformance テストで担保します。
- **優雅な劣化** — ソルバーの欠如がステージを止めることはありません。advisory な finding と `/aidlc --doctor` のヒントに落ちます。
- **検証済み要件に対する refinement（フェーズ③）** — 人間がゲートする明示的な抽象化写像が、各ユニットの設計を検証済み要件 IR に結び付けます：ᾱ 代入した不変条件は静的にも機械の全実行に沿っても成立しなければならず、写像された遷移は要件イベントを模擬し（enabledness + 抽象フレーム付き 1 ステップ模擬）、シナリオは再生され、写像の閉包規則が無言の省略をすべて `mapping-gap` に変えます（[要件: #2](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/issues/2)）。
- **functional design の形式検証（フェーズ②）** — 各ユニットのエンティティ・ビジネスルール・ネイティブ状態機械を設計 IR に形式化し、コンパイルダウン再利用で同じ z3/Quint 機構にかけます：非決定遷移、デッド/冗長ルール、未カバーの状態×トリガセル（人間が宣言する `ignores` 付き）、ステップトレース付きの到達可能な不変条件違反、bounded モードの到達不能状態（[要件: #2](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/issues/2)）。
- **設計成果物の整合性（設計検証拡張フェーズ①）** — ソルバー不要の refcheck センサーが `domain-design`・`contract-design`・`functional-design` の成果物書き込み時に発火し、宙に浮いた参照、非対称・循環依存、幻の FR source、エンティティモデルと食い違う状態機械、設計ステージ間のエンティティドリフトを検出します（[要件: #2](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/issues/2)）。

## クイックスタート

### 前提

- [bun](https://bun.sh/)
- [AI-DLC v2](https://github.com/awslabs/aidlc-workflows) がインストール済みの対象プロジェクト
- 任意（対象プロジェクトでソルバーバックエンドを使う場合）：node ≥ 23（z3 子プロセス）、`@informalsystems/quint`、JDK 17+（Apalache による bounded 検査）——手順は[プラグイン README](deep-spec-analysis/README.ja.md) を参照

### AI-DLC プロジェクトへのインストール

安定版のタグを指定してインストールします。ブートストラップスクリプトと
インストール対象のソースは、同じ不変のタグから取得されます。

```sh
VERSION=v0.5.0
curl -fsSL "https://raw.githubusercontent.com/j5ik2o/deep-spec-analysis/${VERSION}/deep-spec-analysis/scripts/install.ts" |
  bun - --project <your-aidlc-project> --tag "${VERSION}"   # --harness codex, kiro, …（既定: claude）
```

インストーラはタグのソースをダウンロードし、`deep-spec-analysis/dist/<harness>/` にハーネス投影をビルドします。そのうえで、ステージ・センサー・ツール・knowledge をプロジェクトのハーネスツリー（`.claude/`, `.codex/`, …）へ compose します。

ストアを持つハーネス（Claude Code、Codex、Copilot、opencode）は `dist/` から直接 compose するため、投影をプロジェクトへコピーしません。ストアを持たないハーネス（Kiro、Kiro IDE、Cursor）は、各ホストの流儀に従い、先に投影をプロジェクトルートへ配置します。`--dry-run` を付ければ、プロジェクトに触れずに compose を検証できます。対象プロジェクトの外は変更しません。プラグインを無効化すれば、素のワークフローに再 compose されます。

更新時は、以前 compose したプラグイン自身のファイルを先に入れ替えます。バージョンを上げても、古いスキーマやツールは残りません。ソルバーの可用性は `/aidlc --doctor` で確認できます。

取得元と更新方法は次のとおりです。

| オプション | 動作 |
|---|---|
| 指定なし | 最新の安定版 SemVer タグを解決してインストールします。 |
| `--tag v0.5.0` | 不変のリリースを 1 つ指定します。本番利用ではこの方法を推奨します。 |
| `--from <repo-root>` | ローカルのチェックアウトからビルドします。プラグインの開発時に使います。 |
| `--ref <branch>` | 移動するブランチ ref をダウンロードします。再現可能な導入ではなく、開発版を追従するときだけ使ってください。 |
| `--update` | 記録済みの取得元を再利用します。latest は最新タグを再解決し、local と ref は同じ取得元を取り直します。固定タグは不変なので `Changed 0` で終了します。取得元オプションとは併用できません。 |

インストールに成功すると、バージョン、取得元、日時、ペイロードのダイジェストが、対象プロジェクトの `<harness>/tools/data/deep-spec-analysis-install.json` に記録されます。`<harness>` は `.claude` や `.codex` など、選択したハーネスツリーです。プラグインの配布に npm パッケージや GitHub Release のアセットは使いません。タグまたはブランチのソースアーカイブを GitHub から直接取得します。

> インストーラはフォルダドロップ方式で、インストール時の信頼ゲートがありません。コードを実行してよいと判断したビルドにだけ向けてください。ストア経由の信頼プロンプトが必要なら、後述のホストプラグインフローを使ってください。

注：ステージは `scopes: [enterprise, feature]` を宣言しているため、これらのスコープで作られた intent でのみ実行されます——`classic` スコープの intent では仕様どおり SKIP になります。

### 運用中プロジェクトへの後入れ

最初からこのプラグインを入れておく必要はありません。compose は追加合成なので、AI-DLC ワークフローが進行中のプロジェクトへ導入しても他には何も影響しません——そして**導入前から存在する intent も検査できます**。ワークフローを進めずに、既存 intent の要件へステージを単独実行するには：

```
/aidlc --stage deep-spec-analysis-verify --single
```

（compose で生成される `/deep-spec-analysis-verify` スキルは同じものの包装です。）エンジンが intent の既存 `requirements.md` を解決し、センサーはその intent のレコード配下に findings を書き、ワークフローの Current Stage には一切触れません。導入後に作られた intent は自動的にステージを拾います。唯一の制約はスコープです：`classic` スコープの intent は single モードでも拒否されます——先に `feature` か `enterprise` へ移してください。

そして、これらを*覚えておく*必要はありません：インストーラは最後にカバレッジスキャンを実行し、検証記録のない適格 intent を（それぞれに必要なコマンド付きで）列挙します。以後も `/aidlc --doctor` が同じカバレッジを報告し続けます——最後の検証後に要件が変更された intent も含めて。この後入れ経路は検出込みで `tests/intent-e2e.test.ts` が回帰検証しています。

### 代替：ホストプラグインストア経由のインストール

まず `deep-spec-analysis/` から投影をビルドします：`bun ../aidlc-workflows/core/tools/aidlc-plugin-build.ts . claude`（または `codex`）。

Claude Code では、対象プロジェクト内で：

```
/plugin marketplace add <workspace>/deep-spec-analysis/dist/claude
/plugin install aidlc-deep-spec-analysis@aidlc-plugins
```

Codex CLI では、対象プロジェクト内で：

```sh
codex plugin marketplace add <workspace>/deep-spec-analysis/dist/codex
codex plugin add aidlc-deep-spec-analysis@aidlc-plugins   # 初回のみフックの信頼承認
```

次のセッション開始時に、プラグインの SessionStart フックが `.claude/` へ compose します（Codex は `.codex/`、フックは最初の対話で遅延発火）。

## 開発

開発する場合は、リポジトリを clone して dev 依存を導入します：

```sh
git clone --recurse-submodules https://github.com/j5ik2o/deep-spec-analysis.git
cd deep-spec-analysis/deep-spec-analysis
bun install        # dev 依存のみ——どのプロジェクトにも何もインストールしません
```

変更の検証は：

```sh
bun test                                                    # バイト一致の conformance スイート
bun ../aidlc-workflows/core/tools/aidlc-plugin-validate.ts .
bun ../aidlc-workflows/core/tools/aidlc-plugin-build.ts . claude   # → dist/claude/
bun ../aidlc-workflows/core/tools/aidlc-plugin-test.ts . --install <aidlc-project> --harness claude
                                # compose のドライラン——対象を変更せずにマージを検証
```

## リポジトリ構成

| パス | 役割 |
|---|---|
| [`deep-spec-analysis/`](deep-spec-analysis/) | プラグインの authored source：ステージ・センサー・ツール・契約・テスト |
| [`aidlc-workflows/`](https://github.com/awslabs/aidlc-workflows) | フレームワーク checkout（submodule）——validate/build/test ツールチェーンの供給元。ここでは編集しない |
| `deep-spec-analysis-sandbox/` | compose テストの対象に使う使い捨て AI-DLC インストール（`aidlc-plugin-test.ts --install`）——gitignored |

## ドキュメント

- 使い方ガイド——新規プロジェクトと運用中プロジェクトへの後入れ：[docs/usage.ja.md](docs/usage.ja.md)
- 図解アーキテクチャ概観：[docs/architecture.ja.md](docs/architecture.ja.md)
- プラグイン設計とステージの詳細：[deep-spec-analysis/README.ja.md](deep-spec-analysis/README.ja.md)
- 設計判断・スパイク結果・ドラフトからの逸脱：[deep-spec-analysis/docs/decisions.ja.md](deep-spec-analysis/docs/decisions.ja.md)

## ヘルプ

- Issues: <https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/issues>

## ライセンス

MIT。[LICENSE](LICENSE) を参照してください。
