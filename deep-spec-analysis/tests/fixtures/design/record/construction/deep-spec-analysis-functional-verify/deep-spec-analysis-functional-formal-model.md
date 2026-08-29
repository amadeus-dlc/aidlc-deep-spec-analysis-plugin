# Deep Spec Functional Formal Model

## Model Summary

Canonical design-IR conformance fixture: one unit (u1-tickets) with a native
state machine and rules-origin obligations. Planted defects, one per design
check family:

- SM-1 carries a nondeterministic same-(state,trigger) transition pair
  (TR-1/TR-2: `triage` from `open` with overlapping guards and different
  target states) — expected `conflict`;
- TR-4's guard (`priority >= 2 and priority <= 0`) is unsatisfiable — a dead
  transition, expected `unreachable`;
- DOB-4 duplicates DOB-3's trigger and effect with a provably narrower guard
  — expected `redundancy` (mutual, given the type bounds);
- DOB-2 (`escalate`) sets `escalated` without raising `priority`, reachably
  violating DOB-1 (BR1.1) — expected Quint `conflict` with a step trace;
- state `archived` has no incoming transition — expected `unreachable`
  (bounded mode) and a deadlock-shaped gap in machine exploration;
- state x trigger cells nobody covers (e.g. `triage` outside `open`) —
  expected `completeness-gap`s; the `(closed, close)` cell is an explicit
  ignore and must NOT be reported.

DSC-1 is the fully-bound, event-free cross-check scenario. BR1.4 (a prose
workflow) is deliberately unformalized — the BR coverage rule demands the
ledger entry.

## Formal Model (IR)

```json
{
  "irVersion": "1.0.0",
  "irKind": "design",
  "units": [
    {
      "unit": "u1-tickets",
      "schema": {
        "entities": [
          {
            "name": "ticket",
            "description": "A support ticket and its lifecycle.",
            "attributes": [
              { "name": "status", "type": { "kind": "enum", "values": ["open", "triaged", "closed", "archived"] } },
              { "name": "priority", "type": { "kind": "int", "min": 0, "max": 2 } },
              { "name": "escalated", "type": { "kind": "bool" } },
              { "name": "flagged", "type": { "kind": "bool" } }
            ]
          }
        ]
      },
      "obligations": [
        {
          "id": "DOB-1",
          "nature": "invariant",
          "origin": "rules",
          "brRefs": ["BR1.1"],
          "frRefs": ["FR-1"],
          "statement": "An escalated ticket must have priority 2 or higher.",
          "assert": {
            "op": "implies",
            "args": [
              { "op": "ref", "path": "ticket.escalated" },
              { "op": "ge", "args": [{ "op": "ref", "path": "ticket.priority" }, { "op": "int", "value": 2 }] }
            ]
          }
        },
        {
          "id": "DOB-2",
          "nature": "event",
          "origin": "rules",
          "brRefs": ["BR1.2"],
          "statement": "Escalating a triaged ticket marks it escalated (defect: priority untouched).",
          "trigger": "escalate",
          "guard": { "op": "eq", "args": [{ "op": "ref", "path": "ticket.status" }, { "op": "enum", "value": "triaged" }] },
          "effect": { "op": "eq", "args": [{ "op": "ref", "path": "ticket.escalated", "prime": true }, { "op": "bool", "value": true }] }
        },
        {
          "id": "DOB-3",
          "nature": "event",
          "origin": "rules",
          "brRefs": ["BR1.3"],
          "statement": "Closed tickets can be flagged for audit.",
          "trigger": "flag",
          "guard": { "op": "eq", "args": [{ "op": "ref", "path": "ticket.status" }, { "op": "enum", "value": "closed" }] },
          "effect": { "op": "eq", "args": [{ "op": "ref", "path": "ticket.flagged", "prime": true }, { "op": "bool", "value": true }] }
        },
        {
          "id": "DOB-4",
          "nature": "event",
          "origin": "rules",
          "brRefs": ["BR1.3"],
          "statement": "Redundant restatement of DOB-3 with a narrower guard.",
          "trigger": "flag",
          "guard": {
            "op": "and",
            "args": [
              { "op": "eq", "args": [{ "op": "ref", "path": "ticket.status" }, { "op": "enum", "value": "closed" }] },
              { "op": "ge", "args": [{ "op": "ref", "path": "ticket.priority" }, { "op": "int", "value": 0 }] }
            ]
          },
          "effect": { "op": "eq", "args": [{ "op": "ref", "path": "ticket.flagged", "prime": true }, { "op": "bool", "value": true }] }
        }
      ],
      "stateMachines": [
        {
          "id": "SM-1",
          "entity": "ticket",
          "attribute": "status",
          "initial": ["open"],
          "transitions": [
            {
              "id": "TR-1",
              "from": "open",
              "to": "triaged",
              "trigger": "triage",
              "guard": { "op": "ge", "args": [{ "op": "ref", "path": "ticket.priority" }, { "op": "int", "value": 1 }] },
              "brRefs": ["BR1.2"]
            },
            { "id": "TR-2", "from": "open", "to": "closed", "trigger": "triage" },
            { "id": "TR-3", "from": "triaged", "to": "closed", "trigger": "close" },
            {
              "id": "TR-4",
              "from": "open",
              "to": "closed",
              "trigger": "close",
              "guard": {
                "op": "and",
                "args": [
                  { "op": "ge", "args": [{ "op": "ref", "path": "ticket.priority" }, { "op": "int", "value": 2 }] },
                  { "op": "le", "args": [{ "op": "ref", "path": "ticket.priority" }, { "op": "int", "value": 0 }] }
                ]
              }
            }
          ],
          "ignores": [{ "state": "closed", "trigger": "close", "reason": "already closed — closing again is an intended no-op" }],
          "deterministic": true
        }
      ],
      "scenarios": [
        {
          "id": "DSC-1",
          "kind": "accept",
          "brRefs": ["BR1.1"],
          "frRefs": ["FR-1"],
          "title": "a fresh open ticket at priority 1 is legal",
          "bindings": { "ticket.status": "open", "ticket.priority": 1, "ticket.escalated": false, "ticket.flagged": false }
        }
      ],
      "background": [],
      "unformalized": [
        {
          "targets": ["BR1.4"],
          "reason": "workflow-prose",
          "text": "The nightly retention workflow archives closed tickets after 90 days — an ordered prose workflow, outside the v1 design solver domain."
        }
      ]
    }
  ]
}
```
