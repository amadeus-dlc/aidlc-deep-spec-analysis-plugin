# ユースケースの責務是正

## 結果

[監査時の191検出](getter-findings.json)を、状態の所有者への責務移譲と出力境界の変更で解消した。全15ユースケースを確認し、現在のusecase層60 TypeScriptファイルの検出は0件。減算baseline・除外ファイル・抑制コメントは追加していない。

監査時の81ファイルから減った21ファイルは、旧read-model、生のbackend結果、取得結果等の契約を削除・適切な層へ変更した結果である。監査の原本は [review.md](review.md)、コンテキストごとの根拠は [requirements](requirements.md)、[design](design.md)、[doctor/refcheck](doctor-refcheck.md)に残した。

## 責務の移動

| 対象 | 変更後の所有者とフロー |
| --- | --- |
| 要件/設計IRの検査 | 材料の集約が対応版・schema・意味検査の順序を所有。要件の追加原文が必要な段階を型で運び、usecaseはRepository取得後に査定を依頼する |
| 要件Quint/SMT検証 | モデルが検証準備、backend結果型が状態解釈・レポート形成を所有。modelからhash/versionを取り出して再供給する引数組を削除 |
| 設計refinement | RefinementMaterialsが適用可否・欠落・鮮度を判定。LoweredUnitが追加不変量の採番と索引を整合させる |
| 到達性・検証不能 | 計画と型付き実行結果が候補、対象帰属、finding/skipを決定。生のexit/doc/noteはadapterで解釈する |
| refinement結果 | ソルバ計画が元のUnitRefinementPlanを保持。別の準備を結果へ後付けする引数を削除し、未知の対象/異なるunitの診断は構築契約で拒否 |
| doctor | 観測型・コレクションが検証済み条件、鮮度、負債、最新版を査定。DoctorPresenterが表示ラベル・文言を構成 |
| refcheck/Finalizer | チェック・適合をdomainへ依頼し、保存済みレポート/ディレクトリ集約をoutcomeへ運ぶ。表示用bool/number/stringへの分解はentry/adapterで行う |

Resultの振り分けは共通の `matchResult` / `flatMapResult` を使う。汎用Resultに個別の検証知識は追加していない。成功分岐はドメインへの依頼とI/Oの調整に限定し、同じ業務判断をcallbackへ隠す変更にはしていない。

旧getter・旧port結果型・旧read-modelの互換aliasは残していない。時刻の取得やI/O起動予算の制御はapplicationに残し、未実施の対象と診断の意味はdomainが所有する。domainへのRepository/Client/Clock依存は追加していない。

## 再監査で修正した境界

3担当が互いのコンテキストを再監査し、以下も修正した。

- **保存の所属・状態契約**: 保存先と候補IDのディレクトリ不一致、未最終化集約の保存をpanicとする。I/O開始前に確認し、`io-failed`へ偽装しない。
- **診断の表現予算**: 1診断65,536文字・診断数65,536件の既存上限を緩めない。ErrorMessage.parseの失敗と合成時の総数超過はErrorMessages.collectが明示診断へ変換する。通常の診断順序を保持し、総数超過では末尾に省略マーカーを置く。無言の切捨てや正常の合否にはしない。
- **外部応答**: 空/過大なソルバ不能理由、stage scopeの不正値・サイズ超過をparseで処理し、ofのpanic経路に流さない。
- **観測時刻**: モデル時刻0・負値とモデル不在を別状態として保持する。
- **値域の重複**: 導入元sourceの閉集合検証をInstallationSourceへ一本化し、source/versionがともに不正なときの診断順序を維持する。
- **新しい計画の上限**: コピー前の件数/多段総数チェックとparseを追加。生成元の計画と対象・診断の帰属も確認する。

新たな診断予算マーカーは次の2種類である。これまでpanicになっていた上限外の経路にだけ現れる。

- `validation diagnostic could not be represented within its text budget`
- `validation diagnostic limit reached (65536 messages); additional diagnostics omitted`

## リンターと規律

型消去、別名、分割代入、unionキー、generator、fallback、可変ローカル等の回避に回帰テストを置いた。ドメイン結果の引数保持・不変な再代入は正当な操作として区別し、helperにprivate fieldを渡して取り出す経路は由来を伝播して検出する。検出/正常例とCLI終了コードを確認する専用テストは27件。

P8（表示投影の配置）、A3（合否の所有者）、P4/A5（保存結果とpanic）を現在の責務に合わせた。共通原則はClaude/Codex双方の `knowledge/aidlc-shared/usecase-orchestration.md` に同じ内容で記録した。org.mdや起動時のAGENTS.mdへは移していない。CQS採用・CQRS非採用を維持する。

## 検証

- `bun run check`: Biome596ファイル指摘なし、getter検査60ファイル・0件。
- `bun run typecheck`: 成功。
- `bun test --coverage`: **948成功・1スキップ・0失敗、949テスト、44ファイル、終了コード0**。
- アーキテクチャテスト47件: 成功。
- `bun scripts/coverage.ts --base origin/main`: 絶対・相対ゲートとも成功。line coverageは変更後99.90%、基線99.89%。
- 配布用14生成ファイルの同期、plugin validation、7ハーネスのビルド: 成功。validationは既存のcompose-hook-absent警告1件のみ。
- 正常系golden、公開契約スキーマ、aidlc-workflows submoduleは変更していない。

カバレッジのしきい値・対象除外は変更していない。修正前のgetter一覧は再発許容量として使わず、監査基線の証拠として保存する。
