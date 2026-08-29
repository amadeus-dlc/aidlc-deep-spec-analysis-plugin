---
target: domain-design
plugin: deep-spec-analysis
adds:
  consumes:
    - artifact: deep-spec-analysis-report
      required: false
  sensors:
    - deep-spec-refcheck-domain
fragments:
  - anchor: end-of-steps
    order: 100
---

## fragment: end-of-steps

### Additional Step (deep-spec-analysis): Honor Deep Spec Analysis Findings

If the directive's consumes resolve a `deep-spec-analysis-report.md` (the
deep-spec-analysis-verify stage ran upstream), read it before finalizing the
component catalogue:

- Findings the human decided to **accept as-is** (option A) are documented
  risks: carry each one into the affected component's design notes so the
  downstream implementation sees the known contradiction or gap.
- Findings with an **adopted revision** (option B) describe requirement
  changes that may not have landed in requirements.md yet: design the
  affected components against the revised wording quoted in the report, and
  say so in `decisions.md`.
- The report's Verification Coverage table lists obligations that were
  skipped or unverified: treat those requirement areas as *formally
  unchecked* when weighing design risk.

Reference `deep-spec-analysis-report.md` explicitly wherever it changed a
decision. When the artifact is absent, skip this step silently — the stage
is scope-dependent.

#### Fix or record reference-integrity findings (deep-spec-refcheck)

Writing `components.md` fires the `deep-spec-refcheck-domain` sensor, which
checks the seven well-formedness rules of the component catalogue (name
uniqueness, declared references, no self-dependency, depends_on/dependents
symmetry, single entity ownership, declared reference targets, acyclicity)
and writes `deep-spec-refcheck/components.json` next to the artifact.

Before presenting the summary confirmation, read that file. For every
finding, either **fix** the catalogue (structural defects — a dangling
component name, an asymmetric dependency, a cycle — are authoring errors,
not judgment calls) or, when the flagged shape is genuinely intended,
**record** it as an accepted risk in `decisions.md` with the finding's
detail quoted. Do not leave a finding unaddressed and unrecorded. When the
findings file does not exist (sensor not composed), skip silently.
