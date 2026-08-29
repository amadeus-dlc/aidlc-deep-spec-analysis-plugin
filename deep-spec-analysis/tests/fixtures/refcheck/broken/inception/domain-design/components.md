# Domain Design — Components

## Component Catalogue

```yaml
components:
  - name: OrderService
    summary: Owns the order lifecycle.
    behaviour: >
      Validates and persists orders; publishes lifecycle
      events for downstream consumers.
    responsibilities:
      - Order lifecycle
    depends_on:
      - component: PaymentService
        interaction: charge on submit
        style: sync
      - component: GhostService
        interaction: does not exist
        style: async
    dependents: []
    entities:
      - name: Order
        identifier: orderId
        attributes: [orderId, status, amount]
        references:
          - entity: Invoice
            owned_by: PaymentService
            relationship: each Order has one Invoice
  - name: PaymentService
    summary: Charges payments.
    responsibilities:
      - Payments
    depends_on:
      - component: OrderService
        interaction: reads order totals
        style: sync
    dependents: []
    entities:
      - name: Payment
        attributes: [paymentId]
  - name: badName
    summary: Not PascalCase.
    depends_on:
      - component: badName
        interaction: self
        style: sync
    dependents: []
    entities:
      - name: Order
        identifier: orderId
        attributes: [orderId]
```

## Component Summary

| Component | Purpose |
|---|---|
| OrderService | orders |
