deep-spec プラグイン 要件定義（完全版ドラフト）

意図分析

Kiroの「Deep Spec Analysis」と同等のニューロシンボリック要件解析——LLMによる精緻化・形式化と、ソルバーによる決定論的な矛盾・完全性検査、二択質問による人間ゲート——を、AI-DLC v2のプラグインとして実現する。coreを一切変更せず、無効化すれば痕跡なく消える。バックエンド（SMT、Quint）は初日から2本同梱し、IR契約がバックエンド中立であることを出荷前に実証する。単一プラグイン構成としつつ、将来の3分割（core/smt/quint）が機械的作業で済む内部構造を強制する。

機能要件

FR1: IR契約（契約1）

- FR1.1 形式モデルの中間表現（IR）はJSONとし、tools/data/deep-spec-ir-schema.json のJSON Schemaで定義すること
- FR1.2 IRは irVersion（semver）を必須で持つこと
- FR1.3 IRは schema（エンティティ・属性・型・関係）、obligations[]、scenarios[]、background[]（ドメイン制約）の4区画で構成すること
- FR1.4 各obligationはEARS分類タグ nature: invariant | event | state-temporal | numeric と、requirements.mdのFR/NFR-IDへの参照 frRefs を必須で持つこと
- FR1.5 scenarios[] はGherkin受け入れ基準由来の受容/拒否例をFR-ID参照付きで保持すること
- FR1.6 IRはバックエンド固有構文（SMT-LIB、Quint）を一切含まないこと
- FR1.7 IRは論理成果物 deep-spec-formal-model としてステージレコード配下に保存すること

FR2: 正規化findings契約（契約2）

- FR2.1 各バックエンドは検査結果を <record>/…/deep-spec-verify/<backend>.json に書くこと
- FR2.2 findingsファイルは backend / irVersion / method: exhaustive | bounded | simulation / findings[] / skipped[] / unavailable? を持つこと
- FR2.3 各findingは kind: conflict | completeness-gap | scenario-violation | cross-check-disagreement、frRefs、witness（モデルまたはステップトレース）、detail を持つこと
- FR2.4 検査しなかったobligationは skipped[] に理由（capability対象外／コンパイル不能／irVersion不一致／timeout）付きで必ず記録すること（無沈黙原則）
- FR2.5 findingsは正準順（決定論的ソート）で出力すること

FR3: ステージ定義

- FR3.1 新ステージ deep-spec-analysis（phase: inception、requires_stage: [requirements-analysis]）を追加すること
- FR3.2 consumes: requirements（required）、produces: deep-spec-formal-model, deep-spec-analysis-report とすること
- FR3.3 mode: inline、lead_agent: aidlc-product-agent、reviewer なしとすること
- FR3.4 sensors: [deep-spec-ir-valid, deep-spec-verify-smt, deep-spec-verify-quint] を宣言すること
- FR3.5 scopes はcoreの重量級スコープ（enterprise、feature を軸に最終確定はQ1）に付けること

FR4: 形式化ステップ（LLM側）

- FR4.1 ステージのLLMステップはrequirements.mdの各FR/NFRをEARS分類してIRに変換すること。生のSMT-LIB/Quintは書かないこと
- FR4.2 Gherkin受け入れ基準を scenarios[] へ写像すること
- FR4.3 形式化できない要件はIRに unformalized として理由付きで記録すること
- FR4.4 IR著述作法は knowledge/aidlc-product-agent/deep-spec-ir-authoring.md で規定すること

FR5: IR検証センサー（カーネル所有の決定論チェック）

- FR5.1 deep-spec-ir-valid はIRのスキーマ適合を検証すること
- FR5.2 IR内の全 frRefs がrequirements.mdに実在するIDであることを検証すること（逆引き整合）

FR6: SMTバックエンド

- FR6.1 deep-spec-verify-smt.ts はIR→SMT-LIBをTypeScriptで決定論的にコンパイルし、z3-solver（WASM）をインプロセス実行すること
- FR6.2 対象natureは invariant / event / numeric とすること
- FR6.3 検査項目：(a) 矛盾——同時充足不能なobligationペアをunsat coreで特定しfrRefsへ帰責、(b) 完全性ギャップ——どのルールも適用されない入力の存在、(c) シナリオ検査——受容/拒否例のwitness確認
- FR6.4 method: exhaustive を報告すること

FR7: Quintバックエンド

- FR7.1 deep-spec-verify-quint.ts はIR→QuintをTypeScriptで決定論的にコンパイルし、quint CLIへシェルアウトすること
- FR7.2 対象natureは state-temporal および状態スキーマ定義済みの event とすること
- FR7.3 Apalache検出時は quint verify（method: bounded）、非検出時は quint run をseed固定で実行し method: simulation を報告すること
- FR7.4 反例はステップ実行トレースとしてwitnessに格納すること

