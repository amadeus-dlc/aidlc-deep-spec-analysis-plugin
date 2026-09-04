# Requirements Analysis Questions

## Sources

- [desc] Initial description: DDD／クリーンアーキテクチャのレビュー指摘を修正する
- [scope] Workflow-selected scope: `refactor`（Depth: Minimal、Test Strategy: Minimal）
- `aidlc/spaces/default/codekb/deep-spec-analysis/business-overview.md`
- `aidlc/spaces/default/codekb/deep-spec-analysis/architecture.md`
- `aidlc/spaces/default/codekb/deep-spec-analysis/code-structure.md`

## Questions

### Q1. 今回の実装範囲

外部仕様を維持したまま、どこまでを同じ変更で扱いますか？

- A. 主要課題をまとめて修正 — report/cross-check 整合性、strict creation と tolerant hydration の分離、SMT／Quint重複削減、Refinement境界、`LoweredUnit`責務分割を扱い、`kernel/infrastructure` 改名は別 intent にする
- B. 完全性リスクを優先 — report/cross-check 整合性と strict creation のみを修正し、構造整理は後続 intent にする
- C. 全項目を修正 — A に加え、`kernel/infrastructure` の改名も同時に行う
- X. Other (please specify)

[Answer]: A. 主要課題をまとめて修正

### Q2. Refinement の境界

Refinement は独立 package ですが Design の出力型を直接生成しています。どの境界へ揃えますか？

- A. Design subdomain へ統合 — Design内部の refinement として配置し、公認横断エッジと出力型の越境を減らす
- B. 独立 bounded context を完成 — Refinement固有assessmentを返し、Design側のACLでfinding／skipへ変換する
- C. 現状維持 — package境界は変えず、他の課題だけ修正する
- X. Other (please specify)

[Answer]: A. Design subdomain へ統合

### Q3. report と cross-check の整合性

別ファイルという外部契約を保ちながら、更新途中の失敗や並行writerをどう扱いますか？

- A. 派生projectionとして明示 — immutable schema snapshot、directory lock、temp＋rename、失敗の値返却、古いcross-checkのstale扱いを導入する
- B. 厳密な同時切替 — versioned directoryとatomic pointerを導入し、複数ファイルを世代単位で公開する
- C. 最小修正 — schema二重読込だけを解消し、cross-checkの現行eventual consistencyは維持する
- X. Other (please specify)

[Answer]: A. 派生projectionとして明示

### Q4. 互換性境界

内部構造を変更しても、どの外部面を完全に維持しますか？

- A. 既存外部面をすべて維持 — 契約1〜4、findings JSON、stdout verdict、文言、正準順、golden bytes、solver pinを変更しない
- B. JSON shapeのみ維持 — 文言や順序、内部エラー分類の変更は許容する
- C. 必要なら契約も更新 — 設計改善を優先し、schemaやgoldenの変更を許容する
- X. Other (please specify)

[Answer]: A. 既存外部面をすべて維持

**User clarification（verbatim）:**

> 契約とか、ゴールデンはもちろん維持しないとね。
> 原則はAでは？
>
> でもどうしても変更しないといけない場合は人間裁定を個別にやるべきですね。
>
> 外部仕様は本家互換じゃないとダメです。

### Q5. ゼロ Unit 経路の不整合修正

Functional Design の検証で判明した、Unit を生成しない構成における質問確認・レビュー・traceability の不整合修正をどの Intent で扱いますか？

- A. 同じ Intent に含める — `deep-spec-analysis/` の設計改善と、その進行を妨げた AI-DLC のゼロ Unit 経路を一体で修正する
- B. 別 Intent に分ける — 現在の Intent は `deep-spec-analysis/` の設計改善だけに戻す
- X. Other (please specify)

[Answer]: A. 同じ Intent に含める

**User clarification（verbatim）:**

> 別Intentしないで含めて

## Consolidated Summary Confirmation

- 今回は report/cross-check 整合性、strict creation と tolerant hydration の分離、SMT／Quint重複削減、Refinement境界、`LoweredUnit`責務分割を扱う。
- `kernel/infrastructure` の改名は別 intent とし、今回の対象外にする。
- Refinement は Design subdomain へ統合し、Design出力型への横断依存を内部依存へ揃える。
- report/cross-check は派生projectionとして明示し、immutable schema snapshot、directory lock、temp＋rename、失敗の値返却、stale判定を導入する。
- 契約1〜4、findings JSON、stdout verdict、文言、正準順、golden bytes、solver pinを維持し、本家互換を必須とする。
- 外部仕様の変更が避けられない場合は、変更項目ごとに実装前の人間裁定を必須とする。
- Functional Design で実測したゼロ Unit 経路の不整合修正を別 Intent に分けず、同じ Intent に含める。canonical source、各 harness 向け生成物、現在の Codex 導入コピー、回帰テスト、リリース情報を一貫して更新する。

Does this all look correct before I generate the requirements artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
