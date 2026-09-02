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

- `AttrDecl` は自分の整合を自分で判定する：FD-E2 の型区分衝突
  （`declaresAllowedValuesOnNonEnumerableType`・
  `declaresBoundsOnNonNumericType`・`declaresUniqueOnCollectionType`）、
  FD-E3 の範囲・既定値整合（`boundsInverted`・`defaultBelowMin`/
  `defaultAboveMax`・`defaultOutsideAllowed`）、ライフサイクル候補性、
  FD-S の図差分（`rogueDiagramStates`・`allowedValuesAbsentFrom`）。
  型区分集合は `TypeName`（`classifiesNumeric`/`Date`/`Bool`/
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

## ファーストクラスコレクション裁定 — ドメイン層は配列を生で扱わない（2026-08-30）

オーナー裁定：生の配列をドメイン層に流してはならない。コレクションは
不変の `add`・集合の知識・境界専用の脱出口 `toArray()` を持つ
ファーストクラスのドメインオブジェクトである。震源クラスタへ適用：
語彙側に `AttributeNames`・`AllowedValues`・`StateNames`・`SourceIds`、
宣言側に `AttrDecls`・`RelDecls`・`EntityDecls`・`ShapeErrors`・
`RuleDecls`・`StateMachineSketches`・`DomainEntitySketches`・
`SiblingUnitIndex`。集合の知識はさらに一段コレクションへ沈んだ：重複検出
（`duplicatesByName`）、ライフサイクル選定（`AttrDecls.lifecycleAttr`）、
FD-E6/FD-R4 の解決（`EntityDecls.resolvesReference`/`resolvesAppliesTo`）、
FD-S の図差分（`AllowedValues.rogueAmong`/`absentFrom`）、FD-R3 の逆検証
（`SourceIds.valuesMissingFrom`）、XS の巡回順
（`DomainEntitySketches.sortedDistinctByNormalizedName`）、兄弟索引の
照会（`SiblingUnitIndex.definersOf`/`entityDeclaredIn`）。ドメインに
裸の `Map` を晒していた旧 `SiblingUnitEntities` 型別名は索引クラスの中で
死んだ。同セッションの用語補正も記録する：コメントは「型区分」と書く
——通常のオブジェクト指向の分類であり、関数型の型クラスの含意は意図も
実装もしていない。

証明：308 tests green。golden 無変更。パリティスナップショットの
`diff -r` は空のまま。全コレクションは 90% 床の上。

## アクセサ命名の裁定 — DP のアクセサはフィールドでなく表現を語る（2026-08-30）

オーナーは、ドメインプリミティブの `value(): string` が内部構造
（`#value` フィールド）を公開面に暴露していると裁定した。アクセサは
表現への変換なので、変換として命名する：文字列値の DP は
`asString()`、数値の DP（`LineNumber`・`BlockIndex`・`NumericBound`）は
`asNumber()`。全 5 コンテキストの全 DP に適用（宣言 25・呼び出し約
300 箇所）。役割名のアクセサ（`backendName()`・`fileName()`・
`majorVersion()`）は元から原則に適合しており不変。private の
`#value` フィールドは対象外——裁定は公開語彙について。今後の DP は
最初から `asString`/`asNumber` に従う（#46 台帳の不変条件に記載）。

証拠：322 テスト green・golden 無傷・パリティスナップショット
`diff -r` 空・カバレッジフロア充足。

## ドメイン語彙の完全化と層強制のクローズアウト — 裁定 A〜D と PR10（2026-08-31〜09-01）

#46 の 4 裁定を全域適用して台帳をクローズした（PR #54〜#60）。

- **裁定 A（DP 徹底）**: ドメインオブジェクトのフィールドから bool 以外の
  基本データ型を全廃。requirements（5a）→ design（5b）→ refinement/Decl 束
  （5c-1/5c-2）→ トリガ面（5c-3、kernel `TriggerName`）→ lowered ペイロード面
  （5d、`LoweredId`/`LoweredOriginRef`/`ObligationIds`/レポート識別子の
  `BackendName`）。共有語彙は FrRefs の前例どおり kernel へ昇格
  （`AttributeBound`・`TriggerName`・`ErrorMessages`）。
- **裁定 C（Tell-Don't-Ask 徹底）**: DP 化は包むだけでは無意味——値の知識
  （閉集合述語・凍結順・座標導出・境界比較・照合構文）は DP/コレクション
  自身が所有する（#56 で全域是正、以後の新規 DP は最初から適用）。
- **裁定 D（Repository 契約）**: Repository のメソッドは永続化語彙
  （findById/store 系）のみ。findById は ID を持つ集約を返し、書ける文書には
  store を付ける——単文書集約は原文の生バイト列を保持し、
  findById∘store がバイト恒等（原子的書き込み・防御コピー込み）。
  契約適合のような書き込み前提の照会は別サービスポートへ分離。
- **宣言済み除外（恒久）**: `Expression` published language（`op` の閉集合化は
  不採用——寛容な未知値素通しが契約）、状態トークン（enum 宣言値への参照で、
  宣言値語彙そのものが素材）、design `attrPath`（entity/attribute DP 対からの
  導出結合形）、serializer 直描画ペイロード文字列、`FrRefClaim.owner`
  （義務/シナリオ混在の参照トークン）。
