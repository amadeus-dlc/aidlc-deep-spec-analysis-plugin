# deep-spec-analysis — 設計判断記録

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
