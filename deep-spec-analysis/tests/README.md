# deep-spec-analysis tests

Run with `bun install && bun test` from the plugin root.

- `plugin.test.ts` — offline content validation via the sibling
  `aidlc-workflows` checkout's `aidlc-plugin-validate.ts` (set
  `AIDLC_WORKFLOWS_CHECKOUT` if the checkout lives elsewhere).
- `intent-e2e.test.ts` — the deterministic end-to-end path, replayed on a
  throwaway vanilla AI-DLC install: `scripts/install.ts` (store harness ⇒
  compose only, no folder-drop) → real intent minting via
  `aidlc-utility.ts intent-create` → scope routing (classic SKIPs the
  stage, feature EXECUTEs it) → all three sensors fired from the INSTALLED
  `.claude/tools` against the intent's record, with the planted conflicts
  and completeness gap of `fixtures/intent-e2e/` asserted. The LLM
  conversation layer (formalization, A/B gate, report) is out of scope —
  fixtures stand in for it, so this is an integration suite, not a full E2E.
- `conformance.test.ts` — the contract conformance suite (FR12): both
  backends run against `fixtures/conformance/` (a canonical IR with
  intentionally embedded static-rule and state-machine defects) and must
  reproduce `fixtures/conformance/expected/*.json` byte-for-byte, twice.
  Degradation paths (missing solver, IR version mismatch) and the
  cross-check disagreement path are covered as well.

Solvers are exact-pinned devDependencies (`z3-solver`,
`@informalsystems/quint`) so expected files stay stable; the quint backend
is forced to `simulation` in tests. A `node` runtime is required for the
z3 child process (tests skip the SMT assertions with a warning if absent).

Fixtures live here (never under `tools/` — compose refuses test payloads in
the shipped tree).