- **equal→1 凍結コンパレータ群**: `return 0` への正規化は重複宣言時の安定順を
  変え得るため不採用で確定。重複は well-formedness が表面化する。

PR10 で層強制を完全有効化した：

- LEGACY_FILES 免除を空化。フラットに残る 10 ファイル（9 センサー + doctor）は
  「entry（合成ルート）」という役割であり免除ではない——process.*/import.meta を
  許される唯一の場所で、配線だけを持つ。
- スタイルルールを追加（各ルールに red example）: domain クラスの
  private constructor 規律（new は自クラス内のみ、Error 派生は除外）・
  get アクセサ禁止・TS enum 禁止・非 null 表明禁止。実樹の違反は 2 件
  （`CheckFamilyLedger` の公開 ctor → `of()` ファクトリ、doctor の `!` 表明）で
  修正済み。
- 重複監査: kernel 共有済み（findRecordRoot・relArtifact・validateSchema・
  readIfExists・isObject・canonicalStringify・extractFences）に加え、
  `strArr`（5 アダプタ）と `eqRef`（lowering/catalog の暗黙ガード符号——単一
  定義で lockstep を構造保証）を kernel へ一本化。正直な例外 2 件を残す:
  ① sanitize 正規表現は意味別（SMT シンボル `[^A-Za-z0-9_]` と finding target
  `[^A-Za-z0-9_./-]` は別語彙）、② SMT レンダリング語彙（`smtName`/`smtVar`）の
  requirements/design 二重定義は PR8 の結末——adapter は他コンテキストの
  adapter を import できず、第 2 コンパイラは v1 の描画語彙を逐語で写す契約。

証拠：367 tests green・golden 無傷・パリティスナップショット `diff -r` 空
（pre-PR7 基底）・カバレッジフロア充足・7 ハーネスビルド・CLI z3/quint
スポットチェック BYTE-IDENTICAL。

## 1 ファイル 1 公開型の裁定 — 公開型はファイルを一枚ずつ所有する（2026-09-01）

Java 流のファイル規律を層化ツリー全体に適用した。層化ファイル
（kernel/requirements/design/refinement/refcheck の各層）は公開型宣言
（`export class/interface/type/enum`）を高々 1 つ持ち、ファイル名はその
公開型名の kebab-case と一致する（`UseCase` は確立済みの一語「usecase」）。
従属する非公開型・私有定数は所有する公開型のファイルに同居してよく、
関数だけのモジュールに命名制約はない。facade（index.ts）は宣言を持たず
明示再輸出のみ、entry は公開型を持たない——配線だけを運ぶ。

- **執行**: `onePublicTypePerFile` を ALL_RULES に追加（red/green example
  つき、stripStrings 前処理で文字列内の偽陽性なし）。多型ファイル・
  名前不一致・facade/entry での宣言の 3 態を検出する。
- **適用の形**: 186 → 459 ファイル。抽出 273（refcheck/domain 78・
  design/domain 73・requirements/domain 59・refinement/domain 32、残りは
  adapter/usecase/kernel）、公開型名へ追随する改名 28（`lower-unit` →
  `lowered-unit`、`remap-unit-doc` → `remapped-unit`、`design-ir-decl` →
  `design-unit-decl`、kernel adapter の `fence`/`json`/`md-table`/`schema`/
  `yaml`/`names`/`target-ids` ほか）、残余は import と facade の追随修正。
- **共有表は所有型に従う**: KIND_RANK は各 findings コレクション
  （`verification-findings`/`findings`/`design-findings`）のファイルへ移り、
  kind-rank 順序保存テストのパスも追随。分割で露出したコレクション面
  （of/add/巡回）にカバレッジピンを追加。

証拠：tsc clean・全スイート 371 pass / 1 skip / 0 fail・per-file 90% カバレッジ床充足（分割で露出した面はカバレッジピンで封鎖）・golden／パリティ
無傷（参照出力に変更なし）・architecture スイートは新ルール込みで違反ゼロ。

## DDD 移行 PR8 — SMT コンパイラ統一の判断点を裁定：語彙は kernel 共有、式コンパイラは 2 命名で確定（2026-09-01、#21）

PR6 が繰り延べた判断点を実行した。完全統一は**不能**と裁定し、issue #21 の
フォールバック——core 共有の 2 命名コンパイラ——で確定する。

- **issue の 3 つの既知差の帰結**: 「enum sibling 解決」は同一アルゴリズムで、
  差は解決表だけだった。「bare-enum-literal の文言差」は実在の凍結差。
  「smtLit 負数」は両側バイト同一と判明——だからこそ共有できた。
- **統一を退けた 3 つの凍結差**:
  ① bare-enum 文言差——裸の enum リテラルに v1 は明示 case で
  「enum literal without a ref sibling has no resolvable encoding」、
  refinement は case を持たず default 落ちで「unknown operator "enum"」
  （alpha 失敗の detail に載る）。どちらも compile-error skip の detail として
  文書バイトに現れうる凍結文言で、単一関数は方言スイッチなしに両立できない。
  ② ref の解決表が文脈別——v1 は RequirementsModel（DP 集約）、refinement は
  設計ユニットの rawEntities から組む RefinementSmtContext。
  ③ 型境界制約名のサニタイズ差（本裁定で新たに台帳へ）——v1 は smtName 経由で
  `[^A-Za-z0-9_]` 全置換、refinement はドットのみ置換。通常パスでは同一バイト
  だが、異字を含むパスで分岐する凍結挙動。
