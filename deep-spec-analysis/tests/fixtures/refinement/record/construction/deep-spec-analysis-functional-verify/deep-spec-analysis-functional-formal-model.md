# Deep Spec Functional Formal Model

## Model Summary

Design side of the refinement fixture (unit u1-orders): a two-transition
lifecycle whose entity model deliberately LACKS the "closed implies value >= 1"
constraint the requirements demand (OB-1 refinement violation, statically and
reachably), and whose eventMap covers only TR-2 — the requirements event also
applies in phase `new`, where nothing is enabled (enabledness gap).

## Formal Model (IR)

```json
{
  "irVersion": "1.0.0",
  "irKind": "design",
  "units": [
    {
      "unit": "u1-orders",
      "schema": {
        "entities": [
          {
            "name": "ticket",
            "attributes": [
              { "name": "phase", "type": { "kind": "enum", "values": ["new", "closing", "closed"] } },
              { "name": "value", "type": { "kind": "int", "min": 0, "max": 3 } }
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
          "statement": "A closed ticket keeps a non-negative value (too weak on purpose).",
          "assert": {
            "op": "implies",
            "args": [
              { "op": "eq", "args": [{ "op": "ref", "path": "ticket.phase" }, { "op": "enum", "value": "closed" }] },
              { "op": "ge", "args": [{ "op": "ref", "path": "ticket.value" }, { "op": "int", "value": 0 }] }
            ]
          }
        }
      ],
      "stateMachines": [
        {
          "id": "SM-1",
          "entity": "ticket",
          "attribute": "phase",
          "initial": ["new"],
          "transitions": [
            { "id": "TR-1", "from": "new", "to": "closing", "trigger": "finish" },
            { "id": "TR-2", "from": "closing", "to": "closed", "trigger": "confirm" }
          ]
        }
      ],
      "scenarios": [],
      "background": [],
      "unformalized": []
    }
  ]
}
```
