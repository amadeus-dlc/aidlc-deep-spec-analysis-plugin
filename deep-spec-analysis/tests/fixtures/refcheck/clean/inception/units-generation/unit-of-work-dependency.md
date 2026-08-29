# Unit Dependencies

```yaml
units:
  - name: u1-orders
    kind: service
    depends_on: []
  - name: u2-billing
    kind: service
    depends_on: [u1-orders]
```