- **共有した core**: バイト同一の描画語彙 4 面を kernel/adapter
  `smt-symbols` へ一本化——smtVar・smtName・smtLit（v1 側は smtNumeral と
  int リテラル・シナリオ束縛の 2 つのインライン重複も同時に収束）・
  smtIntOf（(- n) 形復号、両 decode の共通部）。単一定義が lockstep を構造
  保証する（eqRef 前例）。式コンパイラは smtOf（requirements）と
  smtOfExpr（design）の 2 命名のまま、旧名 alias なし。
- **重複マップの更新**: PR10 が正直な例外 ② として残した「SMT レンダリング
  語彙の requirements/design 二重定義」は本裁定で解消——正直な例外は
  sanitize 正規表現（意味別）の 1 件に減った。

証拠：base↔head パリティ `diff -r` 空・AIDLC_PARITY=1 決定論 green・
キャラクタライゼーションスナップショット（tests/fixtures/smt-scripts/）
無傷・golden 無傷・371 pass / 1 skip / 0 fail（カバレッジ床込み）・
validator Errors: 0・7 ハーネスビルド。

## DDD 移行 PR9 — doctor が層化ユースケースの合成ルートになる（2026-09-01、#22）

フラット最後の実務ファイル（505 行）が doctor コンテキストの
domain / usecase / adapter に層化され、entry は env 読取と配線だけを持つ
合成ルートになった。

- **doctor/domain の 6 概念**: `InstallationManifest`（43 行の台帳・凍結順）、
  `VerificationStaleness`（sourceDigest 照合＋mtime フォールバックの純粋
  判断——anchor がある限り内容ハッシュだけが真実で、mtime の嘘に騙されない）、
  `CoverageAssessment`、`StructuralDebt`、`UnitCoverage`（refinement 失効を
  別持ちし、凍結順の担い手になる）、`HealthVerdict`（checks 配列の
  ファーストクラスコレクション、`document()` が published 形）。
- **use case 5 本の実行順＝checks 配列順を凍結**: マニフェスト → ソルバ →
  要件カバレッジ → 構造負債 → 設計カバレッジ。label/fix の文言は
  `DoctorPresenter` に封じ、installer が grep する部分文字列
  （"no deep-spec verification" ほか）と intent-e2e の表明 label を逐語凍結。
  Check リテラルのプロパティ順（pass, label, fix, severity）は直列化バイト。
- **RefcheckBackendClient は spawn 維持**: 故障隔離と 15s timeout 意味論の
  保存。report-only の実行不能（ツール欠如・非 0 exit・壊れた verdict）は
  null で不算入——0 findings と混同しない。
- **凍結挙動の保存**: 走査順（spaces/intents は readdir 自然順・unit は
  昇順）、refinement 失効行が unit 行より先に並ぶ割込み順、anchor がある時
  だけ requirements をハッシュする遅延、try/catch の黙殺範囲、fence 正規表現。
- **マニフェスト再編**: doctor entry と doctor 3 canary を台帳へ（39 → 43）、
  intent-e2e の compose 検査リストを台帳と同期（kernel/refcheck の
  usecase/adapter canary も e2e 側へ追補）。
- **カバレッジ憲章の適用**: doctor/domain は 90% 床下（全ファイル 100%）、
  doctor/{usecase,adapter} は bunfig 除外——「数値ゲートは domain 層に 90%」
  の層別憲章どおり。

バイト証明：新旧 doctor stdout を 2 環境（dev repo・design fixture）で
比較——差分は裁定済みマニフェスト 4 行のみ、他 44 行は順序込み deep-equal・
直列化バイト不変。証拠：383 pass / 1 skip / 0 fail・base↔head パリティ
`diff -r` 空・AIDLC_PARITY=1 決定論 green・golden 無傷・validator Errors: 0・
7 ハーネスビルド（dist に doctor ツリーの同梱を確認）。

## ポート契約の置き場の裁定 — ポートは 2 種、usecase/port/ に集める（2026-09-01）

ポートの分類は **Repository（永続化）と外部システム Client
（`Z3SolverClient`/`QuintClient` 型）の 2 種**であり、usecase 層のポート契約
（インターフェイスと、その署名を構成するペイロード型）は `usecase/port/` に
集約する。interactor とその入出力・outcome 型は usecase/ 直下のまま。

- **契約適合サービスポートの廃止**: `ReferenceCheckReportConformance` は
  独立ポートとしては誤った抽象と裁定し、`conformedOf` を
  `ReferenceCheckReportRepository` へ統合した。「store が書くはずの姿」を
  書かずに問う照会は永続化契約の一部であり、report-only の verdict は
  引き続きこの戻り値から導く（stdout とファイルの矛盾を構造的に防ぐ不変条件は
  不変）。裁定 D の「契約適合のような書き込み前提の照会は別サービスポートへ
  分離」句は本裁定で改訂——分離ではなく Repository が運ぶ。3 interactor は
  依存 1 本に減り、entry の二重配線が消えた。
