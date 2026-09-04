## Developer Code Scan Results

### Scan Coverage
- **Scan kind**: partial / focused scan
- **Snapshot allowed path**: `./`
- **Source fingerprint**: `git:3f728096897f31b1f489228f985b6aa433ea865d`
- **Analyzed deeply**:
  - `deep-spec-analysis/src/refinement/domain/package.json`
  - `deep-spec-analysis/src/refinement/domain/index.ts`
  - `deep-spec-analysis/src/refinement/domain/refinement-status.ts`
  - `deep-spec-analysis/src/refinement/domain/refinement-map-defect.ts`
  - `deep-spec-analysis/src/refinement/domain/unit-refinement-plan.ts`
  - `deep-spec-analysis/src/refinement/domain/refinement-solver-plan.ts`
  - `deep-spec-analysis/src/refinement/domain/refinement-materials.ts`
  - `deep-spec-analysis/src/refinement/domain/refinement-requirements.ts`
  - `deep-spec-analysis/src/refinement/domain/refinement-quint-invariant.ts`
  - `deep-spec-analysis/src/refinement/domain/refinement-map.ts`
  - `deep-spec-analysis/src/design/domain/package.json`
  - `deep-spec-analysis/src/design/domain/index.ts`
  - `deep-spec-analysis/src/design/domain/design-report.ts`
  - `deep-spec-analysis/src/design/domain/design-reports.ts`
  - `deep-spec-analysis/src/design/domain/design-finding.ts`
  - `deep-spec-analysis/src/design/domain/design-skipped.ts`
  - `deep-spec-analysis/src/design/domain/lowered-unit.ts`
  - `deep-spec-analysis/src/design/usecase/package.json`
  - `deep-spec-analysis/src/design/usecase/index.ts`
  - `deep-spec-analysis/src/design/usecase/verify-design-smt-usecase.ts`
  - `deep-spec-analysis/src/design/usecase/verify-design-quint-usecase.ts`
  - `deep-spec-analysis/src/design/usecase/port/design-report-repository.ts`
  - `deep-spec-analysis/src/design/usecase/port/`（公開ポートとペイロードの全宣言）
  - `deep-spec-analysis/src/design/adapter/design-report-repository-impl.ts`
  - `deep-spec-analysis/src/design/adapter/design-report-serializer.ts`
  - `deep-spec-analysis/src/entries/data/deep-spec-findings-schema.json`
  - `deep-spec-analysis/src/kernel/domain/verification-method.ts`
  - `deep-spec-analysis/src/kernel/domain/finding-kind.ts`
  - `deep-spec-analysis/src/kernel/infrastructure/`
  - `deep-spec-analysis/tests/architecture/rules.ts` のパッケージ・層・CQS・published language 規則
  - `deep-spec-analysis/tests/architecture.test.ts` の対応する red/green example と実ツリー検査
  - `deep-spec-analysis/tests/design-pipeline.test.ts` の lowering、remap、report、cross-check 契約
  - `deep-spec-analysis/tests/refinement-pipeline.test.ts` の refinement と repository 契約
  - `deep-spec-analysis/docs/decisions.ja.md` の Repository、CQS、infrastructure、refinement、ドメイン種別裁定
  - `deep-spec-analysis/docs/handoffs/71-tda-program.ja.md` の裁定・実装対応表
- **Skimmed only**:
  - `deep-spec-analysis/src/refinement/domain/` の上記以外（import/export、型名、呼出関係を横断検索）
  - `deep-spec-analysis/src/design/domain/` の上記以外（import/export、型名、呼出関係を横断検索）
  - `deep-spec-analysis/src/design/adapter/` の上記以外（refinement と report の接続点を横断検索）
  - `deep-spec-analysis/src/kernel/domain/` の上記以外（`Result`、DP、再構成口の利用箇所を横断検索）
  - `deep-spec-analysis/docs/decisions.md`（日本語版との該当項目照合）
  - `deep-spec-analysis/tests/` の上記以外（関連シンボルの利用箇所を横断検索）
- **Excluded**: `aidlc-workflows/`、`.claude/`、`sandbox/`、`dist/`、`node_modules/`。深い解析範囲は `./` の外へ広げていない。

