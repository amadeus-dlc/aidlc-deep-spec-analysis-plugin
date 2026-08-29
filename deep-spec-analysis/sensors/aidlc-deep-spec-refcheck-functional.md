---
id: deep-spec-refcheck-functional
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/aidlc-sensor-deep-spec-refcheck-functional.ts
default_severity: advisory
description: Solver-free reference/structure integrity checks for a unit's functional-design artifacts — entities.md well-formedness, BR rule ids and FR sources, state-machine vs allowed-values consistency, and domain-design entity drift; writes contract-2 findings to deep-spec-refcheck/functional-design.json (deep-spec-analysis plugin, advisory)
category: document-shape
matches: "**/functional-design/*.md"
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  findings_count: integer
  skipped_count: integer
  method: string
timeout_seconds: 10
---

# deep-spec-refcheck-functional sensor (deep-spec-analysis)

Deterministic, solver-free, LLM-free (phase 1 of the design-verification
extension). Fires on any markdown write inside a unit's `functional-design/`
record dir and runs the full catalog for that unit:

- **FD-E1..E6** `entities.md`: yaml parses with required keys and unique
  names; type-token coherence (allowed values ⇒ enumerable type, min/max ⇒
  numeric/date, unique ⇒ scalar); min ≤ max and default within range/allowed;
  relationship endpoints declared; cardinality from the closed set
  `1:1 | 1:N | N:1 | N:M` with a direction; attribute references resolve
- **FD-R1..R5** `rules.md`: yaml parses with required keys; ids match
  `BR{n}.{m}` and are unique; every `source` FR/NFR id exists verbatim in the
  intent's requirements.md; `applies-to` resolves against this unit's
  entities; category from the closed set
- **FD-S1/S2** `functional-spec.md` × `entities.md`: states in each
  `### State Machine: <Entity>[.<attribute>]` stateDiagram fence are allowed
  values of the lifecycle attribute, and every allowed value appears in some
  diagram state (dangling lifecycle values)
- **XS-1..3** cross-stage: a domain-design entity defined in two or more
  units (duplicated ownership), in no unit (dropped), or with attributes this
  unit's entities.md silently drops

Missing sibling artifacts skip their families with reason `absent-input`;
unparseable regions with `unrecognized-format` — never a crash, never
silence. Findings land in `deep-spec-refcheck/functional-design.json` in the
unit's record dir (contract 2, `method: static`, per-finding `unit`
attribution, self-validated before writing). `--report-only` computes
without writing.
