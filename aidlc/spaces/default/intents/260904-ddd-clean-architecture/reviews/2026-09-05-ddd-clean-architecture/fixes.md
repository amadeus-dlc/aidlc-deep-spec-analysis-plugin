# 監査6件の修正記録

2026-09-05、ユーザーの「6件を修正する」という選択を受けて実装した。
監査時点の問題と実測値は [review.md](review.md) と [results.jsonl](results.jsonl) に保持している。

| 監査項目 | 修正 | 回帰検証 |
|---|---|---|
| 1. timeoutを非到達へ変換 | `SiblingVerdictDocument.reachabilityOf` が3変種の `ReachabilityVerdict` を返す。adapterとportは同じ値を運び、usecaseは全変種を処理する | timeout／compile-error／capability／unavailable、証跡不足、simulationを非到達にしない。実adapterを経由したusecaseでも誤ったfindingが出ない |
| 2. refinementのskip消失 | `RefinementQuintInvariants.interpret` が追加要件のfindingとskipを一緒に写す | 要件OB-1のtimeoutとcompile-errorを保存し、設計本体のskipは重複させない |
| 3. 不正な兄弟文書の正常化 | 共通の `decodeFindingsDocument` で欠損と型不一致を検出する。両Repositoryは `corrupt` を返す | 配列・null・壊れた必須項目・壊れた要素・backendとファイル名の不一致を拒否。正常文書は取得できる |
| 4. 式の可変参照 | `Expression` を再帰的にreadonlyとし、各所有者が `ExpressionTree` 経由で深いコピーを凍結する | 入力・公開面・visitorからの変更を防止し、実モデルの内容・ハッシュ・原文の対応を維持する |
| 5. port外への例外漏出 | `RefinementMaterialsRepository` の取得を `Result` 化する。不在・入力不正・I/O失敗を区別する | 両usecaseは取得失敗時も完了済みの設計検査を保存する。EISDIRはio-failed、不正JSON・構造はcorrupt、不在はinactive |
| 6. Finalizerの呼び順への依存 | 両ディレクトリ集約の `finalizedWith` が候補の適合とcross-check導出を一操作で行う。個別操作でも候補変更時に旧cross-checkを無効化する | 逆順の操作でも古い比較結果が残らない。新しい操作では降格した候補を比較へ参加させない |

回帰テストは `deep-spec-analysis/tests/verification-boundaries.test.ts`。
式の参照同一性を要求していた既存テストは、値の一致と参照の分離を要求するように更新した。
列挙値の検査はノード参照で索引を作るため、2回の走査に同じ不変の木を使用する。

設計規則と判断記録は `deep-spec-analysis/docs/architecture/design-rules.{md,ja.md}` と
`deep-spec-analysis/docs/decisions.{md,ja.md}` に反映した。

**検証結果**

- `bunx tsc --noEmit`: 成功。
- `bun scripts/build-tools.ts` と `--check`: 配布用14ファイルを再生成し、同期確認に成功。
- `bun test --coverage`: 611成功、1スキップ、0失敗。34ファイル、612テスト、3409 assertions。
- カバレッジ表示: 関数99.81%、行99.94%。計測対象は `bunfig.toml` に定義された範囲。
- CIのlcov合算方式による行カバレッジ: 変更後99.86%、変更前HEADも99.86%。絶対90%と相対非低下の両ゲートに成功。Bunの表示値とは集計方法が異なる。
- 既存のgolden出力・契約スキーマに変更なし。正常系のバイト一致検証も成功。
- プラグイン検証: VALID、エラー0。既存のcompose hook未同梱の警告1件は、ビルド時にhookが注入されるため対応不要。
- claude／codex／copilot／cursor／kiro／kiro-ide／opencodeの7ハーネス向けビルド: 成功。

1件のスキップは、別途スナップショットを渡して実行するparity harnessのテスト。
異常系の修正に伴う結果の変更は上表の6項目に限る。監査時点の `reproduce.mjs` は
問題のある挙動をassertする基線資料なので、修正後の成否確認には回帰テストを使う。

相対ゲートは既存の `scripts/coverage.ts` の `runGate` を `baseRef: "origin/main"` で実行した。
一時worktreeには `mise trust` を実行し、比較後に削除した。

**null／undefinedの使い分けについての追補**

ユーザーの追加指示を受け、到達性の `boolean | null` を `ReachabilityVerdict` に置き換えた。
到達・検査範囲内で非到達・未検証を名前つきファクトリで生成し、`match` で全変種を処理する。
portも同じ値を返すため、旧 `ReachabilityProbe` と途中の真偽値への変換を削除した。

兄弟文書の変種と材料はクラス内部の判別共用体で束ね、readable／unavailableの
`method` は必須のstringにした。remapの成功結果もstringを保証する。
設計規則D10には、任意項目のundefined、明示的な不在のnull、戻り値なしのvoid、
失敗のResult、業務判定の値オブジェクトを区別することを明記した。

追加の5テストで、三つの判定がusecaseまで区別されること、値としての同一性、
methodの型契約を確認した。上の検証結果はこの追補を含む。