### Packages Found
- `@deep-spec/refinement-domain` — domain package — TypeScript — 要件 IR と設計 IR の refinement map、被覆分類、SMT/Quint 向け計画・判定解釈を所有する。
- `@deep-spec/design-domain` — domain package — TypeScript — 設計モデル、lowering、兄弟バックエンド verdict の remap、設計 report と cross-check を所有する。
- `@deep-spec/design-usecase` — application/usecase package — TypeScript — SMT/Quint の設計検証、refinement の起動、report 永続化を編成する。
- `@deep-spec/design-adapter` — adapter package — TypeScript — JSON/Schema、ファイル I/O、外部 solver/backend、refinement 文書のパースを所有する。
- `@deep-spec/kernel-domain` — shared domain package — TypeScript — 契約共有の DP、識別子、式、正準順を所有する。
- `@deep-spec/kernel-infrastructure` — innermost language-extension package — TypeScript — `Result`、`Ok`、`Err`、`unreachable` のみを所有する。
- `@deep-spec/kernel-usecase` — shared usecase package — TypeScript — `RepositoryError`、`Clock` 等のアプリケーション契約を所有する。

### Build System
- **Type**: Bun workspaces + TypeScript (`moduleResolution = "bundler"`, strict/noEmit)
- **Config Files**: `deep-spec-analysis/package.json`、`deep-spec-analysis/tsconfig.json`、`deep-spec-analysis/bunfig.toml`、各 `src/<context>/<layer>/package.json`
- **Build Dependencies**:
  - `refinement-domain → design-domain + requirements-domain + kernel-domain + kernel-infrastructure`
  - `design-usecase → design-domain + refinement-domain + kernel-domain + kernel-infrastructure + kernel-usecase`
  - `design-domain → kernel-domain + kernel-infrastructure`
  - `kernel-domain → kernel-infrastructure`
  - isolated linker により、マニフェスト未宣言の `@deep-spec/*` import は解決できない。

### APIs Discovered
- Internal Repository API — `src/design/usecase/port/` — `DesignModelRepository`、`DesignReportRepository`、`RefinementMaterialsRepository`、`RefinementMapRepository`、`DesignIrValidationMaterialsRepository`
- Internal Client API — `src/design/usecase/port/` — `SiblingBackendClient`、`RefinementSolverClient`
- Internal payload/result contracts — `src/design/usecase/port/` — `SiblingLoweredRun`、`RefinementCheck`、`RefinementSolverResult`、`ReachabilityProbe`
- HTTP/GraphQL/gRPC endpoint — 今回の focused scan 範囲にはなし。

### Frameworks & Libraries
- Bun — 実行・テスト・workspace package manager（検証時 `1.3.13`）
- TypeScript — `7.0.2` — strict type checking
- `@informalsystems/quint` — `0.32.0` — Quint backend
- `z3-solver` — `5.2.0` — SMT backend（実運用では Node 子プロセス隔離）

### Test Coverage
- **Test Directories**: `deep-spec-analysis/tests/`、`deep-spec-analysis/tests/architecture/`、`deep-spec-analysis/tests/fixtures/`
- **Test Frameworks**: `bun:test`、golden byte comparison、architecture red/green examples、実ツリー検査
- **Coverage Config**: `bunfig.toml` に domain 層の line/function 90% floor。adapter/usecase は契約・spawn・sandbox 系テストで担保する方針。
- **Focused baseline**: `bun test tests/architecture.test.ts tests/design-pipeline.test.ts tests/refinement-pipeline.test.ts` は 84 pass / 0 fail。`bunx tsc --noEmit` は exit 0。
- **Coverage gap relevant to this intent**: backend report 保存成功後に cross-check 保存・読込が失敗するケース、同一 repository instance の schema 観測が途中で変わるケース、同一 verify directory への並行 writer を固定するテストは見当たらない。

### Code Quality Indicators
- **Linting / architecture**: `tests/architecture/rules.ts` が層方向、マニフェスト方向、CQS、domain 種別、private field、published language を機械検査する。実ツリーは現状すべて通る。
- **CI/CD**: 今回は `deep-spec-analysis/` 内のコード・テスト契約に限定して確認した。リポジトリ外周の pipeline 定義は focused scan の対象外。
- **Documentation**: `docs/decisions.ja.md` と `docs/decisions.md` に主要な裁定と証拠がある。今回のレビュー指摘の一部は、その明示裁定を再び開く提案になる。
- **File size**: 対象 production code の最大は `src/design/adapter/refinement-query-plan.ts` 395 行、次いで `src/design/domain/lowered-unit.ts` 384 行、`src/design/usecase/verify-design-quint-usecase.ts` 341 行。production code に 1,000 行超えはない。テストでは `tests/refinement-pipeline.test.ts` が 1,021 行、`tests/ir-validation.test.ts` が 1,198 行。