- **移設**: 32 契約を 5 コンテキストで（kernel 2・refcheck 2・
  requirements 9・design 11・doctor 8）。ポート署名を構成するペイロード型
  （SmtCheck/RefinementCheck/走査材料ほか）も契約の一部として同行。facade と
  interactor の import を追随、公開面は Conformance の輸出削除以外不変。
- **執行**: `portsLiveInPortDir` を ALL_RULES へ（red/green example つき）
  ——usecase 直下に置かれた Repository/Client インターフェイスと、port/
  配下に紛れ込んだ class（interactor）を検出。

証拠：tsc clean・全スイート green（per-file 90% 床込み）・architecture
スイート違反ゼロ・validator Errors: 0・7 ハーネスビルド。

## 凍結解除 — 移行が byte-freeze で運んだ 7 つのギャップを裁く（2026-09-01、#34・#38）

移行完了（#12、PR10 #23）を受け、#34（verify-smt 4 件）と #38
（refinement 3 件）の台帳を解凍した。結末：**golden もパリティも 1 バイトも
動かなかった**——全ギャップが劣化経路・異常入力の面だったため、修正は新しい
観測面（新文言・新 skip・降格）を足すだけで、健全経路のバイトは保存された。
golden 再生成は不要のまま両台帳を閉じる。

- **#34 項 1（smtVar 衝突）**: 特殊文字はスキーマの identifier パターン
  （`^[a-z][a-zA-Z0-9_]*$`）が当時から締めており、生きていたのは下線衝突
  （`a.b_c` と `a_b.c` → 同じ `v_a_b_c`）だけ。両 well-formedness
  （requirements / design）に衝突検査を追加——新凍結文言
  `attribute paths "…" and "…" collide under the solver variable encoding
  (dots become underscores)`（req 側は `schema: ` 接頭辞つき）。
- **#34 項 2（sibling 無検証キャスト）**: wave 4b の明示写像化で解消済みと
  判明——現行 `parseSiblingReportDocument` は全要素を filter/typeof で選別
  する。回帰ピンで錠止。
- **#34 項 3（event-pair の error 判定）**: evo/evj の error を
  unknown/budget と同じ timeout skip として記録（gap/scenario 分岐と対称）。
  既存凍結文言を再利用、新文言なし。
- **#34 項 4（安全整数範囲）**: `smtLit` は安全域でバイト同一のまま、域外の
  整数（1e21 等——double としては正確）を BigInt 経由の正確な十進で描画する
  ——台帳の「isSafeInteger で拒否」案の上書き改良で、正確に表現できる値を
  拒否しない。model 復号は域外を正確な十進文字列で運ぶ。authoring 面は WF が
  締める——bounds の新凍結文言 `bounds must be safe integers`（両側）・
  binding 検査の isSafeInteger 化（既存文言を再利用）・`AttributeBound.parse`
  に `unsafe-bound` 材料。
- **#38 項 1（Quint 側 alpha 失敗の黙殺）**: `quintStatusSkips` が
  substitution を試行し、失敗を `compile-error` skip として記録——detail は
  SMT 側と逐語で対（`alpha substitution failed: …`）。lockstep はテストで
  錠止。
- **#38 項 2（ETIMEDOUT 後のランタイム再試行）**: タイムアウトで打ち切る
  （ENOENT だけが次のランタイムを試すに値する）。unavailable 文言テンプレート
  は不変で attempts が 1 件になるだけ——30s 予算に対する最悪 ~90s の二重
  燃焼が消えた。
- **#38 項 3（読めないモデルでの無 verdict クラッシュ）**: `a858abc`
  （Repository 読取の Result 契約）で解消済みと判明——existsSync 後の
  EISDIR・権限エラーは io-failed → fail verdict。両バリデータの回帰ピンで
  錠止。

証拠：397 pass / 1 skip / 0 fail（新ピン 12・per-file 90% 床込み）・golden
無傷（`git diff --exit-code tests/fixtures` クリーン）・base↔head パリティ
`diff -r` 空・AIDLC_PARITY=1 決定論 green・validator Errors: 0・
7 ハーネスビルド。

## CQS 裁定 — コマンドは返さない：store は void（2026-09-01）

Repository の store が書いた集約を返していたのは CQS 違反と裁定し、全 10
ポートを `Result<void, RepositoryError>` に改めた。集約を読み込んで返す
store は禁止。複数件の書き込みだけが、正常に書けた件数か事前採番の集約 ID
集合を返してよい（現行ポートに複数件書きは無い）。

- **裁定 D の改訂（write 面）**: 「store は永続化される姿を返す」設計
  （7f40ed0）を廃し、「書かれる(はずの)姿」は conformedOf（照会）の責務に
  ——report 系 3 Repository（refcheck／verification／design）が持つ。
  verdict はモードによらず conformedOf から導き、store は内部で同じ適合を
  通すため、stdout とファイルの矛盾は引き続き構造的に起きない。
  findById∘store のバイト恒等・「不適合を書かない」不変条件は不変。
- **呼び手の追随**: verify 4 本・refcheck 3 本を「照会 → void store」へ、
  #persist 系も Result<void>。InMemory ダブル 2 本もポート契約に追随
  （conformedOf 込み）。
- **執行**: `commandsReturnVoid` を ALL_RULES へ（red/green example つき）
  ——usecase/port の store が Result<void> 以外を返せば違反。

