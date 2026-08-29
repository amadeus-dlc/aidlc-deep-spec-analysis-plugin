# Entities — u1-orders

```yaml
entities:
  - name: Order
    description: A customer order.
    attributes:
      - name: orderId
        type: string
        required: true
        unique: true
      - name: status
        type: string
        allowed_values: [draft, submitted, shipped]
        default: draft
      - name: amount
        type: int
        min: 5
        max: 3
      - name: price
        type: decimal
        allowed_values: [low, high]
      - name: customerRef
        type: string
        references: Ghost
    relationships:
      - to: Ghost
        cardinality: 1:N
      - to: Order
        cardinality: many
```
