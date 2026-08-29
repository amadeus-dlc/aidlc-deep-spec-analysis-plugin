# Deep Spec Refinement Map

## Map Summary

Abstraction function for unit u1-orders: the requirements order lifecycle
(received/done) is the image of the design phase (new+closing -> received,
closed -> done); the amount is the ticket value verbatim. The audit flag is
deliberately unmapped (waiving OB-3); `order.note` is deliberately NEITHER
mapped nor in unmapped[] — the attribute-closure rule must flag it. The
requirements `complete` event maps to TR-2 only, leaving phase `new`
uncovered on purpose (enabledness gap).

## Refinement Map (contract 4)

```json
{
  "mapVersion": "1.0.0",
  "requirementsIrHash": "23f8d411b5620810ef51a0b8dc5e140b3d0a82fbb6f16f650829e9192e951868",
  "designIrHash": "7106691451957f9b3c33f9fd201865194f0a1f959e4c9a8b953dc600bb31052a",
  "units": [
    {
      "unit": "u1-orders",
      "attrMap": [
        {
          "req": "order.state",
          "enumMap": {
            "from": "ticket.phase",
            "cases": { "new": "received", "closing": "received", "closed": "done" }
          }
        },
        { "req": "order.amount", "expr": { "op": "ref", "path": "ticket.value" } }
      ],
      "eventMap": [{ "reqTrigger": "complete", "transitions": ["TR-2"] }],
      "unmapped": [
        { "target": "order.flag", "reason": "the audit flag is not represented in this unit" },
        { "target": "OB-3", "reason": "depends on the unmapped audit flag" }
      ]
    }
  ]
}
```