証拠：397 pass / 1 skip / 0 fail（per-file 90% 床込み）・golden 無傷・
パリティ `diff -r` 空（書かれるバイトも verdict 値も不変）・validator
Errors: 0・7 ハーネスビルド。

## z3 witness 決定化 — GC 由来の解放揺れを構造的に封じる（2026-09-01、#28）

負荷時に限り、制約上自由な変数の witness 値が稀に揺れた事象（PR1 儀式で
1 回だけ、SM-1/TR-3/TR-4 gap の `ticket.priority` が golden の 1 でなく 0）
の根本機構を特定し、封じた。

- **機構**: z3-solver の高水準 API は JS ラッパの GC 時に
  FinalizationRegistry で `dec_ref` を発行する。負荷依存の GC タイミングが
  z3 内部の解放・ID／アリーナ再利用パターンを揺らし、探索順が変わって
  **制約上自由な変数だけ**のモデル値が変わりうる（完全束縛 witness は不変
  ——観測事実と一致）。
- **対処**: 子プロセス実行中は生成した全ラッパ（solver・assumptions・
  model・eval 結果・unsat core）を保持し、実行中の `dec_ref` をゼロにする。
  軽負荷時（GC 無発火）の典型アロケーションパターンを全負荷条件で再現する
  ため、golden バイトは構成上不変。
- **再現性の記録**: 24 回×14 hog（通常）＋子ヒープ 64MB（挑発 GC）の
  ストレスで修正前後とも全回 golden 一致——元事象（十数回に 1 回）はこの
  刺激では非再現だった。よって「再現待ち」でなく機構封殺＋監視網常設で
  裁定する。
- **監視網**: `scripts/smt-stress.ts`（opt-in、揺れ検出で exit 1。
  `NODE_OPTIONS="--max-old-space-size=64"` で挑発 GC モード）を常設。毎 PR
  儀式のパリティハーネスも引き続き全観測面 diff で捕捉する。再発時は #28 を
  再開し、witness 正規化（自由変数の最小化固定——golden 改定を伴う要件
  レベル判断）へ進む。

証拠：全スイート green・golden 無傷・base↔head パリティ `diff -r` 空・
ストレス 48/48 バイト一致・validator Errors: 0・7 ハーネスビルド。

## 後方互換コード削除の裁定 — 旧成果物を救う経路は持たない（2026-09-01）

「後方互換コードは削除せよ」のオーナー裁定で全ツリーを監査した。削除対象は
1 件：doctor の **mtime フォールバック**（sourceDigest anchor を持たない
「anchor 導入以前のモデル」を mtime 比較で救う経路）。ir-valid の
`SourceAnchor` は sourceDigest 必須を強制しており、anchor なしモデルは現行
契約で invalid——この経路は旧成果物専用の互換コードだった。削除後は
**anchor なし＝無条件 stale**（再検証が digest を刻む）。
`VerificationStaleness` は sourceDigest 照合のみの純粋判断になり、
`VerificationTarget` から mtime 材料が消えた。

**非該当と裁定した線引き**（互換コードではない）：stage frontmatter 欠如時の
authored default（劣化契約）・node→bun のランタイムフォールバック
（可用性）・`findingTarget(fallback)`（不正入力の素材選択）・kind-rank の
「順序互換」（互換性の機械証明であってコードでない）・install.ts の
tombstones（後方互換の残骸を**消す**反・互換機構——ファイル廃止時の追記
規律ごと維持）。

証拠：全スイート green（カバレッジ床込み）・golden 無傷・doctor stdout は
dev repo／design fixture の両基準でバイト同一（挙動変化は真の旧成果物のみ
に限定）・validator Errors: 0・7 ハーネスビルド。

## 主従の裁定 — getter は I/O 文脈専用、モデルは命令できる型にする（2026-09-01、#71）

プロパティだけの interface は命令できない。だから呼び手がデータを吸い出して
自前で判断する——ドメインモデルパターンの主従逆転（anemic domain model）で
ある。裁定：**getter（プロパティ読み）はモデルを I/O する文脈
（serializer／parser／presenter／コンパイラ＝モデル⇄バイト境界）と構築ドア
（Seed）専用。domain／usecase 層でモデルのプロパティを読んで判断するのは
すべて Tell-Don't-Ask 違反**。機械走査の実測 約 1,197 箇所／142 ファイル
を #71 の台帳で波状に反転する（class 化は `#` フィールドで違反を tsc レベルで
物理的に不可能にする——これが執行機構）。

- **波 1（原器）**: `IrAttributeDecl`・`DesignAttributeDecl` を命令できる
  class へ。well-formedness 双子（ir-model-decl／design-well-formedness）が
  吸い出していた判断——bounds 三態（欠落・逆転・非安全域）・binding 適合・
  enum リテラル所属・machine 状態面——を宣言自身が所有し、判事は文言
  （凍結面）と発生順だけを所有する。カタログは中間構造体 `AttributeType` を
  廃して宣言そのものを保持し、`new Set(values)` の膜も `enumStates()`／
  `includes` へ畳んだ。
- 文言・発生順は逐語不変——golden 無傷・base↔head パリティ `diff -r` 空で
  証明。両 class は 90% 床下で 100%。

証拠：398 tests / 0 fail・golden 無傷・パリティ空・validator Errors: 0・
7 ハーネスビルド。

