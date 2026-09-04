# Code Generation — Questions

対象: DDD／クリーンアーキテクチャ改善（`refactor` スコープ、Depth `Minimal`、Test Strategy `Minimal`、ゼロ Unit のステージ実行）

上流の確定事項（[`requirements.md`](../../inception/requirements-analysis/requirements.md) FR1〜FR8／NFR1〜NFR5、[`functional-spec.md`](../functional-design/functional-spec.md) Workflow 1〜6、[`rules.md`](../functional-design/rules.md) BR1.1〜BR8.4）は再質問しません。以下は、実装に入る前に実測で判明したギャップのうち、人間の判断が要るものだけです。

---

## Q1. 作業ツリーに既にあるゼロ Unit 修正（FR8）をどう扱うか

実測した現状です。

- `aidlc-workflows/core/tools/aidlc-lib.ts`: `summaryQuestionFiles` に `stateContent` 引数とステージレベル分岐が追加済み
- `aidlc-workflows/core/tools/aidlc-sensor-traceability.ts`: `functional-design` / `nfr-requirements` / `nfr-design` / `infrastructure-design` / `code-generation` のステージレベル上流解決と、`functional-design` の同階層 `rules.md` 解決が追加済み
- `aidlc-workflows/tests/unit/t281-sensor-traceability.test.ts` と `t320-review-confirmation-deadlock.test.ts`: ゼロ Unit の回帰試験が 1 件ずつ追加済み
- 7 harness の `dist/` すべてに反映済み。ワークスペース直下の `.codex/tools/` も `dist/codex` と一致済み
- **未達**: 判定関数 `usesStageLevelPerUnitArtifacts` は「units-generation が承認済みプラン上で `EXECUTE` でない」のままで、FR8.1 が求める「解決された Unit 集合がゼロ件（Units Generation が実行済みでも `SKIP` でも）」になっていない
- **未着手**: リリース情報（`core/tools/aidlc-version.ts` = `2.7.1` / README バージョンバッジ / `CHANGELOG.md`）。`aidlc-workflows/AGENTS.md` の Changelog Policy は、ユーザーに見える変更では同一コミットでこの 3 点を揃えることを要求しており、`tests/unit/t68-version-changelog-sync.test.ts` が整合を強制します

**選択肢**

- A. 既存差分を土台として採用し、判定条件の拡張・回帰試験の追加・リリース情報の更新だけを積み増す（推奨）
- B. 既存差分を破棄し、FR8 を最初から実装し直す
- C. 既存差分を採用したうえで、判定条件は現行の「units-generation が `EXECUTE` でない」のまま据え置く（FR8.1 の射程を実装済みの範囲へ狭める裁定を行う）
- X. Other (please specify)

[Answer]: A

---

## Q2. 「解決された Unit 集合がゼロ件」判定に切り替える適用範囲

実測: `usesStageLevelPerUnitArtifacts` は `aidlc-workflows/core/` 配下の 18 箇所から呼ばれ、成果物ディレクトリ解決、質問ファイル探索、レビュー窓とレシート判定、自律スワームの適格性、`unit start` / `unit complete` の拒否、ディレクティブ組み立てが同じ判定を共有しています。

判定材料の実測:

- `resolveBoltDag` は `unit-of-work-dependency.md` が無ければ `{ state: "none" }` を返す
- `parseBoltDag` は空の `units:` ブロックを `malformed` として弾くため、`{ state: "ok", units: [] }` は到達しない
- したがって「解決 Unit 集合がゼロ件」は `state === "none"` と同値で、`malformed` は従来どおり誤りとして表面化させる

**選択肢**

- A. 共有判定 1 箇所を「units-generation が `EXECUTE` でない、または解決 Unit 集合が `none`」へ拡張し、18 箇所すべてに同じ意味を及ぼす（推奨。FR8.2 の「特定 stage だけの例外実装にしてはならない」に最も素直）
- B. 成果物・質問・レビュー・traceability の解決経路だけ新判定に切り替え、`unit start` / `unit complete` の拒否など Unit 操作系は現行のプラン判定のまま残す
- C. 新判定を別関数として追加し、今回は FR8.2 が名指しする 5 stage の経路だけ移す（残り 13 箇所は現行のまま）
- X. Other (please specify)

[Answer]: A

---

## Q3. NFR1（本家互換の byte 同一）をどう証明するか

実測: golden fixture は `deep-spec-analysis/tests/fixtures/<suite>/expected/` にあり（`conformance` と `design` に `smt.json` / `quint.json` / `cross-check.json` ほか）、`bun test --coverage` で照合されます。今回は Refinement の Design 統合、lowering／verdict の責務移管、report finalization の再編で、findings・skips・cross-check の生成経路が広く動きます。

**選択肢**

- A. 既存 golden fixture の一致（全テスト green）をもって byte 同一の証明とし、追加採取はしない
- B. 変更前に SMT／Quint／refinement の実出力スナップショットを採取し、変更後と直接 byte 比較する専用の回帰試験を足す
- C. まず既存 golden の被覆範囲を洗い出し、覆われていない経路（cross-check 再構築の失敗系、同一ディレクトリの並行 writer など）にだけスナップショット比較を足す（推奨）
- X. Other (please specify)

[Answer]: C

---

## Consolidated Summary Confirmation

- Q1: A. 既存のゼロ Unit 修正を土台として採用し、判定条件の拡張・回帰試験の追加・リリース情報の更新だけを積み増す
- Q2: A. 共有判定 `usesStageLevelPerUnitArtifacts` を「units-generation が `EXECUTE` でない、または解決 Unit 集合が `none`」へ拡張し、`core/` 配下 18 箇所すべてに同じ意味を及ぼす
- Q3: C. 既存 golden fixture の被覆範囲を先に洗い出し、覆われていない経路（cross-check 再構築の失敗系、同一ディレクトリの並行 writer）にだけ比較試験を足す

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct

---

## Plan Approval

対象は [`code-generation-plan.md`](./code-generation-plan.md)（埋め込んだ `## Testing Contract` を含む）と [`unit-test-instructions.md`](./unit-test-instructions.md) です。

[Approval Fingerprint]: sha256:9ab387ba5d574a86cc6bb332b9bca73e90e8b03d51e22aac954c12007200f4c7

- Approve Plan
- Request Changes

[Answer]: Approve Plan
