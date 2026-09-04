# deep-spec-analysis — コード品質評価

## Focused scan 更新: DDD／クリーンアーキテクチャ評価

focused baseline は `bun test tests/architecture.test.ts tests/design-pipeline.test.ts tests/refinement-pipeline.test.ts` が **84 pass / 0 fail**、`bunx tsc --noEmit` が exit 0。現状のアーキテクチャ規則に対する違反はないが、規則そのものが許している境界と、失敗時の整合性に改善余地がある。

| 優先度 | 問題 | 構造的な改善 | 追加すべき検証 |
|---|---|---|---|
| Blocker | backend report 保存後の sibling 読込／cross-check 保存失敗を成功扱いする | report finalization を一箇所へ集約し、失敗を non-verified outcome として返す。cross-check は source fingerprint 付き派生 projection とする | backend 成功後の読込失敗、cross-check 書込失敗、古い cross-check を返さないこと |
| Blocker | 同じ report を `conformedOf` と `store` で別々に schema 適合し、schema を二度観測する | Repository instance が immutable schema snapshot を保持する。port/CQS は維持する | 途中で schema source が変化／読込失敗しても verdict bytes と保存 bytes が一致すること |
| High | 正常生成が任意文字列の `reconstitute` を通る | strict creation と tolerant hydration を分離し、閉集合 DP を正常生成に要求する | 未知値の adapter 降格は維持し、domain の正常生成では不正値を拒否すること |
| High | SMT／Quint usecase の共通 lifecycle が重複する | まず具体的 report finalizer、次に実際に同型な acquisition／sibling run を抽出する | 両 backend の golden と失敗分岐が同じ共通契約を通ること |
| High | Refinement package の境界が Design 語彙に従属する | Design subdomain 統合または独立 assessment + ACL のどちらかに揃える | 公認横断エッジと package manifest の red/green example を裁定後に更新すること |
| Medium | `LoweredUnit` が三役を持つ | Tell-Don't-Ask を保ち、既存 domain object に lowering/remap の所有を分配する | byte-frozen 文言・順序、dedupe、synthetic probe、waiver の回帰 |
| Medium | `kernel/infrastructure` が一般用語と逆 | 今回は改名せず最内層の説明を補強する | `kernel/infrastructure` が上位層を import しない既存規則を維持 |

コード・ジュードの中心は「巨大な generic pipeline を作る」ことではなく、report finalization という一つの整合性単位を切り出すことにある。これにより失敗黙殺、schema 二重観測、backend 間の修正漏れを同時に減らせる。次に strict DP を入れると正常系の文字列分岐も減る。

production code の最大は395行で1,000行超えはない。`LoweredUnit` 384行と Quint usecase 341行は分解候補だが、行数だけで別ファイルへ移すと複雑性を移動するだけになる。テストでは `tests/refinement-pipeline.test.ts` が1,021行、`tests/ir-validation.test.ts` が1,198行であり、今後の追加時は契約／fixture 単位へ分割する。

セキュリティ／コンプライアンス上は外部 JSON／Markdown を未信頼入力として adapter で検証し続け、path derivation を広げない。atomic write／lock の失敗は `Result` へ閉じ、監査対象の verdict と保存証跡が一致しない状態を成功にしない。solver pin、golden、正準順、公開 JSON shape は変更しない。

以下の installer／release と全体品質の本文は既存 store の履歴知識である。

## Focused scan 更新: installer／release の品質評価

今回の Developer Scan はコード読解のみで、テストや typecheck を実行していない。したがって以下は構造・既存テスト契約・未実装面の評価であり、前回 store の pass 数や coverage 数値を現行基線として再主張しない。

### 維持すべき回帰ゲート