### Technical Debt Signals

#### 1. Refinement は独立 package だが、出力語彙と識別を Design に借りている

- `src/refinement/domain/package.json:9-12` は `design-domain` と `requirements-domain` の双方を直接依存に持つ。
- `src/refinement/domain/refinement-status.ts:43-45`、`refinement-map-defect.ts:55-56`、`unit-refinement-plan.ts:54-65,263-307`、`refinement-solver-plan.ts:44-139` は refinement の判断から `DesignFinding` / `DesignSkipped` / `DesignSkips` を直接生成する。
- `src/refinement/domain/refinement-quint-invariant.ts:31-33` は refinement の不変量を `LoweredObligation` に直接変換する。
- 逆方向には `src/design/usecase/verify-design-{smt,quint}-usecase.ts` が `UnitRefinementPlan` を消費し、パッケージ全体では `refinement/domain → design/domain → design/usecase → refinement/domain` のコンテキスト循環になる。TypeScript import の直接循環ではないが、変更理由は相互に結びつく。
- ただしこれは偶発的な抜け道ではない。`docs/decisions.ja.md:612-639` と `tests/architecture/rules.ts:730-752` は「adapter を持たない refinement」「design が ports/adapters を担う」「4 本の公認横断エッジ」として意図的に許可している。したがって単なる違反修正ではなく、既存裁定の再審が必要。
- **案 A — Design の refinement subdomain として統合**: package/境界を減らし、現在の出力語彙への依存を自然な内側依存にする。型変換は最小だが、独立した refinement 語彙・テスト領域を弱める。
- **案 B — 独立 bounded context を完成**: `RefinementFinding` / `RefinementSkip` / `RefinementAssessment` 等の固有オブジェクトを返し、design usecase/adapter で契約2の `DesignFinding` / `DesignSkipped` へ変換する。境界は明確になる一方、型・変換・byte-frozen 文言の所有点が増える。
- **推奨判断**: refinement を独立プロダクト境界として進化させる予定がないなら案 A が最小。独立させるなら案 B を選び、「adapter なしで Design の出力モデルを返す」現行の中間形を残さない。

#### 2. `conformedOf` は明示裁定済みだが、同一操作で schema を二度観測する

- `DesignReportRepository` の `conformedOf` は `docs/decisions.ja.md:1085-1099,1156-1173` で意図的に Repository 契約へ統合され、`store(): Result<void, ...>` の CQS と stdout/file 一致を両立する設計として裁定済み。レビュー指摘どおり別 application service へ移すだけでは、既存裁定を無断で反転する。
- 一方、`verify-design-smt-usecase.ts:223-225` と `verify-design-quint-usecase.ts:312-314` は `conformedOf(report)` の後に `store(report)` を呼び、`DesignReportRepositoryImpl.store` は `design-report-repository-impl.ts:70-79` で再度 `conformedOf` する。各回が `readContractSchema` を実行するため、schema の変更・一時的読込失敗を途中で挟むと、返す verdict と保存文書が別の適合結果になり得る。通常時にも schema parse/validation は二重実行される。
- **案 A — Repository 構築時に schema snapshot を一度だけ読み込む**: 現行裁定と公開ポートを保ち、同一 instance 内の TOCTOU を消す。二重 validation の計算は残るが結果は同じになる。
- **案 B — 裁定を再開し、validated/prepared report を一度だけ作る**: conformance を明示境界へ分け、Repository は検証済み report だけを store する。責務は明瞭になるが、新しい型またはポートを要し、CQS と「Repository は不適合を書かない」の再定義が必要。
- **推奨判断**: まず案 A。案 B は report 3 系（design/requirements/refcheck）をまとめて再裁定する場合に限る。Design だけの局所差は作らない。

#### 3. backend report と cross-check は同一の整合性単位なのに、保存は非原子的

