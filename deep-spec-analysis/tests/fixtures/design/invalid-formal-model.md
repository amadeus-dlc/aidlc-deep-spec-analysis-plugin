# Deep Spec Functional Formal Model (invalid fixture)

## Model Summary

Planted contract violations for the design-ir-valid negative test:

- a duplicate transition id (TR-1 twice);
- an initial state (`archived`) outside the value set;
- a transition effect assigning the machine's own attribute;
- an unbounded int attribute (`ticket.retries` without min/max);
- an enum literal bound to the wrong sibling attribute (`"email"` compared
  against `ticket.status`; the value exists only on `ticket.channel`, so the
  any-enum shortcut would wrongly accept it);
- a brRef (`BR9.9`) that does not exist in rules.md;
- BR coverage silence: rules.md declares BR1.1..BR1.4 and none is referenced
  or in unformalized[] — four coverage errors;
- a second unit (`u9-ghost`) whose name matches no construction directory.

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
              { "name": "channel", "type": { "kind": "enum", "values": ["email", "phone"] } },
              { "name": "retries", "type": { "kind": "int" } },
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
        },
        {
          "id": "DOB-2",
          "nature": "invariant",
          "origin": "entities",
          "assert": { "op": "eq", "args": [{ "op": "ref", "path": "ticket.status" }, { "op": "enum", "value": "email" }] }
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
    },
    {
      "unit": "u9-ghost",
      "schema": { "entities": [] },
      "obligations": [],
      "stateMachines": [],
      "scenarios": [],
      "background": [],
      "unformalized": []
    }
  ]
}
```
