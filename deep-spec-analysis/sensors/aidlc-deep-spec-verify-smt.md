---
id: deep-spec-verify-smt
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/aidlc-sensor-deep-spec-verify-smt.ts
default_severity: advisory
description: SMT backend (z3, method exhaustive) — checks the deep-spec IR for conflicts, completeness gaps, and scenario violations; writes contract-2 findings to deep-spec-verify/smt.json (deep-spec-analysis plugin, advisory)
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

# deep-spec-verify-smt sensor (deep-spec-analysis)

SMT verification backend. Compiles the IR (contract 1) to SMT-LIB in
TypeScript — the LLM never writes solver syntax — and executes z3
(`z3-solver`, WASM) to check the natures `invariant`, `event`, and `numeric`:

- **conflict** — obligations that cannot hold together: global joint
  unsatisfiability, implication conditions annihilated by sibling rules
  (vacuity), and same-trigger event pairs with overlapping guards but
  contradictory effects. Attributed to FR ids via unsat cores.
- **completeness-gap** — a legal input state that no rule of a trigger
  covers (witness model attached): unspecified behavior.
- **scenario-violation** — Gherkin-derived accept examples the obligations
  rule out, and reject examples they fail to exclude.

Results land in `deep-spec-verify/smt.json` next to the formal model
(contract 2, `method: exhaustive`), and the shared
`deep-spec-verify/cross-check.json` is recomputed. Obligations outside this
backend's coverage (state-temporal natures, event scenarios), compile
failures, and timeouts are recorded in `skipped[]` — never silently dropped.

## Degradation

z3 runs in a child process (`node` preferred, `bun` fallback — z3's
Emscripten pthread build aborts in-process under current bun). If neither
runtime can execute z3, or the `z3-solver` package is not installed in the
project, the findings file records `unavailable` and the sensor reports
tool-unavailable (exit 127). The stage keeps running; `/aidlc --doctor`
carries the install advice.
