---
slug: deep-spec-analysis-functional-verify
number: 3.55
name: Deep Spec Functional Design Analysis
plugin: deep-spec-analysis
phase: construction
execution: CONDITIONAL
condition: Execute when at least one construction/<unit>/functional-design record exists; skip when no unit produced functional-design artifacts.
lead_agent: aidlc-architect-agent
support_agents: []
mode: inline
summary_confirmation: if-present
produces:
  - deep-spec-analysis-functional-formal-model
  - deep-spec-analysis-functional-report
optional_produces:
  - deep-spec-analysis-refinement-map
consumes:
  - artifact: requirements
    required: true
  - artifact: components
    required: false
  - artifact: contract-summary
    required: false
  - artifact: deep-spec-analysis-formal-model
    required: false
  - artifact: deep-spec-analysis-report
    required: false
requires_stage:
  - functional-design
sensors:
  - deep-spec-design-ir-valid
  - deep-spec-design-verify-smt
  - deep-spec-design-verify-quint
scopes:
  - enterprise
  - feature
inputs: every construction/<unit>/functional-design record (entities.md, rules.md, functional-spec.md), requirements.md, design IR authoring guide (knowledge)
outputs: deep-spec-analysis-functional-formal-model.md, deep-spec-analysis-functional-report.md (under this stage's record dir, engine-resolved)
---

# Deep Spec Functional Design Analysis

MANDATORY: Follow stage-protocol.md for the complete execution protocol — context loading, question files, human gates, memory, and completion handoff.

Neurosymbolic verification of the functional design. You (the LLM) do the
*semantic* half: formalize each unit's entities.md, rules.md, and
functional-spec.md state machines into the backend-neutral design IR
(contract 3, native state machines). Deterministic sensors do the *symbolic*
half: solver backends check every unit for rule conflicts, dead and
redundant rules/transitions, uncovered state x trigger cells, invariant
violations reachable by the machine, and scenario breaks. You then translate
every finding back into design language and put it to the human as a
structured A/B decision. You never write SMT-LIB or Quint; you never edit
`requirements.md` or the requirements formal model (upstream freeze); the
only files you may change are this unit's design artifacts, and only with
the revisions the human explicitly accepted (`B.` answers).

This is a NON-per-unit aggregator stage: it walks every unit's
functional-design record itself, so a late-adopting project can run it with
`/aidlc --stage deep-spec-analysis-functional-verify --single` against
records that predate the plugin.

## Steps

### Step 1: Load Prior Context and Enumerate Units

Read `requirements.md` from the directive's consumes. Enumerate the units by
walking `<record>/construction/*/functional-design/` — never assume the unit
list. For each unit read `entities.md`, `rules.md`, and
`functional-spec.md` (whichever exist; a UI-only unit may carry only
`functional-spec.md`). The IR authoring rules are in
`{{HARNESS_DIR}}/knowledge/aidlc-architect-agent/deep-spec-design-ir-authoring.md`
— follow them exactly; the sensors enforce the contract they describe.
Units listed in the unit-of-work DAG that have no functional-design record
are reported as unverified in Step 7 — never silently dropped.

### Step 2: Re-establish Reference Integrity (refcheck)

Run the phase-1 refcheck tools directly against the design artifacts — on a
late-adopted record the write-fired sensors never ran:

```
bun {{HARNESS_DIR}}/tools/aidlc-sensor-deep-spec-refcheck-domain.ts --stage deep-spec-analysis-functional-verify --output-path <record>/inception/domain-design/components.md
bun {{HARNESS_DIR}}/tools/aidlc-sensor-deep-spec-refcheck-contract.ts --stage deep-spec-analysis-functional-verify --output-path <record>/inception/contract-design/contract-summary.md
bun {{HARNESS_DIR}}/tools/aidlc-sensor-deep-spec-refcheck-functional.ts --stage deep-spec-analysis-functional-verify --output-path <record>/construction/<unit>/functional-design/entities.md   # per unit
```

(Skip a command when its artifact does not exist.) Read the resulting
`deep-spec-refcheck/*.json` findings. Structural defects (dangling
references, phantom FR sources, state/allowed-value drift) are authoring
errors: fold every unresolved refcheck finding into the Step 5 question set
so nothing reaches the solvers on a silently broken reference graph.

### Step 3: Formalize into the Design IR

For each unit, express the design in the IR (contract 3):

- entities.md attribute types, ranges, and allowed values → `schema.entities`
  (int attributes MUST carry min/max — the Quint backend needs bounded
  domains);
- rules.md rules → obligations with `origin: "rules"` and exact `brRefs`
  (validation/constraint → invariant or numeric; triggered rules → event, or
  a transition when they move a lifecycle attribute);
- functional-spec.md state machines → `stateMachines[]` NATIVELY: the
  lifecycle enum attribute, `initial` states, `transitions[]` (TR-n) with
  trigger and any extra guard/effect, and `ignores[]` for every (state,
  trigger) cell that is an INTENDED no-reaction — an ignore you fail to
  declare will surface as a completeness gap;
- worked examples → `scenarios[]` (prefer fully-bound, event-free — they are
  the cross-check surface);
- ordered prose workflows, per-instance uniqueness, actors not modeled as
  attributes → `unformalized[]` with the reason. Silence is a contract
  violation; every BR{n}.{m} in rules.md must be referenced or in the ledger.

Then write the `deep-spec-analysis-functional-formal-model` artifact with
your file-write tool (the sensors fire on that write): an H1 title, a short
`## Model Summary` per unit (machines, obligation counts, scenario and
unformalized counts), and a `## Formal Model (IR)` section holding exactly
one ```json fence with the design IR document (`irKind: "design"`, one
`units[]` entry per unit). Nothing else goes in the fence.

### Step 3b: Author the Refinement Map (when the requirements were verified)

When the intent carries a verified requirements formal model
(`<record>/inception/deep-spec-analysis-verify/deep-spec-analysis-formal-model.md`),
author the refinement map (contract 4) BEFORE writing the formal model, so
the sensors run the refinement checks on the same write:

- Write `deep-spec-analysis-refinement-map.md` in this stage's record dir:
  an H1 title, a short `## Map Summary`, and a `## Refinement Map (contract 4)`
  section holding exactly one ```json fence. Authoring rules are in
  `{{HARNESS_DIR}}/knowledge/aidlc-architect-agent/deep-spec-refinement-map-authoring.md`.
- Per unit: `attrMap` defines every REQUIREMENTS attribute over DESIGN
  attributes (an expression for bool/int, a total `enumMap` for enums —
  merging design values is allowed); `eventMap` names the design transitions
  that simulate each requirements event (or records a human-approved
  `waived`); `unmapped[]` is the no-silence ledger for everything this unit
  deliberately does not represent.
- Set `requirementsIrHash` and `designIrHash` to the sha256 of the canonical
  (key-sorted) JSON of the two IR fences — a later drift in either document
  turns every refinement check into an explicit `stale-input` skip.
- The closure rule is mechanical: every requirements obligation, scenario,
  and attribute must be mapped, waived, or in `unmapped[]` — anything else
  becomes a `mapping-gap` finding.
- No requirements formal model → skip this step; the backends will not run
  refinement checks and nothing is silently claimed.

### Step 4: React to Sensor Verdicts, then Collect Findings

Three sensors fire on the write, in order: `deep-spec-design-ir-valid`
(contract conformance, machine well-formedness, brRefs reverse-check, BR
coverage), then the two verification backends, which write normalized
findings under this stage record's `deep-spec-design-verify/` directory. If
`deep-spec-design-ir-valid` FAILED, the formalization itself is broken: fix
the IR and rewrite the artifact (sensors re-fire) until it passes.

Read every `deep-spec-design-verify/*.json` by glob — never assume which
backends exist. Contract 2 with per-unit attribution: `findings[]` carry
`unit`, `targets` are design ids (DOB/TR/SM/DSC), `skipped[]` includes
`waived` entries for `deterministic: false` machines and capability skips
for simulation-mode reachability. If NO findings files exist, every design
element is **unverified**: say so in the report, recommend
`/aidlc --doctor`, and continue — this stage degrades, it never blocks.

### Step 5: Convert Findings into Human Questions

Deduplicate findings naming the same kind, unit, and targets across
backends, then create
`deep-spec-analysis-functional-verify-questions.md` per stage-protocol §3,
one `## Qn.` entry per finding, ordered conflicts → completeness-gaps →
scenario-violations → unreachable → redundancy → refcheck leftovers →
cross-check-disagreements. Each question must:

- name the unit and quote the implicated design elements — the BR rule text
  (via `brRefs` and rules.md), the transition (from → to on trigger), or the
  entity attribute — plus the FR ids where `frRefs` carry them;
- explain the finding in design language and summarize the witness (a state,
  a step trace, or a core — no solver jargon);
- offer exactly: `A.` keep the design as-is (document the finding as an
  accepted risk), `B.` adopt the proposed revision (state your concrete
  revision of the implicated design artifact text), `X. Other (please specify)`.

For `cross-check-disagreement` findings, say explicitly the backends
disagree and the defect is most likely in the formalization or a backend
compiler — offer `A.` record as tooling issue / `B.` re-formalize, never a
design edit. When a finding's real resolution is a requirements change,
DO NOT offer to edit requirements.md: state the suggested requirement
wording in the report and the exact re-run command
(`/aidlc --stage deep-spec-analysis-verify --single`) — the upstream freeze
is absolute.

Then follow stage-protocol §3 to collect answers and run the Consolidated
Summary Confirmation. Zero findings → no questions file; skip to Step 7.

### Step 6: Apply Accepted Revisions

Every `B.` answer is an explicit, twice-confirmed human approval of a
concrete revision you proposed. Apply them now — the human never hand-edits:

- Edit only this record's design artifacts — `entities.md`, `rules.md`,
  `functional-spec.md` of the implicated unit (or `components.md` /
  `contract-summary.md` for refcheck findings) — as `aidlc-architect-agent`,
  the same lead persona that owns them upstream. Change exactly the
  implicated text to the approved revision, verbatim; ids stay stable;
  `A.`/`X.` items and untouched areas stay untouched.
- When a `B.` edit touches source-of-truth content that feeds a derived view
  (functional-spec.md's mermaid ER diagram or rules summary), regenerate the
  affected derived views in the same edit — never let source and view drift.
- NEVER edit `requirements.md` or `deep-spec-analysis-formal-model.md`.
- Close the loop: redo Step 3 for the affected units (rewrite the formal
  model; the sensors re-fire) and collect the second-pass findings. A
  revision that provokes a NEW finding goes back through Step 5 before
  reporting.
- Zero `B.` answers → skip this step.

### Step 7: Write the Functional Analysis Report

Write `deep-spec-analysis-functional-report.md`:

- **Overview** — units verified (and units that had no functional-design
  record: unverified, listed by name), counts by nature/machine per unit,
  backends and methods, findings by kind.
- **Verification Coverage** — per unit: every design element (DOB/TR/SM/DSC)
  × every backend → checked / skipped (reason — `waived` entries quote the
  model's waiver) / unavailable / unverified. No silence.
- **Reference Integrity** — the refcheck outcome per artifact (Step 2),
  including families skipped as absent-input/unrecognized-format.
- **Findings and Decisions** — per finding: kind, unit, implicated design
  elements and BR/FR ids, witness summary, the human's decision (A/B/X).
- **Applied Revisions** — for every `B.`: the artifact, before/after text,
  derived views regenerated, and the second-pass verification result.
- **Unformalized Design** — every unit's `unformalized[]` ledger, verbatim.
- **Refinement Coverage** — when the refinement checks ran: per unit, every
  requirements obligation/scenario × status (checked per backend /
  refinement-violation / mapping-gap / waived / skipped with reason), plus
  the map's `unmapped[]` ledger verbatim. When they did not run, say why
  (no requirements model / no map / stale hashes) — never silence.
- **Requirements-side Suggestions** — findings whose resolution belongs
  upstream, with suggested wording and the `deep-spec-analysis-verify`
  re-run command (never applied by this stage).

### Step 8: Completion Handoff

Run `bun {{HARNESS_DIR}}/tools/aidlc-orchestrate.ts report --stage deep-spec-analysis-functional-verify --result awaiting-approval`.
That `report` call owns every lifecycle transition and advancement; never
perform one in prose, and never narrate this bookkeeping to the user.

### Step 9: Present Completion & Request Approval

Present the completion per stage-protocol §2 with the :microscope: emoji:
units verified, findings by kind, decisions recorded, revisions applied
(with second-pass confirmation), and unverified/skipped coverage. Review
path: `<record>/construction/deep-spec-analysis-functional-verify/`. Then
the standard 2-option approval gate (Approve / Request Changes) and END THE
TURN.

## Sensors

Sensor outputs land in this record's
`.aidlc-sensors/deep-spec-analysis-functional-verify/` (dispatch details)
and `deep-spec-design-verify/` (normalized backend findings, contract 2).
Imports: `deep-spec-design-ir-valid`, `deep-spec-design-verify-smt`,
`deep-spec-design-verify-quint`. Upstream targets: `requirements`,
`components`, `contract-summary`. All three sensors are advisory and fire on
writes of `deep-spec-analysis-functional-formal-model.md`; a FAILED
`deep-spec-design-ir-valid` verdict is treated as a mandatory-fix signal
before question generation (Step 4).

## Learn

Follow stage-protocol.md §13: maintain
`<record>/construction/deep-spec-analysis-functional-verify/memory.md` under
the four standard headings while working; before the approval gate, surface
candidates with `aidlc-learnings.ts`; still ask the mandatory "Anything to
add for next time?" question, and persist confirmed selections with the
tool. The memory file stays in the artefact directory, and the stage file
remains immutable.
