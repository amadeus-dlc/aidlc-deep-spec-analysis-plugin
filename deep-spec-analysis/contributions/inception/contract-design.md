---
target: contract-design
plugin: deep-spec-analysis
adds:
  sensors:
    - deep-spec-refcheck-contract
fragments:
  - anchor: end-of-steps
    order: 100
---

## fragment: end-of-steps

### Additional Step (deep-spec-analysis): Fix or record reference-integrity findings

Writing `contract-summary.md` fires the `deep-spec-refcheck-contract`
sensor, which checks that contracts-table units exist in the units-generation
edge block, that every fenced spec block parses with its family discriminator
(`openapi:` + `paths`, `asyncapi:`, shared-schema), and that every inter-unit
dependency edge has a contract row. It writes
`deep-spec-refcheck/contract-summary.json` next to the artifact.

Before presenting the summary confirmation, read that file. For every
finding, either **fix** the summary (an undeclared provider unit or an
uncovered dependency edge is an authoring error, not a judgment call) or,
when the flagged shape is genuinely intended — e.g. a dependency edge that
deliberately carries no formal contract — **record** it in the summary's
Contract ownership rules or open-questions section with the finding's detail
quoted. Do not leave a finding unaddressed and unrecorded. Entries in
`skipped[]` (an absent units block, an unparseable region) mean those checks
did not run — say so when weighing the contract set's completeness. When the
findings file does not exist (sensor not composed), skip silently.
