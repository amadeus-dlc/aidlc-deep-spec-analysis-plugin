# Deep Spec Formal Model

## Model Summary

Canonical conformance fixture: 1 entity (order), 8 obligations (4 invariant/
numeric, 3 event, 1 state-temporal), 4 scenarios, 1 background constraint,
1 unformalized requirement. It intentionally contains a static rule pair
that annihilates its shared condition (OB-1/OB-2), a same-trigger event pair
with contradictory effects (OB-4/OB-5), an uncovered input region for the
ship trigger (OB-6), an invariant the event machine fails to preserve
(OB-7, reachable via OB-6), and a broken accept example (SC-2).

## Formal Model (IR)

```json
{
  "irVersion": "1.0.0",
  "sourceDigest": "800302a36b3e68472ab2ab9beb1f70472d70dcc8457881acf1c21a7b53cf3f42",
  "schema": {
    "entities": [
      {
        "name": "order",
        "description": "A customer order moving through its lifecycle.",
        "attributes": [
          { "name": "status", "type": { "kind": "enum", "values": ["draft", "submitted", "approved", "rejected", "shipped"] } },
          { "name": "amount", "type": { "kind": "int", "min": 0, "max": 3 } },
          { "name": "expedited", "type": { "kind": "bool" } }
        ]
      }
    ]
  },
  "obligations": [
    {
      "id": "OB-1",
      "nature": "invariant",
      "frRefs": ["FR-1"],
      "ears": "The system shall keep every expedited order at an amount of at least 3.",
      "assert": {
        "op": "implies",
        "args": [
          { "op": "ref", "path": "order.expedited" },
          { "op": "ge", "args": [{ "op": "ref", "path": "order.amount" }, { "op": "int", "value": 3 }] }
        ]
      }
    },
    {
      "id": "OB-2",
      "nature": "invariant",
      "frRefs": ["FR-2"],
      "ears": "The system shall keep every expedited order at an amount of at most 1.",
      "assert": {
        "op": "implies",
        "args": [
          { "op": "ref", "path": "order.expedited" },
          { "op": "le", "args": [{ "op": "ref", "path": "order.amount" }, { "op": "int", "value": 1 }] }
        ]
      }
    },
    {
      "id": "OB-3",
      "nature": "numeric",
      "frRefs": ["FR-3"],
      "ears": "The system shall keep every order amount at or below 3.",
      "assert": { "op": "le", "args": [{ "op": "ref", "path": "order.amount" }, { "op": "int", "value": 3 }] }
    },
    {
      "id": "OB-4",
      "nature": "event",
      "frRefs": ["FR-4"],
      "ears": "When submit occurs while the order is draft with a positive amount, the system shall mark the order submitted.",
      "trigger": "submit",
      "guard": {
        "op": "and",
        "args": [
          { "op": "eq", "args": [{ "op": "ref", "path": "order.status" }, { "op": "enum", "value": "draft" }] },
          { "op": "ge", "args": [{ "op": "ref", "path": "order.amount" }, { "op": "int", "value": 1 }] }
        ]
      },
      "effect": { "op": "eq", "args": [{ "op": "ref", "path": "order.status", "prime": true }, { "op": "enum", "value": "submitted" }] }
    },
    {
      "id": "OB-5",
      "nature": "event",
      "frRefs": ["FR-5"],
      "ears": "When submit occurs, the system shall mark the order rejected.",
      "trigger": "submit",
      "guard": { "op": "ge", "args": [{ "op": "ref", "path": "order.amount" }, { "op": "int", "value": 0 }] },
      "effect": { "op": "eq", "args": [{ "op": "ref", "path": "order.status", "prime": true }, { "op": "enum", "value": "rejected" }] }
    },
    {
      "id": "OB-6",
      "nature": "event",
      "frRefs": ["FR-6"],
      "ears": "When ship occurs while the order is submitted, the system shall mark the order shipped.",
      "trigger": "ship",
      "guard": { "op": "eq", "args": [{ "op": "ref", "path": "order.status" }, { "op": "enum", "value": "submitted" }] },
      "effect": { "op": "eq", "args": [{ "op": "ref", "path": "order.status", "prime": true }, { "op": "enum", "value": "shipped" }] }
    },
    {
      "id": "OB-7",
      "nature": "invariant",
      "frRefs": ["FR-7"],
      "ears": "The system shall keep every shipped order at an amount of at least 1.",
      "assert": {
        "op": "implies",
        "args": [
          { "op": "eq", "args": [{ "op": "ref", "path": "order.status" }, { "op": "enum", "value": "shipped" }] },
          { "op": "ge", "args": [{ "op": "ref", "path": "order.amount" }, { "op": "int", "value": 1 }] }
        ]
      }
    },
    {
      "id": "OB-8",
      "nature": "state-temporal",
      "frRefs": ["FR-8"],
      "ears": "While an order is submitted, the system shall eventually move it out of the submitted state.",
      "temporal": {
        "pattern": "leads-to",
        "from": { "op": "eq", "args": [{ "op": "ref", "path": "order.status" }, { "op": "enum", "value": "submitted" }] },
        "to": { "op": "ne", "args": [{ "op": "ref", "path": "order.status" }, { "op": "enum", "value": "submitted" }] }
      }
    }
  ],
  "scenarios": [
    {
      "id": "SC-1",
      "kind": "accept",
      "frRefs": ["FR-1"],
      "title": "a fresh draft order is legal",
      "bindings": { "order.amount": 1, "order.expedited": false, "order.status": "draft" }
    },
    {
      "id": "SC-2",
      "kind": "accept",
      "frRefs": ["FR-2"],
      "title": "an expedited approved order with amount 2 is (claimed) legal",
      "bindings": { "order.amount": 2, "order.expedited": true, "order.status": "approved" }
    },
    {
      "id": "SC-3",
      "kind": "reject",
      "frRefs": ["FR-2"],
      "title": "expedited with amount 2 must be impossible",
      "bindings": { "order.amount": 2, "order.expedited": true }
    },
    {
      "id": "SC-4",
      "kind": "accept",
      "frRefs": ["FR-4"],
      "title": "submitting a fresh draft order succeeds",
      "bindings": { "order.amount": 1, "order.expedited": false, "order.status": "draft" },
      "event": { "trigger": "submit" },
      "expect": { "op": "eq", "args": [{ "op": "ref", "path": "order.status", "prime": true }, { "op": "enum", "value": "submitted" }] }
    }
  ],
  "background": [
    {
      "id": "BG-1",
      "text": "Order amounts are non-negative by definition.",
      "assert": { "op": "ge", "args": [{ "op": "ref", "path": "order.amount" }, { "op": "int", "value": 0 }] }
    }
  ],
  "unformalized": [
    {
      "frRefs": ["NFR-1"],
      "reason": "Latency is a runtime quality, not a state-space property; the v1 IR has no vocabulary for it.",
      "text": "The system shall respond to any order request within 200 ms."
    }
  ]
}
```
