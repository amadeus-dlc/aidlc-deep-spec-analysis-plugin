# Code Generation Plan

## 目的

checkoutや`aidlc-workflows` submoduleに依存せず、公開tag・branch・local checkoutから`deep-spec-analysis`を導入・更新できるようにする。express scopeのzero-Unit実装として、Boltやper-Unit分割を使わず、以下の依存順でstage-levelに実装する。

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "project",
  "ordering": "Implement each testable layer, then write and run that layer's tests.",
  "scope": "express",
  "test_strategy": "minimal",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "project",
      "text": "- Testing Contract の plan_profile の層は実体に合わせて読み替える。DB と UI を持たないプロジェクトではその 2 層を落とし、Repository/data access を「層境界の解決経路」、Business logic を「境界を判定するアーキテクチャ規則」、API/endpoint を「出荷物の公開面」に対応づける。methodology（test-after）は変えない (learned 2026-09-03) \n- 生成物 tools/** をカバレッジ除外に足す必要はない。bun test --coverage の実測で tools/ は計測に一切現れない（すべて子プロセス実行で in-process 計測に乗らない） (learned 2026-09-03)"
    }
  ],
  "obligations": {
    "strategy": "minimal",
    "strategy_volume": [
      "One verifiable test per requirement at the narrowest effective level.",
      "At least one happy-path unit test per component.",
      "Unit tests are the default; a bugfix/security scope floor may require an integration or E2E regression when that is the narrowest level that reproduces the defect."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:8d6b33c2931f295d104c3479ad1678aaedfca6efa1d3015174714d4409327918",
  "contract_sha256": "sha256:7ddd297c4b3c229970273f26a7e1440cd7ddd80096d942cc31386912c0fbeacc"
}
```

## 変更方針

新しいdomain serviceやfacts／materials／ledger／generic record型は作らない。取得元、version、source kind、payload digestなどは値オブジェクトとして表現する。予期された入力・取得・検証失敗はthrowせず`Result`値で返し、entryまたはscript境界で終了コードと利用者向け文言へ変換する。

## 実装手順

### 0. PreToolUse hook互換性の修復

- `updatedInput`を返すPreToolUse hook応答には`permissionDecision: "allow"`を必ず含める。
- allow／deny／変更なしの3経路をadapter境界の回帰テストで固定する。
- 読み取り専用commandを計画前のworkspace mutationとして扱わないことを検証する。
- この修復は以降の実装を安全に実行するためのblocking prerequisiteとし、installer要件の挙動は変更しない。

### 1. Source acquisitionとselector

- `scripts/install.ts`からCLI解釈と手続きの配線を分離する。
- `deep-spec-analysis/`を直下に持つrepo rootだけを`--from`として受け付ける。
- `--from > --ref > --tag > latest`の優先順を実装する。
- GitHub tags APIからstable SemVerの最大値を選び、tag／branch archiveを一時`deep-spec-analysis/`へ安全に展開する。
- path traversal、root外symlink、manifest名／version／tag不一致を導入先変更前に拒否する。
- 対応要件: FR1.1–FR1.6、NFR1、NFR4、NFR6。

### 2. 導入先toolchainと既存transaction

- `<project>/<harness>/tools/aidlc-plugin-build.ts`、target定義、plugin testを導入先から解決する。
- builder不在時はAI-DLC本体の導入不足として停止する。
- build成功後だけ、既存refresh → recursive tombstone → no-clobber compose → doctorを実行する。
- `tools/`のbundle 10本＋`data/` 4本、`.ts`ファイル名、plugin-owned境界を維持する。
- 対応要件: FR2.1–FR2.5、NFR1、NFR4–NFR6。

### 3. Provenanceとupdate

- `<harness>/tools/data/deep-spec-analysis-install.json`を原子的に保存するadapterを追加する。
- `version`、`ref`、`source`、`installed_at`、`payload_sha256`を保存し、来歴JSON自身はhash・contributes・tombstoneから除外する。
- compose後のplugin-owned regular filesを相対pathのbyte順で正準化してSHA-256を求める。
- localは同じpath、refは同じbranch、fixed tagはno-op、latestは最新stable tagへ進める。
- 同じversionでもmutable sourceのhashが変われば更新し、完全一致なら`Changed 0`で来歴bytesとmtimeを変えない。
- 対応要件: FR3.1–FR3.6、NFR2–NFR4。

### 4. Doctor version advisory

- doctorのdomain／usecase／adapter／entryへ来歴とlatest tagの比較を追加する。
- GitHub不達時は`pass: true`のadvisory checkを残し、`label`にskip理由を書く。
- `{checks:[{pass,label,fix?,severity}]}`のshapeと既存checkの意味を維持する。
- 対応要件: FR4.1–FR4.3、NFR5。

### 5. ReleaseとCI

- `scripts/release.ts <version>`を追加し、cleanな`main`、stable SemVer、未使用tagをpreflightする。
- manifest version更新、英語release commit、`v<version>` tag、`git push --atomic`によるcommit＋tag公開を一括実行する。
- tag CIでtagとmanifest versionの一致を検査し、main push／PRの既存jobを維持する。
- 対応要件: FR5.1–FR5.4。

### 6. E2E、回帰、README

- `tests/intent-e2e.test.ts`へsubmodule不要の`--from`導入とsame-source `--update`の`Changed 0`を追加する。
- source、archive、manifest、provenance、doctor offline、release preflightを決定論的doubleで検査する。
- rootとpluginのREADME（日英）をtag-first Quickstart、stdin bootstrap、`--from`／`--ref`／`--tag`／`--update`、来歴の説明へ更新する。
- 対応要件: FR6.1–FR6.4、NFR1–NFR6。

## Blast Radius

| 対象 | consumer／参照元 | 影響 | 方針 |
|---|---|---|---|
| Codex PreToolUse adapter／plan approval guard | Codex CLI 0.152.0、全PreToolUse hook | High | `updatedInput`と`permissionDecision`のschema整合を回帰テストで固定 |
| `deep-spec-analysis/scripts/install.ts` | 利用者、intent E2E、README | High | 配線役へ縮小し、既存refresh／tombstone／composeを維持 |
| `deep-spec-analysis/scripts/release.ts`（新規） | maintainer、CI、git remote | High | 全preflight後にatomic push |
| installer関連のdomain／usecase／adapter（新規） | installer entry、tests | High | 依存方向と`Result`規律を維持 |
| doctor domain／usecase／adapter／entry | doctor consumer、doctor tests | Medium | 公開JSON shapeを維持 |
| `deep-spec-analysis/scripts/build-tools.ts` | bundle 10本＋data 4本 | Medium | 出荷集合を変えずprovenanceを含めない |
| `deep-spec-analysis/tests/intent-e2e.test.ts` | installer全経路 | Medium | networkを使わないfixture／doubleで決定論化 |
| `.github/workflows/ci.yml` | PR、main、tag | Medium | tag triggerとversion一致checkを追加 |
| 日英README | 利用者、maintainer | Low | tag導入を最短経路にし、開発用`--ref`を分離 |

## 要件トレーサビリティ

| 要件 | 実装面 | テスト面 |
|---|---|---|
| FR1 / NFR1,4,6 | selector、GitHub client、safe archive | selector、stable tag、malicious archive、failure immutability |
| FR2 / NFR1,4,5 | destination toolchain、installer transaction | missing builder、14 files、CLEAN、tombstone |
| FR3 / NFR2,3,4 | provenance repository、payload digest、update policy | atomic write、same-source no-op、mutable source update |
| FR4 / NFR5 | doctor version check | newer tag、offline pass、JSON compatibility |
| FR5 | release script、tag CI | dirty/non-main/existing tag、atomic push double、mismatch CI |
| FR6 / NFR1–6 | E2E、README | full regression matrix、documentation assertions |

## Baseline

実装開始前に、次を記録する。

1. `cd deep-spec-analysis && bunx tsc --noEmit`
2. `cd deep-spec-analysis && bun test --coverage`
3. `cd deep-spec-analysis && bun scripts/build-tools.ts --check`
4. 現行plugin validate、7 harness build、`aidlc-plugin-test`の`CLEAN`
5. `deep-spec-analysis/tools/`が正確に14ファイルであること

## 完了時の検証

- 各実装レイヤー直後に`unit-test-instructions.md`の対象テストを追加・実行する。
- `bunx tsc --noEmit`、全`bun test --coverage`、bundle drift、architecture tests、goldenを通す。
- plugin validate、7 harness build、`aidlc-plugin-test`の`CLEAN`と`Changed 0`を確認する。
- `tools/` 14ファイル、doctor JSON shape、`.ts`公開名が不変であることを確認する。
- `git diff --check`とsecret scanを通す。

## Rollback

- installerは取得・検証・build完了前に導入先を変更しない。
- provenanceはcompose成功後のatomic renameでのみ更新し、失敗時は旧来歴を残す。
- release preflight失敗時はcommit／tag／pushを行わない。remote公開は`git push --atomic`で片側だけの反映を避ける。
- rollbackで既存refresh／tombstone／compose、14ファイル、golden、architecture ruleを弱めない。
