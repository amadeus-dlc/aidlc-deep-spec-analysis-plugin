# Domain Design — Components

## Component Catalogue

```yaml
components:
  - name: OrderService
    summary: Owns the order lifecycle.
    responsibilities:
      - Order lifecycle
    depends_on: []
    dependents:
      - component: BillingService
        interaction: consumes order.shipped events
    entities:
      - name: Order
        identifier: orderId
        attributes: [orderId, status]
  - name: BillingService
    summary: Issues invoices.
    responsibilities:
      - Invoicing
    depends_on:
      - component: OrderService
        interaction: consumes order.shipped events
        style: event
    dependents: []
    entities:
      - name: Invoice
        identifier: invoiceId
        attributes: [invoiceId]
```
