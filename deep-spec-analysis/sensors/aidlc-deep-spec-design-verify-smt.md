---
id: deep-spec-design-verify-smt
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/aidlc-sensor-deep-spec-design-verify-smt.ts
default_severity: advisory
description: SMT backend for the design IR (z3, method exhaustive, compile-down reuse of the v1 backend) — rule/transition conflicts, dead guards (unreachable), shadowed rules (redundancy), state x trigger completeness with ignores waivers, and scenario checks; writes contract-2 findings to deep-spec-design-verify/smt.json (deep-spec-analysis plugin, advisory)
category: document-shape
matches: "**/deep-spec-analysis-functional-formal-model.md"
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

# deep-spec-design-verify-smt sensor (deep-spec-analysis)

SMT verification backend for the design IR (contract 3). Each unit is
lowered to a contract-1 document — transitions become event obligations with
the implicit `state == from` guard and `state' = to` effect; ignores become
explicit no-op events — and the PROVEN v1 SMT backend executes it in a child
process. Findings return remapped into design vocabulary (DOB/TR/SM/DSC ids,
per-unit attribution):

- **conflict** — nondeterministic same-(state,trigger) transition pairs and
  same-trigger rules with overlapping guards but contradictory effects
  (unsat cores); machines declaring `deterministic: false` have these
  converted to `skipped[reason: waived]` — a model waiver, never silence.
- **unreachable** — a dead rule/transition: its guard is unsatisfiable under
  the entity constraints (a synthetic tautological invariant rides the v1
  antecedent-vacuity query — no new solver plumbing).
- **redundancy** — a rule/transition subsumed by a same-trigger sibling with
  a provably wider guard and an identical effect; mutual subsumption
  collapses to one "equivalent" finding.
- **completeness-gap** — a legal state x trigger cell no transition covers
  and no `ignores` entry waives (witness model attached).
- **scenario-violation** — fully-bound, event-free DSC scenarios (the
  cross-check surface shared with the Quint backend).

Results land in `deep-spec-design-verify/smt.json` (contract 2,
`method: exhaustive`, self-validated), and the shared
`deep-spec-design-verify/cross-check.json` is recomputed. Degradation
mirrors v1: a missing solver becomes an `unavailable` document and exit 127;
budget overruns close into `skipped[reason: timeout]` per unit.