- `verify-design-smt-usecase.ts:224-249` と `verify-design-quint-usecase.ts:313-338` は backend report を保存し、その後 `findAllByDirectory` で兄弟を読み、別の `store` で `cross-check.json` を保存する。
- `findAllByDirectory` が失敗すると両 usecase は `ok(undefined)` で成功扱いにする（SMT `:245-248`、Quint `:334-337`）。このとき backend report は新しく、cross-check は古いまま残り得る。
- `DesignReportRepositoryImpl.store` は `writeFileSync` で最終パスへ直接上書きする（`:74-82`）。1 ファイル単位でも temp + rename ではなく、同一 directory の並行 SMT/Quint writer を直列化する lock もない。
- 現行 golden は「最後の書き手が勝ち、最終的に同じ byte へ収束」を検証するが、中間失敗・同時実行・partial state は検証しない。
- **案 A — cross-check を明示的な派生 projection として eventual consistency 化**: backend report は原本、cross-check に source fingerprint / stale marker を持たせ、再構築失敗時は `verified` を返さず再試行可能な outcome にする。二ファイルの真の atomicity は要求しない。
- **案 B — directory 単位の commit protocol**: per-directory lock 下で schema snapshot、兄弟読込、backend/cross-check の candidate bytes を作り、各ファイルを temp + rename する。並行 writer と partial file は防げるが、別々の最終パスを外部 reader が lock なしで読む限り、二ファイル同時切替の厳密な atomicity は得られない。厳密に必要なら versioned directory + atomic manifest/pointer 切替まで要る。
- **推奨判断**: 契約2が別ファイルを固定している現状では、案 A の明示的な派生 projection と、案 B の lock + temp/rename を組み合わせる。失敗を黙殺せず、古い cross-check を新しいものとして扱わない。

#### 4. `reconstitute` の寛容性は必要だが、新規生成の門にも流用されている

- `FindingKind` は `parse` と `reconstitute` を分離し、未知 kind を降格試験で運ぶことが `finding-kind.ts:1-46`、`tests/kind-rank.test.ts:46-54`、`docs/decisions.ja.md:1928-1933` に明記されている。未知値を全面禁止する修正は既存契約に反する。
- しかし `DesignFinding` の唯一の公開生成口は `reconstitute({ kind: string, ... })`（`design-finding.ts:18-42`）で、usecase/domain 内の正常な新規 finding もすべてこの寛容口を通る。`DesignReport.compose` も `method: string` を受け、内部で `VerificationMethod.reconstitute` する（`design-report.ts:117-140`）。`VerificationMethod` 自体には閉集合の `parse/of` がない（`verification-method.ts:5-22`）。
- `DesignSkipped.reason` は schema 上 9 種の enum（`deep-spec-findings-schema.json:215-233`）だが、型は任意 `string` のみ（`design-skipped.ts:6-20`）。usecase の `skipAll(reason: string, ...)` は正常系の組成点にも任意値を通す。
- **案 A — strict creation / tolerant hydration の二つの門**: `FindingKind.of...` または strict `parse`、`VerificationMethod.parse/of`、共有 `SkipReason` DP を追加し、`DesignFinding.of` / `DesignSkipped.of` / `DesignReport.compose` は検証済み DP のみ受ける。adapter の既存文書読込だけが `reconstitute` を使う。外部不適合文書の降格挙動は維持できる。
- **案 B — static named factories**: 各 finding/skip/method の名前付き factory で正常生成を閉じ、raw hydration は adapter 専用 factory に分ける。呼出は読みやすいが factory 数と定型コードが増える。
- **推奨判断**: 案 A。`SkipReason` と `VerificationMethod` は契約2共有語彙なので `kernel/domain`、`DesignFinding.of` 等は `design/domain` に置く。`reconstitute` は削除せず adapter 境界に限定する。

#### 5. SMT/Quint usecase は共通 lifecycle を複製し、修正漏れの面を広げている

- `VerifyDesignSmtUseCase.execute` は 252 行、`VerifyDesignQuintUseCase.execute` は 341 行。
- 取得・not-applicable/io/corrupt 分岐（双方 `:72-93`）、共通 lowering/run/remap（SMT `:95-145`、Quint `:95-147`）、refinement map の absent/stale/unit-missing 分岐（SMT `:147-182`、Quint `:200-233`）、report compose/conform/store/cross-check（SMT `:213-249`、Quint `:301-338`）がほぼ同型である。
- Quint 固有の到達性 probe と refinement extras、SMT 固有の solver query は本質的な差であり、すべてを一つの巨大な generic strategy にすると型と制御がかえって読みにくくなる。
- **案 A — 小さな具体的 application collaborator を抽出**: acquisition/version handling、共通 sibling run、refinement map freshness、report finalization を個別に共通化し、SMT/Quint 固有フローは各 usecase に残す。低い魔法性で重複を減らす。
- **案 B — template pipeline + backend strategy**: backend policy が budgets、synthetics、probe/refinement extension、method を供給する一つの `VerifyDesignUseCase` に統合する。重複削減は最大だが、strategy の条件面が増えると現在の二本より複雑になりやすい。
- **推奨判断**: 案 A。まず report finalization を抽出し、非原子的更新の修正点も一箇所にする。その後、実際に同型のまま残った acquisition/common sibling run だけを抽出する。

