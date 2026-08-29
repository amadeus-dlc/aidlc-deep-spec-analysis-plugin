# Deep Spec Functional Formal Model (invalid fixture)

## Model Summary

Planted contract violations for the design-ir-valid negative test: a
duplicate transition id, an initial state outside the value set, a
transition effect assigning the machine's own attribute, a brRef that does
not exist in rules.md, and BR coverage silence (BR1.3 and BR1.4 neither
referenced nor in unformalized[]).

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
            "attributes": [
              { "name": "status", "type": { "kind": "enum", "values": ["open", "closed"] } },
              { "name": "escalated", "type": { "kind": "bool" } }
            ]
          }
        ]
      },
      "obligations": [
        {
          "id": "DOB-1",
          "nature": "invariant",
          "origin": "rules",
          "brRefs": ["BR9.9"],
          "assert": { "op": "ref", "path": "ticket.escalated" }
        }
      ],
      "stateMachines": [
        {
          "id": "SM-1",
          "entity": "ticket",
          "attribute": "status",
          "initial": ["archived"],
          "transitions": [
            { "id": "TR-1", "from": "open", "to": "closed", "trigger": "close" },
            {
              "id": "TR-1",
              "from": "closed",
              "to": "open",
              "trigger": "reopen",
              "effect": { "op": "eq", "args": [{ "op": "ref", "path": "ticket.status", "prime": true }, { "op": "enum", "value": "open" }] }
            }
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
