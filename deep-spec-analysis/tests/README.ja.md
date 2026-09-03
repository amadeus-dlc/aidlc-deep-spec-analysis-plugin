# deep-spec-analysis テスト

[English](README.md) | 日本語

プラグインルートで `bun install && bun test` を実行する。

センサーを spawn するスイートは出荷物——`src/entries/` から
`bun scripts/build-tools.ts` が生成した `tools/` 配下のバンドル——を
駆動する。`src/` のソースを直接実行することはない。バンドルのファイル名は
`.ts` のまま（AI-DLC のセンサーディスパッチャは manifest の `command` から
`.ts` で終わるトークンを探して起動スクリプトを決める）だが、中身は bundle
済みの JavaScript である。`src/` を触ったら `tools/` を再生成すること。
さもないと spawn 系スイートは前回のビルドを検査してしまう。

- `plugin.test.ts` — 隣接する `aidlc-workflows` checkout の
  `aidlc-plugin-validate.ts` によるオフライン内容検証（checkout が別の場所に
  ある場合は `AIDLC_WORKFLOWS_CHECKOUT` を設定）。
- `intent-e2e.test.ts` — 使い捨てのバニラ AI-DLC インストール上で再生する
  決定論的エンドツーエンド経路：`scripts/install.ts`（store ハーネス ⇒
  compose のみ、フォルダドロップなし）→ 実 intent の鋳造 → スコープ
  ルーティング（classic は SKIP、feature は EXECUTE）→ インストール済み
  `.claude/tools` のバンドルからのセンサー発火——**本物のディスパッチャ
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
- `build-tools.test.ts` — 生成器の drift guard（コミット済み `tools/` が
  `src/` と一致すること、`--check` が変更・欠落・余剰のバンドルを名指しする
  こと）、決定論（2 回生成してバイト同一）、出荷形（`.ts` バンドル 10 本＋
  `data/` のスキーマ 4 本ちょうど、素の `.js` は 1 本も無し、各バンドルは
  サイズ上限内）。

ソルバーは exact-pin の devDependencies（`z3-solver`・
`@informalsystems/quint`）なので期待ファイルは安定する。quint バックエンドは
テストでは `simulation` に固定される（bounded/Apalache はサンドボックスで
実射検証）。z3 子プロセスには `node` ランタイムが必要（無い場合、SMT 系の
アサーションは警告付きでスキップ）。

fixture はここに置く（`src/` にも `tools/` にも置かない——`no-test-payloads`
のアーキテクチャ規則がソースツリーで拒否し、compose が出荷ツリーで拒否する）。

## 移行後の内部スイート（DDD/Clean Architecture）

- `architecture.test.ts` + `architecture/rules.ts` — 層 DAG（infrastructure→
  domain→usecase→adapter、公認横断 4 エッジのみ）・entry 限定の
  process.*/import.meta・facade の export * 禁止・domain の private
  constructor 規律・get アクセサ/TS enum/非 null 表明の禁止。各ルールは
  実樹適用の前にインライン fixture で検出力を証明する（red example 必須）。
  旧 LEGACY_FILES 免除は PR10 で空化——`src/` でフラットなのは
  `src/entries/` の合成ルート 10 ファイルのみ。
- `parity/` — 移行の基底（pre-PR7）に対する全パイプライン出力のバイト
  パリティスナップショット（`diff -r` が空でなければ落ちる）。
- `kernel-domain.test.ts`・`aggregate-ids.test.ts`・`ir-validation.test.ts`・
  `kind-rank.test.ts` — kernel/各コンテキストのドメインプリミティブと
  ファーストクラスコレクション、Decl 束、finding kind の凍結順の単体固定。
- `verify-smt-pipeline.test.ts`・`verify-quint-pipeline.test.ts`・
  `design-pipeline.test.ts`・`refinement-pipeline.test.ts`・
  `refcheck-{domain,pipeline,report}.test.ts` — 層化後の各縦串
  （domain/usecase/adapter チェーン）を InMemory ダブルと実 Impl の両方で
  駆動する結合スイート。golden 等価（実ソルバー込み）を含む。
