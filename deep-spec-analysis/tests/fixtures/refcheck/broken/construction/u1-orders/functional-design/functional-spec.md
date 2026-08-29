# Functional Spec — u1-orders

## Workflows

1. Submit order.

### State Machine: Order

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> submitted
    submitted --> cancelled
```
