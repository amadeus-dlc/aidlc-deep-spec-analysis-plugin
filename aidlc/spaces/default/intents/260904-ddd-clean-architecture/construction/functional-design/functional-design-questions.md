# Functional Design Questions

## Sources

- `aidlc/spaces/default/intents/260904-ddd-clean-architecture/inception/requirements-analysis/requirements.md`
- `aidlc/spaces/default/codekb/deep-spec-analysis/architecture.md`
- `aidlc/spaces/default/codekb/deep-spec-analysis/code-structure.md`
- `aidlc/spaces/default/memory/project.md`

## Questions

### Q1. Refinement subdomain の物理配置

独立packageを廃止した後、Refinementの語彙をDesign context内でどう整理しますか？

**Evidence:** `design/domain` は85ファイル、`refinement/domain` は37ファイル。basename衝突は`index.ts`のみ。例外的な`design/domain/refinement/`は既存の`<context>/<layer>`配置規則に存在しない。

- A. `design/domain/refinement/` に集約 — Design domain package内の明示的subdomainとして既存型をまとめ、`design-domain` facadeから必要な型だけ再輸出する
- B. `design/domain/` 直下へ統合 — Refinementという下位区分を残さず、既存Design型と同じ階層へ移す
- C. packageだけ統合 — ファイル配置は可能な限り維持し、workspace package境界だけを除去する
- X. Other (please specify)

[Answer]: B. `design/domain/` 直下へ統合

### Q2. 二ファイル更新の失敗時動作

backend reportとcross-checkは別ファイルのままなので、二回のrenameの途中で失敗する可能性があります。どう整合性を守りますか？

**Evidence:** 捕捉可能な例外ではbackup rollbackにより旧ペアを復元できた。一方、最初のrename直後のプロセスクラッシュ相当では`backend=new / cross-check=old`が残った。既存`writeFileAtomically`は1ファイルの完全性だけを保証し、複数ファイルtransactionとlockは実装されていない。

- A. backup付きrollback — lock内で両candidateを作り、各ファイルをatomic renameし、途中失敗時は直前のbackend／cross-check組へ復元して失敗を返す
- B. stale cross-checkを先に無効化 — lock内で古いcross-checkを先に除去し、backendと新cross-checkを個別atomic writeする。クラッシュ時は不整合な主張でなくcross-check欠落として残し、失敗を返す
- C. エラー通知のみ — 不完全な組合せを残し得るが、成功扱いだけを止める
- X. Other (please specify)

[Answer]: B. stale cross-checkを先に無効化

### Q3. 旧Refinement packageの互換shim

`@deep-spec/refinement-domain` はprivate workspace packageですが、移行時に旧importを残しますか？

**Evidence:** 参照はTypeScript 15ファイル、依存manifest 3個と旧package自身。外部公開packageではなく、全参照を同じ変更で更新できる。shimは旧境界を依存グラフへ残す。

- A. shimを残さない — 全内部importとmanifestを同時に更新し、旧packageを削除して境界を一本化する
- B. 一時shimを残す — 旧packageから`design-domain`を再輸出し、段階的に移行する
- C. packageを残す — facadeとして恒久維持し、実装だけDesignへ移す
- X. Other (please specify)

[Answer]: A. shimを残さない

### Q4. `LoweredUnit` の責務移管

新しいdomain serviceを作らず、buildとverdict解釈をどの既存objectへ移しますか？

**Evidence:** `LoweredUnit`は384行で、buildが161行、verdict解釈が135行。移管先候補は`DesignUnit` 127行、`SiblingVerdictDocument` 57行で、単純移管後の概算は約288行／192行。production呼出点は`LoweredUnit.of` 3か所、`remapVerdicts` 3か所（tests込み9か所／11か所）。新しいdomain serviceなしで既存objectへ移せる。

- A. 意味の所有者へ移す — `DesignUnit`／宣言群がloweringを行い、`SiblingVerdictDocument`が`LoweringIndex`を通してverdictをDesign語彙へ変換する
- B. `LoweredUnit`に残す — class内のprivate処理を整理するだけで公開責務は変えない
- C. domain serviceを新設 — 専用lowerer／translatorを作るため、別途人間裁定を行う
- X. Other (please specify)

[Answer]: A. 意味の所有者へ移す

## Consolidated Summary Confirmation

- Refinementの37ファイルは例外的な`design/domain/refinement/`を作らず、既存の`<context>/<layer>`規則に合わせて`design/domain/`直下へ統合する。衝突する`index.ts`は既存Design facadeへ統合する。
- backend reportとcross-checkの複数ファイル同時可視性は、外部契約を変えずには厳密保証できない。古いcross-checkを先に無効化し、directory lock下でbackendと新cross-checkを個別atomic writeする。クラッシュ時はstaleな主張でなくcross-check欠落として残し、処理は失敗を返す。
- `@deep-spec/refinement-domain`はprivate workspace packageで参照面がTypeScript 15ファイル・依存manifest 3個と限定されるため、互換shimを残さず同じ変更で全参照を更新する。
- `LoweredUnit`のbuild 161行は`DesignUnit`／宣言群へ、verdict解釈135行は`SiblingVerdictDocument`へ移す。`LoweredUnit`はlowered collectionsとindexの不変条件に集中し、新しいdomain serviceは作らない。
- 推奨選択肢は静的な変更面の計測、故障注入、既存テスト84件とtypecheckの基線に基づく。実測で保証できない性質は限界として設計文書に明記する。
- 契約1〜4、findings JSON、stdout verdict、文言、正準順、golden bytes、solver pin、本家互換を維持する。
- `conformedOf`は既存裁定どおりRepository境界に維持し、Finalizerが一度だけ呼んだ適合済みreportを再conformanceなしで保存する。実測はproductionの3 repository実装、7 usecase呼出し、3 store内再評価である。
- Directory lockは待機なし、128-bit以上のowner token、30秒lease、token一致解放、期限切れ時の再読込・atomic隔離で設計する。64 KiB二文書のtemp＋rename 1,000回はp99 0.534 ms、最大2.026 msだった。
- 解決済みUnit集合が0件なら、Units Generationの実行済み／`SKIP`を問わず、質問、review confirmation、traceabilityを同じstage-level path判定へ揃える。正本、全harness生成物、導入コピー、回帰試験、version、README badge、CHANGELOGを同期する。

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