FR8: クロスチェック

- FR8.1 両バックエンドが扱えるobligationは両方で検査すること
- FR8.2 結果不一致は kind: cross-check-disagreement として報告すること（形式化またはコンパイラの欠陥シグナルであり、要件の欠陥とは区別する）

FR9: 質問生成と人間ゲート

- FR9.1 ステージは deep-spec-verify/*.json をglobで全収集すること（バックエンド名を仮定しない）
- FR9.2 各findingをstage-protocolの [Answer]: 構造化質問（A: 現状維持／B: 修正案採用／X. Other）に変換すること
- FR9.3 deep-spec-analysis-report にFR-ID逆引き付き修正案を記載すること。requirements.mdは編集しないこと
- FR9.4 findingsファイルが0件の場合、全obligationを「未検証」と明示報告すること

FR10: 下流連携

- FR10.1 contributions/inception/domain-design.md により adds.consumes: deep-spec-analysis-report (required: false) をcoreの domain-design ステージへ合流させること

FR11: doctorチェック

- FR11.1 deep-spec-doctor.ts は z3-solver、@informalsystems/quint、Apalacheの可用性をadvisoryで検査し、不在時は導入コマンドを提示すること

FR12: テスト・conformance

- FR12.1 正準IR fixture（静的ルールと状態機械の両方を意図的に含む）＋期待findingsを tests/ に置くこと（tools/ 配下は禁止）
- FR12.2 両バックエンドがfixtureで期待findingsを返すことをプラグインの tests/ で強制し、integration tierへ接続すること
- FR12.3 aidlc-plugin-validate / build / test を全ハーネスで通過すること

非機能要件

- NFR1（決定論） 同一IR・同一環境で全センサー出力がバイト同一であること。seed固定、obligation毎timeout、正準ソートで担保する
- NFR2（可搬性） 必須ランタイムはbunのみ。z3はWASMでインプロセス。quinとし、欠如は劣化のみ
- NFR3（劣化） ソルバー異常・timeout・不在を含む全失敗はadvisory findings（unavailable/skipped）に閉じ、ステージ実行を停止させないこと
- NFR4（分割可能性） バックエンド1＝センサー1＋ツール1の対応を維持し、のみとすること。ファイル名は3分割時と同一とし、分割がファイル移動＋manifest追加＋contribution変換のみで完了すること
- NFR5（可視性） skip・unavailable・dropを一切沈黙させないこと

制約

- C1 additive-only。coreを編集せず、プラグイン無効化で素のcoreにバイト
- C2 ✅実装済みシームのみ使用。when: 評価・memory/ 投影・adds.requires_stage・after-questions アンカーに依存しないこと
- C3 上流成果物（requirements.md）を編集しないこと（write-freeze・監査
- C4 命名：プラグイン名 deep-spec（core/aidlc/aidlc-* は予約）、成果物は deep-spec-* 接頭辞、センサーmanifestは aidlc-<id>.md 形式
- C5 センサーはadvisory。ゲートはA/B質問＋既存承認ゲート（人間）のみ
- C6 新規エージェント・新規スコープ・reviewerゲートを追加しないこと

前提

- A1 z3-solver（WASM）がbunで動作する（未検証——スパイクで確認）
- A2 quint CLIがbunからのシェルアウトで動作し、--seed 固定で決定論にな
- A3 knowledge指導下でLLMがスキーマ適合IRを安定生成できる
- A4 manifestの dependencies 解決は機構側でdeferredのため使用せず、irV 代替する

スコープ外

- O1 Alloy等の追加バックエンド実装（契約上は受け入れ可能な設計とするが
- O2 3プラグイン分割での配布（分割トリガー成立時に実施）
- O3 Semantic Entropy（N回独立形式化＋クラスタ化）——v1は単一形式化＋ソ
- O4 requirements.mdへの修正の自動反映
- O5 専任formalizerエージェント、専用スコープ、reviewerゲート

未解決事項

- Q1 ステージの scopes 最終セット（enterprise/feature以外にmvp等を含め
- Q2 nature 分類の粒度（numeric を invariant のサブタイプにするか独立で維持するか）
- Q3 Apalacheサポートの深さ（検出時のみか、導入手順をdocに含めるか）
- Q4 timeout・性能予算の具体値（obligation毎・全体）
- Q5 EARS正規化テキストを人間可読の形でレポートに含めるか（IRのJSONのみか)