- `tests/intent-e2e.test.ts` が既に検証する初回 compose、stale schema refresh、file/directory tombstone、再実行時の payload byte 不変。
- `tests/plugin.test.ts` と framework の `aidlc-plugin-test` が示す `Plugin test: CLEAN`、Changed files 0、Drops 0、second compose idempotent。
- generated `tools/` は bundle 10本＋`data/` 4本の14-file 形を維持する。
- byte-frozen golden、architecture rules、doctor の公開 JSON shape を壊さない。

### 追加が必要な検証

| 対象 | 最小の受け入れ証拠 |
|---|---|
| local source | `--from` fixture が source checkout 側 submodule なしで導入できる |
| tag/latest source | archive を一時 `deep-spec-analysis/` へ安全に展開し、manifest/version と選択 ref が一致する |
| update | same-version で provenance を書き直さず Changed 0、更新版で既存 refresh/tombstone/compose を通る |
| failure atomicity | fetch／validation／build failure では target bytes と provenance が不変。compose failure の扱いを明示する |
| provenance | atomic write、schema validation、canonical payload digest、plugin payload/tombstone からの除外 |
| doctor | current／outdated／offline の advisory を既存 JSON contract 内で安定描画する |
| release/CI | clean-tree、version commit、`v<version>` tag、tag push trigger、manifest/tag equality |
| docs | bootstrap、selector、update、offline／失敗時の案内が実装契約と一致する |

### Intent 固有のリスク

1. `scripts/install.ts` に resolver と provenance を直接足すと、346行の transaction がさらに密結合になり、target mutation の開始点が曖昧になる。
2. `payload_sha256` の対象と正準順が未定義のままだと、archive 再取得や harness 差で false update を起こす。
3. mutable branch と fixed tag を同じ update 規則で扱うと、記録した source と取得物の意味がずれる。
4. tags API の prerelease／pagination／rate limit／timeout が未契約で、「latest」が不安定になる。
5. 外部 `tar`／`unzip` 依存は「bun のみ」という利用前提を崩す。path traversal を含む展開安全性も必要。
6. doctor に `skip` field を追加すると host contract が変わる。互換表現を先に決める必要がある。
7. release script が manifest 更新を commit せず tag を打つと、tag/version の不一致を自ら作る。
8. remote source 導入後も builder／target data／plugin test のいずれかが source checkout 側を向けば submodule 依存が残る。
9. bootstrap の raw URL を mutable `main` に向けるか fixed tag に向けるかで supply-chain trust が変わる。

以下の全体品質評価と数値は前回 store の `UNVERIFIED` な基線であり、今回の focused scan では再実行・再集計していない。

出典: developer link の実測（`bun test --coverage`、`bunx tsc --noEmit`、import 走査、scratchpad での 2 本のスパイク。HEAD `94d64a3`、2026-09-03）。本ファイルが技術的負債 14 項目と本 intent のリスク 9 項目の所有者で、他の成果物はここを参照する。

## テスト

