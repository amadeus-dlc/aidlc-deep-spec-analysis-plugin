# Rules — u1-orders

```yaml
rules:
  - id: BR1.1
    statement: An order must have a positive amount.
    category: validation
    applies_to: Order.amount
    logic: IF amount <= 0 THEN reject
    source: FR-1
  - id: BR1.1
    statement: Duplicate id.
    category: validation
    applies_to: Order
    source: FR-1
  - id: BRx
    statement: Bad id shape.
    category: policy
    applies_to: Order
    source: FR-2
  - id: BR1.2
    statement: Phantom source.
    category: constraint
    applies_to: Ghost.field
    source: FR-99
  - id: BR1.3
    statement: Weird category.
    category: magic
    applies_to: Order.status
    source: FR-1
  - id: BR1.4
    category: validation
    applies_to: Order
    source: FR-3
```
