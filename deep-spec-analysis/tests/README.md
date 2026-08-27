# deep-spec-analysis tests

Run with `bun install && bun test` from the plugin root.

- `plugin.test.ts` — offline content validation via the sibling
  `aidlc-workflows` checkout's `aidlc-plugin-validate.ts` (set
  `AIDLC_WORKFLOWS_CHECKOUT` if the checkout lives elsewhere).
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
