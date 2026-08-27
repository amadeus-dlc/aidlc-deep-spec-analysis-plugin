提案は半分正解です。「プラグイン用の空リポジトリ新規作成」は正解、ただし「そこにAI-DLC v2をインストール」はしない方がいい。 インストール先は別のサンドボックスプロジェクトに分けるのが、ツールチェーンの設計意図に沿った形です。役割を3つに分けます。

推奨構成：3つの場所

① aidlc-workflows/          # 既存のこのcheckout — ツール供給元。ここでは開発しない
② deep-spec/                # 新規空リポジトリ — プラグインのauthoredソースのみ
③ deep-spec-sandbox/        # 新規使い捨てリポジトリ — AI-DLCをインストールし、composeと実走テストの場

②にAI-DLCをインストールしない理由は3つあります。

- 検証・ビルドのツールチェーン（aidlc-plugin-validate / build）は「AIDLCプロジェクトもフレームワークcheckoutも無しでオフライン動作する」設計で、プラグインリポジトリ側にインストールは不要です
- compose検証ツールは aidlc-plugin-test.ts <plugin-root> --install <project-root> と、インストール済みプロジェクトを外部から指す設計になっています。つまり「authoredソースの場所」と「インストールの場所」は分離が前提です
- 同居させると、エンジンをアップグレードするたびに .claude/ の差分がプラグインリポジトリの履歴を汚し、authored treeとインストール産物の境界が曖昧になります（配布タグ deep-spec--v<version> を切るリポジトリは、プラグインの内容物だけの履歴であるべき）

セットアップ手順（具体コマンド）

# ② プラグインリポジトリをスキャフォールド（決定論的な最小構成が生成される）
bun ~/Sources/j5ik2o.github.com/awslabs/aidlc-workflows/core/tools/aidlc-plugin-create.ts \
  deep-spec ~/Sources/deep-spec
cd ~/Sources/deep-spec && git init && git add -A && git commit -m "chore: scaffold deep-spec plugin"

# 検証とビルド（どちらもオフライン、AI-DLCインストール不要）
bun <checkout>/core/tools/aidlc-plugin-validate.ts ~/Sources/deep-spec
bun <checkout>/core/tools/aidlc-plugin-build.ts ~/Sources/deep-spec claude
#   → ~/Sources/deep-spec/dist/claude/ にホストプラグイン投影が出る

# ③ サンドボックス（AI-DLC v2のインストール先はここ）
mkdir ~/Sources/deep-spec-sandbox && cd ~/Sources/deep-spec-sandbox && git init
cp -r <checkout>/dist/claude/.claude .        # AI-DLC v2をインストール

# compose自動テスト（使い捨て候補にコピーして2回composeし、drop無し・バイト安定を要求）
bun <checkout>/core/tools/aidlc-plugin-test.ts ~/Sources/deep-spec \
  --install ~/Sources/deep-spec-sandbox --harness claude

実走（LLM込みのE2E）は③でClaude Codeを起動し、/plugin marketplace add ~/Sources/deep-spec/dist/claude → /plugin install aidlc-deep-spec@aidlc-plugins で組み込むと、次セッションのSessionStartフックがcomposeします。以後 /aidlc --doctor と /aidlc plugin list で状態確認、実際にステージを走らせて挙動を見ます。

開発ループ

②でソース編集 → validate → build → ③に対してplugin-test（機械検証）
→ 必要なとき③でセッション再起動して実走（LLM挙動の確認）

補足が2点：

- 手動スパイク（IR→SMT/Quint両建て検証）は②の中の spike/ ディレクトリでやってOKです。投影はディレクトリ規約（stages/ sensors/ tools/ …）で発見されるので、規約外のディレクトリは出荷物に混ざりません。ただし tools/ 配下にfixtureやテスト用ペイロードを置くのだけは禁止（composeが検出して警告します）。
- ②のテストからフレームワークのテストヘルパー（tests/harness/plugin-kit.ts）を使いたくなったら、checkout①を兄弟ディレクトリとして相対参照するのが現実的です。外部リポジトリには同梱されないため。

代替案：このcheckout内で first-party として開発する

plugins/test-pro/ と同じく plugins/deep-spec/ を①内に作る手もあります。bun scripts/package.ts が全7ハーネス投影を自動生成し、plugin-kitやintegration tierのテスト基盤をフルに使える利点があります。ただしこれはdeep-specをawslabs/aidlc-workflows本体に取り込む（upstreamする）意図がある場合の選択です。独立した実験・独立バージョニングなら外部リポジトリ（推奨構成）が正解で、機構上どちらでも成果は同一です（first-party/third-partyは機構的に等価）。