## 主従の裁定・補遺 — getter しかない型はデータモデルであり、domain 層の住人ではない（2026-09-01、#71）

波 1 で私（実装側）が新造した `*Seed` interface への棄却裁定。getter 群＋
ドメインの振る舞いを持つものがドメインオブジェクトであり、**getter しか
ない型はデータモデル**——それを domain 層に置くのは、層の存在理由への
違反である。「構築ドアの引数だから正当」という波 1 の除外判定は撤回する。

- **正しい形**: ドアの引数は**名前付き型ではなく、ドア署名の無名インライン
  引数**で運ぶ。関数の引数リストを誰もデータモデルと呼ばないのと同じで、
  domain 層に getter-only の市民を作らない。adapter は構造的型付けで
  リテラルを渡すだけ——名前は要らない。
- **即時適用**: 波 1・2 で新造した 4 Seed（attribute-decl 双子・verdict
  双子）を解散し、`reconstitute` のインライン署名へ畳んだ。
- **横展開**: 既存の `*Seed`／`*Composition` 群の全解散を #71 の波 7 として
  台帳化（domain 層から getter-only 型を全廃する波）。除外に残るのは
  I/O 文脈（adapter）と `Expression`（寛容 published language——既裁定）
  のみ。

波 2（同 PR）: verdict 双子（`SmtQueryVerdict`／`RefinementQueryVerdict`）を
命令できる class へ——status 分類（`isSat`/`isUnsat`/`isUndecided`——3 状態
列挙の散在は #34 項 3 の三重バグの土壌だった）と witness 材料面
（`witnessModel`/`witnessTrace`/`coreLabels`/`sortedCore`）を判定自身が所有。
文言・発生順は逐語不変——golden 無傷・パリティ diff 空で証明。

## 主従の裁定・MECE フェンス — 病巣の完全分割と縮小専用台帳（2026-09-01、#71）

「言われた箇所だけ直す」逐次対応と、`export interface` しか数えない棚卸しは
非 MECE だった——その棄却裁定の反映。domain 層の全輸出型を完全分割し直した：
**behavior class 211／病巣 122（getter-only interface 102・record 共用体 19・
object 型エイリアス 1）／閉じた文字列語彙 6／published 1（Expression）**。
record 共用体（`RefinementProbe`・`VerificationWitness`・各 `*Outcome` 等）も
getter しかない data model であり、同じ病巣として台帳に載る。

- **フェンス**: `noDataModelsInDomain` を ALL_RULES へ（red/green example
  つき）——domain 層の getter-only interface・object エイリアス・record
  共用体を検出。着手時全数 122 ファイルは `DATA_MODEL_DEBT`（縮小専用——
  増やす変更は裁定違反、LEGACY_FILES と同じ規律）に列挙し、波が 1 型を
  返すたびに消す。これで**新規流入は CI が遮断し、残債は台帳が可視化**する
  ——逐次対応の再発を構造的に防ぐ。
- 判別共用体の一部（`DesignValue`・`VerificationWitness` 等の値／witness
  ペイロード語彙）は published language 除外の候補——各波で個別に裁定し、
  除外するなら Expression と同じく恒久除外リストへ移す（台帳から黙って
  消さない）。

証拠：399 tests / 0 fail・golden 無傷。

波 3（同 PR）: 3 ステージ全ての義務／シナリオ双子とその decl
（`Obligation`・`Scenario`・`IrObligationDecl`・`IrScenarioDecl`・
`DesignObligation`・`DesignScenario`・`DesignObligationDecl`・
`DesignScenarioDecl`・`DesignTransitionDecl`・`RefinementObligation`・
`RefinementScenario`）が命令できる class へ。`DesignTemporalDecl` は
`DesignObligationDecl` のドア署名へ解散。台帳から 12 エントリを回収し、
縮小専用台帳は開始在庫 122 のうち 110 を保持する（記録は開始数、
台帳は残債——差分が各波の回収分）。

波 4（本 PR）: 背景仮定 decl 双子（`IrBackgroundDecl`／
`DesignBackgroundDecl`）が命令できる class へ。呼び出し側が
`assert !== undefined` を分岐し `primesAllowed = false` を直書きして
いた漏洩を解消し、式の列挙は宣言自身の `inspectExpressions` が所有する
（背景仮定の式に prime は許されない——その不変条件は well-formedness
ループではなく宣言に宿る）。台帳から 2 エントリを回収し、残債は
122 中 108。`BackgroundAssumption`／`DesignBackgroundAssumption`／
`LoweredBackground` は adapter が外部形式へ射影する消費（公認）に留まる
ため台帳に残し、波ごとの個別裁定を待つ。

波 5（同 PR）: `AttributeMapping` が α置換の材料（enum 比較の展開・
参照への代入・抽象フレーム等式）と全域性チェック（欠けケース・
生成値の範囲外）を所有する——`AlphaContext` は索引と未カバー検出、
`UnitRefinementPlan` は gap 文言だけを担う。さらに
`DesignTransition`／`DesignIgnore` の compile-down 意味論
（暗黙の `state==from` ガード ∧ `state'=to` 効果、ignore ⇒ 明示
no-op event）を、重複していた2箇所（`buildLowering` と
`DesignEventCatalog.of`）から型自身へ戻す。台帳から 3 エントリを
回収し、残債は 122 中 105。

