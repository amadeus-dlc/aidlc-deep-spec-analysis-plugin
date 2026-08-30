# deep-spec-analysis — 設計判断記録

[English](decisions.md) | 日本語

要件定義（docs/TODO.md, 2026-08）に対する実装時の判断・スパイク結果・逸脱の記録。

## スパイク結果（前提A1〜A4の検証）

- **A1: z3-solver（WASM）はbunで動くか → 不成立（回避策あり）**
  z3-solver 5.2.0 / 4.15.8 いずれも bun 1.3.13 では Emscripten pthread
  ワーカーの起動時アサーションで即死（`Aborted(Assertion failed)` in
  `removeRunDependency`）。node 24 では unsat / sat+モデル抽出 / unsat core
  （`solver.unsatCore()`）/ `solver.fromString` によるSMT-LIB取込みまで全機能動作。
  → **対応**: SMTバックエンドはソルバー実行を常に子プロセスへ隔離。同一ファイルを
  `--smt-child` で再入し、node優先・bunフォールバック（将来bunが直れば自動回復）。
  どちらも不可なら contract-2 の `unavailable` に閉じる（NFR3）。
- **A2: quint CLIのseed固定決定論 → 成立（1点補正）**
  `quint run --seed` でトレース内容（states）は決定論的。ただしITFの
  `#meta`（timestamp / description）が実行毎に変わるため、witness格納時に
  `#meta` を全部剥がす。これでバイト同一（NFR1）を実測確認済み。
- **A2': Apalache** — apalache-mcバイナリが無くても、JavaがあればquintがApalacheを
  `~/.quint/apalache-dist-*` へ自己管理して `quint verify` が動く。検出は
  「java実行可 かつ (APALACHE_DIST または ~/.quint/apalache-dist-*)」で決定論的に判定。
- **A4: manifest dependencies** — 機構側で未解決（deferred）のため不使用。
  バックエンドは findings ファイルの `irHash` / `irVersion` で整合を判定。

## 未解決事項（Q1〜Q5）の決着

- **Q1（scopes）**: `enterprise`, `feature` の2つ。ステージ側 `scopes:` 宣言で
  付与（フレームワークはステージ→スコープ方向の宣言）。mvp等への拡張は利用実績を見て。
- **Q2（numericの粒度)**: 独立natureとして維持。形（`assert`）はinvariantと同一だが、
  カバレッジ表で定量要件を判別できる価値を優先。
- **Q3（Apalache）**: 検出時のみ使用（bounded昇格）。導入手順はdoctorのfixメッセージと
  READMEに記載。同梱はしない。
- **Q4（タイムアウト予算）**: SMT: クエリ毎2秒（z3 `timeout` パラメタ）＋子プロセス
  総予算45秒＋壁時計55秒、センサーmanifest 75秒。Quint: run 30秒 / verify 45秒 /
  シナリオ毎15秒、manifest 75秒。ir-valid: 15秒。いずれもフックの子プロセス上限
  （90秒）の内側。超過は `skipped[reason: timeout]` に閉じる。
- **Q5（EARS正規化テキスト）**: IRに `ears` フィールドとして保持し、レポートで
  人間可読に引用する（IR JSONのみにしない）。

## 要件ドラフトからの逸脱

1. **プラグイン名 = `deep-spec-analysis`**（C4ドラフトは `deep-spec`）— ユーザー指示
  （2026-08-28）による。フレームワークの成果物接頭辞規則
  （produces は `<plugin>-` で始まる）により、論理成果物は
  `deep-spec-formal-model` → **`deep-spec-analysis-formal-model`** に改名（FR1.7 / FR3.2）。
  doctor は `<plugin>-doctor.ts` 規約により **`deep-spec-analysis-doctor.ts`**（FR11.1）。
2. **センサーツールのファイル名**（FR6.1 / FR7.1 ドラフトは `deep-spec-verify-smt.ts` 等）—
  フレームワークのコンパイル済みバイナリ経路（`aidlc-sensor.ts` の
  `resolveSensorScriptPath`）がスクリプト名 `aidlc-sensor-<id>.ts` を強制するため、
  **`aidlc-sensor-deep-spec-verify-smt.ts` / `-quint.ts` / `-ir-valid.ts`** を採用。
  「バックエンド1＝センサー1＋ツール1」（NFR4）の対応は維持。
3. **クロスチェックの実装位置**（FR8）— 各バックエンドのfindingsファイル内ではなく、
  独立ファイル `deep-spec-verify/cross-check.json` に分離。両バックエンドが自分の
  書込み後に「同一 `irHash` の全siblingファイルの純関数」として再計算する
  （最後の書き手が勝つが全書き手が同一バイトに収束）。理由: バックエンド自身の
  ファイルに書くと発火回数・順序で内容が揺れ、NFR1（バイト同一）と矛盾する。
  v1の比較面は「全属性束縛・イベント無しシナリオの判定」— 両バックエンドが同一意味論で
  独立実装している唯一の検査であり、不一致＝形式化/コンパイラ欠陥（FR8.2の意図）が
  偽陽性なく成立する。イベントobligationは両者が検査するが検査意味論が相補的
  （静的整合 vs 到達可能性）なため、v1では判定比較の対象にしない。
