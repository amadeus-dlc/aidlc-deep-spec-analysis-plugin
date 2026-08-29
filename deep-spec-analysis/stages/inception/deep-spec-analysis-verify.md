---
slug: deep-spec-analysis-verify
number: 2.35
name: Deep Spec Analysis
plugin: deep-spec-analysis
phase: inception
execution: ALWAYS
condition: Always executes in its scopes — neurosymbolic depth pays off where requirements complexity does
lead_agent: aidlc-product-agent
support_agents: []
mode: inline
summary_confirmation: if-present
produces:
  - deep-spec-analysis-formal-model
  - deep-spec-analysis-report
consumes:
  - artifact: requirements
    required: true
requires_stage:
  - requirements-analysis
sensors:
  - deep-spec-ir-valid
  - deep-spec-verify-smt
  - deep-spec-verify-quint
scopes:
  - enterprise
  - feature
inputs: requirements.md from requirements-analysis (EARS classification source), deep-spec IR authoring guide (knowledge)
outputs: deep-spec-analysis-formal-model.md, deep-spec-analysis-report.md (under this stage's record dir, engine-resolved)
---

# Deep Spec Analysis

MANDATORY: Follow stage-protocol.md for the complete execution protocol — context loading, question files, human gates, memory, and completion handoff.

Neurosymbolic requirements verification. You (the LLM) do the *semantic*
half: classify each requirement EARS-style and formalize it into the
backend-neutral deep-spec IR. Deterministic sensors do the *symbolic* half:
solver backends check the IR for contradictions, completeness gaps, and
scenario violations, and write normalized findings. You then translate every
finding back into requirement language and put it to the human as a
structured A/B decision. You never write SMT-LIB or Quint, you never edit
`requirements.md` beyond the revisions the human explicitly accepted
(`B.` answers), and no finding blocks anything without a human choice.

## Steps

### Step 1: Load Prior Context

Read `requirements.md` from the directive's consumes (the
requirements-analysis stage record). The IR authoring rules are in
`{{HARNESS_DIR}}/knowledge/aidlc-product-agent/deep-spec-ir-authoring.md`
(loaded with your inline context) — follow them exactly; the sensors enforce
the contract they describe.

### Step 2: Formalize into the Deep-Spec IR

For each FR/NFR in requirements.md, classify its nature EARS-style —
`invariant` (ubiquitous), `event` (WHEN/IF trigger-guard-effect),
`state-temporal` (always / leads-to over the state machine), `numeric`
(quantitative bound) — and express it as an IR obligation with `frRefs`
pointing at the exact FR/NFR ids. Map Gherkin acceptance criteria to
`scenarios[]` (accept/reject examples). Record domain truths in
`background[]`. Any requirement you cannot formalize goes into
`unformalized[]` with the reason — never drop one silently.

Stamp the IR's `sourceDigest` with the sha256 of the requirements.md you
formalized (run `shasum -a 256 <path>` — never guess it): this anchors the
verification to the exact source text, and `deep-spec-ir-valid` rejects a
missing or drifted digest.

