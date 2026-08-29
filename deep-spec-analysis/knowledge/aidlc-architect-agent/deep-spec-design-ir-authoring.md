# Deep-Spec Design IR Authoring (contract 3)

Applies only to the `deep-spec-analysis-functional-verify` stage. The
`deep-spec-design-ir-valid` sensor enforces this contract mechanically;
follow it exactly. Never write SMT-LIB or Quint — the IR is backend-neutral
JSON, compiled by deterministic tools.

## Document shape

One `units[]` entry per unit-of-work that has a functional-design record.
Top level: `irVersion` (current contract line: `1.0.0`), `irKind: "design"`
(mandatory discriminator — it keeps this document out of the requirements
backends), optional `inputs[]` provenance, `units[]`.

Each unit: `unit` (the construction directory name), `schema.entities`,
`obligations[]` (DOB-n, dense from 1), `stateMachines[]` (SM-n / TR-n),
`scenarios[]` (DSC-n), `background[]` (DBG-n), `unformalized[]`. Ids are
unique within the unit; TR ids are unique across all of the unit's machines.

## Source-artifact mapping

| Source | IR section |
|---|---|
| entities.md attribute types / ranges / allowed values | `schema.entities` — bool, int (min/max MANDATORY: the Quint backend needs bounded domains), enum |
| entities.md required / entity-level constraints | obligations `origin: "entities"` (invariant/numeric) or `background[]` when definitional |
| entities.md per-instance `unique` | `unformalized[]` (single-instance state model — no quantifiers) |
| rules.md validation / constraint rules | invariant or numeric obligations, `origin: "rules"`, exact `brRefs` |
| rules.md triggered rules (IF … WHEN …) | event obligations — or a transition when the rule moves a lifecycle attribute |
| rules.md calculation rules | event effects or numeric invariants over int attributes; decimals → `unformalized[]` (reason `decimal`) |
| rules.md authorization rules | guards, only when the actor/role is a modeled enum attribute; otherwise `unformalized[]` |
| functional-spec.md state machines | `stateMachines[]` NATIVELY (below) |
| functional-spec.md ordered prose workflows | `unformalized[]` (reason `workflow-prose`); single-step Given/When/Then examples → `scenarios[]` |
| contract-summary.md spec blocks | never formalized (out of scope) |

`origin: "rules"` REQUIRES `brRefs`. Copy the rule's `source:` FR ids into
`frRefs` when present — they join design findings back to requirements.

## State machines

Declare each lifecycle explicitly — recovering it from an obligation soup is
exactly the heuristic this section exists to avoid:

- `entity` + `attribute` name a declared **enum** attribute; its values ARE
  the state set.
- `initial`: the states an instance can begin in (minItems 1).
- `transitions[]`: `TR-n` with `from`, `to`, `trigger`; an optional extra
  `guard` (prime-free — `state == from` is implicit) and an optional extra
  `effect` (a conjunction of primed assignments over OTHER attributes —
  `state' = to` is implicit and assigning the machine's own attribute is an
  ir-valid error).
- `ignores[]`: EVERY (state, trigger) cell that is an intended no-reaction,
  each with its reason. An ignore you fail to declare will surface as a
  completeness gap or a deadlock — that is the point: intended silence must
  be written down.
- `deterministic: false` waives the same-(state,trigger) overlap check for
  that machine (reported as `skipped[reason: waived]`, never silently).

## Obligations, scenarios, background

- The expression grammar and attribute types are byte-identical to the
  requirements IR: `and/or/not/implies/iff/eq/ne/lt/le/gt/ge/add/sub/mul`,
  `ref` (with `prime` only in effects and event-scenario expectations), and
  `bool`/`int`/`enum` literals.
- Event effects are conjunctions of primed assignments,
  `eq(ref', prime-free expr)`, each attribute at most once; unmentioned
  attributes keep their value (explicit frame in the backends).
- Prefer fully-bound, event-free scenarios — they are the cross-check
  surface both backends verify with identical semantics.
- `background[]` holds definitional truths from the entity model only, never
  rules — background is never attributed a finding.

## No silence

`unformalized[]` is mandatory bookkeeping: every BR{n}.{m} in the unit's
rules.md must be referenced by an obligation/transition/scenario `brRefs` or
listed in `unformalized[].targets` with a reason. The ir-valid sensor fails
the model otherwise. Silence is a contract violation.

## Pre-write checklist

1. `irKind: "design"` present; one `units[]` entry per verified unit.
2. Every int attribute carries min/max; every machine attribute is an enum.
3. Every transition's extra effect avoids the machine's own attribute.
4. Every intended no-reaction is an `ignores[]` entry with a reason.
5. Every BR id is referenced or in `unformalized[]`; `origin: "rules"`
   obligations carry `brRefs`.
