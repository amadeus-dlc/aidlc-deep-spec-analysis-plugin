# マージ後に届いた取得処理レビューへの対応

[PR #162](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/pull/162) のマージ後に届いた5件を、現在の契約と実ファイル操作で確認した。

| 指摘 | 判定・対応 |
| --- | --- |
| 未検査・部分検査にもfinding修正を案内する | 妥当。状態ごとに入力復旧・センサー実行・finding修正を案内する |
| doctorのlocaleCompare | 妥当。2箇所をUTF-16コード単位の比較へ変更する |
| 要件探索が通常ファイルをphaseとして扱う | 妥当。aidlc-state.mdの探索でENOTDIRとなり、後続phaseの要件を見つけられなかった。ディレクトリだけを探索する |
| in-memory doubleの保存順 | 現契約では非該当。公開APIからcandidateあり・cross-check読取不能の組合せを構築できない。今回は変更しない |
| 通常ファイルになったunitのrulesを読み取る | 妥当。既知のunit shape不一致はドメインのdirectory欠如診断へ渡す。別のENOTDIRは取得失敗として保持する |

unitが通常ファイルの場合は `no construction/u1-tickets/ directory exists` の診断を確認し、unitがディレクトリでfunctional-designだけ通常ファイルの場合は `io-failed` を返す対のテストを追加した。読取例外を一律に欠如へ丸める変更ではない。

検証: 関連テスト108件成功、526 assertions。Biome、型検査、既存lint、生成バンドル一致検査は成功。生成物のテスト10件も成功。
