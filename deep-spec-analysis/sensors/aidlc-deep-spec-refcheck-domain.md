---
id: deep-spec-refcheck-domain
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/aidlc-sensor-deep-spec-refcheck-domain.ts
default_severity: advisory
description: Solver-free reference/structure integrity checks for the domain-design component catalogue — the seven components.md well-formedness rules (name uniqueness, declared references, no self-dependency, depends_on/dependents symmetry, single entity ownership, declared reference targets, acyclicity); writes contract-2 findings to deep-spec-refcheck/components.json (deep-spec-analysis plugin, advisory)
category: document-shape
matches: "**/components.md"
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

# deep-spec-refcheck-domain sensor (deep-spec-analysis)

Deterministic, solver-free, LLM-free (phase 1 of the design-verification
extension). Fires on every write of `components.md` and checks the fenced
yaml source-of-truth block against the seven well-formedness rules the
domain-design stage states in prose — rules nothing machine-checks otherwise:

- **DD-0** exactly one parseable yaml block with the documented shape
- **DD-1** component names PascalCase and unique
- **DD-2** every referenced component is declared (`reference-broken`)
- **DD-3** no self-dependency
- **DD-4** `depends_on`/`dependents` symmetry
- **DD-5** every entity owned by exactly one component, with an identifier
- **DD-6** every `references.entity` declared under its stated `owned_by`
- **DD-7** the dependency graph is acyclic (the witness lists the cycle)

Findings land in `deep-spec-refcheck/components.json` next to the artifact
(contract 2, `method: static`, self-validated against the findings schema
before writing). Families that ran clean are listed in `checked[]` — a clean
run is distinguishable from a family that never ran. YAML is parsed in a
fixed deterministic subset; out-of-subset input (anchors, aliases, tags,
flow maps) is a `structure-invalid` finding, never an interpretation guess.

`--report-only` (used by `/aidlc --doctor`) computes the verdict without
writing anything — how late adopters see structural debt before any stage
runs.
