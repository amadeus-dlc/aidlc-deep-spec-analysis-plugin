# mainとの未反映差分の照合

ユーザーの選択1に基づき、未マージの文書言語規則と記録差分を整理してから最新mainの別worktreeへ移る。現在の元作業ツリーはdocs/one-language-per-docのac4309c、比較したmainは33be9c6。

## コード変更

文書の英日分離と言語lintを追加した2コミットは、[PR #152](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/pull/152)が未マージだった。最新mainを取り込み、CI・設計判断・監査ログの競合を双方の意図を保って解消する。コレクション契約など、既にマージしたコメント・ドメイン・コレクションの是正を古い状態へ戻さない。

## レビュー記録

ローカルの未追跡39ファイルは、すべて同じパスがmainに存在する。34ファイルは内容も同一。差分5ファイルは以下の理由でmain版を選ぶ。

| 記録 | 判断 |
| --- | --- |
| code-comments/measure-comments.ts | mainの出力先指定を保持し、計測基線の上書きを防ぐ |
| code-comments/reproduce.ts | mainの出力先指定と削除済みファイルへの対応を保持する |
| code-comments/report.md | mainの是正記録・再現手順・基線固定リンクを保持する |
| domain-cohesion/report.md | 本文は同一であり、mainの基線固定リンクを保持する |
| collection-contracts/proposal.md | head/tailと非空型の空判定撤回を反映したmainの承認済み方針を保持する |

ローカルの旧稿をmainへ上書きする必要はない。各内容のハッシュと判断を[evidence.json](evidence.json)に記録した。元の作業ツリーと控えは保全する。

## 監査ログ

照合時点のローカル監査ログはmain版の全内容を含み、末尾に追加の記録を持っている。PR側の監査内容もprefixとして含むことを確認した。実際の追記をそのまま取り込み、行の再作成や並び替えを行わない。追加行数はevidence.jsonの値を参照する。
