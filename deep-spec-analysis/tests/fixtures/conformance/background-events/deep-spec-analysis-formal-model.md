# Deep Spec Formal Model

## Model Summary

Background-and-events fixture (ruling 4, 2026-09-03): 1 entity (order),
3 event obligations and 1 background constraint — no invariant, numeric or
temporal obligation, no scenario. The refund event lowers the amount without
a floor, so the event machine can drive the order below the background
constraint (amounts are non-negative). The Quint machine phase — which used
to be skipped for a model without invariant obligations, leaving this defect
undetected — must now report the reachable violation as a conflict over the
event obligations, with the step trace as the witness.

## Formal Model (IR)

```json
{
  "irVersion": "1.0.0",
  "sourceDigest": "800302a36b3e68472ab2ab9beb1f70472d70dcc8457881acf1c21a7b53cf3f42",
  "schema": {
    "entities": [
      {
        "name": "order",
        "attributes": [
          { "name": "status", "type": { "kind": "enum", "values": ["draft", "submitted", "shipped"] } },
          { "name": "amount", "type": { "kind": "int", "min": 0, "max": 3 } }
        ]
      }
    ]
  },
  "obligations": [
    {
      "id": "OB-1",
      "nature": "event",
      "frRefs": ["FR-4"],
      "ears": "When submit occurs while the order is draft, the system shall mark the order submitted.",
      "trigger": "submit",
      "guard": { "op": "eq", "args": [{ "op": "ref", "path": "order.status" }, { "op": "enum", "value": "draft" }] },
      "effect": { "op": "eq", "args": [{ "op": "ref", "path": "order.status", "prime": true }, { "op": "enum", "value": "submitted" }] }
    },
    {
      "id": "OB-2",
      "nature": "event",
      "frRefs": ["FR-6"],
      "ears": "When ship occurs while the order is submitted, the system shall mark the order shipped.",
      "trigger": "ship",
      "guard": { "op": "eq", "args": [{ "op": "ref", "path": "order.status" }, { "op": "enum", "value": "submitted" }] },
      "effect": { "op": "eq", "args": [{ "op": "ref", "path": "order.status", "prime": true }, { "op": "enum", "value": "shipped" }] }
    },
    {
      "id": "OB-3",
      "nature": "event",
      "frRefs": ["FR-3"],
      "ears": "When refund occurs, the system shall lower the order amount by one.",
      "trigger": "refund",
      "guard": { "op": "ge", "args": [{ "op": "ref", "path": "order.amount" }, { "op": "int", "value": 0 }] },
      "effect": { "op": "eq", "args": [{ "op": "ref", "path": "order.amount", "prime": true }, { "op": "sub", "args": [{ "op": "ref", "path": "order.amount" }, { "op": "int", "value": 1 }] }] }
    }
  ],
  "scenarios": [],
  "background": [
    {
      "id": "BG-1",
      "text": "Order amounts are non-negative by definition.",
      "assert": { "op": "ge", "args": [{ "op": "ref", "path": "order.amount" }, { "op": "int", "value": 0 }] }
    }
  ],
  "unformalized": []
}
```
