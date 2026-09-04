---
name: plugin-dev
depth: Standard
keywords: []
description: AI-DLC v2 プラグイン開発 — contributions・manifest・tests を設計付きで作り、validate/build で検証する
skeleton: off
runner: true
---

# plugin-dev scope

このワークスペースで AI-DLC v2 プラグイン（`.aidlc-plugin/plugin.json` と
`contributions/<phase>/<stage>.md` の overlay 断片、bun テスト、drift guard）を
開発するための Standard depth のスコープ。Ideation は intent-capture のみ、
Inception は reverse-engineering → requirements-analysis → domain-design →
units-generation、Construction は functional-design → code-generation →
build-and-test の 11 ステージで、Operation フェーズは持たない。composer の
提案から起こし、各ステージの `scopes:` フロントマターに登録した stock
スコープで、既存 11 スコープのどれにも当てはまらない「フレームワーク内で
新しい能力を足す」種類の作業を受け持つ。aidlc-grilling-plugin で確立した
スコープをこのリポジトリに取り込んだもの。

## Why these stages, why skip those

プラグインは単一パッケージに集約されているが、その挙動は vendored エンジン
（`aidlc-workflows/`）の compile / overlay merge / 7 ハーネス projection という
設定駆動の仕組みで決まる。そのため brownfield の `reverse-engineering` で
エンジンの拡張点と現行プラグイン構造を local codekb store に写し、
`requirements-analysis` で contributions の機能分解・制約（エンジン版ピン、
ハーネス移植性）・対象外を仕様化する。`intent-capture` は短く汎用な依頼を
「どの能力を・誰のために・なぜ」に固定する低コストの枠として残す。

設計は 2 段で持つ。`domain-design` は contributions-only か
stages / agents / sensors / `src/` を持つかといった構成決定と ADR を担い、
feasibility をここに吸収する。`functional-design` は断片を横断する挙動規則
（質問プロトコル、帳簿の書き方）や tool ロジックを生成前に設計する。
`code-generation` が実装し、`build-and-test` が typecheck・drift check・
bun test・aidlc-plugin-validate・7 ハーネス build を回して検証する。

`units-generation` は、プラグインの規模が小さくても EXECUTE にする。
Units Generation を SKIP した「Unit を切らない」ワークフローでは、Unit ごとの
ステージ（functional-design、code-generation など）の成果物がステージ直下
（`construction/<stage>/`）に置かれるが、エンジン v2.7.1 時点の 2 つの検査は
`construction/<unit>/<stage>/` しか見ない。レビュー依頼と承認ゲートの
「確認済みの検査」は質問ファイルを見つけられずに依頼とゲートを拒否し
（[awslabs/aidlc-workflows#1020](https://github.com/awslabs/aidlc-workflows/issues/1020)）、
traceability センサーは Unit を導けずに必ず失敗する
（[awslabs/aidlc-workflows#1011](https://github.com/awslabs/aidlc-workflows/issues/1011)）。
このリポジトリではフレームワークを書き換えない（`aidlc-workflows/` は開発対象外）ので、
refactor scope で回した Intent `260904-ddd-clean-architecture` では導入コピーへの
暫定パッチで回避し、その後の裁定で戻した（追跡: issue #138）。Units Generation を
回して Unit を 1 つ以上切れば、Unit ごとのステージは `construction/<unit>/` 配下に
成果物を置き、どちらの検査も本来の経路で動く。Unit は 1 つ（例: contributions と
scripts と tests をまとめた 1 Unit）で構わない。上流の修正が入ってエンジンを
更新したら、SKIP に戻すかどうかを見直す。

SKIP の理由は「別の EXECUTE ステージか既存の資産が同じ成果を出す」か
「この種の作業にその成果物の消費先がない」のどちらか。
`market-research` / `team-formation` / `rough-mockups` / `refined-mockups` /
`user-stories` は市場・チーム・UI・複数ペルソナがない開発者ツールには
消費先がない。`feasibility` と `scope-definition` はそれぞれ `domain-design` と
`requirements-analysis` の out-of-scope に折り込む。`approval-handoff` は
Ideation が intent-capture 1 つなので brief に新情報がなく、intent-capture の
ゲートが handoff になる（stock `poc` と同じ扱い）。`practices-discovery` は
brownfield の慣行が既存コードと CI に体現済みなので折り込むが、`team.md` を
確定したい初回だけ un-SKIP する価値がある。`delivery-planning` は外す:
Unit の並び順はエンジンが `unit-of-work-dependency.md` から計算するので
Bolt 計画がなくても Construction は回り、`skeleton: off` で最初の Bolt に
bootstrap すべきものもないため、Bolt 計画の消費先がない（新ステージ・
エージェント・センサー・tools を跨ぐ大型プラグインで Bolt を分けたくなったら
un-SKIP する）。`contract-design` は契約がフレームワーク所有で
`aidlc-plugin-validate` が強制するため外す。NFR・インフラ・`ci-pipeline` は
既存 CI と requirements の constraints が担い、Operation フェーズは配布物が
リポジトリ内容（contributions と harness projections）で完結するため全て
SKIP。レジストリ公開やリリース運用を始める時に deployment 系を un-SKIP する
（このリポジトリの配布は `refactor` 等の stock scope が持つ deployment 系と
`scripts/release.ts` のタグ運用で行う）。

## Membership

Keyword triggers: なし（`keywords: []`）。推論では選ばれず、
`/aidlc --scope plugin-dev` で明示指定するか、`/aidlc-plugin-dev` ランナーで
起動する（`runner: true`）。Initialization 3 ステージに
加えて `intent-capture`、`reverse-engineering`、`requirements-analysis`、
`domain-design`、`units-generation`、`functional-design`、`code-generation`、
`build-and-test` が EXECUTE、残る 22 ステージは SKIP。`skeleton: off` —
プラグインは既に build が通る状態にあり、最初の Bolt に bootstrap すべきものがない。
