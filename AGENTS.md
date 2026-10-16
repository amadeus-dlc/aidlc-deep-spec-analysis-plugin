# aidlc-deep-spec-analysis-plugin

[AI-DLC v2](https://github.com/awslabs/aidlc-workflows) 向けの追加合成プラグイン `deep-spec-analysis` を開発するリポジトリ。LLM が `requirements.md` と設計を中間表現（IR）に形式化し、z3（SMT）と Quint が矛盾・欠落・シナリオ違反を検査する。

このリポジトリの開発には AI-DLC を使わない。2026-10-16 に AI-DLC のワークスペースを廃止し、開発は takt で進める（経緯は `deep-spec-analysis/docs/decisions.ja.md` の同日の項）。`.claude/`・`.codex/`・`aidlc/` などに AI-DLC の設定を足し戻さない。

## 構成

- `deep-spec-analysis/` — プラグイン本体。変更の対象は原則ここ。
  - `src/` — 原本。`tools/` は `src/entries/` から生成するバンドルなので手で編集せず、`bun scripts/build-tools.ts` で作り直す。
  - `stages/`・`sensors/`・`contributions/`・`knowledge/`・`.aidlc-plugin/` — 利用者のプロジェクトへ出荷するもの。
  - `tests/` — 出力のバイト一致を確かめる適合テスト。
- `docs/` — 利用者向けの文書（英日の対）と、開発の規則・知見（日本語のみ）。
- `.cache/aidlc-workflows/` — 開発と CI が使う上流 AI-DLC 2.8.1 の固定版（使い捨て、git の管理外）。中身を変更しない。

## 開発と検証

準備は README の「開発」節のとおり。検証は `deep-spec-analysis/` で次を流す（CI と同じ）。

```sh
bun run check                       # 整形・リント・層境界・文書言語
bun run typecheck
bun scripts/build-tools.ts --check  # tools/ が src/ と一致するか
bun test
bun ../.cache/aidlc-workflows/core/tools/aidlc-plugin-validate.ts .
```

- PATH に `aidlc` コマンドがあると、インストーラー（`scripts/install.ts`）はそれを使って compose する。版が合わないと `tests/intent-e2e.test.ts` が `unknown command 'plugin'` で失敗するので、そのときは PATH から外して流す。
- `scripts/prepare-quint-evaluator.ts` は Linux x64 の CI 専用で、macOS では失敗する。

## 従う規則

- いまの設計規則: `deep-spec-analysis/docs/architecture/design-rules.ja.md`
- 裁定の経緯: `deep-spec-analysis/docs/decisions.ja.md`。新しい裁定は英語版と日本語版の両方に追記する。
- 共有コーディング規則: `docs/coding-rules/README.md`
- 用語: `deep-spec-analysis/CONTEXT.ja.md`
- domain 層に置くのは、エンティティ・値オブジェクト・ファーストクラスコレクション・ドメインイベントを基本とする。ドメインサービスや、これ以外の種類のドメインオブジェクトを作るときは、実測した問題と対策を添えて、実装前に人間の裁定を得る。
- 外部仕様（契約1〜4、golden のバイト列、findings JSON、標準出力の verdict 行、文言、正準順、ソルバーの版固定）は原則として変えない。避けられない変更は、項目ごとに実装前に人間の裁定を得る。
- `deep-spec-analysis/` の中の Markdown は、英語版 `<name>.md` と日本語版 `<name>.ja.md` の対で書く（`lint:doc-language` が検査する）。
- コミットは Conventional Commits、英語、attribution 行なし。
