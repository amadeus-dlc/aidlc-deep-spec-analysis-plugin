# Contract Summary

## Contracts

| # | Provider Unit | Consumer | Mechanism | Owner |
|---|---|---|---|---|
| 1 | u1-orders | u2-billing | Event | u1-orders |

## Contract 1 — Order events

```yaml
asyncapi: 2.6.0
channels:
  order.shipped:
    subscribe:
      message:
        name: OrderShipped
```