- **実行**: `bun test --coverage` — **480 テスト（479 pass / 1 skip / 0 fail）、3,149 expect、26.8 秒、exit 0**。`bunx tsc --noEmit` は 0.14 秒で exit 0
- **カバレッジ**: All files 99.84%（行）/ 99.96%（関数）。床 0.9（`bunfig.toml coverageThreshold`）は非除外パス——各コンテキストの `domain/**` と `kernel/{infrastructure,domain,usecase}`——に per-file で効き、adapter／usecase／entry／scripts／tests は除外（除外理由: CLI は子プロセス実行で in-process 計測に乗らず、golden／e2e スイートが実効カバレッジを担う）。CI は床割れを失敗にする
- **構成**（`tests/`）: `.test.ts` 23 本、`architecture/rules.ts`、`doubles/`（in-memory Repository 2 本）、`fixtures/`（conformance／design／refcheck broken・clean／refinement／intent-e2e／invalid）、`parity/`（`snapshot.ts` ＋ `parity.test.ts`）
- **決定論の凍結面**: 4 種の findings golden は **byte 凍結**（`tests/conformance.test.ts` は両バックエンドを 2 回走らせて byte 比較し、縮退と偽造 cross-check も検査）、`tests/parity/` は entry の spawn 出力を丸ごとスナップショット。bundle 化しても verdict 行・findings JSON の文言と発生順を変えない限り緑
- **アーキテクチャゲート**: `tests/architecture.test.ts` が `../tools` を歩き（`walkToolsFiles`。**symlink を見つけたら fail**、`node_modules` を除外していない）、`rules.ts` の 18 規則を全ファイルに red／green example つきで適用する。加えて entry 集合が 10 でフラットファイルはそれだけ、published-language 表 11 項目の実在、domain の公開 interface が `kernel/domain/expression.ts:Expression` だけであることを assert（305-345 行）
- **テストが `tools/` に到達する経路（src/ 移動で変わる箇所）**:
  1. in-process import: 17 テストファイル＋`tests/doubles/` 2 本が `../tools/<ctx>/<layer>/index.ts`（doubles は `../../tools/...`）。facade 以外への直接 import は 0 件
  2. entry の spawn（パス文字列、いずれも `join(pluginRoot, "tools", ...)`）: `conformance.test.ts:42`、`design-verify.test.ts:49`、`refcheck.test.ts:41`、`refinement.test.ts:38`、`ir-validation.test.ts:83`、`parity/snapshot.ts:232`（tool 名 12 箇所は `.ts`）、`verify-smt-pipeline.test.ts:84`（`sensorPath`）、`design-pipeline.test.ts:122`（`toolsDirectory`）、`refinement-pipeline.test.ts:117,123`（`toolsDirectory`・`childHostPath` に `.ts`）
  3. `tools/data/*.json` の読取: `design-verify.test.ts:170-171`、`design-pipeline.test.ts:99`、`ir-validation.test.ts:58-59`、`refcheck-pipeline.test.ts:73`、`refcheck-report.test.ts:45`、`refcheck.test.ts:206`、`refinement-pipeline.test.ts:103-104`、`verify-quint-pipeline.test.ts:54`、`verify-smt-pipeline.test.ts:82`
  4. `intent-e2e.test.ts`: `aidlc-workflows/dist/claude` を一時 sandbox にコピー → `node_modules` を symlink → `scripts/install.ts --project <sandbox>` でビルド＋compose → **compose 後の `.claude/tools/*.ts` を実射**（verify-smt・ir-valid・refcheck-domain・doctor、および実ディスパッチャ `aidlc-sensor.ts fire`）。compose 検査リスト（478-503 行）は entry 3 本＋**17 個の `index.ts` canary** の存在を assert、tombstone 検査（687-700 行）は `.claude/tools/deep-spec-lib.ts` を植えて `--skip-build` 再導入で消えることを assert
  5. `tests/doctor-domain.test.ts:24-27`: `InstallationManifest.standard()` に `tools/deep-spec-analysis-doctor.ts`・`tools/doctor/{domain,usecase,adapter}/index.ts` が含まれることを assert
  6. `tests/plugin.test.ts`: `aidlc-workflows/core/tools/aidlc-plugin-validate.ts` を実行し `Plugin validation: VALID` を assert
  7. `tests/architecture.test.ts` 305-345 行（上記）

## 静的規律（lint の代替）と CI

