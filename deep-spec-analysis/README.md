# deep-spec-analysis — AIDLC plugin

English | [日本語](README.ja.md)

Kiro-style **Deep Spec Analysis** for AI-DLC v2: neurosymbolic requirements
verification as an additive plugin. The LLM formalizes `requirements.md`
into a backend-neutral IR; deterministic solver backends (z3/SMT and Quint)
check it for contradictions, completeness gaps, and scenario violations; and
every finding comes back to the human as a structured A/B question. Core is
never modified — disable the plugin and the vanilla workflow remains.
Inspired by Kiro's
[Deep Spec Analysis](https://kiro.dev/blog/deep-spec-analysis/).

## What it adds

| Piece | File | Purpose |
|---|---|---|
| Stage | `stages/inception/deep-spec-analysis-verify.md` | Inception stage after `requirements-analysis` (scopes: `enterprise`, `feature`). Produces `deep-spec-analysis-formal-model` + `deep-spec-analysis-report`. |
| Contract 1 (IR) | `tools/data/deep-spec-ir-schema.json` | Backend-neutral formal model: schema / obligations (EARS natures) / scenarios / background, anchored to the exact source text by `sourceDigest` (sha256 of requirements.md). No SMT-LIB or Quint anywhere in it. |
| Contract 2 (findings) | `tools/data/deep-spec-findings-schema.json` | Normalized per-backend results at `<record>/inception/deep-spec-analysis-verify/deep-spec-verify/<backend>.json`: findings, `skipped[]` with reasons (no silence), `unavailable`, canonical sort. |
| IR sensor | `sensors/aidlc-deep-spec-ir-valid.md` + `tools/aidlc-sensor-deep-spec-ir-valid.ts` (bundled from `src/entries/` + `src/requirements/{domain,usecase,adapter}/`) | Schema conformance + semantic checks + frRefs reverse-verified against requirements.md + `sourceDigest` recomputed and rejected on drift (the error carries the expected value). |
| SMT backend | `sensors/aidlc-deep-spec-verify-smt.md` + `tools/aidlc-sensor-deep-spec-verify-smt.ts` | IR→SMT-LIB compiled in TypeScript, z3 (`z3-solver` WASM) executed in a child process. Conflicts (unsat cores), completeness gaps (witness models), scenario checks. `method: exhaustive`. |
| Quint backend | `sensors/aidlc-deep-spec-verify-quint.md` + `tools/aidlc-sensor-deep-spec-verify-quint.ts` | IR→Quint compiled in TypeScript, `quint` CLI shell-out. Reachable invariant violations (step traces), deadlock gaps, leads-to temporal (bounded), scenario re-check. `method: bounded` with Apalache, else seeded `simulation`. |
| Cross-check | written by both backends | `deep-spec-verify/cross-check.json` — scenario verdicts compared across backends; a `cross-check-disagreement` flags a formalization/compiler defect, distinct from a requirements defect (FR8.2). |
| Knowledge | `knowledge/aidlc-product-agent/deep-spec-ir-authoring.md` | IR authoring rules for the product agent. |
| Downstream | `contributions/inception/domain-design.md` | Adds `deep-spec-analysis-report` as an optional consume of core `domain-design` + a step honoring accepted findings. |
| Refcheck sensors (design phase 1) | `sensors/aidlc-deep-spec-refcheck-{domain,contract,functional}.md` + `tools/aidlc-sensor-deep-spec-refcheck-*.js` (bundled from `src/refcheck/` + `src/kernel/`) | Solver-free, LLM-free reference/structure integrity for the design artifacts: the `components.md` catalogue (DD-0 block shape + the seven prose well-formedness rules DD-1..7), `contract-summary.md` unit/spec-block/DAG-edge checks, and per-unit functional-design checks (entities types/ranges/relationships, BR rule ids + FR sources, state machine ↔ allowed values, drift vs the component catalogue). Contributed to the core design stages via `adds.sensors` + fix-or-record fragments; findings in `deep-spec-refcheck/*.json` (contract 2, `method: static`, self-validated). |
| Design verify stage (phase 2) | `stages/construction/deep-spec-analysis-functional-verify.md` | Construction aggregator stage after `functional-design` (scopes: `enterprise`, `feature`): formalizes every unit's entities/rules/state machines into the design IR (contract 3, `tools/data/deep-spec-design-ir-schema.json` — native state machines with transitions, `ignores[]`, `initial`), runs the design backends, A/B/X gate, applies accepted design revisions (upstream freeze: never touches requirements). |
| Design backends (phase 2) | `sensors/aidlc-deep-spec-design-{ir-valid,verify-smt,verify-quint}.md` + `tools/aidlc-sensor-deep-spec-design-*.js` (bundled from `src/design/{domain,usecase,adapter}/`) | Compile-down reuse: each unit lowers to a contract-1 document and the proven v1 backends run it as child processes; findings remap to design vocabulary (DOB/TR/SM/DSC, per-unit attribution). New kinds via synthetic-vacuity riding: `unreachable` (dead guards; plus bounded-mode unreachable states, budget-capped) and `redundancy` (shadowed rules, mutual pairs collapsed); `deterministic: false` machines get `waived` skips. |
| Refinement (phase 3) | `tools/data/deep-spec-refinement-map-schema.json` + `src/refinement/domain/` + knowledge | The human-gated abstraction function (contract 4: attrMap expressions / total enumMaps, eventMap, the unmapped[] no-silence ledger, dual content-hash anchors) and the checks it enables inside the design backends: alpha-substituted requirements invariants (static via the v1 z3 child, reachable via Quint traces), event enabledness and one-step simulation with the abstract frame, scenario replay, and `mapping-gap` closure findings. Missing/stale inputs become explicit skips, never silence. |
| Doctor | `tools/deep-spec-analysis-doctor.ts` | Advisory availability checks (z3-solver, node, quint, Apalache) with install commands — the Apalache row verifies a trivial spec whenever a server is already listening on 8822, so it fails on an orphaned server that can no longer verify, requirements-verification coverage (unverified/stale intents — staleness by `sourceDigest` content hash, mtime only as legacy fallback), and a report-only structural-debt scan of existing design artifacts. |

## Install & prerequisites

Install an immutable stable tag directly into a project that already has
AI-DLC v2:

```sh
VERSION=v0.5.0
curl -fsSL "https://raw.githubusercontent.com/j5ik2o/deep-spec-analysis/${VERSION}/deep-spec-analysis/scripts/install.ts" |
  bun - --project <your-aidlc-project> --tag "${VERSION}"   # add --harness codex, kiro, … as needed
```

Without a source selector, the installer resolves the latest stable SemVer
tag. `--tag <tag>` pins an immutable release, `--from <repo-root>` uses a local
checkout, and `--ref <branch>` follows a moving development branch and should
not be used for reproducible installations. `--update` reuses the installation
source recorded on the previous run: latest resolves again, local and ref
reacquire the same source, and a fixed tag returns `Changed 0`. Do not combine
`--update` with a source selector.

The provenance record is written to
`<harness>/tools/data/deep-spec-analysis-install.json` in the target project,
where `<harness>` is a tree such as `.claude` or `.codex`. It includes the
version, resolved source, install time, and payload digest. The plugin is not
distributed as an npm package or a GitHub Release asset; remote installs fetch
GitHub source archives.

Required runtime: **bun** only. The backends degrade gracefully — everything
below is optional and advisory (`/aidlc --doctor` will tell you):

```bash
# SMT backend (z3): package in the project + a node runtime for the child process
bun add z3-solver          # in the AIDLC project root
# node >= 23 on PATH (z3-solver's pthread WASM build aborts in-process under current bun)

# Quint backend
npm i -g @informalsystems/quint
# optional, upgrades simulation -> bounded model checking:
#   install a JDK 17+ and run any `quint verify` once (downloads Apalache to ~/.quint)
```

To develop from a local checkout, validate or build it like any AIDLC plugin:

```bash
bun <checkout>/core/tools/aidlc-plugin-validate.ts .
bun <checkout>/core/tools/aidlc-plugin-build.ts . claude       # dist/claude/
bun <checkout>/core/tools/aidlc-plugin-test.ts . --install <project> --harness claude
```

## How the stage runs

1. The product agent EARS-classifies each FR/NFR and writes the IR into
   `deep-spec-analysis-formal-model.md` (one ```json fence).
2. The three write-fired sensors run in order: IR validation, then both
   backends, which write contract-2 findings under `deep-spec-verify/`.
3. The stage globs `deep-spec-verify/*.json` (backend-agnostic), converts
   each finding into an `[Answer]:` question — `A.` keep as-is / `B.` adopt
   the proposed revision / `X.` Other — and records the human's decisions.
4. `deep-spec-analysis-report.md` carries the coverage table (checked /
   skipped-with-reason / unavailable / unverified per obligation × backend)
   and the applied revisions. `B.`-accepted revisions are applied to
   `requirements.md` by the stage itself (the same product-agent persona
   that owns the artifact upstream), then re-verified in a second sensor
   pass; nothing is ever edited beyond the human-approved text.

Failures never block: a missing solver, a timeout, or an uncompilable
obligation becomes an `unavailable`/`skipped` record and a line in the
report. Determinism: same IR + same environment ⇒ byte-identical sensor
output (fixed seeds, canonical sorting, no timestamps).

## Tests

```bash
bun install --frozen-lockfile
bun run check        # Biome: format, lint, import order (read-only)
bun run typecheck    # TypeScript
bun test --coverage
```

Biome は Bun の開発依存としてバージョンを固定しています。`bun run check:fix` で
フォーマット・import 整理・安全な lint 修正をまとめて適用できます。
整形だけなら `bun run format`、lint の確認だけなら `bun run lint` を使います。
CI も `bun run check` を実行し、警告を含む未解決の指摘があれば失敗します。

対象は保守する `src/`・`scripts/`・`tests/` と開発用 JSON 設定です。
配布用の `tools/` は原本から再生成し、公開契約スキーマと期待値 fixture は
Biome の書換対象から除きます。整形規約は 2 スペース・120 桁・ダブルクォートです。

`tests/conformance.test.ts` drives both backends over the canonical fixture
(`tests/fixtures/conformance/`) and compares against expected findings
byte-for-byte, twice; it also exercises degradation (missing solver,
IR-version mismatch) and a forged cross-check disagreement.

Source and shipped artifact are separate trees. `src/` holds the TypeScript:
five bounded contexts (kernel / requirements / design / refinement / refcheck)
× four layers (infrastructure / domain / usecase / adapter), plus
`src/entries/` — the ten composition roots (nine sensors + the doctor, the
*entry* role) — with the contract schemas beside them in `src/entries/data/`,
so an entry resolves `data/` the same way in source and in the shipped
tree. `tools/` is the
shipped tree and holds nothing else: exactly ten `.ts` bundles (one per
entry) plus `data/`'s four schemas, generated by
`bun scripts/build-tools.ts` and committed. A shipped `tools/<entry>.ts` is
bundled JavaScript wearing a `.ts` filename — the AI-DLC sensor dispatcher
resolves a manifest `command` by looking for a token that ends in `.ts`, so
the name is part of the contract while the contents are not TypeScript.
`--check` regenerates and byte-compares, so a stale bundle fails CI. The layer DAG and style
discipline (private constructors in domain, no get accessors / TS enums /
non-null assertions, …) are enforced by `tests/architecture.test.ts` with
red examples, and byte parity against the migration base is pinned by
`tests/parity/` (see `tests/README.md` and `docs/decisions.md`).

## Future split (NFR4)

The internal structure keeps a strict backend = 1 sensor + 1 tool mapping so
a later 3-way split (`deep-spec-analysis` core / `-smt` / `-quint`) is
mechanical: move each backend's manifest+tool pair into its own plugin root,
add its `plugin.json`, and re-point the stage's `sensors:` list (the one
line per backend). Contracts 1 and 2 are the only coupling: backends never
import each other and cross-check reads sibling files generically.

See `docs/decisions.md` for spike results (z3-under-bun, quint determinism),
resolved open questions, and deviations from the original requirements
draft.

See [`docs/architecture/`](docs/architecture/README.md) for the DDD and Clean
Architecture design rules the source follows — the 35 rules, the decision
procedure for introducing a new type, the inventory of which rules are checked
mechanically, and the deviations that remain. Written to be portable to other
AI-DLC plugins.
