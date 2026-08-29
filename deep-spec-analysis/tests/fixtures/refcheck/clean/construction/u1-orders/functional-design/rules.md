# Rules — u1-orders

```yaml
rules:
  - id: BR1.1
    statement: An order amount must stay within bounds.
    category: validation
    applies_to: Order.amount
    trigger: order submission
    logic: IF amount < 0 OR amount > 100 THEN reject
    violation: reject the submission with a validation error
    source: FR-2
  - id: BR1.2
    statement: Only submitted orders can ship.
    category: constraint
    applies_to: Order.status
    trigger: ship
    logic: IF status != submitted THEN reject
    violation: reject the ship request
    source: FR-1
```