- **linter は無い**（ESLint／Biome／Prettier の設定ファイルはリポジトリ・ワークスペースルートともに無し）。代替は (a) `tsc --strict` ＋ `noUnusedLocals/Parameters`、(b) `tests/architecture/rules.ts` の 18 規則: `no-test-payloads`・`only-sanctioned-imports`・`no-entry-imports`・`no-io-in-pure-layers`・`process-only-in-entries`・`no-export-star`・`layer-direction`・`private-constructor-in-domain`・`no-get-accessors`・`no-enums`・`no-non-null-assertions`・`one-public-type-per-file`・`ports-live-in-port-dir`・`commands-return-void`・`no-data-models-in-domain`・`no-primitive-fields-in-domain`・`domain-fields-are-private`・`published-language-layers`。`tools/` 内の `TODO/FIXME/HACK` は 0 件、抑止コメントは `z3-engine-child.ts:301` の `biome-ignore` 1 件（linter 不在なので効力なし）
- **CI**（`.github/workflows/ci.yml`）: submodule 取得 → node 24 → bun 1.3.13 → `bun install --frozen-lockfile` → `bunx tsc --noEmit` → `bun test --coverage` → `aidlc-plugin-validate.ts .` → 7 ハーネス分の `aidlc-plugin-build.ts`。配布は projection ビルド＋PR マージ（運用ステージは対象外）

## ドキュメント

- `README.md`／`README.ja.md`: 構成表に `tools/aidlc-sensor-*.ts`・`tools/<ctx>/{domain,usecase,adapter}/`・`tools/data/*.json`・doctor を明記。91 行目に「`tools/` は 5 コンテキスト × 4 層…唯一のフラットファイルは entry」、93 行目 `## Future split (NFR4)` は SMT／Quint の 3 プラグイン分割案（本 intent とは別物）
- `docs/decisions.md`／`decisions.ja.md`: 約 1,800 行の設計判断記録（スパイク A1〜A4、DDD 移行 PR0〜PR10、#71 の裁定群、#128）。`tools/` 言及 12 箇所は歴史記述なので本 intent で更新不要
- `docs/handoffs/71-tda-program.ja.md`、`tests/README.md`／`README.ja.md`、`knowledge/` 3 本（`deep-spec-ir-authoring.md:26` が `{{HARNESS_DIR}}/tools/data/deep-spec-ir-schema.json` を参照——`data/` は残るので不変）
- チームナレッジ `aidlc/spaces/default/knowledge/aidlc-shared/`（domain-modeling／formal-verification-ops／aidlc-engine-operations）
- コードコメントは日英混在で密度が高く、各 adapter の冒頭に「なぜ entry が注入するか」の説明がある

## 技術的負債（14 項目）

intent（src/ 分離＋bundle 化）に効くものを優先。特記のない項目は実測。

