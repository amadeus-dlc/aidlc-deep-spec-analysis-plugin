---
id: deep-spec-design-verify-quint
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/aidlc-sensor-deep-spec-design-verify-quint.ts
default_severity: advisory
description: Quint backend for the design IR (compile-down reuse of the v1 backend, method bounded with Apalache else seeded simulation) — reachable invariant violations with step traces, deadlocks, leads-to obligations, unreachable states (bounded, budget-capped), and scenario re-checks; writes contract-2 findings to deep-spec-design-verify/quint.json (deep-spec-analysis plugin, advisory)
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
timeout_seconds: 85
---

# deep-spec-design-verify-quint sensor (deep-spec-analysis)

Quint verification backend for the design IR (contract 3). Each unit is
lowered to a contract-1 document (transitions -> event obligations; ignores
-> explicit no-op events, so intended silence never reads as a deadlock) and
the PROVEN v1 Quint backend executes it in a child process. Findings return
remapped into design vocabulary with per-unit attribution:

- **conflict** — the machine reaches a state violating a design invariant
  (BR-origin rules included), with an ITF-decoded step trace and
  per-component attribution; leads-to obligations in bounded mode.
- **completeness-gap** — a deadlocked legal state (a cell neither a
  transition nor an `ignores` entry covers).
- **unreachable** — bounded mode only, budget-capped
  (AIDLC_DEEP_SPEC_QUINT_UNREACH_CAP, default 2): per non-initial machine
  state, a probe lowering carries the single invariant `attr != state`; a
  bounded verify whose violation trace never ends in the state means no
  execution reaches it within the bound. Simulation mode records the family
  as a capability skip — non-observation under random simulation is not
  evidence. States beyond the cap are skipped with the reason.
- **scenario-violation** — fully-bound, event-free DSC scenarios (the
  cross-check surface shared with the SMT backend).

Method: `bounded` (quint verify, Apalache) when Java and an Apalache
distribution are detected, else seeded `simulation`. Results land in
`deep-spec-design-verify/quint.json` (contract 2, self-validated) and the
shared cross-check is recomputed. A missing quint CLI degrades to an
`unavailable` document and exit 127.
