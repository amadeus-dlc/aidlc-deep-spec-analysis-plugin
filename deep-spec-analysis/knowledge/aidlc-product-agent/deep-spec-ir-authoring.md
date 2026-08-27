# Deep-Spec IR Authoring Guide

Applies only to the `deep-spec-analysis-verify` stage. It defines how to write the
`deep-spec-analysis-formal-model` artifact. The `deep-spec-ir-valid` sensor
enforces this contract mechanically; deviations fail its verdict.

## Artifact layout

```
# Deep Spec Formal Model

## Model Summary
<entities, obligation counts by nature, scenario count, unformalized count>

## Formal Model (IR)
<exactly ONE ```json fence containing the IR document — nothing else>
```

Never write SMT-LIB or Quint. The deterministic backends compile the IR
themselves; your output is the JSON IR only.

## IR document shape

Top level: `irVersion` (use `"1.0.0"`), `schema`, `obligations`, `scenarios`,
`background`, optional `unformalized`. Full contract:
`{{HARNESS_DIR}}/tools/data/deep-spec-ir-schema.json`.

### schema — entities and attributes

- Names are `lowerCamel`/snake-free identifiers: `^[a-z][a-zA-Z0-9_]*$`.
- Attribute types: `{"kind":"bool"}`, `{"kind":"int","min":M,"max":N}`,
  `{"kind":"enum","values":[...]}`.
- **Always give int attributes `min` and `max`.** The Quint backend needs
  bounded domains; an unbounded int forces it to skip every machine check.
  Choose the smallest range that preserves the requirement's meaning.
- `relations` are documentation only in v1 — backends do not compile them.

### Expression grammar

JSON nodes: `{"op":...}` with:

- connectives `and`/`or` (n-ary `args`), `not` (1), `implies`/`iff` (2)
- comparisons `eq`/`ne`/`lt`/`le`/`gt`/`ge` (2)
- arithmetic `add`/`sub`/`mul` (2, int)
- `{"op":"ref","path":"entity.attribute"}` — current state;
  add `"prime":true` for the post-state (ONLY inside event effects)
- literals `{"op":"bool","value":true}`, `{"op":"int","value":3}`,
  `{"op":"enum","value":"draft"}` (enum literals must appear as the direct
  sibling of a `ref` in a comparison, so their encoding is resolvable)

### Obligations — EARS classification to nature

| EARS shape | nature | obligation fields |
|---|---|---|
| Ubiquitous — "the system shall always …" | `invariant` | `assert` |
| Quantitative bound — limits, ranges, thresholds | `numeric` | `assert` |
| Event-driven — "WHEN <trigger> [IF <guard>] the system shall …" | `event` | `trigger`, `guard`, `effect` |
| State/temporal — "while/after … eventually …" | `state-temporal` | `temporal` (`always` or `leads-to`) |

Rules:

- `id`: `OB-<n>`, unique, dense from 1. `frRefs`: the exact FR/NFR ids from
  requirements.md (they are reverse-checked). `ears`: the normalized EARS
  sentence — it is quoted verbatim in the analysis report.
- **Event effects must be a conjunction of primed assignments**:
  `eq(ref' , <prime-free expr>)` terms only, each attribute at most once.
  Attributes an effect does not mention are frame-unchanged. Guards never
  use primes. Anything else forces backend skips.
- `numeric` vs `invariant` is a classification tag: both carry `assert`;
  keep quantitative bounds under `numeric` so coverage reporting shows them.

### Scenarios — from Gherkin acceptance criteria

- `id`: `SC-<n>`; `kind`: `accept` (a state/behavior that must be legal) or
  `reject` (one the requirements must exclude); `frRefs` as above.
- Given → `bindings` (`{"entity.attr": literal}`), When → `event`
  (`{"trigger": ...}`), Then → `expect` (expression; primes allowed only
  when `event` is present).
- **Prefer fully-bound, event-free scenarios**: bind every declared
  attribute and omit `event`. Both backends check those independently —
  they are the v1 cross-check surface. Scenarios with `event` are recorded
  but skipped by both v1 backends.

### background

Definitional domain truths only (value constraints that are facts, not
requirements): `{"id":"BG-<n>","text":"...","assert":<expr>}`. Never put a
requirement here — background never gets attributed a finding of its own.

### unformalized

Every FR/NFR you cannot express in the IR goes here with the reason:
`{"frRefs":["NFR-1"],"reason":"...","text":"<original text>"}`. Silence is a
contract violation; the report prints this list verbatim.

## Worked micro-example

```json
{
  "irVersion": "1.0.0",
  "schema": {
    "entities": [
      {
        "name": "order",
        "attributes": [
          { "name": "status", "type": { "kind": "enum", "values": ["draft", "submitted"] } },
          { "name": "amount", "type": { "kind": "int", "min": 0, "max": 8 } }
        ]
      }
    ]
  },
  "obligations": [
    {
      "id": "OB-1",
      "nature": "invariant",
      "frRefs": ["FR-1"],
      "ears": "The system shall keep submitted orders at a positive amount.",
      "assert": {
        "op": "implies",
        "args": [
          { "op": "eq", "args": [{ "op": "ref", "path": "order.status" }, { "op": "enum", "value": "submitted" }] },
          { "op": "ge", "args": [{ "op": "ref", "path": "order.amount" }, { "op": "int", "value": 1 }] }
        ]
      }
    },
    {
      "id": "OB-2",
      "nature": "event",
      "frRefs": ["FR-2"],
      "ears": "When submit occurs while the order is draft, the system shall mark it submitted.",
      "trigger": "submit",
      "guard": { "op": "eq", "args": [{ "op": "ref", "path": "order.status" }, { "op": "enum", "value": "draft" }] },
      "effect": { "op": "eq", "args": [{ "op": "ref", "path": "order.status", "prime": true }, { "op": "enum", "value": "submitted" }] }
    }
  ],
  "scenarios": [
    {
      "id": "SC-1",
      "kind": "accept",
      "frRefs": ["FR-1"],
      "title": "a fresh draft order is legal",
      "bindings": { "order.amount": 0, "order.status": "draft" }
    }
  ],
  "background": [],
  "unformalized": []
}
```

## Checklist before writing the artifact

1. Every FR/NFR is either an obligation/scenario `frRefs` target or listed
   in `unformalized` — nothing dropped.
2. Every int attribute has `min`/`max`.
3. Every event effect is a conjunction of primed assignments.
4. Enum literals sit next to a `ref` in a comparison.
5. Exactly one ```json fence in the artifact.