1. **`.ts` 固定のパス文字列が出荷経路の 5 箇所に散在**: (a) `sensors/*.md` の `command:` 9 本、(b) `tools/design/adapter/sibling-backend-client-impl.ts:50` の `aidlc-sensor-deep-spec-verify-${backend}.ts`、(c) `tools/aidlc-sensor-deep-spec-design-verify-smt.ts:52` の `childHostPath: join(toolsDir, "aidlc-sensor-deep-spec-verify-smt.ts")`、(d) `tools/doctor/adapter/doctor-workspace-client-impl.ts:138,140,158` の refcheck tool 名、(e) `tools/doctor/domain/installation-manifest.ts` の 44 行の台帳（entry `.ts` 10 本＋`index.ts` canary 17 本＋sensors／knowledge／data）。加えて `stages/construction/deep-spec-analysis-functional-verify.md:84-86` の手打ちコマンド例、`scripts/install.ts:290`、`scripts/smt-stress.ts:348`、README 2 本の表、テスト側（前節の経路 2・4・5）
2. **`import.meta.url` 相対の `data/` 探索が entry 9 本に埋め込み**。bundle が `tools/` 直下に置かれ `data/` が隣に残る限り成立する——スパイク実測: `bun build --target=bun --external z3-solver` した `aidlc-sensor-deep-spec-verify-smt.js` を `data/` の隣に置き conformance fixture に実射したところ verdict `{"pass":false,"findings_count":4,"skipped_count":2,"method":"exhaustive"}`、生成 `smt.json` は `tests/fixtures/conformance/expected/smt.json` と **byte 同一**（`cmp` 一致）。`-ir-valid.js` も `{"pass":true,"findings_count":0,"errors":[]}`、doctor bundle も JSON を返した
3. **bundle 化の実測プロファイル**（bun 1.3.13、`--target=bun`、splitting 無し、minify 無し）: 158 モジュールを 6 ms で bundle、verify-smt 158.5 KB / 4,957 行、ir-valid 156.8 KB / 4,919 行、doctor 49.6 KB / 1,702 行。先頭 2 行は `// @bun` と `var __require = import.meta.require;`（以降 `__require(` の使用 0 件）、`node:` 接頭辞は bare に書き換わる、`import.meta.url` は 2 箇所そのまま残る、`await import("z3-solver")` は external として残る、SMT entry 末尾の top-level `await solveSmtChild()` も残る。**node 24.19.0 が同 bundle の `--smt-child` 分岐を直接実行できる**（2 クエリ → `{"results":[{"id":"q1","status":"sat","model":{"x":"4"}},{"id":"q2","status":"unsat","core":[]}]}`、exit 0）。bun in-process で空クエリが落ちなかった観察は、z3 の pthread abort が実クエリ時に起きる既存知見を覆す根拠にはならない（推測。node 優先は維持）
4. **facade を経由しない層またぎ import が 23 件**（内訳は `dependencies.md`）。引かれる名前はすべて facade が再輸出済みで、付け替えは機械的
5. **パッケージ境界は bare specifier しか縛らない**: 相対パスで隣のパッケージへ逃げる import は isolated linker でも実行時に通る（`dependencies.md` のスパイク表）。「パッケージディレクトリを出る相対 import」を規則で禁じない限り依存方向の強制は完成しない
6. **isolated linker では entry と tests が「どこかのパッケージの中」に無いと `@deep-spec/*` を解決できない**。`tests/` は現状 `../tools/...` の相対 import なので、src/ 化後は「ルートに `@deep-spec/*` の依存を宣言する」か「相対 import のまま（＝境界検査の外）」かの選択になる
7. **isolated linker は各 workspace パッケージ直下に `node_modules/@deep-spec/<dep>` の symlink を作る**。`walkToolsFiles` の symlink 拒否と `node_modules` 非除外がそのまま fail 要因になる。`.gitignore` の `node_modules/` は入れ子も無視する。tsconfig の `include` glob が入れ子 `node_modules` を既定除外するかは推測
8. **`bunfig.toml` と `tsconfig.json` は `tools/` 起点**: 除外パターンが `tools/<ctx>/adapter/**` などで書かれているため、src/ に移すと adapter／usecase が計測対象に入り 0.9 の床を割る（推測、機構上ほぼ確実）。`tsconfig.include` に `src/**/*.ts` を足さないと型検査対象から外れる
9. **アップグレード経路が `.ts` 468 本の孤児を残す**: `scripts/install.ts` の refresh は現 dist と同名のファイルしか消さず、tombstone は `REMOVED_PAYLOADS` のファイル単位 `rmSync`（`recursive` 無し）。bundle 化後の dist は `.js` 10 本＋`data/` だけなので、既存インストール先の `.claude/tools/aidlc-sensor-*.ts` と `tools/<ctx>/**` は消えない。intent-e2e の tombstone 検査（`deep-spec-lib.ts`）がこの機構の回帰網
10. **アーキテクチャ規則の位置分類はパス構造に依存**: `locationOf` は `<ctx>/<layer>/...` の先頭 2 セグメント（`rules.ts:49-57`）、entry は `ENTRY_FILES` のフラット basename（`rules.ts:23-34`）、`PUBLISHED_LANGUAGE` の鍵は `kernel/domain/expression.ts` 形式の相対パス。走査ルートを `src/` に変えれば層分類と表はそのまま効くが、`src/entries/<name>.ts` は再分類が要る
11. **upstream 側の `tools/` 契約は拡張子を見ない**（浅読み）: validate は `tests`／`fixtures` と `.test.ts` の拒否と symlink 禁止のみ、build は `cpSync`、compose は `{{HARNESS_DIR}}` 置換つき no-clobber（`tools/*.ts` にトークン 0 件）。`.js` 化・`data/` 同居は projection／validate／compose を変えずに通る（intent 前提と整合）
12. **既存の残骸**: `bunfig.toml` の除外に存在しない `tools/deep-spec-lib.ts`・`tools/deep-spec-refinement-lib.ts` が残る。`tests/architecture/rules.ts:8-9` の「フラット 13 ファイルは LEGACY」コメントは PR10 で空化済みの古い記述
13. **決定論の凍結面**: findings golden の byte 凍結と `tests/parity/` の spawn スナップショット。bundle 化しても verdict 行・findings JSON の文言と発生順を変えない限り緑（項目 2 の実測が根拠）
14. 大規模／God ファイルなし（最大 395 行）、`process.*`／`import.meta` は entry 10 本に閉じている（`process-only-in-entries`、grep でも層ファイルの該当はコメントのみ）——bundle の入口を entry に限定する設計前提は現状のコードで既に満たされている

