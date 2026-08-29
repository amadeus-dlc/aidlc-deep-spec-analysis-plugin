# deep-spec-analysis テスト

[English](README.md) | 日本語

プラグインルートで `bun install && bun test` を実行する。

- `plugin.test.ts` — 隣接する `aidlc-workflows` checkout の
  `aidlc-plugin-validate.ts` によるオフライン内容検証（checkout が別の場所に
  ある場合は `AIDLC_WORKFLOWS_CHECKOUT` を設定）。
- `intent-e2e.test.ts` — 使い捨てのバニラ AI-DLC インストール上で再生する
  決定論的エンドツーエンド経路：`scripts/install.ts`（store ハーネス ⇒
  compose のみ、フォルダドロップなし）→ 実 intent の鋳造 → スコープ
  ルーティング（classic は SKIP、feature は EXECUTE）→ インストール済み
  `.claude/tools` からのセンサー発火——**本物のディスパッチャ
  （`aidlc-sensor.ts fire`）経由を含む**——を intent のレコードに対して行う。
  アップグレード経路（陳腐化した composed スキーマをインストーラが
  リフレッシュ）、フェーズ①の refcheck シナリオ（壊れたレコード → doctor の
  負債 → 修正 → doctor 静穏）、フェーズ②の設計検証（グラフルーティング・
  `--single`・doctor のユニット単位カバレッジ unverified → verified → stale・
  完了記録）、フェーズ③の refinement（ディスパッチャ実射・refinement-stale）、
  そして `sourceDigest` アンカー（モデルの mtime が新しくても要件編集を
  コンテンツハッシュで検出）をカバーする。LLM 会話層（形式化・A/B ゲート・レポート）は範囲外で
  fixture が代替するため、これはフル E2E ではなく統合スイートである。
- `conformance.test.ts` — v1 の契約 conformance スイート：両バックエンドを
  `fixtures/conformance/`（静的ルールと状態機械の欠陥を意図的に埋め込んだ
  正典要件 IR）に対して実行し、`fixtures/conformance/expected/*.json` と
  バイト単位で 2 回一致しなければならない。劣化経路とクロスチェック不一致
  経路もカバーする。
- `refcheck.test.ts` — フェーズ①の conformance：broken/clean レコードに
  対するソルバー不要参照整合センサーのバイト golden、無沈黙の `checked[]`
  ファミリー、劣化、`--report-only`、そして**リポジトリ内の全 golden findings
  ファイルのスキーマ適合**。
- `design-verify.test.ts` — フェーズ②の conformance：設計 IR 検証（正/負
  fixture）、設計バックエンドのバイト golden（コンパイルダウン再利用、
  `unreachable`/`redundancy` kind、ignore セルの無誤報）、契約分離（v1 モデルは
  設計センサーを発火させず、逆も然り；共有スキーマ定義のバイト同一）、
  `deterministic: false` の waiver、劣化。
- `refinement.test.ts` — フェーズ③の conformance：人間がゲートした写像の下での
  refinement 検査のバイト golden（静的かつ到達可能な不変条件違反・許容されて
  しまう reject シナリオ・enabledness の穴・waived な義務・属性閉包違反）、
  および劣化（写像欠如・陳腐化ハッシュ・ユニット項目欠如）——常に明示 skip で、
  決して沈黙しない。

ソルバーは exact-pin の devDependencies（`z3-solver`・
`@informalsystems/quint`）なので期待ファイルは安定する。quint バックエンドは
テストでは `simulation` に固定される（bounded/Apalache はサンドボックスで
実射検証）。z3 子プロセスには `node` ランタイムが必要（無い場合、SMT 系の
アサーションは警告付きでスキップ）。

fixture はここに置く（決して `tools/` 配下に置かない——compose は出荷ツリー内の
テストペイロードを拒否する）。