4. **IRの物理形**: エンジンの成果物ファイル名解決が `.md` 固定のため、IR JSONは
  `deep-spec-analysis-formal-model.md` 内の単一 ```json フェンスとして格納
  （FR1.1のJSON性は維持、センサーはフェンスを決定論的に抽出）。
5. **ステージslug = `deep-spec-analysis-verify`**（FR3.1ドラフトは `deep-spec-analysis`）—
  composeが「プラグイン所有ステージのslugは `<plugin>-` 接頭辞必須」を強制するため
  （オフラインvalidatorは通すがcompose時にdropされる）。プラグイン名が
  `deep-spec-analysis` である以上、slug `deep-spec-analysis` 単体は不可。
  ステージレコードは `<record>/inception/deep-spec-analysis-verify/` になる。
  接尾辞を変えたい場合はステージファイル名・slug・本文中の3参照の機械的リネームで済む。
6. **完全性ギャップの意味論**（FR6.3b）: トリガー毎に「background＋不変量を満たすが
  どのguardも成立しない状態の存在」を検査。トリガー自体が不可能な状態も含むため
  過剰報告になり得るが、EARSの「未規定領域は人間に問う」という本プラグインの
  哲学に合致（A: 暗黙no-op容認 / B: 規定追加、の質問になる）。
7. **同梱インストーラ = `scripts/install.ts`**（2026-08-29追加）— `aidlc-plugin-build.ts`
  → compose（`aidlc plugin sync`、CLI欠如時は `hooks/compose.ts` を直接bun実行）を
  1コマンドに自動化。投下の要否は `plugin-targets.json` の `kind` で分岐：store系
  （claude/codex/copilot/opencode）は `dist/` から直接composeしプロジェクトへ何も
  コピーしない。フォルダドロップは kiro/kiro-ide/cursor のみ（ホストの流儀）。
  当初は全ハーネスでドロップしていたが、store系ではプロジェクトルートに
  stages/ 等の残骸を作るだけと判明し kind分岐に修正。
  `tools/` はcompose対象としてプロジェクトへ配布されるため、配布対象外の `scripts/` に
  配置（tsconfig includeに追加、CI typecheck対象）。ハーネス→leaf対応はハードコード
  せず aidlc 同梱の `plugin-targets.json` を参照。`--dry-run` は
  `aidlc-plugin-test.ts --install` に委譲。ストア経由と違い信頼ゲートを通らない点は
  README/architecture.md に明記。
8. **B承認済み改訂の自動適用**（2026-08-29追加、当初設計からの変更）— 当初は
  「requirements.md は編集しない。改訂はready-to-apply提案としてレポートに載せるのみ」
  だったが、B承認後の適用を人間の手作業に残すのはUX欠陥（ユーザー指摘）。Step 6として、
  B回答（個別回答＋Consolidated Summary Confirmationの二重承認）済みの改訂をステージ
  自身が requirements.md へ verbatim 適用し、formal model を書き直してセンサー再発火
  →解消確認（第2パス）まで行う設計に変更。成果物所有モデルとの整合: requirements-analysis
  と本ステージの lead は同一の `aidlc-product-agent`。安全性質は維持: 適用されるのは
  承認文面のみ、A/X・未指摘箇所は不変、レポートの Applied Revisions に before/after を
  記録、決定論的センサー群は引き続き読み取り専用。

## 検証マトリクス（実測、2026-08-28）

| 検査 | 実施 | 結果 |
|---|---|---|
| aidlc-plugin-validate | ✔ | VALID (errors 0) |
| fixture: SMT期待findings | ✔ | conflict×2（unsat core帰責）/ gap×1 / scenario-violation×1 / skip×2 |
| fixture: Quint期待findings（simulation, seed 0x2a） | ✔ | conflict×1（2状態トレース）/ scenario-violation×1 / skip×3 |
| fixture: Quint boundedモード（Apalache） | ✔ | 同findings、OB-8（leads-to）は反例なし＝検査済クリーン |
| クロスチェック収束・不一致検出 | ✔ | 正常時findings空・改竄sibling注入でSC-2のdisagreement検出 |
| NFR1バイト同一（再実行） | ✔ | smt/quint/cross-check 3ファイルともdiffなし |
| NFR3劣化（quint欠如・runtime欠如・irVersion不一致） | ✔ | unavailable/skippedに閉じ、exit 127/0で停止なし |

## intent実作成E2E検証（実測、2026-08-29、sandboxにて）

以下の手動検証は `tests/intent-e2e.test.ts` として自動化済み（`bun test` でCI毎回実行）。
LLM会話層（形式化・A/Bゲート・レポート）はfixture代替のため、正確には
「決定論経路のintentレベル統合テスト」であり、フルE2Eではない。

| 検査 | 実施 | 結果 |
|---|---|---|
| インストーラでバニラAI-DLC素体へ導入 | ✔ | store系=非投下で `.claude/` へcompose、drops 0、ルート無汚染 |
| `intent-create --scope classic` | ✔ | intent minted。**2.10 deep-spec-analysis-verify は SKIP**（stage `scopes: [enterprise, feature]` によるscope routing——仕様どおり） |
| `intent-create --scope feature` | ✔ | 34ステージ中 2.10 が **EXECUTE** でon-path |
| 実intentレコードでのセンサー3連発火（`--stage`/`--output-path` 実契約） | ✔ | ir-valid: pass / SMT(exhaustive): findings 5（同一トリガーconflict×3 unsat core付き + completeness-gap 具体的反例状態付き + SC-5 scenario-violation）/ Quint: findings 2（**OB-4不変条件をイベント機械が破る2状態トレース**＝SMTにない状態機械レンズ + SC-5 scenario-violation でSMTと判定一致）/ cross-check: SC-3・SC-5を両バックエンドが照合しdisagreementゼロ / When-event型シナリオと部分bindings rejectは明示的capability skip |
| headless `/aidlc`（`claude -p`）実走 | △ | オーケストレータ起動〜プラン選択ゲートまで動作。aidlcはゲート駆動設計のため非対話完走は不可（ゲート毎に `--resume` 注入が必要）。sandboxのdist設定はBedrock強制（`CLAUDE_CODE_USE_BEDROCK=1`）のため、非AWS環境では `settings.local.json` での上書きが必要 |
| **後入れ**（プラグイン導入前に作られたintentへの検査） | ✔ | バニラ素体でfeatureスコープintent作成（32ステージ・verifyステージ言及なし）→ 後からインストーラ導入 → `aidlc-orchestrate next --stage deep-spec-analysis-verify --single` が受理（load-steering→run-stage、consumesは既存レコードの requirements.md に解決）→ センサーが同レコードで5 findings全件検出。classicスコープは singleモードでも明示拒否（"skipped for scope classic"）。`tests/intent-e2e.test.ts` の late adoption ブロックで毎回回帰検証 |
| **未検査要件の自動検出**（人間の注意力に依存しない後入れ） | ✔ | doctorに検査カバレッジスキャンを追加：全space×全intentを走査し、ステージ定義の `scopes:` に該当し requirements.md を持つのに検査記録が無い intent を advisory 行で列挙（切替＋`--single` の実行コマンド付き）、検査後に requirements.md が更新された intent は stale として検出。インストーラは compose 直後に同スキャンを実行して導入時点の検査負債を表示。未検査→検出、検査後→`1/1 verified`、touch後→stale の全遷移を実測・テスト化 |

## 設計検証拡張フェーズ①（refcheck）の設計判断（2026-08-29、v0.2.0）

要件の正典は [issue #2（要件定義全文）](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/issues/2) と [issue #3（フェーズ①）](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/issues/3)。実装：ソルバー不要・LLM不要の参照整合センサー3本（`deep-spec-refcheck-{domain,contract,functional}`）を contributions の `adds.sensors` で domain-design / contract-design / functional-design に合流させ、findings 契約（契約2）を是正・拡張し、doctor に report-only 構造負債スキャンを追加した。ステージ追加はゼロ（②③で1本）。

### 未解決事項の決着（issue #3 に割り付けた Q）

- **Q3（YAML解析）**: 自作の決定論的サブセットパーサ（`tools/deep-spec-lib.ts`）。センサーはターゲットプロジェクトの `node_modules` に依存せず動く必要があり、vendored 依存は不可。サブセット外（アンカー・エイリアス・タグ・フローマップ）は `structure-invalid`／`unrecognized-format` に落ち、解釈の推測はしない。
- **Q4（mermaidサブセット）**: `stateDiagram-v2` の単純状態＋遷移のみ。composite state / choice / fork / join は機械ごと `unrecognized-format` skip。frontend-components.md は①では対象外（要件 O10 のまま）。
- **Q7（mandatory-fix化）**: ①は全て advisory。write 発火センサーの blocking はフレームワークが強制しない事実に合わせ、ゲートはコアステージへの end-of-steps fragment（「summary confirmation 前に fix or record」）が担う。
- **Q8（contributionスコープ）**: ターゲットステージの全スコープに追従。`when:` は不評価のため絞る機構がそもそも無く、refcheck は bun のみ・10秒級・advisory なので広く付けて害がない。

### 要件（issue #2 FR）からの逸脱・精緻化

1. **kind 追加は3種のみ**（`structure-invalid` / `reference-broken` / `consistency-mismatch`）。FR1.4 の7種一括でなく、②③の kind は各フェーズが追加する——契約の変更をフェーズ境界に揃える。
2. **トップレベル `checked[]` を契約2に追加**。check-family 粒度の no-silence（FR2.9/FR5.5「クリーンでも現れる」）を載せる欄が契約2に無かったため。クリーン run と未実行 family がファイル単体で区別できる。
3. **skip reason `absent-input` を追加**。隣接成果物の欠如は `unavailable`（ソルバー/ランタイム不在）とも `unrecognized-format` とも意味が違う。
4. **プラグイン同梱 lib `tools/deep-spec-lib.ts`**。C9「自己完結」は「framework/core ツールを import しない」の意味に精緻化：同一 compose デルタで配布される自前 lib は可（coreの `aidlc-lib.ts` と同型のパターン）。v1 の smt/quint も契約2自己検証のためこの lib の `validateSchema` を使う。
5. **CD-1/CD-3 のユニット出典は `unit-of-work-dependency.md` の `units:` エッジブロック**（FR4.1 の字面は unit-of-work.md）。フレームワーク自身が batch fan-out を計算する機械可読ソースであり、散文パースより頑健。
6. **FD-S のライフサイクル属性決定則**: 見出しの `Entity.attr` 明示 > `status`/`state` 名で allowed values を持つ属性 > allowed values を持つ唯一の属性 > 判定不能は `unrecognized-format` skip。
7. **重複報告の排除**: DD-7 は自己ループを報告しない（DD-3 の担当）。XS 走査は components.md 側の重複宣言を正規化名で1回に畳む（重複自体は DD-5 の担当）。
8. **是正1・是正2（v1 既知問題）**: witness に `verdicts` 変種を正式定義し cross-check.json の契約逸脱を解消（バックエンド別判定は本質情報であり、model/trace/core への書き換えは情報を捨てる上に v1 golden を壊す——契約側を実装の意図に追いつかせた）。全 contract-2 writer（v1 の smt/quint 含む）に書き込み前の自己スキーマ検証を義務化（不適合→検証エラーを理由に `unavailable` 降格）、全 golden findings のスキーマ適合を `tests/refcheck.test.ts` が恒久的にアサート。
9. **バージョン**: 要件書 FR16 の「①=v1.1.0」はノミナル。実系列は 0.x のため ①=**v0.2.0**（同じくマイナーバンプ）。

### 検証マトリクス（実測、2026-08-29）

| 対象 | 結果 | 証拠 |
|---|---|---|
| refcheck conformance（`tests/refcheck.test.ts`、22件） | ✔ | broken/clean 両レコードの golden バイト一致（3センサー×2）、再実行バイト同一（NFR1）、clean golden の checked が全 family を列挙（DD-0 構造検査＋DD-1..7 の 7 規則で DD×8 / CD×3 / FD+XS×16）、劣化（サブセット外YAML→FD-E1＋家族skip、components.md欠如→XS absent-input、unitsブロック欠如→CD-1/CD-3 absent-input）、`--report-only` 無書き込み、not-applicable素通り |
| **全 golden のスキーマ適合**（是正2b） | ✔ | v1 conformance golden（smt/quint/cross-check）＋refcheck golden 全ファイルが拡張後の deep-spec-findings-schema.json に適合 |
| v1 リグレッション | ✔ | conformance 11件不変・golden バイト同一（自己検証追加後も出力契約不変）、intent-e2e 既存12件不変 |
| intent-e2e フェーズ①ブロック（+4件） | ✔ | compose がセンサー3本＋lib を `.claude/` へ配置、contributions が3コアステージの `sensors:` に合流、合成済みセンサーが sandbox の実レコードで planted defects（DD-2・循環）を検出、doctor の report-only スキャンが負債行（advisory）を表示 |
| validator / ビルド | ✔ | `aidlc-plugin-validate` VALID（errors 0）、7ハーネス全ビルドOK |

### 実サンドボックス実射で発見した欠陥と是正（2026-08-29、v0.2.0 追補）

tmp から作る自動 E2E は常にバニラツリー開始のため踏めない欠陥を、ワークスペースの実サンドボックス（`deep-spec-analysis-sandbox/`、v0.1.0 が compose 済み）への後入れアップグレードで発見した：

- **事象**: フレームワークの compose フックは payload コピーが **no-clobber**（新規ファイルは置くが既存ファイルは絶対に上書きしない）。v0.1.0 → v0.2.0 のアップグレードでは、新規の refcheck センサー群は配置される一方、**変更された既存ファイル（findings スキーマ・自己検証入り smt/quint）は旧版のまま残り**、新旧混在になる。結果、新センサーが旧スキーマで自己検証し `/method: not one of ["exhaustive","bounded","simulation"]` で**全文書が unavailable に降格**——フェーズ①がアップグレード環境で全滅する。`plugin-sync` はこの経路（インストーラ直 compose）では "no installed plugins" で無力。
- **是正**: `scripts/install.ts` に **upgrade refresh** を追加——compose 前に、dist projection が出荷する payload（sensors/ tools/ knowledge/ agents/ scopes/ stages/）と同名の既存ファイルだけを harness ツリーから除去し、no-clobber コピーに最新版を再配置させる。プラグイン以外のファイルには一切触れず（additive-only 維持）、contribution のステージ合流は内容ベースで自己更新するため対象外。compose が再配置に失敗すれば既存の sentinel 検査が即失敗する（静かな欠落は起きない）。
- **回帰テスト**: `tests/intent-e2e.test.ts` の upgrade-path ブロック——composed スキーマを故意に stale 化 → インストーラ再実行 → `upgrade refresh` 行の出力・スキーマ最新化・composed センサーの実射成功をアサート。
- **実射マトリクス（実サンドボックス、ディスパッチャ `aidlc-sensor.ts fire` 経由）**: 3 センサーとも registry 登録・glob 照合（`**/functional-design/*.md` の bespoke マッチャ含む）・発火 OK。欠陥入り成果物で domain 9 / contract 4 / functional 15 findings、doctor の report-only スキャンは手動発火していない u2-billing も自力発見（計 31 findings / 4 成果物、全 advisory）。

## 設計検証拡張フェーズ②（設計IR + SMT/Quint 単独検査）の設計判断（2026-08-29、v0.3.0）

要件の正典は [issue #2](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/issues/2) と [issue #4（フェーズ②）](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/issues/4)。実装：設計 IR（契約3、`deep-spec-design-ir-schema.json`）、検証ステージ `deep-spec-analysis-functional-verify`（construction・for_each なし集約型）、センサー trio `deep-spec-design-{ir-valid,verify-smt,verify-quint}`、doctor のユニット単位カバレッジスキャン。

### 中核アーキテクチャ：コンパイルダウン再利用

設計 IR の各ユニットを契約1 文書へロワリングし（遷移→暗黙 `state==from` ガード＋`state'=to` 効果の event obligation、ignores→明示ノーオップ event）、**実証済みの v1 バックエンドを子プロセスとして実行**、findings を設計語彙（DOB/TR/SM/DSC・ユニット帰責）へリマップする。ソルバー配管の複製はゼロ。共有機構は `tools/deep-spec-design-lib.ts`（プラグイン同梱 lib、フェーズ①の precedent を踏襲）。

新検査 2 種は**恒真の合成不変条件で v1 の前件空虚（vacuity）検査に相乗り**して獲得：

- `unreachable`（デッドガード）: `implies(guard, true)` — 前件（ガード）の充足不能＝死
- `redundancy`（シャドーイング）: `implies(and(guardB, not(guardA)), true)` — 空虚⇔ guardB⇒guardA、効果の正準同値と合わせて包摂。相互包摂は「同値」1 findings に畳み込み、デッド要素の空虚な包摂は抑止

恒真式なので global／gap／シナリオ判定を一切変えない（実測確認済み）。

### Quint 到達不能状態検査（Q1 の決着）

bounded モード限定・キャップ制（`AIDLC_DEEP_SPEC_QUINT_UNREACH_CAP`、既定 2）。機械の非 initial 状態ごとに「イベント＋単一不変条件 `attr != state`」の変種ロワリングで v1 bounded verify を実行し、**違反 trace の終端がその状態のときだけ「到達」**と判定（conflict の有無だけでは不十分——実装時に発見：設計不変条件を invAll に残すと任意の到達可能違反がプローブを覆い隠し全状態が「到達済み」誤判定になる。変種では設計不変条件を完全に除外——無制約探索で到達しないなら真に到達不能、の健全方向）。キャップ超過・プローブ失敗は理由付き skip（無沈黙）。実測：Apalache の JVM 温存でプローブ約 1 秒/件、キャップ 2 で全体 10 秒程度。simulation モードは capability skip（ランダム模擬の非観測は証拠でない）。

### 要件（issue #2 FR）からの逸脱・精緻化

1. **`initial` は探索を制約しない（v0.3.0）**: FR6.7 の「initial → init 制約」はコンパイルダウン先の v1 init（全合法状態）に注入点が無く未実装。帰結は保守的（不変条件保存は過剰報告方向・到達不能は過小報告方向でいずれも健全）。ir-valid は initial の値域チェックを行う。フェーズ③または v1 バックエンドへの init 制約追加時に再訪。
2. **redundancy の効果同値は正準文字列比較**（FR7.5 の「意味的等価」の保守近似——構文が異なる意味的同値効果は報告しない。偽陽性ゼロ方向）。
3. **contract-2 逸脱ゼロ化の継続**: kind に `unreachable` / `redundancy` を追加（フェーズ計画どおり additive）。
4. **TR id はユニット内一意**（Q10 前半の決着。機械横断で密）。ユニット間の DSC/TR 衝突は findings の `unit` 欄で判別（FR1.10 の設計意図どおり）。
5. **バージョン**: ②= v0.3.0（0.x 系列）。

### 検証マトリクス（実測、2026-08-29）

| 対象 | 結果 | 証拠 |
|---|---|---|
| design conformance（`tests/design-verify.test.ts`、12件） | ✔ | ir-valid 正/負 fixture（重複TR・initial域外・自属性代入・幻BR・BRカバレッジ沈黙を全検出）、SMT golden バイト一致（conflict TR-1/TR-2・unreachable TR-4・相互 redundancy DOB-3/DOB-4・gap×4、ignore セル無誤報）、Quint simulation golden＋cross-check 収束、再実行バイト同一、契約1/3 共有定義のバイト同一（expr は prime 説明文のみ差、構造同一をテスト）、**v1 モデル⇔設計モデルの相互不発火**、irKind 欠如→unavailable、quint 不在→exit 127、版不一致→skip-all |
| intent-e2e フェーズ②ブロック（+5件） | ✔ | ステージがグラフ登録・feature=EXECUTE / classic=SKIP、`--single` 受理（load-steering）、**実ディスパッチャ経由で trio 発火**（ir-valid passed / smt failed 全4種 kind / quint failed）、doctor ユニット単位カバレッジ 0/3→1/3→touch 後 stale で 0/3 |
| **実サンドボックス実射**（後入れアップグレード） | ✔ | upgrade refresh 18 ファイル→compose、ディスパッチャ実射で smt 7 findings、**Quint bounded 自動検出（実 Apalache）で unreachable "archived" を検出**＋DOB-1 の 2 状態 trace＋キャップ超過分の明示 skip（10.4 秒）、cross-check DSC-1 一致、doctor が feature intent のユニットを unverified→verified（1/1）遷移・**classic intent はスコープ除外（仕様どおり）** |
| v1・フェーズ① リグレッション | ✔ | 全 72 テスト green、既存 golden バイト同一 |
| validator / ビルド | ✔ | VALID（errors 0）、7 ハーネス全ビルド OK |

### フェーズ② レビュー追補（2026-08-29、PR #7 の CodeRabbit 指摘 7 件への対応）

- **実行予算の子プロセス伝播**（実バグ）: これまで予算判定は子プロセス起動「前」だけで、予算末期に起動した子が満額の wall timeout まで走り、センサー本体が dispatcher の timeout で殺されて findings 文書ゼロという最悪劣化があり得た。両バックエンドとも `min(単体wall, 予算残)` を子の timeout に渡し、残 3 秒未満はユニット/プローブを `timeout` skip する。
- **UNREACH_CAP の run 全体共有**（実バグ）: プローブ数カウンタがユニットごとに実質リセットされ、複数ユニットでキャップ超過し得た。カウンタをユニットループ外へ。
- **ir-valid の強制強化 3 件**: (a) enum リテラルは二項比較の兄弟 `ref` 属性に束縛して照合（他属性に同名値があるだけで通る any-enum ショートカットを廃止。v1 ir-valid は出荷済み意味論として現状維持——バックエンドの compile-error skip が防波堤）。(b) int 属性の min/max 欠落をエラー化（著述契約の MANDATORY を機構的に強制。スキーマ側を必須化しないのは契約1 との共有定義バイト同一を守るため）。(c) unit 名が construction ディレクトリに一致しない場合、brRefs ゼロでもエラー（typo で BR カバレッジ検査が丸ごと沈黙する穴を閉鎖）。
- **doctor**: cross-check.json 単独では verified と数えない（実バックエンド文書を要求）。ユニット単位の完了記録（clean と未実行の判別）は契約2 に per-unit checked の語彙が要るためフェーズ③の検討事項として持ち越し。
- 不正 fixture のサマリを実際の planted 欠陥（BR カバレッジ 4 件を含む）と一致させ、新 3 検査の負テストを追加。

## 設計検証拡張フェーズ③（refinement 検査）の設計判断（2026-08-29、v0.4.0）

要件の正典は [issue #2](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/issues/2) と [issue #5（フェーズ③）](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/issues/5)。実装：精緻化写像（契約4、`deep-spec-refinement-map-schema.json`）、`deep-spec-refinement-lib.ts`（写像検証・ᾱ 代入・SMT クエリビルダ・Quint 追加不変条件）、両設計バックエンドへの refinement パス配線、ステージの写像著述ステップ、doctor の refinement-stale。

### アーキテクチャ

- **写像は第一級成果物**（`deep-spec-analysis-refinement-map.md`、単一 json フェンス）。LLM が起案し人間がゲートし、決定論ツールが検証する——IR と同じニューロシンボリック分業を 1 段上へ。方向は標準的データ精緻化：各**要件**属性を**設計**属性上の式（bool/int）または全域 enumMap（enum、合流可）で定義し、ᾱ 代入を機械的にする。
- **発火は既存の formal-model write のまま**：要件 formal model の存在で③が活性化し、写像・要件 IR は同胞読み込み。写像欠如→`absent-input`、ハッシュ乖離→`stale-input`、ユニット項目欠如→`absent-input`——全て明示 skip（無沈黙）。findings 文書は `inputs[]` に 3 成果物（機能モデル・写像・要件モデル）のファイルハッシュを刻む。
- **SMT は v1 の汎用 z3 子プロセス（`--smt-child`）を直接ペイロード起動**：本 lib は SMT-LIB スクリプトを組むだけで、ランタイムフォールバック・予算・model/core 復号プロトコルは v1 のまま。検査：不変条件精緻化 sat(designLegal ∧ ¬ᾱ(P))（過剰報告方向は v1 の completeness-gap と同じ哲学）／enabledness sat(ᾱg ∧ ¬∨designGuards)／イベント 1 ステップ模擬（2 状態スクリプト：設計フレーム込みの完全ステップ ∧ ᾱg(pre) ∧ ¬(f̄ ∧ 要件フレーム)）／シナリオ再生（accept=unsat→core、reject=sat→model）。
- **Quint は ᾱ(P) を追加不変条件としてロワリングに載せた第 2 実行**：違反 trace の帰責成分が要件側なら到達可能な refinement-violation。設計不変条件の到達可能違反が先に出る場合は「マスクされている」と明示 skip（capability、設計 conflict の解消が先）。イベント模擬・enabledness・シナリオ再生は v1 では SMT 専任（capability skip 明記）、③にクロスチェック面は無い。
- **mapping-gap は写像と両 IR の純関数**なので両バックエンド文書に同一内容で載る（質問時に重複排除）。

### Q2 の決着（イベント模擬の抽象フレーム意味論）

要件 effect が代入しない要件属性は ᾱ(a)(pre) == ᾱ(a)(post) を要求する（enumMap 属性は「同じ要件値クラスに属す ⇔」の iff 連言に展開）。写像されていない属性のフレーム等式は検査不能のため課さない（著述ガイドに明記）。

### 検証マトリクス（実測、2026-08-29）

| 対象 | 結果 | 証拠 |
|---|---|---|
| refinement conformance（`tests/refinement.test.ts`、5件） | ✔ | smt/quint/cross-check golden バイト一致＋再実行同一。planted 欠陥全種：**refinement-violation OB-1（静的 model ＋ Quint 到達 trace の両建て）**・SC-2（reject 許容）・enabledness gap（OB-2+TR-2）・mapping-gap（属性閉包）・OB-3 waived（unmapped 台帳の理由文言）。劣化：写像欠如→absent-input×5、ハッシュ改竄→stale-input（乖離側を明記）、ユニット項目欠如→absent-input |
| 自己検証の実効 | ✔ | フェーズ③ kind をスキーマに追加する前の実行で、書き込み側自己検証が文書を unavailable に降格し kind 欠落を検出（是正2 の再発防止が実際に機能）。あわせて設計ツールの stdout も「書かれた文書の真実」を返すよう統一 |
| intent-e2e フェーズ③ブロック（+2件） | ✔ | 実ディスパッチャ経由で ir-valid passed / smt failed（refinement-violation・mapping-gap・inputs 3・OB-3 waived）、doctor が要件再検証後に refinement-stale 行（`--single` 修復コマンド付き） |
| **実サンドボックス実射**（v0.3.0 からのアップグレード） | ✔ | upgrade refresh 28 ファイル→compose、ディスパッチャ実射：SMT＝静的 refinement-violation OB-1・SC-2・enabledness・mapping-gap、**Quint bounded（実 Apalache）＝到達 trace 付き refinement-violation OB-1**（closing/0→closed/0）＋simulation では出なかった deadlock gap も検出、doctor refinement-stale 遷移、検証後は掃除済み |
| リグレッション | ✔ | 全 79 テスト green、v1・①・② golden バイト同一、validator VALID、7 ハーネス全ビルド OK |

### マージ済み PR コメントの完全対応監査（2026-08-29）

全 PR のレビューコメントを再監査：#6=6/6、#7=7/7、#8=0、#9=有効 3 対応＋誤検出 1 検証。唯一の部分対応だった **#7 の 7 件目（doctor のユニット単位判定）を完全対応**：設計バックエンドは検証を実際に完走したユニットを契約2 の `checked[]` に `unit:<name>` として記録し（フェーズ①で導入した check-family 台帳と同じ語彙・targetId の unit: 名前空間）、doctor の verified 判定は「バックエンド JSON の存在」から「非 unavailable なバックエンド文書の checked[] にそのユニットが載っていること」へ厳格化——clean なユニットと一度も走らなかったユニットがファイル単体で区別できるようになった。golden 再生成、e2e に completion-evidence アサーション追加。

## sourceDigest — IR を正確な要件テキストにアンカーする（2026-08-29、v0.5.0）

ギャップ：IR と requirements.md を結ぶ機械的リンクは frRefs の id 逆検証
（id の実在のみ、本文は未検査）と doctor の mtime ヒューリスティックだけ
だった——そして mtime は嘘をつく（git checkout がリセットする・編集後の
touch で編集自体が隠れる）。検証後の要件変更に気づけない可能性があった。
決定：

- **契約1 にトップレベルの任意フィールド `sourceDigest`** を追加——
  requirements.md の生バイトの sha256（hex）。スキーマ上は任意（必須化は
  破壊的メジャー変更で既存モデルを全て無効化する上、フェーズ②の
  コンパイルダウンで生成される契約1 文書は要件ファイルを持たない）。
  **センサーでは必須**：`deep-spec-ir-valid` は欠落・乖離をエラーにし、
  エラーメッセージが再計算した期待値を提示するため修正は機械的
  （エージェントは `shasum -a 256` で計算し、決して記憶から書かない——
  契約4 の irHash アンカーと同じパターン）。
- **doctor の stale 判定をコンテンツベース化**：モデルに digest があれば
  stale ⇔ ハッシュ不一致で、mtime は無視。digest を持たないレガシー
  モデルは従来の mtime フォールバック——遡及ノイズなし。次回の再検証で
  センサーが要求するためアンカーが付与される。
- ステージは Step 2 で digest を刻印し、Step 6 のループクローズの
  書き直しで再刻印する（B 承認改訂は requirements.md を編集するため、
  第 2 パスは必然的に再アンカーになる）。
- conformance golden を再生成：fixture IR にフィールドが加わり埋め込みの
  `irHash` が変わった——期待ファイル 3 つの差分はそれのみ。

### 検証マトリクス（実測、2026-08-29）

| 対象 | 結果 | 証拠 |
|---|---|---|
| conformance（+2件） | ✔ | 乖離ソースを新旧両 digest 明記で拒否・digest 除去を追加すべき正確な値付きで拒否・golden バイト同一 ×2 |
| intent-e2e（+4件） | ✔ | 要件編集後、モデル mtime を 1 時間未来に押し出しても実ディスパッチャがモデルを拒否。doctor はコンテンツのみで verified → stale に遷移し、正確なバイト列の復元で復帰 |
| **実サンドボックス実射** | ✔ | バニラ導入 → feature intent → digest 刻印モデル → ディスパッチャ：ir-valid passed・SMT が planted completeness gap を検出・Quint bounded（実 Apalache）clean・doctor 1/1 verified。ドリフト＋未来日付モデル：ir-valid が新旧 sha256 を明記して failed・doctor stale 0/1。エラー中の digest で restamp → passed・1/1。陳腐化した v0.4.0 composed スキーマはフィールドを拒否（`unexpected property "sourceDigest"`）し、インストーラの upgrade refresh が修復。おまけ：実射中に実際の著述ミス（`prime` を `primed` と誤記）も ir-valid が検出 |
| リグレッション | ✔ | 全 85 テスト green・validator VALID（0 errors）・claude ハーネスビルド OK |

## DDD 移行 PR0 — パリティハーネス・順序証明・アーキテクチャルール（2026-08-29、ロードマップ #12）

tools/ ツリーを Domain Primitive / Always-Valid Domain Model とクリーン
アーキテクチャ（コンテキスト優先 `tools/<context>/{domain,usecase,adapter}/`、
entry はディスパッチャの basename 解決のためフラット維持）へ移行する。
PR0 は安全網のみを導入し、production 変更はゼロ：

- **パリティスナップショット**（`tests/parity/snapshot.ts`）：全 9 センサーを
  全 fixture シナリオへ発火し、観測面の全体——findings ファイルのバイト・
  stdout verdict 行の逐語・exit code——を決定論的ツリーに記録する。PR ごとの
  儀式で base commit のスナップショットと `diff -r` して空を要求する。これは
  golden 15 ファイルより厳密に広い保護（verdict 行と exit code は golden に
  含まれない）。node と pinned quint が無ければ実行を拒否し、劣化環境の出力を
  「正」として記録する事故を防ぐ。
- **パリティ決定論テスト**（`AIDLC_PARITY=1`、opt-in）：同一コミットの
  スナップショット 2 回がバイト同一であること。
- **KIND_RANK 順序証明**（`tests/kind-rank.test.ts`）：v1 の 4-kind 表
  （未知→9）と拡張 11-kind 表（未知→99）を実ソースから正規表現抽出し、
  順序互換を機械証明。移行では統一せず 2 つの順序 VO として保持する
  （バイト安全 ＞ 統一）。
- **アーキテクチャルール**（`tests/architecture/rules.ts`＋テスト）：層 DAG・
  公認 import 集合・entry 限定の `process.*`/`import.meta`・`export *` 禁止・
  テストペイロード禁止を純粋関数化し、**実ツリー適用前にインライン red
  example で検出力を証明**（ルール集の DoD）。現行フラット 13 ファイルは
  縮小専用の LEGACY allowlist に載り、PR10 で空になる。

## DDD 移行 PR1 — kernel/domain 抽出とカバレッジ床（2026-08-29、#14）

最初のレイヤードディレクトリ。`tools/kernel/domain/` に、`deep-spec-lib.ts`
先頭部の純粋関数群（Json/isObject・canonicalStringify・sha256・idCompare/
sortedUnique・extractFences・YAML サブセットパーサ・parseMarkdownTables・
draft-07 サブセット validateSchema・safeTarget・requirementIds・
normalizeName）を逐語移動し、ハウス `Result`（`ok`/`err`/`unreachable`、
コンビネータなし）を新設した。決定：

- **逐語移動・1 ファイル 1 概念・明示列挙の `index.ts` facade**（`export *`
  禁止）。移動コードは元の英語コメントを保持——バイト凍結の移動でコメントを
  書き換えるのは diff ノイズであり、日本語コメント方針は新規・再モデル化
  コードに適用する（本 PR の新規ヘッダは日本語）。
- **`deep-spec-lib.ts` からの再輸出なし**（shim 禁止）：importer 11 ファイル
  とテスト 2 import を同一コミットで直繋ぎ替え。lib には後続 PR で解体する
  残余（契約2 findings 語彙＋ライタ・record-root/relArtifact・CLI 契約）のみ
  が残る。
- **domain 90% カバレッジ床が稼働**：`bunfig.toml` で計測対象をレイヤード
  domain に限定（センサー CLI・レガシー lib・tests は除外——CLI は子プロセス
  実行で in-process 計測に乗らず、golden が実効カバレッジを担う）、CI は
  `bun test --coverage`、ゲートは red 証明済み（threshold 0.999 → exit 1）。
  kernel は新設の逐語文言単体スイートで 99%+——YAML 拒否文言とスキーマ検証の
  キーワード別文言は golden の detail/errors[] に出るため完全一致で固定。
- doctor に kernel canary 行（`tools/kernel/domain/index.ts`）を追加、e2e の
  compose 済みファイル表明にネストパスを追加——tools/ サブディレクトリが
  端から端まで運ばれることのリポジトリ内初の実証。

### PR1 補遺 — CI カバレッジ失敗と二層の原因

初回 push の CI がテスト失敗 0・カバレッジ表 99% のまま fail した。原因は
二層：(1) ローカルの「ゲート通過」測定がパイプ越しに `tail` の exit code を
読んでいた（実はローカルでも fail していた。儀式はパイプなしで exit を測る
よう改めた）。(2) bun の `coverageThreshold` は**ファイル単位**で強制され、
`yaml-subset.ts` が関数カバレッジ 88.89% だった——`class YamlError extends
Error {}` の暗黙コンストラクタを bun が「未実行の関数」として数えるため
（実際は全拒否テストで実行されている）。真に未検査だった分岐（`-` 単独＋
深いネストブロック）のテスト追加と、コンストラクタの明示化（挙動不変・計測
に乗る）で解消。kernel は関数 100% / 行 99.7%。

## DDD 移行 PR2a — deep-spec-lib 解体（2026-08-30、#15）

`deep-spec-lib.ts` を削除した。残余は所有権で分割し逐語移動：

- **refcheck/domain**: 契約2 の refcheck 語彙（RefEntry・Finding・Skipped・
  InputEntry・RefcheckDoc/EmitResult・CATALOG_VERSION）と拡張 11-kind
  カタログ順序（sortFindings/sortSkipped）。型は interface のまま——
  VO 化（render キー順を型が所有する Finding）はセンサーの構築サイトを
  作り替える PR2b で行う。今日のキー順は構築サイトが持っている。
- **refcheck/usecase + adapter**: 最初のポート
  `ReferenceCheckReportRepository` と、その Impl（旧 emitRefcheckDoc を
  逐語内包——自己検証・unavailable 降格・正準描画）。findings スキーマの
  パスは合成ルートから**注入**——層構造のファイルは `import.meta` を
  触らない（コードが LEGACY 免除集合から出たことで、アーキテクチャ
  ルールが実際に強制し始めた）。
- **kernel/adapter**: parseFlags・findRecordRoot/relArtifact・
  readIfExists・`renderVerdictLine`（旧 `verdictOut` の純粋半分。
  `process.stdout.write`＋`process.exit` はセンサー＝合成ルートが所有）。
- 再輸出なし・importer 全直繋ぎ替え・LEGACY allowlist は 1 減（残 12）。
- アーキテクチャルールに**コメント除去**を追加——`process.argv` 等に言及
  する日本語 doc コメントが、実レイヤードアダプタの登場と同時に偽陽性化
  したため（修正と併せて green example を追加）。

### PR2a 補遺 — tombstone：アップグレード先に後方互換の残骸を残さない

オーナールール（2026-08-30）：後方互換コードを残さない。監査で実物の残骸を
1 件検出：compose は no-clobber で、upgrade refresh は「現 dist が出荷して
いる同名ファイル」しか消せないため、廃止ファイル（deep-spec-lib.ts）は
アップグレードされた全インストールに孤児として永久に残る。インストーラに
tombstone リスト（REMOVED_PAYLOADS——ファイル廃止と同じ変更で追記する）を
導入し、アップグレード時に削除する（"upgrade cleanup"）。e2e のアップグレード
シナリオで回帰証明：仕込んだ旧 deep-spec-lib.ts が再インストールで消える。
なお PR2b の再モデル化を待つ interface 群は issue #15 で完了追跡される staged
work であり互換コードではない——判定基準は「同じ目的の第二の口・孤児成果物を
作らない」こと。

## DDD 移行 PR2b-1 — ReferenceCheckReport の真の集約化（2026-08-30、#15）

作業中に 3 つのオーナー裁定が入り、Repository 設計を作り直した：

1. **命令レシート形は CQS 違反として却下**。PR2a の
   `save(outDir, doc, reportOnly): EmitResult`（当時「公認逸脱」と記録）は
   廃止。文書そのものを集約 `ReferenceCheckReport` にした——正準キー順・
   スキーマ自己検証・unavailable 降格は `compose`（唯一の新規構築口。降格が
   仕様の一部なので失敗しない）の**構築時に完結**する Always-Valid。verdict
   述語 `passes()` も型が所有するクエリで、stdout verdict は集約から導出
   されるため「ファイルと矛盾しない」性質は保存。
2. **ポートごとの固有エラー型を作らない**。Repository は kernel 共有の
   `RepositoryError`（not-found / io-failed / corrupt の閉じた 3 変種、
   材料のみ）を話す。不在は null でなくエラー変種。
3. **Repository は集約の I/O 責務＝永続化と再構成の対**。ポートは
   `findById(aggregateId): Result<ReferenceCheckReport, RepositoryError>` と
   `save(report): Result<void, RepositoryError>` の対で、識別 VO
   `ReferenceCheckReportId`（directory＋backend）だけから実装がパスを導出。
   `reconstitute` は書かれた真実からの再構成（書込時に自己検証済みのため
   最小限の構造検査のみ）。

`report-doc.ts`（RefcheckDoc/EmitResult）は削除——互換残骸なし。契約テストは
実 Impl を tmpdir で走らせ、save→findById のバイト往復同一・not-found・
corrupt・backend 不一致破損を固定。カバレッジゲートの憲章（per-file 90% は
domain 層）を bunfig に明文化し、adapter/usecase は契約・spawn スイートが
検証する。同じレシート形が残る legacy design-lib のライタは PR5 の解体で
同様に処置する。

### PR2b-1 補遺 — 追加裁定 2 件：RepositoryError の配置と Json の追放

- **RepositoryError は use-case 層**（アウトプットポートの一部）に置く。
  Repository は本来ドメインの責務とされるが、ドメイン層に置くとドメイン
  オブジェクト内部から Repository を使うリスクが生まれるため、Repository の
  語彙ごとドメインから遠ざける（`kernel/usecase`）。
- **Json はユビキタス言語ではない**。直列化形式——`Json` ユニオン・正準 JSON・
  JSON Schema 検証器・YAML サブセット/markdown パーサ——はインターフェイス
  アダプタ層の知識であり、`kernel/domain` から追放した（domain に残るのは
  Result・sha256・id 順序・target サニタイズ・要件 id 抽出・名前正規化のみ）。
  集約は型付き語彙だけを話し、新設の adapter serializer が描画（正準キー順・
  irHash）・契約適合（`conformToContract`——凍結文言で集約を降格させ、verdict
  が「書かれるもの」から導出される性質を維持）・再構成用の文書解体を持つ。
  降格文言は emitter（adapter）が組み、ドメインは値として保持する。

## DDD 移行 PR2b-2 — refcheck センサーのレイヤード縦割り化（2026-08-30、#15）

refcheck 3 センサーを完全なクリーンアーキテクチャ縦割りにした。Json 追放
裁定が分割線を決めた：**解析はアダプタ、検査は型付きモデル上のドメイン**。

- **refcheck/adapter のパーサ群**が形式歩きを全所有：コンポーネント
  カタログ・units エッジブロック・contracts テーブル行・spec ブロック評定・
  entities/rules モデル・mermaid 状態機械スケッチ・XS 用 domain エンティティ・
  兄弟ユニット索引。各々が型付き outcome ユニオン（wrong-fence-count /
  unparseable / extracted …）を返し、解析失敗は文字列でなくデータとして
  ドメインに届く。
- **refcheck/domain の検査**（DD/CD/FD/XS）は新設 **CheckFamilyLedger** を
  通じた純検査——`detail.split(":")[0]` による family 復元の型置換：family は
  フィールドで運ばれ、凍結描画（`"<family>: …"`・`check:<family>`）と
  checked[] 導出を台帳自身が行う。AttrDecl は旧生 Json フィールドを検査が
  区別する意味論（宣言有無・数値・文字列 default）へ無損失に写した。
- **ユースケースは純粋なアプリケーション操作**：検査実行・凍結された取得
  規則下の inputs 記録（requirements は rules が使えたときだけ・兄弟は
  カタログが解析できたときだけ・自ユニット entities は二重記録しない）・
  集約の compose。**entry は配線パイプライン**（取得→解析→実行→適合→保存→
  verdict）：390/249/753 行 → 82/88/約130 行。
- **in-process golden 同値**：新スイートがレイヤード全経路を子プロセスなしで
  broken/clean fixture に走らせ golden とバイト比較——同一バイトへの独立経路が
  2 本になり、カバレッジ床は実分岐カバレッジで成立（refcheck/domain は検査
  モジュール行 100%・関数 93%+）。

## Interactor 裁定 — ユースケースは Repository を保持し、execute は識別を受ける（2026-08-30、#16）

移行の途中で恒久裁定が下った：**ユースケースはコンストラクタ注入で
Repository を保持し、`execute` は識別（ID・値オブジェクト）だけを受けて
内部で集約を解決してからビジネスロジックを起動する。** 以前の形——entry が
取得・パースまで済ませ、型付き入力を「純粋な」ユースケースに渡す——は
アプリケーションの仕事を合成ルートに置くもので、却下された。

- refcheck の 3 ユースケースを interactor として再構築
  （`ctor(designRecords, reports)`・`execute({artifactPath,
  reportDirectory, reportOnly})`）。新しい **DesignRecord** 集約が検査対象
  成果物と随伴文書の型付きスナップショットで、**DesignRecordRepository**
  が凍結取得規則（rules が使えたときだけ requirements、カタログが解けた
  ときだけ兄弟、自ユニットの entities は二重記録しない）で解決する。
- **ReferenceCheckReportRepository** に `conformedOf` を追加——「この
  Repository は契約不適合の文書を決して書かない」という不変条件のクエリ面。
  `save` は内部で適合させ、verdict は conformed な集約から導くため、
  stdout とファイルは構造的に矛盾できない。
- entry は純配線（flags → basename ゲート → Impl 構築 → execute → 閉じた
  **CheckOutcome** ユニオンの switch）へ縮み、`tests/doubles/` の InMemory
  Repository だけで interactor が動くことをユースケーステストが証明する。

## DDD 移行 PR3 — verify-smt が requirements の縦割りになる（2026-08-30、#16）

バイトリスク最高のセンサー（1,136 行：寛容 IR パース・SMT-LIB コンパイラ・
z3 子プロトコル・unsat core 解釈・クロスチェック）が、interactor 形の
requirements コンテキスト縦割りになった。base↔head パリティスナップショットの
diff は空、golden は無変更。

- **requirements/domain** が意味を所有：`RequirementsModel`（型付き
  義務/シナリオ/属性の集約）、`VerificationReport`（`compose` が正準
  ソートを適用する v1 集約）、4-kind 順位表（11-kind 表と統一しない独立
  VO のまま）、降格ファクトリ（ir-unreadable / version-mismatch /
  solver-unavailable、凍結文言つき）、`interpretSmtVerdicts`（大域一貫性・
  前件空虚・イベント対・ギャップ・シナリオ——全 detail 文字列を逐語所有）、
  `crossCheckReport`（兄弟文書間のシナリオ判定合意）。
- **requirements/adapter** が形式を所有：寛容 IR パーサと irHash 導出
  （`FormalModelRepositoryImpl`）、SMT-LIB 計画ビルダ（`smtVar`/`smtName`/
  `enumCode`/`smtOf` 逐語、仮定間接化、形式を含まない `SmtPlanFacts` を
  返す）、z3 子エンジン（`solveSmtChild`——refinement-lib も spawn する
  凍結 stdin/stdout プロトコル）、ソルバクライアント（node 優先 spawn、
  stderr 200 字尾つき v1 attempt 文言、witness モデルはドメインに届く前に
  decode）、v1 レポート serializer/Repository（`findAllByDirectory` ＝
  クロスチェックの取得規則）。
- **entry** は配線と描画のみ：env 読取（`AIDLC_DEEP_SPEC_SMT_TIMEOUT_MS`・
  `AIDLC_DEEP_SPEC_SMT_RUNTIME`）、自パス、スキーマパス、凍結 verdict 行
  4 形（v1 の NA は `skipped_count` を持たない）、ソルバ実行不能時の
  exit 127。
- **証明**：in-process golden スイートが実 Impl（実 z3 子）で interactor を
  駆動して `smt.json` と収束後の `cross-check.json` をバイト一致で照合。
  requirements/domain はカバレッジ 100%。kiro ハーネスの実 sandbox で
  z3 なし降格（dispatcher `tool-unavailable`）と golden 同一の検証成立の
  両経路を再現し、doctor は 0 errors。
- Issue #28（負荷時の稀な z3 witness 非決定性）は設計上オープンのまま：
  決定化オプションは golden バイトを変えるため、この移行では禁じ手。

## DDD 移行 PR4 — verify-quint が requirements 縦割りへ解体（2026-08-30、#17）

第二の v1 バックエンドが 1,154 行の自己完結コピーを失い、interactor 形で
requirements コンテキストに合流した。バイト同一の重複（寛容 IR パース・
正準ソート表・findings 文書ライタ・クロスチェック再計算）はすべて削除し、
PR3 が確立したモジュールを再利用する。base↔head パリティスナップショットの
diff は空、golden は無変更。

- **共有の背骨をそのまま再利用**：`FormalModelRepository`・
  `VerificationReport`＋Repository（適合 save）・`crossCheckReport`・
  4-kind 順位 VO。バックエンド非依存の降格 2 種（ir-unreadable・
  version-mismatch）は明示 `method` 引数つきで
  `verification-degradation.ts` へ——quint はこれらの経路で
  `"simulation"`、smt は `"exhaustive"` を凍結する。`smt-degradation.ts` /
  `quint-degradation.ts` にはバックエンド固有語彙だけが残る
  （`z3 could not be executed` と `quint CLI missing`、および quint の
  machine-uncompilable＝**検出済み** method 下での全対象 compile-error
  文書）。
- **requirements/domain** が quint の意味を獲得：`evaluateExpression`
  （帰属評価のための寛容純評価）、decode 済み `TraceState` 語彙
  （witness ユニオンが `{trace}` を持つ）、`QuintMachineFacts`、
  `interpretQuintVerdicts`——3 フェーズ（機械不変量：デッドロックと違反
  成分帰属、leads-to 時相：蓄積 skip ガード、全属性束縛シナリオ判定）を
  detail 文字列逐語で所有。
- **requirements/adapter** が quint の形式を獲得：モジュールコンパイラ
  （生成テキスト逐語。**CQS 修正**——旧 `compileMachine` は引数の
  `skipped[]` を破壊していたが、新コンパイラはコンパイル時 skip を
  戻り値で返す）、ITF デコーダ、`QuintClientImpl`（probe・java/Apalache
  の method 検出・tmpdir 編成・凍結 seed/予算/タイムアウト定数・型付き
  判定写像）。env 読取（`AIDLC_DEEP_SPEC_QUINT_BIN`・
  `AIDLC_DEEP_SPEC_QUINT_METHOD`・`APALACHE_DIST`・`HOME`）は entry へ。
- **意図的な非観測逸脱**（記録済み・パリティと 5 レンズ敵対的レビューで
  検証済み）：from/to がモジュールへコンパイルされなかった leads-to
  義務の時相実行は spawn しない（旧実装は無駄に実行していた——出力は
  同一）、死んだ `QuintRun.ok` / `temporalIds` フィールドは削除、
  そして退化入力（義務 id / シナリオ id の重複 IR）ではクライアントが
  一意 id ごとに 1 回 spawn する（旧実装は IR エントリごと。解釈が
  エントリごとに同一判定を再生するため、決定論実行の文書バイトは同一）。
  レビューは裁定済みの「verdict は conformed（書かれた姿）から導出」も
  再確認し、実在した挙動差 1 件を修正させた：モデル Repository が旧
  `existsSync` ゲートを正確に再現する（stat できないパス——例：親
  ディレクトリの権限拒否——は not-applicable / exit 0 であり I/O エラー
  ではない）。
- **証明**：in-process golden スイートが実 Impl（実 quint CLI・seeded
  simulation）で interactor を駆動して `quint.json` と収束後の
  `cross-check.json` をバイト一致で照合。requirements/domain は
  per-file カバレッジ 100% を維持。kind-rank 証明は単一の共有 v1 表を
  固定。実 sandbox で CLI なし降格（dispatcher `tool-unavailable`・
  凍結文書）と golden 同一の seeded 実行を再現し doctor 0 errors。
  マージ前に 5 レンズの敵対的レビュー Workflow で新旧のバイトドリフトを
  照合した。

## インフラストラクチャ裁定 — 言語拡張基盤は独立の層を持つ（2026-08-30）

PR5 の途中で恒久裁定が 2 つ下り、即座にリポジトリ全体へ適用した：

- **`Result` はユビキタス言語ではない。** 言語を拡張する技術基盤
  （手巻き `Result`/`ok`/`err`/`unreachable`）は新設の最内層
  `kernel/infrastructure` に置く。この層は何にも依存しない（`node:*` も
  不可）が、他のすべての層から到達できる。Onion の外殻ではないことが
  要点：**RPC クライアントと永続化はインターフェイスアダプタ層の
  ゲートウェイ責務のまま**であり、決して infrastructure に置かない。
  アーキテクチャルールは両方向（infrastructure は上位を import しない・
  層内の `node:` import は違反）を red example つきで強制する。
- **Repository 実装は必ずポート interface を implements する。**
  すべての `XxxRepositoryImpl` / `XxxClientImpl` は use-case 層のポート
  に対して `implements` を宣言する——design コンテキストは Impl が
  生まれた瞬間に `design/usecase` ポート（`DesignModelRepository`・
  `DesignReportRepository`・`SiblingBackendClient`）を得た（後の PR
  送りにしない）。ポートは domain 語彙だけを話す：兄弟バックエンドの
  ポートは型付き lowering を受けて型付き判定面を返し、契約1 直列化・
  ITF の知識は Impl 内に留まる。

## DDD 移行 PR5 — design-lib が design 縦割りへ解体（2026-08-30、#18）

821 行の design-lib を削除（インストーラで tombstone 化）し、2 つの
design-verify センサーは `design/{domain,usecase,adapter}` の上で動く。
`Expression` ツリーは契約共有語彙として `kernel/domain` へ移動
（requirements の import は直繋ぎ替え——互換再輸出なし）。base↔head
パリティ diff は空、golden は無変更。

- **design/domain** が意味を所有：`DesignModel`/`DesignUnit` 集約
  （ユニット順序は compose の不変条件・`allTargets`/`enumValuesOf` は
  クエリ）、型付き lowering（`lowerUnit`——OB/SC/BG 採番・合成
  vacuity/shadow トートロジー・台帳 map）、`expressionCanonicalKey`
  （kernel 正準 JSON とバイト同一——テストが機械証明）、`remapUnitDoc`
  （unreachable/redundancy 変換・相互包摂の畳み込み・deterministic:false
  waiver・OB-n の detail/core 書き換え——文言逐語）、`DesignReport` 集約
  （inputs/checked ソートも compose の不変条件）、11-kind 順位 VO、設計
  クロスチェック、降格ファクトリ群。
- **design/adapter** が形式を所有：寛容な契約3 パーサ、モデル Repository
  （旧 `existsSync` ゲート再現）、lowered 文書 serializer、兄弟
  バックエンドクライアント（wrapper 文言と spawn 契約は凍結・toolsDir/
  cwd は注入・決定論テスト用の任意 spawn 環境オーバーレイ——entry は
  未指定で旧来の継承のまま）、兄弟判定パーサ、到達性プローブ（変種＋
  到達判定）、design-report serializer/Repository。
- **entry はあと 1 PR だけ編成役**：Phase 3（refinement）は legacy の
  refinement-lib を entry からのみ逐語で呼び、design センサーの
  interactor 化は refinement 解体と同時に PR6 で行う。refinement-lib は
  新 `DesignUnit` クラス API（フィールド → クエリ）と kernel/design
  import へ橋渡し済み。design-ir-valid は design-lib からの 2 つの小
  import をインライン化した。
- **証明**：新しい in-process スイートが実 v1 兄弟 spawn 越しに設計
  golden（smt＋quint＋収束後 cross-check）を再現。design/domain は
  per-file 90% 床を保持（ほぼ 100%）。kind-rank 証明は設計順位 VO を
  読む。実 sandbox のアップグレードで tombstone が design-lib を除去し、
  design ツリーが運搬され、quint 設計 golden を再現、doctor 0 errors。

## DDD 移行 PR6 — refinement-lib 解体・design センサーの interactor 化（2026-08-30、#19）

最後の共有 lib（1,109 行）を削除（tombstone 化）し、2 つの design-verify
センサーは完全な interactor になった。base↔head パリティ diff は空・golden
無変更・refinement E2E スイートはレイヤード化後の初回実行で green。

- **refinement/domain**（意図して adapter を持たないコンテキスト——I/O は
  design のポート群の背後に居る）：閉じた `AttributeMapping` ユニオン
  （expression / enum-cases / スキーマ到達不能の `unspecified` 素通し形——
  唯一の意図的逸脱：旧実装はここで TypeError 落ち、新実装は材料のみの
  AlphaError）を持つ `RefinementMap` 集約、`RefinementRequirements`
  （契約1 の refinement プロファイルビュー）、alpha 置換、
  `planUnitRefinement`（閉包規則と全 mapping-gap 文言逐語）、設計イベント
  カタログ、バックエンド別の status-skip 語彙 2 種、
  `interpretRefinementVerdicts`（4 プローブ種の凍結文言）、Quint extras。
- **design/usecase**：`Clock` ポート消費（予算制御はフロー——時計は kernel
  ポート＋`SystemClock` アダプタ）、`RefinementContextRepository` ポート
  （レコードルート歩行・契約4 map 読込の凍結エラー 4 種・3 成果物の inputs
  台帳）、`RefinementSolverClient` ポート、そして interactor 2 本
  `VerifyDesignSmtUseCase` / `VerifyDesignQuintUseCase`——Phase 1-3・予算・
  プローブ・masked-capability の全ロジックが entry から出て、entry は純粋な
  合成ルートになった。
- **design/adapter**：**明示的な第 2 SMT コンパイラ**（v1 計画ビルダとは
  意図して統一しない——PR8 判断点）と、refinement プロファイルの attempt
  文言（stderr 尾なし——v1 と別の凍結プロファイル）を持つソルバクライアント。
- **PR8 の安全網**：両コンパイラの SMT-LIB スクリプトをキャラクタライゼー
  ションスイートが逐語固定（`tests/fixtures/smt-scripts/`）——将来の統一は
  このバイトを保つことが条件。
- **証明**：in-process golden スイートが実 Impl（実 v1 兄弟・実 z3 子）で
  両 interactor を Phase 3 込みで駆動し、refinement golden 3 本をバイト一致
  で照合。refinement/domain は 90% 床（ほぼ 100%）。実 sandbox アップグレード
  で tombstone が refinement-lib を除去し、3 golden を再現、doctor 0 errors。
  この PR でアーキテクチャルールの LEGACY 集合は entry のみ——**legacy
  ライブラリは残っていない**。

## DDD 移行 PR7 — IR バリデータ 2 本の interactor 化・kernel 重複の解消（2026-08-30、#20）

契約バリデータ 2 本（ir-valid 460 行・design-ir-valid 348 行）が層化された
ユースケース上の合成ルートになり、kernel ヘルパのローカル複製が消えた。
base↔head パリティ diff は空、golden は無変更。

- **keep-both fallback は不要だった。** issue #20 は手順の最初に「ir-valid の
  ローカル `validateSchema` と kernel 版の文言 diff」を要求していた——error
  文字列は観測面（intent-e2e が表明する ir-valid の `errors[]`）だからである。
  両者は `export` キーワード以外バイト同一で、12 種のエラー文言も完全一致
  したため、ローカル複製は保持せず削除した。`requirementIds` も同じくバイト
  同一。`extractJsonFences` は `extractFences(md, "json")` の body 射影と等価。
  ローカル `parseFlags` は kernel 版から未使用の `--report-only` を欠いた形。
- **`walkExpression` を kernel/domain へ。** 両バリデータが共有 `Expression`
  語彙に対する同一の前順走査を各自に持っていた。
- **requirements/domain**：`modelWellFormednessErrors`（id 一意性・参照解決・
  enum 所属・prime 合法性——文言と発生順序を逐語保存）、`FrReferenceIndex`
  （frRef 逆索引と未存在参照の整列報告）、`SourceAnchor`（宣言値と実測値の
  照合、凍結文言 2 種）。
- **design/domain**：`designWellFormednessErrors`（ユニット内 id 名前空間・
  兄弟束縛つき enum 規則・状態機械の整合・BR カバレッジ）と
  `BrReferenceIndex`。
- **ドメインは `Json` を見られない。** 層方向は domain → kernel/adapter を
  禁じ、直列化形式はアダプタの知識という裁定も生きている。よって生 Json の
  寛容な走査——「どのエントリを黙って落とすか」を決める `isObject` /
  `typeof` ガードのすべて——はアダプタへ移し、ドメインへは型付きビュー
  （`IrModelView` / `DesignUnitView`）を渡す形にした。既存の契約1 パーサは
  **再利用できない**：`type` が壊れた属性を落とすが、ir-valid は `kind: ""`
  で登録する——参照解決の可否が変わる差である。
- **ダイジェストはバイトのダイジェストのまま。** `sourceDigest` は
  requirements.md の**バイト列**を hash する。kernel の `sha256(text)` は
  文字列を UTF-8 で符号化し直すため、不正な UTF-8 を含むファイルで結果が
  ずれる。アダプタは Buffer に対する `createHash` を維持し、理由を呼び出し
  地点に記録した。
- **レビュー修正（ゲート復元）**：design 材料ゲートウェイは当初、unit view
  の構築（per-unit の `existsSync` と rules.md 読み込みを含む）を無条件に
  行っていたが、レガシー main は「バージョン一致かつスキーマ妥当」のとき
  だけ `semanticErrors` を呼んでいた。アダプタにゲートを復元：unit view と
  その I/O はレガシーの errors 空条件下でのみ組まれ、スキーマの
  `^[a-z0-9][a-z0-9-]{0,63}$` 制約を通過していないユニット名がファイル
  システムのパスへ join されることはない（レガシーの I/O プロファイルと
  経路制限の保存）。
- **証明**：新しい in-process スイートが実 Impl で両 interactor を駆動し、
  描画した verdict 行が実センサーの stdout とバイト一致することを全シナリオ
  （正常・各仕込み欠陥・ダイジェストのドリフト・requirements 不在・
  fence/JSON/スキーマの失敗・バージョン不一致・pass-through）で表明する。
  well-formedness 2 モジュールは行カバレッジ 100%。base↔head パリティ
  スナップショットの `diff -r` は 45 ファイルで空。実 sandbox アップグレード
  で両ツリーが転送され、正常系の pass と全仕込み欠陥を再現、doctor 0 errors。

## Repository 裁定 — Repository は集約自身の ID で解決する（2026-08-30）

PR7 レビュー中にオーナー裁定が下り、即時適用した：**Repository の解決
メソッドは、解決対象の集約の識別子を受け取る——別成果物の識別子を受けて
内部で導出してはならない。識別子の値がパスであることは問題ないが、あくまで
その集約の ID として型付け・概念化されていなければならない。**

- 指摘された違反：`RequirementsSourceRepository.resolve(outputPath)` は
  **形式モデル成果物の**パスを受け取り、要件ソースの恒等（記録ルート、
  3 階層上）を Impl 内部で導出していた——別集約の識別子による解決。
- 修正：新しい `RequirementsSourceId` 値オブジェクト（requirements/domain）
  が記録ルートを運ぶ。要件ソースは 1 インテント記録に 1 つであり、記録こそが
  恒等である。requirements.md がどのフェーズ配下に物理配置されているかは
  Repository の解決詳細に留まる。検証対象成果物のパスからの導出はパス配置の
  知識なのでアダプタの仕事：材料ゲートウェイが取得時に `sourceId` を
  `IrValidationMaterials` へ刻印し、use case はその ID を `resolve` へ渡す。
- パラメータが解決対象集約自身の成果物パスであるポート（形式モデル／設計
  モデルの `findByPath`）は「値はパスでよい」条項を既に満たす。これらの
  恒等の型付けはクローズアウトで整合を取る追補として記録する。

## Repository 裁定・補遺 — findById が正引きの主経路、Input は値オブジェクトを運ぶ（2026-08-30）

PR7 マージ直後にオーナー裁定がさらに 2 つ下り、一括でリポジトリ全体へ
適用した：

1. **Repository の解決は `findById(aggregateId)`。** 逆引きしか無い
   （`findByArtifact(artifactPath)`・`findByPath(modelPath)`・
   `findByModelPath`）ということは、集約の ID が設計の中で何の役にも
   立っていない——恒等がモデリングされていないということである。全解決
   ポートは型付き集約 ID による正引きになった：`DesignRecordId`
   （refcheck）、`FormalModelId`（requirements）、`DesignModelId`
   （design）、そして `RefinementContextId`（`ofModel` による設計モデル
   への 1:1 錨着——錨着が型に現れる）。PR7 期の
   `RequirementsSourceRepository.resolve` は `findById` に改名し、
   バリデータ 2 本の材料ゲートウェイもモデル ID で取得する。
2. **ユースケース Input のボディは値オブジェクトを運び、基本データ型を
   使わない。** `ArtifactPath.parse(raw): Result<ArtifactPath,
   ArtifactPathError>`（kernel/domain）が境界の唯一の構築口：entry は
   `--output-path` を一度だけ parse し——parse の失敗こそが旧
   「--output-path is required」分岐である——その値はユースケースを
   通る間、二度と基本データ型へ戻らない。Input は
   `{ modelId, verifyDirectory: ArtifactPath }` /
   `{ recordId, reportDirectory: ArtifactPath, mode }` になり、
   `reportOnly: boolean` は閉じた語彙 `CheckExecutionMode =
   "persist" | "report-only"` へ、レポート ID 3 種の directory 半分と
   `findAllByDirectory` は `ArtifactPath` を受ける。基本データ型が
   生き残るのは正確に 2 箇所——entry が parse する前の生 flags と、
   アダプタの fs 境界（join/read/mkdir での `value()`——境界と注記した
   公認の外向き横断）だけである。

証明：base↔head パリティスナップショットの `diff -r` は PR7 以前の
base に対して空（45 ファイル）。296 tests green。新 VO は全て行カバレッジ
100%。golden 無変更。

## ドメインプリミティブ・カタログ — parse/reconstitute の二面性、2 種を即時・6 種を凍結封鎖（2026-08-30）

オーナーから「ドメインプリミティブも徹底していない」の裁定：ユビキタス
言語の制約付き値が生 string のまま集約を流れていた。値ごとに監査し、
集約のイディオムを DP へ拡張した——**`parse` が境界の strict な構築口
（Result・材料のみエラー）、`reconstitute` が凍結文書の逐語再水和専用の
口**。集約が既に持っていた compose / reconstitute の二面性そのもので、
バイト凍結された寛容読みはアダプタに残り、parse 経路は Always-Valid に
なる。

即時適用（今日すでに実の生成・解釈セマンティクスを持つ 2 種）：

- **`ContentHash`**（kernel）——`^[0-9a-f]{64}$`。`sha256()` がこれを
  返し、`ofText`/`ofBytes` が計算側の生成口。`AcquiredFormalModel` /
  `AcquiredDesignModel` の irHash、両レポート集約、`InputAnchor` /
  `DesignInputAnchor` の sha256、`SourceAnchor` の実測辺、
  `RefinementMap` の 二重アンカーと陳腐化比較（string の `!==` を
  `equals` へ）まで縦貫。serializer は描画バイトで `value()` へ落とし、
  再構成は逐語の口を使う。
- **`IrVersion`**（kernel）——semver。strict な invariant は両モデル
  パーサに既に存在した（`IR lacks a semver irVersion`）ため、
  `RequirementsModel` / `DesignModel` は Always-Valid にこれを保持し、
  `majorVersion` / `supportsMajor` は本来の居場所である DP へ移った。
  レポート再構成は凍結された "" 許容を `reconstitute` で保存（major は
  legacy と同じ NaN）。

凍結封鎖（PR10 が意図的に解除するための台帳）：残る 6 候補には今日
strict な生成経路が存在しない——全値がバイト凍結された寛容取り込みから
入るため、`parse` は死にコードになり DP は純粋な儀式になる。
`UnitName`（スキーマパターンは存在するがユニットは寛容モデルパーサ
経由でしか到来しない）、`RequirementId` / `BusinessRuleId`（frRefs /
brRefs は文書から到来；抽出集合は regex 保証だが照合相手は生の文書側
主張）、`VerificationMethod`（内部は bounded/simulation に閉じるが
レポート再構成が任意文字列を許す）、`BackendName`（兄弟再構成が
ファイル名から導出する）、`AttributePath`（式のパスはまさに
well-formedness が parse で拒否せず**報告**すべき対象）。PR10 の凍結
解除時に golden 再生成とともに変換する。

同じレビューで命名の裁定も入った：`InputEntry` / `DesignInputEntry` は
ユビキタス言語ではない（「entry＝台帳行」は技術語）。概念は入力成果物の
**内容による錨着**——`SourceAnchor` と同じ語彙——であるため、`InputAnchor`
（refcheck）と `DesignInputAnchor`（design）へ改名した。語はコンテキスト
ごとに所有する。

証明：296+12 tests green。両 DP は行カバレッジ 100%。パリティ
スナップショットは PR7 以前の base に対し `diff -r` 空。実 sandbox の
z3 実行が `smt.json` を golden とバイト一致で再現。

## 集約恒等の裁定 — エンティティと集約は必ず自分の ID を運ぶ（2026-08-30）

オーナー裁定：ID を持たないエンティティ・集約は許容できない。監査の結果、
PR #40 の型付き集約 ID は解決には使われていたが、解決された集約自身が
それを**運んでいなかった**——Repository が `findById(id)` に答えるのに、
返る集約は自分の恒等を知らない片手落ちだった。

- `RequirementsModel` は `FormalModelId` を、`DesignModel` は
  `DesignModelId` を、`DesignRecord` は `DesignRecordId` を保持する。
  注入は Repository が `findById` の引数から行う（パーサは文書の中身しか
  知らず、恒等を知らない）。
- `RefinementMap` は新設の `RefinementMapId`（契約4 map 成果物——1 記録に
  1 つ）を、`RefinementRequirements` は `FormalModelId` を保持する。
  プロファイルは恒等を変えないため、契約1 集約の ID を refinement の
  facade から再輸出した（層規律：design/adapter→requirements/domain は
  禁止辺、design/adapter→refinement/domain は許可辺）。
- `DesignModel` 内のエンティティ `DesignUnit` は `id(): DesignUnitId` を
  得た（恒等はユニット名。名前の正当性検証は凍結封鎖中の `UnitName` DP の
  責務で、ID の責務ではない）。`RefinementMap.unitMapOf` は生文字列でなく
  型付き ID を受ける。
- インターフェイスのエンティティ（`Obligation`・`Scenario`・機械・遷移）は
  `id` フィールドを既に持つ。それら安定 ID の型付けは凍結封鎖中の
  `RequirementId` / `BusinessRuleId` の話である。

同 PR のレビューラウンド：本カタログの型付け一覧に残っていた旧名
`InputEntry` を修正（CodeRabbit）。`IrVersion.parse` が先行ゼロを受理する
のはレガシーパーサの凍結パターン `/^\d+\.\d+\.\d+$/` の逐語であることを
確認——厳密 SemVer 化は旧実装が受理した IR を拒否する観測面の変更になる
ため、テストで固定し PR10 の解除へ送った。

証明：304 tests green。パリティスナップショットは PR7 以前の base に対し
`diff -r` 空。golden 無変更。新設の id アクセサは全て 90% 床の上で被覆。

## 語彙プリミティブの裁定 — ドメインインターフェイスの非 bool 値は DP にする（2026-08-30）

同じレビューセッションでさらに 2 つの裁定が下り、適用した：

1. **ポートを保持するフィールドは役割の名で呼ぶ。** `#designRecords` /
   `#reports` は保持物を隠していた。ポートを保持する全ユースケースの
   フィールドとコンストラクタ引数はポート名を冠する
   （`#designRecordRepository`・`#referenceCheckReportRepository`・
   `#formalModelRepository`・`#verificationReportRepository`・
   `#z3SolverClient`・`#quintClient`・`#designModelRepository`・
   `#designReportRepository`・`#siblingBackendClient`・
   `#refinementContextRepository`・`#refinementSolverClient`・
   `#irValidationMaterialsRepository`・`#requirementsSourceRepository`・
   `#designIrValidationMaterialsRepository`）。
2. **ドメインインターフェイスの非 bool フィールドはドメインプリミティブ**
   ——凍結封鎖の判断は棄却された：`reconstitute` の口があるため、strict な
   `parse` 経路に生成者がまだ無くても DP 化は凍結と両立する。まず引用された
   実例とそのクラスタ全体へ適用：functional-design 語彙（`AttrDecl`・
   `RelDecl`・`EntityDecl`・`RuleDecl`・`StateMachineSketch`・
   `DomainEntitySketch`・兄弟索引）は `EntityName`・`AttributeName`・
   `ElementPath`・`TypeName`・`AllowedValue`・`AttributeDefault`・
   `NumericBound`・`CardinalityNotation`・`BusinessRuleId`・
   `RuleCategory`・`AppliesTo`・`SourceId`・`MachineSpec`・`StateName`・
   `ComponentName`・`ReferenceTarget` を話す。各 DP は照合・描画の解釈語彙
   （ケース／アンダースコア正規化・BR 形・基数トークン畳み込み・spec 分解・
   既定値描画）を所有し、検査は意味論として読める一方、凍結文言は全て
   バイト同一に保たれる。bool（宣言フラグ）と文言材料（detail・unsupported
   理由・欠落キー名列）は裁定自身の除外により素のまま。行番号・件数の
   メタデータは明示裁定があるまで number のまま。

証明：305+ tests green。語彙ファイルは行カバレッジ 100%。golden 無変更。
パリティスナップショットは PR7 以前の base に対し `diff -r` 空のまま
（refcheck シナリオがこれらの文言を濃密に通す）。

## Tell-Don't-Ask 裁定 — ドメインオブジェクトは抽象データ型であり、データ構造ではない（2026-08-30）

オーナー裁定：貧血ドメインモデルは許容できない。プロパティしか持たない
ドメイン interface は振る舞いが外へ逃げた証拠であり、呼び手は皆
**尋ねて**（データを取り出し外で判断して）いる。ドメインオブジェクトは
複雑なドメイン知識を狭い面の内側に閉じ込めるべし。

まず指摘の震源である functional-design クラスタへ適用：プロパティ袋
7 型は振る舞いを持つクラスになり、逃げていた述語が家に帰った——

- `AttrDecl` は自分の整合を自分で判定する：FD-E2 の型クラス衝突
  （`declaresAllowedValuesOnNonEnumerableType`・
  `declaresBoundsOnNonNumericType`・`declaresUniqueOnCollectionType`）、
  FD-E3 の範囲・既定値整合（`boundsInverted`・`defaultBelowMin`/
  `defaultAboveMax`・`defaultOutsideAllowed`）、ライフサイクル候補性、
  FD-S の図差分（`rogueDiagramStates`・`allowedValuesAbsentFrom`）。
  型クラス集合は `TypeName`（`classifiesNumeric`/`Date`/`Bool`/
  `Collection`）へ、基数の閉集合は `CardinalityNotation.isInClosedSet`
  へ、category の閉集合は `RuleCategory.isKnownCategory` へ移った。
- `EntityDecl` は `duplicateAttrDecls`・`lifecycleAttr`（旧自由関数は
  この中で死んだ）・`attrNamed` を所有。`DeclaredEntities` は
  `duplicateEntityDecls`・`allRels`・`containsEntityNamed`・FD-E6 の
  `resolvesReference`・FD-R4 の `resolvesAppliesTo`・
  `entityByNormalizedName`・`lifecycleEntities` を所有。`RuleDecl` は
  `findingTarget`（5 連の BR 形三項演算子はこの中で死んだ）・
  `sourceIdValuesMissingFrom`・`categoryOutsideClosedSet` を所有。
  `StateMachineSketch` は凍結書式の `locationLabel` を、
  `DomainEntitySketch` は `catalogLabel` と `attributesDroppedIn` を所有。
- 検査ランナーは純粋なコーディネータになった：巡回し、宣言に違反を
  **告げさせ**、凍結文言を描画するだけ。書式は境界アクセサに残るため
  全文言はバイト同一（golden 無変更とパリティ空 diff で実証）。
- 族内の finding 発行順は変わった（重複が集合メソッド由来になったため）
  が、レポート集約の compose が正準ソートを所有するため観測不能——
  golden が確認している。
