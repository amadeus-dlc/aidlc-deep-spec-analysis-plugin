# Deep Spec Formal Model

## Model Summary

Requirements side of the refinement fixture: one entity, an invariant the
design must preserve (OB-1), an event the design must simulate (OB-2), an
obligation depending on a deliberately unmapped attribute (OB-3, waived),
plus one accept and one reject scenario. `order.note` exists solely to trip
the attribute-closure rule (neither mapped nor in unmapped[]).

## Formal Model (IR)

```json
{
  "irVersion": "1.0.0",
  "schema": {
    "entities": [
      {
        "name": "order",
        "attributes": [
          { "name": "state", "type": { "kind": "enum", "values": ["received", "done"] } },
          { "name": "amount", "type": { "kind": "int", "min": 0, "max": 3 } },
          { "name": "flag", "type": { "kind": "bool" } },
          { "name": "note", "type": { "kind": "bool" } }
        ]
      }
    ]
  },
  "obligations": [
    {
      "id": "OB-1",
      "nature": "invariant",
      "frRefs": ["FR-1"],
      "ears": "The system shall keep every done order at an amount of at least 1.",
      "assert": {
        "op": "implies",
        "args": [
          { "op": "eq", "args": [{ "op": "ref", "path": "order.state" }, { "op": "enum", "value": "done" }] },
          { "op": "ge", "args": [{ "op": "ref", "path": "order.amount" }, { "op": "int", "value": 1 }] }
        ]
      }
    },
    {
      "id": "OB-2",
      "nature": "event",
      "frRefs": ["FR-2"],
      "ears": "When complete occurs while the order is received, the system shall mark it done.",
      "trigger": "complete",
      "guard": { "op": "eq", "args": [{ "op": "ref", "path": "order.state" }, { "op": "enum", "value": "received" }] },
      "effect": { "op": "eq", "args": [{ "op": "ref", "path": "order.state", "prime": true }, { "op": "enum", "value": "done" }] }
    },
    {
      "id": "OB-3",
      "nature": "invariant",
      "frRefs": ["FR-1"],
      "ears": "The system shall keep every flagged order at an amount of at least 1.",
      "assert": {
        "op": "implies",
        "args": [
          { "op": "ref", "path": "order.flag" },
          { "op": "ge", "args": [{ "op": "ref", "path": "order.amount" }, { "op": "int", "value": 1 }] }
        ]
      }
    }
  ],
  "scenarios": [
    {
      "id": "SC-1",
      "kind": "accept",
      "frRefs": ["FR-2"],
      "title": "a received order at amount 1 is legal",
      "bindings": { "order.state": "received", "order.amount": 1 }
    },
    {
      "id": "SC-2",
      "kind": "reject",
      "frRefs": ["FR-1"],
      "title": "a done order at amount 0 must be impossible",
      "bindings": { "order.state": "done", "order.amount": 0 }
    }
  ],
  "background": [],
  "unformalized": []
}
```
