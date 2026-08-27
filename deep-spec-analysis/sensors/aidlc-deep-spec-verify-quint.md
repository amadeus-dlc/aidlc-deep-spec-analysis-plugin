---
id: deep-spec-verify-quint
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/aidlc-sensor-deep-spec-verify-quint.ts
default_severity: advisory
description: Quint backend (bounded via Apalache when available, otherwise seeded simulation) — checks the deep-spec IR's event machine for reachable obligation violations; writes contract-2 findings to deep-spec-verify/quint.json (deep-spec-analysis plugin, advisory)
category: document-shape
matches: "**/deep-spec-analysis-formal-model.md"
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  findings_count: integer
  skipped_count: integer
  method: string
timeout_seconds: 75
---

# deep-spec-verify-quint sensor (deep-spec-analysis)

State-machine verification backend. Compiles the IR (contract 1) to Quint in
TypeScript — the LLM never writes Quint — and shells out to the `quint` CLI
to check `state-temporal` obligations plus `event` obligations over the
bounded state schema:

- **conflict** — the event machine can reach a state violating an
  invariant/numeric/always obligation (the rules do not preserve it), or a
  leads-to obligation fails. Witness: a step-execution trace.
- **completeness-gap** — the machine deadlocks in a legal state (no event
  rule applies).
- **scenario-violation** — fully-bound, event-free scenarios evaluated
  through Quint's own engine. This deliberately duplicates the SMT backend's
  scenario check with an independent compiler and evaluator: it is the v1
  cross-check surface, and a disagreement (recorded as
  `cross-check-disagreement` in `deep-spec-verify/cross-check.json`) signals
  a formalization or compiler defect — distinct from a requirements defect.

Method selection (FR7.3): when Java and an Apalache distribution are
detected, `quint verify` runs bounded model checking (`method: bounded`);
otherwise `quint run` executes seeded simulation (`method: simulation`,
fixed seed — deterministic). Override with
`AIDLC_DEEP_SPEC_QUINT_METHOD=bounded|simulation`.

Results land in `deep-spec-verify/quint.json` (contract 2). Everything not
checked — leads-to under simulation, event or partially-bound scenarios,
uncompilable events, unbounded int attributes, timeouts — is recorded in
`skipped[]` with its reason.

## Degradation

If the `quint` CLI is missing, the findings file records `unavailable`, the
sensor reports tool-unavailable (exit 127), and the stage keeps running.
`/aidlc --doctor` carries the install advice.
