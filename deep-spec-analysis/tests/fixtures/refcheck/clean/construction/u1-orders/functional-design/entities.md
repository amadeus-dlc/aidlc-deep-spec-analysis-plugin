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
        min: 0
        max: 100
```
