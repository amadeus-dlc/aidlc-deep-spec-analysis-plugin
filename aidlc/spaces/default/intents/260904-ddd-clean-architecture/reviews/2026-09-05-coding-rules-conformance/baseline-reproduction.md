# 修正前の不具合の再現手順

`reproduce.ts`と`results.jsonl`は、コミット`26324f9def27e396cdcb08d11136dcf7691bf73c`の不具合を記録した基線資料である。現在の実装に対する回帰テストではない。スクリプトの相対importが対象コミットのソースを読むよう、次の手順で独立したチェックアウトへ配置して実行する。

リポジトリのルートで実行する。

```sh
baseline_dir=$(mktemp -d /tmp/deep-spec-baseline.XXXXXX)
git worktree add --detach "$baseline_dir" 26324f9def27e396cdcb08d11136dcf7691bf73c
review_dir=aidlc/spaces/default/intents/260904-ddd-clean-architecture/reviews/2026-09-05-coding-rules-conformance
mkdir -p "$baseline_dir/$review_dir"
cp "$review_dir/reproduce.ts" "$baseline_dir/$review_dir/reproduce.ts"
(
  cd "$baseline_dir" || exit 1
  mise trust
  test "$(git rev-parse HEAD)" = 26324f9def27e396cdcb08d11136dcf7691bf73c || exit 1
  cd deep-spec-analysis || exit 1
  bun install --frozen-lockfile || exit 1
  cd .. || exit 1
  bun "$review_dir/reproduce.ts"
)
```

`node_modules`を現在の作業ツリーからリンクせず、基線側でインストールする。これにより、相対importとworkspaceパッケージの解決先を同じ基線チェックアウトに揃える。既存の`results.jsonl`は履歴として残し、実行結果を上書きしない。

修正後の期待動作は`deep-spec-analysis/tests/`の回帰テストで検証する。特に束縛型は後続のリファクタリングで置換したため、現在の作業ツリーで`reproduce.ts`を直接実行してはならない。
