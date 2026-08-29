# Rules — u1-tickets

```yaml
rules:
  - id: BR1.1
    statement: An escalated ticket must have priority 2 or higher.
    category: constraint
    applies_to: ticket.escalated
    source: FR-1
  - id: BR1.2
    statement: Escalating a triaged ticket marks it escalated.
    category: policy
    applies_to: ticket.escalated
    trigger: escalate
    source: FR-1
  - id: BR1.3
    statement: Closed tickets can be flagged for audit.
    category: policy
    applies_to: ticket.flagged
    trigger: flag
    source: FR-1
  - id: BR1.4
    statement: The nightly retention workflow archives closed tickets after 90 days.
    category: policy
    applies_to: ticket.status
    source: FR-1
```