Then write the `deep-spec-analysis-formal-model` artifact with your file-write tool
(the sensors fire on that write): an H1 title, a short `## Model Summary`
section (entities, obligation count by nature, scenario count, unformalized
count), and a `## Formal Model (IR)` section holding exactly one ```json
fence with the IR document. Nothing else goes in the fence.

### Step 3: React to Sensor Verdicts

Three sensors fire on the write, in order: `deep-spec-ir-valid` (contract
conformance + frRefs reverse-check), then the verification backends, which
write normalized findings under this stage record's `deep-spec-verify/`
directory. If `deep-spec-ir-valid` FAILED, the formalization itself is
broken: fix the IR and rewrite the artifact (sensors re-fire) until it
passes. Do not proceed to question generation on an invalid IR.

### Step 4: Collect Findings

Read every `deep-spec-verify/*.json` file in this stage's record directory
by glob — never assume which backends exist. Each file follows contract 2:
`backend`, `method` (exhaustive/bounded/simulation), `findings[]` (kind,
frRefs, targets, witness, detail), `skipped[]` (with reasons), optional
`unavailable`. Build the coverage picture: for every obligation and
scenario, which backend checked it, skipped it (why), or was unavailable.

If NO findings files exist (sensors never ran — e.g. plugin tools missing),
every obligation is **unverified**: say so explicitly in the report
(Step 7), recommend `/aidlc --doctor`, and continue — this stage degrades,
it never blocks.

### Step 5: Convert Findings into Human Questions

Deduplicate findings that name the same kind and targets across backends,
then create `deep-spec-analysis-verify-questions.md` per stage-protocol §3, one
`## Qn.` entry per finding, ordered conflicts → completeness-gaps →
scenario-violations → cross-check-disagreements. Each question must:

- quote the implicated FR/NFR ids and their requirement text (reverse
  lookup via the finding's `frRefs`),
- explain the finding in requirement language and summarize the witness (a
  state, a step trace, or an unsat core — no solver jargon),
- offer exactly: `A.` keep the requirements as-is (document the finding as
  accepted), `B.` adopt the proposed revision (state your concrete revision
  of the implicated requirement text), `X. Other (please specify)`.

For `cross-check-disagreement` findings, say explicitly that the backends
disagree and the defect is most likely in the formalization or a backend
compiler — offer `A.` record as tooling issue / `B.` re-formalize the
implicated obligation, not a requirements edit.

Then follow stage-protocol §3 to collect answers (Guide me / I'll edit the
file / Chat) and run the Consolidated Summary Confirmation. Zero findings →
no questions file; skip straight to Step 7.

### Step 6: Apply Accepted Revisions

Every `B.` answer is an explicit, twice-confirmed human approval (the
individual answer, then the Consolidated Summary Confirmation) of a concrete
revision you proposed. Apply them now — the human never hand-edits:

- Edit `requirements.md` (the consumes path) as `aidlc-product-agent` — the
  same lead persona that owns it in requirements-analysis — changing exactly
  the implicated FR/NFR text to the approved revision, verbatim. Keep ids
  stable; requirements answered `A.`/`X.` and everything else stay untouched.
  Never apply an edit the human did not approve.
- Close the loop: redo Step 2 against the revised requirements (rewrite the
  formal model — including a fresh `sourceDigest` of the now-revised
  requirements.md; the sensors re-fire) and collect the second-pass findings.
  Accepted revisions are expected to resolve their findings; if a revision
  provokes a NEW finding, put it to the human per Step 5 before reporting.
- Zero `B.` answers → skip this step.

### Step 7: Write the Analysis Report

Write `deep-spec-analysis-report.md`:

- **Overview** — what was formalized (counts by nature), backends that ran
  and their methods, findings count by kind.
- **Verification Coverage** — a table: every obligation/scenario × every
  backend → checked / skipped (reason) / unavailable / unverified. Skips and
  unavailability are stated verbatim — no silence. When Step 6 ran, this is
  the second-pass (post-revision) coverage.
- **Findings and Decisions** — per finding: kind, implicated FR/NFR ids and
  text, witness summary, the human's recorded decision (A/B/X).
- **Applied Revisions** — for every `B.`: the requirement id, its
  before/after text as applied in Step 6, and the second-pass verification
  result confirming the finding is resolved (or the follow-up decision when
  it was not). Nothing is ever edited beyond the approved text — no silent
  revisions.
- **Unformalized Requirements** — the IR's `unformalized[]`, verbatim, with
  reasons.

Reference the upstream `requirements.md` explicitly so traceability holds.

### Step 8: Completion Handoff

Run `bun {{HARNESS_DIR}}/tools/aidlc-orchestrate.ts report --stage deep-spec-analysis-verify --result awaiting-approval`.
That `report` call owns every lifecycle transition and advancement; never
perform one in prose, and never narrate this bookkeeping to the user.

### Step 9: Present Completion & Request Approval

Present the completion per stage-protocol §2 with the :microscope: emoji:
summary of obligations checked, findings by kind, decisions recorded,
revisions applied (with their second-pass confirmation), and
unverified/skipped coverage. Review path: `<record>/inception/deep-spec-analysis-verify/`.
Then the standard 2-option approval gate (Approve / Request Changes) and END
THE TURN.

## Sensors

Sensor outputs land in this record's `.aidlc-sensors/deep-spec-analysis-verify/`
(dispatch details) and `deep-spec-verify/` (normalized backend findings,
contract 2). Imports: `deep-spec-ir-valid`, `deep-spec-verify-smt`,
`deep-spec-verify-quint`. Upstream targets: `requirements`. All three
sensors are advisory and fire on writes of `deep-spec-analysis-formal-model.md`; a
FAILED `deep-spec-ir-valid` verdict is treated as a mandatory-fix signal
before question generation (Step 3).

## Learn

Follow stage-protocol.md §13: maintain `<record>/inception/deep-spec-analysis-verify/memory.md`
under the four standard headings while working; before the approval gate,
surface candidates with `aidlc-learnings.ts`; still ask the mandatory
"Anything to add for next time?" question, and persist confirmed selections
with the tool. The memory file stays in the artefact directory, and the
stage file remains immutable.