## この intent（src/ 分離＋bundle 化）に対するリスク（9 項目）

| # | リスク | 根拠 | 求められる対処 |
|---|---|---|---|
| 1 | 相対 import はパッケージ境界を素通りする | 負債 5（実測） | `only-sanctioned-imports`／`layer-direction` に「パッケージディレクトリを出る `../` 禁止」を足す。無ければ intent の「宣言外の層を解決不能にする」は bare specifier にしか効かない |
| 2 | isolated linker 下で `src/entries/` と `tests/` が `@deep-spec/*` を解決できず `bun build` も失敗する | 負債 6（実測） | 両者を workspace メンバー（または root の `dependencies`）にする |
| 3 | 各層ディレクトリ直下に `node_modules` symlink が生え、architecture テストが落ちる | 負債 7（実測） | `walkToolsFiles` の symlink 拒否と再帰を `node_modules` 除外にする |
| 4 | `installation-manifest.ts` の canary 17 本、intent-e2e の compose 検査リスト、`doctor-domain.test.ts:24-27` が全部書き換えになる | 負債 1(e)、テスト経路 4・5 | doctor 出力の label 文言＝外部仕様の変更を伴う点は要注意（裁定事項） |
| 5 | `scripts/install.ts` の refresh／tombstone がファイル単位・非再帰で、既存インストール先の `.ts` 468 本が孤児化する | 負債 9（実測） | ディレクトリ単位の tombstone（`rmSync(..., { recursive: true })`）か全 `.ts` の列挙 |
| 6 | `bunfig.toml coveragePathIgnorePatterns` と `tsconfig.include` が `tools/` 起点で、カバレッジ床（0.9）と型検査の対象がずれる | 負債 8（推測、機構上ほぼ確実） | src/ 起点のパターンに書き換える |
| 7 | bundle 先頭に bun 固有の `var __require = import.meta.require;`（未使用）が入る | 負債 3（実測） | node 実行で害は出なかったが `--target=node` との比較は未実施 |
| 8 | `bun build` は `node:` 接頭辞を剥がして bare にする | 負債 3（実測） | `no-io-in-pure-layers` の bare 正規化は src 側の規則なので bundle には無関係だが、bundle を規則の走査対象に入れてはいけない |
| 9 | byte-frozen golden／parity は entry の spawn 出力に依存する | 負債 13 | テストの spawn 先を `.js` に切り替えた後も同じ fixture で緑であることが drift guard と並ぶ受け入れ条件 |

## 関連成果物

- 直接 import 23 本の内訳とスパイク表: `dependencies.md`
- `.ts` 固定パスを持つコンポーネントの健全性評価: `component-inventory.md`
- 改善機会としての整理: `architecture.md` の Improvement Opportunities
