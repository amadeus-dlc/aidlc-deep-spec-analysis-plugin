---
target: functional-design
plugin: deep-spec-analysis
adds:
  sensors:
    - deep-spec-refcheck-functional
fragments:
  - anchor: end-of-steps
    order: 100
---

## fragment: end-of-steps

### Additional Step (deep-spec-analysis): Fix or record reference-integrity findings

Writing any of this unit's functional-design artifacts fires the
`deep-spec-refcheck-functional` sensor, which runs the full solver-free
catalog for the unit — entities.md well-formedness (types, ranges,
relationship endpoints, cardinality), rules.md integrity (BR id shape and
uniqueness, `source` FR/NFR ids existing in requirements.md, `applies-to`
resolving against the entities), state-machine ↔ allowed-values consistency
in functional-spec.md, and drift against the domain-design component
catalogue (duplicated or dropped entities, dropped attributes). It writes
`deep-spec-refcheck/functional-design.json` in this unit's record dir.

Before completing this unit, read that file. For every finding, either
**fix** the artifact (a phantom FR source, a state the entity model does not
allow, a dropped attribute — authoring errors, not judgment calls) or, when
the flagged shape is genuinely intended — e.g. an attribute deliberately not
carried into this unit — **record** it in `functional-spec.md`'s notes with
the finding's detail quoted. Do not leave a finding unaddressed and
unrecorded. Entries in `skipped[]` (an absent sibling artifact, an
unparseable region) mean those checks did not run — treat those areas as
unchecked when weighing design risk. When the findings file does not exist
(sensor not composed), skip silently.