#### 6. `LoweredUnit` は compile-down 結果、builder、verdict translator の三役を持つ

- `lowered-unit.ts:44-85` は値オブジェクトとして lowered collections/index を保持し、`:224-384` の `buildLowering` が設計モデルを契約1相当へ変換する。
- 同じ型の `:87-221` は兄弟 backend の document を Design finding/skip へ翻訳し、synthetic probe、waiver、dead/shadow、dedupe の政策まで所有する。384 行で 1,000 行問題ではないが、compile-down 規則と外部 verdict 契約の変更理由が同居する。
- ただし `docs/decisions.ja.md:577-599` は lowering と remap を design/domain の意味として置くことを明示している。単に adapter/usecase へ逃がすと既存裁定に反する。
- **案 A — Tell-Don't-Ask を維持して ownership を分ける**: `DesignUnit`/宣言群が lowering を命じられる形にし、`LoweredUnit` は結果と index の不変条件を保持する。verdict translation は `SiblingVerdictDocument.remapThrough(loweringIndex, unit)` または専用の domain object として裁定する。
- **案 B — 現状維持し、private 関数を別ファイルへ機械分割**: scanability は上がるが、概念と変更理由は分かれず、構造改善は限定的。
- **推奨判断**: 案 A。ただし新しい domain service を安易に作らず、プロジェクト規則どおり domain object の振る舞いとして配置するか、人間の裁定を先に得る。

#### 7. `kernel/infrastructure` は一般的な命名と異なるが、現プロジェクトでは意図された最内層

- `kernel/infrastructure` は `Result`/`Ok`/`Err`/`unreachable` だけを持ち、Node I/O や gateway は持たない。
- `docs/decisions.ja.md:556-567` は「Onion の外殻ではない、言語拡張基盤の最内層」と明記する。`tests/architecture/rules.ts:730-743` と `tests/architecture.test.ts:418-423` は infrastructure が上位を知らず、全層から到達可能であることを red/green example 付きで固定する。
- よって「一般的な Clean Architecture と名前が逆」は読者負荷の問題ではあるが、現時点の依存方向違反ではない。
- **案 A — `kernel/foundation` 等へ改名**: 意味の誤読を減らすが、17 workspace package、全 import、architecture rule、docs、配布契約に大きな機械変更が出る。
- **案 B — 現状名を維持し、architecture overview と package README で最内層を強調**: churn は最小だが、一般的用語との摩擦は残る。
- **推奨判断**: この intent の主要な整合性・境界問題を先に直し、今回は案 B。改名は独立 intent に分ける。

### Security / Compliance Impact
- 新しい認証・個人情報・秘密情報の境界は今回の対象にない。
- 主な影響は完全性と再現性。backend report と cross-check の不整合、schema の二重観測は、監査対象の verdict と保存証跡を食い違わせる可能性がある。
- 外部 JSON/Markdown は untrusted input のまま adapter で schema/構造検証し、strict creation と tolerant hydration を分離しても不適合文書の降格経路を失わないこと。
- atomicity 改善で lock/temp file を導入する場合、directory traversal を増やさず `DesignReportId` から導出した既存 directory/file name 境界を維持すること。

## Handoff Summary
- **Intent-relevant finding**: 最優先は、(1) backend report と cross-check の整合性単位を明示し、失敗黙殺と直接上書きを解消すること、(2) strict creation と tolerant hydration を分離すること、(3) refinement を Design の subdomain とするか独立 bounded context とするかを裁定すること。根拠は `verify-design-smt-usecase.ts:223-249`、`verify-design-quint-usecase.ts:312-338`、`design-report-repository-impl.ts:70-82`、`refinement/domain/package.json:9-12`、`unit-refinement-plan.ts:54-65`。
- **Risks / follow-up**: レビュー指摘の `conformedOf` 分離、`kernel/infrastructure` 移設、`UnitRefinementPlan` の再分類は既存の人間裁定と正面から衝突する。次段では「バグ修正」として黙って変更せず、少なくとも各項目を現行維持案と裁定更新案の二案で決めること。findings JSON、verdict、golden の byte 同一性を守り、report 3 系へ共通する裁定を Design だけに局所適用しないこと。
