# Deep-Spec Refinement Map Authoring (contract 4)

Applies only to the `deep-spec-analysis-functional-verify` stage, and only
when the intent carries a verified requirements formal model. The map is the
explicit abstraction function refinement checking is defined by: the LLM
proposes it, deterministic tools validate it, humans gate it — the same
neurosymbolic split as the IRs, one level up. Never write SMT-LIB or Quint.

## Direction

Standard data refinement: every REQUIREMENTS attribute is defined by an
expression over DESIGN attributes (alpha). Substituting the map into a
requirements property is then purely mechanical — which is exactly what the
backends do.

## Document shape

One ```json fence: `mapVersion` (current line `1.0.0`),
`requirementsIrHash` and `designIrHash` (sha256 of the canonical key-sorted
JSON of the two IR fences — drift in either turns every refinement check
into an explicit `stale-input` skip, never a stale verdict), and `units[]`
(one entry per design unit; a unit without an entry has all refinement
checks skipped as absent-input).

## attrMap

- bool/int requirements attribute → `{ "req": "entity.attr", "expr": ... }`
  with a prime-free contract-1 expression over design refs.
- enum requirements attribute → `{ "req": ..., "enumMap": { "from":
  "designEntity.attr", "cases": { designValue: reqValue, ... } } }`. The
  cases must be TOTAL over the design attribute's values, every result must
  be a value of the requirements attribute, and merging design values into
  one requirements value is allowed (that is what abstraction means).
- An enum-mapped attribute may appear in requirements expressions only
  inside eq/ne against an enum literal (the comparison expands into a
  disjunction over the matching design values).

## eventMap

For each requirements event trigger: the design transitions (TR-n) or event
obligations (DOB-n) that simulate it. What the checks then verify: a mapped
design step taken where alpha(guard) holds must produce an abstract
post-state satisfying the requirements effect AND the abstract frame —
requirements attributes the effect does not assign keep their abstract value
(unassigned-but-unmapped attributes are uncheckable and omitted). A trigger
the design deliberately does not simulate gets `waived` with a reason — a
human-gated decision, surfaced as `skipped[waived]`, never silence.

## unmapped[] — the closure rule

Every requirements obligation, scenario, and attribute must be mapped,
waived, or listed in `unmapped[]` with a reason. Anything else is a
`mapping-gap` finding. This is mechanical (the tools enforce it): write the
ledger honestly rather than stretching a mapping.

## What the checks are (so you can anticipate findings)

- alpha-substituted requirements invariants must hold in every design-legal
  state (static, z3) and along every machine execution (dynamic, Quint).
- Requirements events: enabledness (wherever alpha(guard) holds, some mapped
  transition must be enabled) and one-step simulation (see eventMap above).
- Requirements scenarios replay as alpha-constraints (SMT only in v1).
- The upstream freeze is absolute: a finding whose resolution is a
  requirements change is reported with suggested wording — this stage never
  edits requirements.md or the requirements formal model.
