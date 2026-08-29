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
| 実intentレコードでのセンサー3連発火（`--stage`/`--output-path` 実契約） | ✔ | ir-valid: pass / SMT(exhaustive): findings 4（FR1×FR2・FR1×FR3・FR2×FR3のconflict + 在庫不足域のcompleteness-gap＝仕込んだ欠陥を全件正検出）/ Quint(bounded=Apalache): When-eventシナリオはv1 capability skipとして明示、cross-check crossChecked空で整合 |
| headless `/aidlc`（`claude -p`）実走 | △ | オーケストレータ起動〜プラン選択ゲートまで動作。aidlcはゲート駆動設計のため非対話完走は不可（ゲート毎に `--resume` 注入が必要）。sandboxのdist設定はBedrock強制（`CLAUDE_CODE_USE_BEDROCK=1`）のため、非AWS環境では `settings.local.json` での上書きが必要 |
