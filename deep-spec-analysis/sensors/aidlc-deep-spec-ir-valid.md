---
id: deep-spec-ir-valid
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/aidlc-sensor-deep-spec-ir-valid.ts
default_severity: advisory
description: Validates the deep-spec formal model IR against the contract-1 JSON Schema, reverse-checks every frRefs id against requirements.md, and verifies the sourceDigest anchor (sha256 of requirements.md) so a drifted source is rejected (deep-spec-analysis plugin, advisory)
category: document-shape
matches: "**/deep-spec-analysis-formal-model.md"
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  findings_count: integer
  errors: string[]
timeout_seconds: 15
---

# deep-spec-ir-valid sensor (deep-spec-analysis)

Kernel-owned deterministic check for contract 1 (the deep-spec IR). Fires on
each write of `deep-spec-analysis-formal-model.md` and verifies, in order:

1. the artifact carries exactly one ```json fence holding the IR document;
2. the IR conforms to `{{HARNESS_DIR}}/tools/data/deep-spec-ir-schema.json`
   (irVersion, schema/obligations/scenarios/background compartments,
   expression grammar);
3. semantic well-formedness the schema cannot express: unique OB/SC/BG ids,
   resolvable `entity.attribute` references, enum literal membership, primed
   references only inside event effects;
4. reverse traceability: every `frRefs` id exists verbatim in the upstream
   `requirements.md` of this intent record.

A failing verdict means the *formalization* is broken, not the requirements:
the stage fixes the IR and rewrites the artifact (the sensor re-fires). The
verification backends do not trust this sensor — they re-parse defensively —
but their findings are only meaningful once this sensor passes.

## Advisory note

The framework has no blocking severity for write-fired dispatch, so a
`SENSOR_FAILED` here is REPORTED to the stage, never enforced. The stage
protocol treats it as a mandatory-fix signal before question generation.