波 6（同 PR）: `Component`／`ComponentEntity`／`ComponentRef` が命令
できる class へ。コンポーネント宣言は名の形（DD-1 の PascalCase）
と自己依存の検出（DD-3、`ComponentRef.pointsAt` を経由）を、
エンティティは所有の要件たる識別子の有無（DD-5）を、コレクション
は重複の対生成（DD-1）と複数所有のグルーピング（DD-5）を所有する
——いずれも `ComponentCheckMaterials` に漏れていた seen-map 走査と
owners-map 走査の移設。materials は凍結文言の組み立てだけを担う。
台帳から 3 エントリを回収し、残債は 122 中 102。

波 7（同 PR）: `DesignFinding`／`DesignMachine` が命令できる class へ。
finding は conflict 判定の refinement 再解釈（対象が要件 id に届く
conflict は `refinement-violation` へ昇格する——文言は凍結、frRefs と
witness は引き継ぐ。届かない conflict は設計自身の conflict として
masked skip の勘定へ回す）と、相互包摂の畳み込みが使う文言差し替え
複製を所有する。機械は到達不能プローブの候補選別（宣言 enum 値から
初期状態を除いた昇順——capability skip 文言の states 列挙順そのもの）と
deterministic:false waiver の判定（conflict の対象がすべてこの機械の
遷移であり、かつ非決定を宣言済み）を所有する。quint ユースケースと
remap は訊くのではなく命じる。台帳から 2 エントリを回収し、残債は
122 中 100。

波 8（同 PR）: `QuintMachineRunVerdict` が命令できる class へ。機械
フェーズの判定は、quint アダプタが kind を訊いていた phase 2 のガード
（timeout と実行失敗は機械対象を一括 skip するので、時相フェーズは
それらを走らせない）と、解釈が kind 分岐で組み立てていた対象ごとの
skip（timeout は凍結の budget 文言、実行失敗は method 別の verify／run
失敗文言——CLI 出力尾は逐語で載り、対象の順は保つ）と、witness 材料面
（復号済みステップトレース。ITF を残さなかった deadlock は空 model へ
退避）および不変量の帰属評価が使う最終状態を所有する。アダプタは
名前つきファクトリで再構成し、解釈は訊く代わりに命じる。台帳から
1 エントリを回収し、残債は 122 中 99。

波 9（同 PR）: dead フィールド 2 件を落とす。`DesignIgnore` は `reason` を
運ばなくなる——design IR は文書上の人間承認の注記として必須のまま
（契約3）だが、domain オブジェクトから読む者は下流に誰もいなかったので、
parser は拾い上げを止め、型はフィールドを捨てる。`QuintMachineComponent`
は `frRefs` を捨てる——コンパイラは義務の要件参照を不変量成分ごとに
複写していたが、解釈は成分 id から `RequirementsModel.frRefsOf` で帰属
するので、複写は一度も読まれていなかった。台帳の回収はなし——残債は
122 中 99 のまま。

波 10（同 PR）: target 語彙にプリミティブを与える。Ruling A は集約を
またぐ target トークンに DP を与えておらず、`FrRefClaim.owner` の除外に
乗って `TargetIds`・`IdOrder`・成分 id・`machineTargets`・skip の target・
`frRefsOf` がすべて生 string のままだった。kernel に `TargetId` を置く:
`parse` は findings スキーマの `targetId` 形（OB/SC、BR、設計の
DOB/DSC/DBG/SM/TR、名前空間付きトークン）を検証し、`reconstitute` は凍結
文書と生 id 材料の逐語の門、正準順序は id 自身が所有する（`compareTo`、
`IdOrder` に従属）。`TargetIds` は `TargetId` の集合になり（`of` は DP の
門、`reconstitute` は生 id の門、`toStrings` は境界、一意化しない
`sortedCanonically` を併置）、requirements の検証語彙は端から端まで
これを話す: `QuintMachineComponent` は命令できる class へ（id は降りて
きた `ObligationId`、帰属評価は成分自身の知識）、`machineTargets`、機械
判定の skip、`VerificationSkipped.target`、`RequirementsModel.allTargets`／
`frRefsOf`（`FrRefs` を返す）、SMT の解釈、縮退文書、クロスチェックが
`TargetId` を運び、`QuintRuns` は `ObligationId`／`ScenarioId` で引き、
facts はシナリオ id を持つ。義務 id とシナリオ id は `asTargetId` を得る。
design・refinement・refcheck は自分の波まで生 id からの再構成にとどめる
（`DesignSkipped.target`、`SiblingVerdictFinding.targets`、refcheck 台帳の
名前空間付きトークンは string のまま、`TargetIds.safe` はその台帳の
サニタイザとして残る）。この波で bun の `toEqual` が private フィールドを
比較しないことが判明したため、触れた skip の期待値は `asString()` 経由で
比較する。文言・順序・golden は不変。台帳から 1 エントリを回収し、残債は
122 中 98。

