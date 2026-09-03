# deep-spec-analysis tests

English | [日本語](README.ja.md)

Run with `bun install && bun test` from the plugin root.

The suites that spawn a sensor drive the SHIPPED artifact — the bundles
under `tools/`, generated from `src/entries/` by `bun scripts/build-tools.ts`
— never a `src/` source file. Each bundle keeps a `.ts` filename (the AI-DLC
sensor dispatcher resolves a manifest `command` by looking for a token ending
in `.ts`) but its contents are bundled JavaScript. Regenerate `tools/` after
touching `src/`, or the spawn suites exercise the previous build.

- `plugin.test.ts` — offline content validation via the sibling
  `aidlc-workflows` checkout's `aidlc-plugin-validate.ts` (set
  `AIDLC_WORKFLOWS_CHECKOUT` if the checkout lives elsewhere).
- `intent-e2e.test.ts` — the deterministic end-to-end path, replayed on a
  throwaway vanilla AI-DLC install: `scripts/install.ts` (store harness ⇒
  compose only, no folder-drop) → real intent minting → scope routing
  (classic SKIPs, feature EXECUTEs) → sensors fired from the INSTALLED
  `.claude/tools` bundles — including through the REAL dispatcher
  (`aidlc-sensor.ts fire`) — against the intent's record. Covers the
  upgrade path (a stale composed schema is refreshed by the installer),
  the phase-1 refcheck scenario (broken record → doctor debt → fixed →
  doctor quiet), phase-2 design verification (graph routing, `--single`,
  per-unit doctor coverage unverified → verified → stale, completion
  evidence), phase-3 refinement (dispatcher fire, refinement-stale), and the
  `sourceDigest` anchor (a requirements edit is caught by content hash even
  when the model's mtime claims freshness).
  The LLM conversation layer (formalization, A/B gate, report) is out of
  scope — fixtures stand in for it, so this is an integration suite, not a
  full E2E.
- `conformance.test.ts` — the v1 contract conformance suite: both backends
  run against `fixtures/conformance/` (a canonical requirements IR with
  intentionally embedded static-rule and state-machine defects) and must
  reproduce `fixtures/conformance/expected/*.json` byte-for-byte, twice.
  Degradation paths and the cross-check disagreement path are covered.
- `refcheck.test.ts` — phase-1 conformance: byte goldens for the
  solver-free reference-integrity sensors over broken/clean records, the
  no-silence `checked[]` families, degradation, `--report-only`, and the
  schema conformance of EVERY golden findings file in the repository.
- `design-verify.test.ts` — phase-2 conformance: design-IR validation
  (positive/negative fixtures), byte goldens for the design backends
  (compile-down reuse; `unreachable`/`redundancy` kinds, the ignores cell
  never reporting), contract separation (a v1 model never fires the design
  sensors and vice versa; shared schema definitions byte-identical), the
  `deterministic: false` waiver, and degradation.
- `refinement.test.ts` — phase-3 conformance: byte goldens for the
  refinement checks under the human-gated map (a static AND reachable
  invariant break, an admitted reject scenario, an enabledness hole, a
  waived obligation, an attribute-closure violation), plus degradation
  (absent map, stale hashes, missing unit entry) — always explicit skips,
  never silence.
- `build-tools.test.ts` — the generator's drift guard (committed `tools/`
  matches `src/`, and `--check` names a changed/missing/extra bundle),
  determinism (two runs are byte-identical), and the shipping shape (exactly
  10 `.ts` bundles + 4 schemas under `data/`, no bare `.js` artifact, each
  bundle under the size ceiling).

Solvers are exact-pinned devDependencies (`z3-solver`,
`@informalsystems/quint`) so expected files stay stable; the quint backend
is forced to `simulation` in tests (bounded/Apalache is exercised live on
the sandbox). A `node` runtime is required for the z3 child process (tests
skip the SMT assertions with a warning if absent).

Fixtures live here (never under `src/` or `tools/` — the `no-test-payloads`
architecture rule refuses them in the source tree, and compose refuses them
in the shipped tree).

## Post-migration internal suites (DDD / Clean Architecture)

- `architecture.test.ts` + `architecture/rules.ts` — the layer DAG
  (infrastructure→domain→usecase→adapter, four sanctioned cross-context
  edges only), entry-only process.*/import.meta, no `export *` facades,
  private-constructor discipline in domain, and bans on get accessors,
  TS enums, and non-null assertions. Every rule proves its detection power
  on inline fixtures (red examples) before scanning the real tree. The
  old LEGACY_FILES exemption was emptied in PR10 — the only flat files
  under `src/` are the ten `src/entries/` composition roots.
- `parity/` — byte-parity snapshots of every pipeline output against the
  pre-migration (pre-PR7) base; fails unless `diff -r` is empty.
- `kernel-domain.test.ts`, `aggregate-ids.test.ts`, `ir-validation.test.ts`,
  `kind-rank.test.ts` — unit pins for the kernel/context domain primitives,
  first-class collections, decl bundles, and the frozen finding-kind order.
- `verify-smt-pipeline.test.ts`, `verify-quint-pipeline.test.ts`,
  `design-pipeline.test.ts`, `refinement-pipeline.test.ts`,
  `refcheck-{domain,pipeline,report}.test.ts` — integration suites driving
  each layered vertical (domain/usecase/adapter chains) through both
  in-memory doubles and the real Impls, including golden equivalence with
  the real solvers.
