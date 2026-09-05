# DDD／クリーンアーキテクチャ監査記録

修正後の実装と検証結果は [fixes.md](fixes.md) を参照。以下は監査時点の記録。

2026-09-05、`main` の `6aa82e5f61d5811d40dda3b20be2d9d5e7833e5d` を監査した。判定は **要修正**。確認した6件のうち、3件は誤判定・検査記録の欠落に直結し、3件は不変条件・失敗契約の欠陥である。

対象は `deep-spec-analysis/src/` の現行設計。実装の未コミット差分がなかったため、現在のコードと設計規則を照合した。各問題の導入コミットは特定していない。フレームワークのsubmodule・生成された配布コードは主対象に含めない。

依存方向、パッケージ分離、ファイル規模の検査は通る。しかし、公開メソッドが不変条件を守ること、外部結果の失敗状態が境界で失われないことまでは保証されていない。`#private`、値オブジェクト、Repositoryという形を揃えるだけでは防げない問題が残る。

**1. P1 — 到達性の判定がadapterに漏れ、タイムアウトを「到達しなかった」に変換する**

箇所: `src/design/adapter/sibling-backend-client-impl.ts:39–45`、`src/design/adapter/reachability-variant.ts:33–45`、`src/design/usecase/verify-design-quint-usecase.ts:166–179`。

`probeState` は子センサーの終了コード・文書の存在・`unavailable` だけを確認し、`skipped` を確認しない。子センサーが正常にレポートを書いて終了しても、ソルバーの検査自体はタイムアウトしている場合がある。実際に `QuintMachineRunVerdict.skipsFor` はその状況を `timeout` として記録する。

この文書を `probeReached` に渡すと、違反の証跡がないという理由だけで `false` になり、usecaseが `unreachable` finding を作る。偽の子センサーで `exit=0, findings=[], skipped=[{target:"OB-9999",reason:"timeout"}]` を返し、実adapterとusecaseを通したところ、**到達不能のfindingが2件生成された**。

修正方針: adapterは実行結果と証跡を復号し、検査完了・未検証を失わずに運ぶ。到達した／指定の探索範囲で到達しなかった／未検証という判定をドメイン側で表す。現在のportにも `failed` はあるため、まずtimeoutをそこへ正しく写し、未完了の探索から到達不能を導かないことが最小の修正となる。

**2. P1 — refinementの結果組成をusecaseが所有し、未検証記録を落とす**

箇所: `src/design/usecase/verify-design-quint-usecase.ts:259–290`。

通常の設計検証では `remapped.findings` と `remapped.skipped` の両方を回収する。一方、refinementでは `remapped.findings` のconflictだけを走査し、`remapped.skipped` は回収しない。追加した要件不変量がtimeoutやcompile-errorになっても、要件対象の未検証記録が消える。

既存refinement fixtureを読み、2回目のbackend実行で全lowered義務のtimeoutを返すと、**要件 `OB-1` が最終文書のskippedに存在しないまま `verified` が返った**。これは「全対象を検証済みか理由付き未検証として残す」という意味上の不変条件が、usecaseの配列操作に依存している結果である。

修正方針: refinementの実行結果から、要件対象ごとのfinding・skipを一緒に導く振る舞いをドメイン側へ集める。追加要件のID集合を使ってskipも写し、設計本体のskipとの重複を避ける。usecaseは実行と保存の順序を担当し、対象の検査状態を独自に組み立てない。

**3. P1 — Repositoryの寛容な復元が、不正文書を「検査済みで問題なし」に変える**

箇所: `src/requirements/adapter/verification-report-serializer.ts:29–49`、`src/requirements/adapter/verification-directory-repository-impl.ts:222–241`。design側にも同形の処理がある。

JSONオブジェクトなら必須項目が壊れていても復元し、`findings:null` と `skipped:null` を空配列にする。JSON配列などの非オブジェクトは `null` に変え、Repositoryの列挙で黙って除外する。呼び手にはどちらも取得成功として見える。

同じIRハッシュを持つ `quint.json` を `{irHash:...,findings:null,skipped:null}` にしたところ、正常なSMT文書との比較が成立した。実Finalizer・実Repositoryを通して、**QuintとSMTの2backendを比較済みとする、findingゼロのcross-check文書が保存された**。`quint.json` を `[]` にした場合も、取得は成功して兄弟が1件に減った。

これは原文を逐語で運ぶ「寛容な復元」と異なる。壊れているという情報を消して、業務上の正常値を補っている。後段は欠落前の情報を復元できない。既存テストはJSON構文エラーを検出するが、この意味上の欠落は検出しない。

修正方針: 復号段階で不正な形を明示する。未知の値を保持する必要があるなら、検証対象の文書と、比較に参加できる検証結果を区別する。文書の適格性判断はドメイン側で持ち、比較不能を `corrupt` または明示した未検証状態へ写す。Repositoryに出力スキーマの業務判断を戻す必要はない。

**4. P2 — 値オブジェクトが可変の式を公開し、モデルとハッシュの対応を壊せる**

箇所: `src/kernel/domain/expression.ts:5–11`、`src/kernel/domain/expression-tree.ts:27–43`、`src/requirements/domain/obligation.ts:42–46,67–71`。

