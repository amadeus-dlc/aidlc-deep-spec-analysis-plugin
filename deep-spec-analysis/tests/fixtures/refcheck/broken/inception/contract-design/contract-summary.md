# Contract Summary

## Contracts

| # | Provider Unit | Consumer | Mechanism | Owner |
|---|---|---|---|---|
| 1 | u1-orders | u2-billing | REST | u1-orders |
| 2 | ghost-unit | External: Stripe | REST | u1-orders |
| 3 | Order Service | u2-billing | REST | u1-orders |

## Contract 1 — Orders API

```yaml
openapi: 3.0.0
info:
  title: Orders API
  version: 1.0.0
```

## Contract 2 — Billing events

```yaml
asyncapi: 2.6.0
channels:
  order.submitted:
    subscribe:
      message:
        name: OrderSubmitted
```
