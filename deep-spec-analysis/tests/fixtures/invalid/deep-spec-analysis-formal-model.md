# Deep Spec Formal Model

## Model Summary

Deliberately broken IR for negative testing of the deep-spec-ir-valid
sensor: a dangling frRef (FR-99), an unresolvable attribute reference, a
primed reference inside a guard, and an enum literal that belongs to no
declared enum.

## Formal Model (IR)

```json
{
  "irVersion": "1.0.0",
  "schema": {
    "entities": [
      {
        "name": "order",
        "attributes": [
          { "name": "status", "type": { "kind": "enum", "values": ["draft", "submitted"] } },
          { "name": "amount", "type": { "kind": "int", "min": 0, "max": 3 } }
        ]
      }
    ]
  },
  "obligations": [
    {
      "id": "OB-1",
      "nature": "invariant",
      "frRefs": ["FR-99"],
      "assert": { "op": "ge", "args": [{ "op": "ref", "path": "order.total" }, { "op": "int", "value": 0 }] }
    },
    {
      "id": "OB-2",
      "nature": "event",
      "frRefs": ["FR-4"],
      "trigger": "submit",
      "guard": { "op": "eq", "args": [{ "op": "ref", "path": "order.status", "prime": true }, { "op": "enum", "value": "draft" }] },
      "effect": { "op": "eq", "args": [{ "op": "ref", "path": "order.status", "prime": true }, { "op": "enum", "value": "cancelled" }] }
    }
  ],
  "scenarios": [],
  "background": []
}
```
