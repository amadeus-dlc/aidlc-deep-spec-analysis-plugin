# Domain Design — Components

## Component Catalogue

```yaml
components:
  - name: OrderService
    summary: Owns the order lifecycle.
    responsibilities:
      - Order lifecycle
    depends_on:
      - component: BillingService
        interaction: request invoicing on ship
        style: async
    dependents: []
    entities:
      - name: Order
        identifier: orderId
        attributes: [orderId, status]
  - name: BillingService
    summary: Issues invoices.
    responsibilities:
      - Invoicing
    depends_on: []
    dependents:
      - component: OrderService
        interaction: request invoicing on ship
    entities:
      - name: Invoice
        identifier: invoiceId
        attributes: [invoiceId]
```
