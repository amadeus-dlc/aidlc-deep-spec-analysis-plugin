---
id: deep-spec-refcheck-contract
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/aidlc-sensor-deep-spec-refcheck-contract.ts
default_severity: advisory
description: Solver-free reference/structure integrity checks for the contract-design summary — contracts-table units exist, spec blocks parse with their family discriminator, every unit-dependency edge has a contract row; writes contract-2 findings to deep-spec-refcheck/contract-summary.json (deep-spec-analysis plugin, advisory)
category: document-shape
matches: "**/contract-summary.md"
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

# deep-spec-refcheck-contract sensor (deep-spec-analysis)

Deterministic, solver-free, LLM-free (phase 1 of the design-verification
extension). Fires on every write of `contract-summary.md`:

- **CD-1** contracts-table rows parse; Provider Unit and Owner are units
  declared in units-generation's machine-readable `units:` edge block;
  Consumer is a declared unit or `External: …` (`reference-broken`)
- **CD-2** every fenced yaml spec block parses and carries its family
  discriminator: `openapi:` + `paths`, `asyncapi:`, or shared-schema
  (parseability only — full OpenAPI/AsyncAPI validation is out of scope)
- **CD-3** every inter-unit dependency edge has at least one contracts-table
  row for that (provider, consumer) pair, in either orientation
  (`consistency-mismatch`)

Declared units come from `unit-of-work-dependency.md`'s `units:` edge block —
the same block the framework computes its batch fan-out from. When it is
absent the unit-dependent families are skipped with reason `absent-input`;
never guessed, never silent. Findings land in
`deep-spec-refcheck/contract-summary.json` (contract 2, `method: static`,
self-validated before writing). `--report-only` computes without writing.
