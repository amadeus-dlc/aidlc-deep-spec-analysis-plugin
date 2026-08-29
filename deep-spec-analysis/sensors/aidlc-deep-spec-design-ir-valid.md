---
id: deep-spec-design-ir-valid
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/aidlc-sensor-deep-spec-design-ir-valid.ts
default_severity: advisory
description: Design IR contract check (contract 3) — schema conformance, per-unit semantic well-formedness (ids, references, state machines), brRefs reverse-verified against each unit's rules.md, and the BR coverage rule; a FAILED verdict is the stage's mandatory-fix signal (deep-spec-analysis plugin, advisory)
category: document-shape
matches: "**/deep-spec-analysis-functional-formal-model.md"
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  findings_count: integer
  errors: array
timeout_seconds: 15
---

# deep-spec-design-ir-valid sensor (deep-spec-analysis)

Deterministic design-IR contract check for the functional formal model:

1. exactly one ```json fence carrying the design IR (contract 3,
   `irKind: "design"`, one entry per unit-of-work);
2. schema conformance against `tools/data/deep-spec-design-ir-schema.json`
   (whose expression grammar and attribute types are byte-identical
   duplicates of contract 1);
3. per-unit semantic well-formedness: unique ids per namespace
   (DOB/DSC/DBG/SM/TR), resolvable attribute references, enum literal
   membership, prime legality, and state-machine shape — the lifecycle
   attribute is a declared enum whose values are the state set,
   initial/from/to are its values, ignores collide with no transition, and a
   transition's effect never assigns the machine's own attribute
   (state' = to is implicit);
4. brRefs reverse-verified against `construction/<unit>/functional-design/
   rules.md`, plus BR coverage: every BR{n}.{m} in rules.md is referenced by
   an obligation/transition/scenario or listed in `unformalized[]` — the
   design-level no-silence ledger. Silence is a contract violation.

A FAILED verdict is the stage's mandatory-fix signal: repair the IR and
rewrite the model before generating questions (the backends still run and
degrade cleanly, but their findings on a malformed IR are noise).