波 11（同 PR）: Ruling A に機械検査を与える。「domain primitives
everywhere」の裁定はこれまで手作業で適用され（PR #54〜#60）、生 string が
domain オブジェクトへ戻るドリフトを止めるものがなかった——波 10 の target
語彙がまさにそれだった。アーキテクチャスイートは `no-primitive-fields-in-
domain` を走らせる: domain の class と公開 interface／type 別名の
string／number フィールド（スカラ、列、集合、それらをキーか値に持つ map）は
裁定の除外——bool、DP ラッパー自身（唯一の `#value`）、prose（`detail`、
`reason`、`message` 等とその列）、state トークン（`state`、`from`、`to` と
宣言値／初期状態の集合）、design の `attrPath`、`Expression` published
language、`FrRefClaim.owner`——を除いてすべて違反。着手時の全数棚卸しは
縮小専用台帳 `PRIMITIVE_FIELD_DEBT` で、ファイルごとの記述子（`name: type`）
単位に持つ（domain 68 ファイル・107 個の primitive フィールド）。台帳内
ファイルへの新しい primitive フィールドは違反、台帳の記述子が検出されなく
なった瞬間に陳腐化ガードがスイートを落とすので、台帳は縮む一方になる
（ファイル単位だった初版と初期化子 `#x: string = …` の死角はレビュー指摘で、
同 PR で修正。二巡目で無インデント・definite assignment `#x!: T`・型注釈
なし初期化子 `#x = 0` の形と、台帳への追加を diff 上で可視化する記述子総数の
上限定数 `PRIMITIVE_FIELD_DEBT_CEILING` を加えた——縮んだら下げ、上げない）。既知の限界: 非公開の type 別名（Result
のエラー材料）と index signature 型は見ない。裁定待ち: プリミティブの文字列
形をキーにした索引 map（DP の門の内側の `ReadonlyMap<string, …>`）、分類
文字列（`kind`、`method`、`nature`、`pattern`）、doctor の行、裁定が保留した
数値メタデータ。DATA_MODEL_DEBT は不変——残債は 122 中 98。

波 12（同 PR）: design と refinement の skip 語彙が `TargetId` を話す。
`DesignSkipped.target`、`DesignUnit.allTargets`、`RefinementRequirements.
allTargetIds` がプリミティブを運び（設計機械 id は `asTargetId` を得る。要件
id は既に持っていた）、design の skip は `compareTo` で並び、縮退文書・クロス
チェック・quint／SMT の設計ユースケース・refinement の計画とソルバ事実は
文字列を組む代わりに命じ、シリアライザは再構成する。`SiblingVerdictFinding`
は生配列の代わりに `FrRefs` と lowered id（`LoweredId[]`）を運び、remap は
lowering 索引がまだ文字列キーである唯一の境界で `asString()` を通す。台帳
から primitive フィールド記述子 3 件が消えた（残 104）。DATA_MODEL_DEBT は
122 中 98 のまま。

波 13（同 PR）: 設計 IR の宣言がデータモデルであることをやめる。
`DesignEntityDecl`、`DesignIgnoreDecl`、`DesignMachineDecl`、`DesignUnitDecl`
——アダプタの寛容パースが判事へ渡す well-formedness 検査材料——が private
constructor と `reconstitute` の門を持つ命令できる class になり、判事が
フィールドを読んで下していた判断が宣言へ移る: エンティティは属性を座標と
重複フラグつきで訪ね（`inspectAttributes`）、ignore は自分の状態が機械の
状態集合に属するかと遷移セルのキーを知り（`isStateAmong`、`cellKey`）、機械は
状態集合の外にある初期状態を宣言順に選び（`initialStatesOutside`）、ユニットは
construction ディレクトリ欠落の判定を所有する（`lacksConstructionDirectory`）。
判事は凍結文言とその順序だけを持ち、アダプタとテストは再構成する。台帳から
4 エントリを回収し、残債は 122 中 94。

波 14（同 PR）: 宣言の形をした最後のデータモデルが落ちる。`IrEntityDecl`
（requirements）は design の双子と同じく属性を座標と重複フラグつきで訪ね、
モデルの well-formedness 判事は `name`／`attributes` を読む代わりに命じる。
`IrTemporalDecl` は `IrObligationDecl.inspectExpressions` がフィールドを
読んで綴っていた assert → from → to の式巡回（prime 禁止）を所有する。
refcheck の `UnitDecl` は CD-3 の辺の選別（`declaredDependencies`: 値順の
depends_on 名、未宣言の辺は units-generation の問題として落とす）を所有し、
契約材料はフィルタする代わりに命じられた列を回る。アダプタとテストは
再構成する。台帳から 3 エントリを回収し、残債は 122 中 91——`*-decl.ts`
は台帳に残っていない。

波 15（同 PR）: seed が解散する。残っていた `*Seed` interface——design・
refcheck・refinement・requirements にまたがる 25 件——はいずれも、それが
種を蒔く集約だけが読む getter-only の形だった。波 2 の先例に従い、それぞれ
ドアの無名インライン署名へ解散し（`private constructor` と `of`／
`reconstitute` が props 型を自分で綴る）、seed ファイルと facade の再輸出は
消え、外部の参照 4 箇所（形式モデルのパーサ、設計記録のリポジトリ、
パイプラインテスト 2 本）はドアの引数型を名指す。seed のうち 7 件は台帳に
載った primitive フィールドも運んでいたので、`PRIMITIVE_FIELD_DEBT` から
それらの記述子が消える（上限 104 → 93）。台帳から 25 エントリを回収し、
残債は 122 中 66。