`Expression` は再帰的に可変であり、`ExpressionTree` と `Obligation` は受け取った参照を保持して、そのまま返す。`#private readonly` が守るのは参照の再代入だけで、中身の変更ではない。visitor経由でも参照が外へ出る。

実Repositoryからモデルを読み、`obligation.assertion()` の式を書き換えると、**モデル内の式だけが変わり、`irHash` と `sourceDocument` は変わらなかった**。公開APIだけで実行でき、型の強制キャストは不要である。同じハッシュが別の検証内容を指すため、クロスチェック・陳腐化判定の前提を崩せる。

修正方針: ドメインが所有する式を再帰的に不変にする。入出力での防御コピー、またはコピーした木のdeep-freezeとreadonly型を組み合わせる。JSONとしての公開表現を残すことと、可変な内部参照を公開することは分ける。現行の実行経路で意図せず変更された事例までは確認しておらず、公開APIの不変条件欠陥としての指摘である。

**5. P2 — RefinementMaterialsのportに失敗を表す方法がなく、I/O例外と不正入力が別々の抜け道を通る**

箇所: `src/design/usecase/port/refinement-materials-repository.ts:17–18`、`src/design/adapter/refinement-materials-repository-impl.ts:66–88,150–158`。

portは常に集約を返す契約なのに、adapterの `readFileSync` が捕捉されていない。実fixtureの要件モデル位置をディレクトリに置き換えると、**`EISDIR` がportを越えて投げられた**。usecaseはPhase 1–2の結果をまだ保存していないため、この段階の例外で、それまでの検査結果も今回のレポートに残らない。

一方、不正JSONの場合は `inactive` に変わる。適用外と、適用対象の入力が壊れていて実行できない状態を呼び手が区別できない。`Result` を返さない例外は設計規則の既知事項だが、今回の指摘は単なる戻り型の不統一ではなく、例外漏出と検査状態の消失である。

修正方針: 適用外・取得失敗・入力不正・取得成功をportに明示し、OSの例外をadapter内で変換する。usecaseは各状態から保存する結果を決める。RepositoryかClientかの名称変更だけでは解決しない。

**6. P2 — 集約の整合性がFinalizerの呼び順に依存する**

箇所: `src/requirements/domain/verification-directory.ts:88–96`、`src/design/domain/design-verify-directory.ts:89–97`。呼び順の補償は `src/requirements/usecase/verification-report-finalizer.ts:32–54` とdesign側のFinalizerにある。

集約は「cross-checkは現在のreportsから導いたもの」と宣言している。しかし `conformedTo` は候補を降格してreportsを書き換えても、既存cross-checkをそのまま残す。

公開APIで `finalizing → crossChecked → conformedTo` を実行すると、**候補はunavailableなのに2backendが比較済みのまま残った**。同じ集約からcross-checkを再計算すると比較backendは0件になる。再現では `compose` が受け入れる不正methodを、同梱スキーマで降格させた。

現行Finalizerは先に候補へ適合処理を行うため、この経路を回避している。したがって通常のCLIで発生済みという指摘ではない。集約の不変条件を、外部のapplication collaboratorが手順で補償している設計欠陥である。

修正方針: 候補の適合・集合への反映・cross-check導出を、集約の一つの操作で完了させる。複数操作を残す場合でも、元データが変わった時点で派生結果を無効にする。これによりFinalizerの重複した `conformedTo` 呼び出しと、呼び順についての暗黙の前提を減らせる。

**検証記録**

既存テストは以下の9ファイルを実行し、**168 pass / 0 fail、1193 assertions** だった。

```sh
cd deep-spec-analysis
bun test tests/architecture.test.ts tests/package-boundaries.test.ts \
  tests/domain-primitives.test.ts tests/design-domain.test.ts \
  tests/requirements-domain.test.ts tests/refcheck-domain.test.ts \
  tests/design-usecase-collaboration.test.ts \
  tests/design-report-finalization.test.ts \
  tests/verification-report-finalization.test.ts
```

6件の再現は [reproduce.mjs](reproduce.mjs)、実測出力は [results.jsonl](results.jsonl)。リポジトリルートから次のコマンドで実行できる。

```sh
bun aidlc/spaces/default/intents/260904-ddd-clean-architecture/reviews/2026-09-05-ddd-clean-architecture/reproduce.mjs
```

スクリプトは既存fixtureを一時領域へ複製し、終了時にその領域を削除する。ソルバーのtimeoutはstub／偽の子センサーで注入した。実ソルバーの性能や全E2Eは今回の検証対象ではない。4と6は公開APIの欠陥の再現であり、現在のCLI経路での自然発生を示すものではない。

実装・既存テスト・設計規則は変更していない。保存したのは監査記録、再現スクリプト、実測出力のみ。

**次の進め方**

1. 推奨: 6件の修正へ進む。まず1–3の誤判定・記録欠落を塞ぎ、続いて4–6の不変条件と失敗契約を直す。
2. 修正前に、6件をIssueとして整理し、受け入れ条件と担当範囲を確定する。
3. 今回は監査記録だけで終了する。
