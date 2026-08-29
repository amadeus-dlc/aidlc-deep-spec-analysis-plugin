# Deep Spec Formal Model

## Model Summary

在庫引当サービスの形式化。1エンティティ（order）、イベント義務3件（FR-1〜FR-3、
すべて注文処理トリガー `place_order` 上のルール）、不変条件1件（OB-4）、
シナリオ5件（When-event型2件＋静的3件）、背景制約1件。
FR-1/FR-2/FR-3 はガードが重なり得る（例: 在庫十分×ブロック顧客×高額）が効果が
互いに矛盾するため、同一トリガー上の衝突として検出されることを期待する。
「在庫不足かつ非ブロックかつ非高額」の入力領域はどの FR も挙動を規定しておらず、
完全性ギャップとして検出されることを期待する。静的シナリオのうち SC-5 は
OB-4 に反する状態を合法と主張する壊れた accept であり、scenario-violation として
両バックエンドに検出されることを期待する（cross-check の照合対象）。
When-event 型の SC-1 / SC-2 は v1 では両バックエンドとも capability skip となる。

## Formal Model (IR)

```json
{
  "irVersion": "1.0.0",
  "schema": {
    "entities": [
      {
        "name": "order",
        "description": "在庫引当を待つ注文。金額は expensive（100,000円超）として抽象化する。",
        "attributes": [
          { "name": "status", "type": { "kind": "enum", "values": ["pending", "allocated", "rejected", "awaiting_approval"] } },
          { "name": "stock", "type": { "kind": "int", "min": 0, "max": 3 } },
          { "name": "qty", "type": { "kind": "int", "min": 1, "max": 3 } },
          { "name": "blocked", "type": { "kind": "bool" } },
          { "name": "expensive", "type": { "kind": "bool" } }
        ]
      }
    ]
  },
  "obligations": [
    {
      "id": "OB-1",
      "nature": "event",
      "frRefs": ["FR-1"],
      "ears": "When an order is placed while stock is at least the ordered quantity, the system shall mark the order allocated.",
      "trigger": "place_order",
      "guard": {
        "op": "and",
        "args": [
          { "op": "eq", "args": [{ "op": "ref", "path": "order.status" }, { "op": "enum", "value": "pending" }] },
          { "op": "ge", "args": [{ "op": "ref", "path": "order.stock" }, { "op": "ref", "path": "order.qty" }] }
        ]
      },
      "effect": { "op": "eq", "args": [{ "op": "ref", "path": "order.status", "prime": true }, { "op": "enum", "value": "allocated" }] }
    },
    {
      "id": "OB-2",
      "nature": "event",
      "frRefs": ["FR-2"],
      "ears": "When an order is placed while the customer is blocklisted, the system shall reject the order.",
      "trigger": "place_order",
      "guard": {
        "op": "and",
        "args": [
          { "op": "eq", "args": [{ "op": "ref", "path": "order.status" }, { "op": "enum", "value": "pending" }] },
          { "op": "ref", "path": "order.blocked" }
        ]
      },
      "effect": { "op": "eq", "args": [{ "op": "ref", "path": "order.status", "prime": true }, { "op": "enum", "value": "rejected" }] }
    },
    {
      "id": "OB-3",
      "nature": "event",
      "frRefs": ["FR-3"],
      "ears": "When an order is placed while the order amount exceeds 100,000 yen, the system shall mark the order awaiting approval.",
      "trigger": "place_order",
      "guard": {
        "op": "and",
        "args": [
          { "op": "eq", "args": [{ "op": "ref", "path": "order.status" }, { "op": "enum", "value": "pending" }] },
          { "op": "ref", "path": "order.expensive" }
        ]
      },
      "effect": { "op": "eq", "args": [{ "op": "ref", "path": "order.status", "prime": true }, { "op": "enum", "value": "awaiting_approval" }] }
    },
    {
      "id": "OB-4",
      "nature": "invariant",
      "frRefs": ["FR-2"],
      "ears": "The system shall never keep a blocklisted customer's order in the allocated state.",
      "assert": {
        "op": "implies",
        "args": [
          { "op": "ref", "path": "order.blocked" },
          { "op": "ne", "args": [{ "op": "ref", "path": "order.status" }, { "op": "enum", "value": "allocated" }] }
        ]
      }
    }
  ],
  "scenarios": [
    {
      "id": "SC-1",
      "kind": "accept",
      "frRefs": ["FR-1"],
      "title": "在庫十分・非ブロック・通常金額の注文は引当済みになる",
      "bindings": { "order.status": "pending", "order.stock": 3, "order.qty": 1, "order.blocked": false, "order.expensive": false },
      "event": { "trigger": "place_order" },
      "expect": { "op": "eq", "args": [{ "op": "ref", "path": "order.status", "prime": true }, { "op": "enum", "value": "allocated" }] }
    },
    {
      "id": "SC-2",
      "kind": "accept",
      "frRefs": ["FR-2"],
      "title": "ブロック顧客の高額注文は（在庫が十分でも）必ず拒否される",
      "bindings": { "order.status": "pending", "order.stock": 3, "order.qty": 1, "order.blocked": true, "order.expensive": true },
      "event": { "trigger": "place_order" },
      "expect": { "op": "eq", "args": [{ "op": "ref", "path": "order.status", "prime": true }, { "op": "enum", "value": "rejected" }] }
    },
    {
      "id": "SC-3",
      "kind": "accept",
      "frRefs": ["FR-1"],
      "title": "非ブロック顧客の引当済み注文は合法な状態である",
      "bindings": { "order.status": "allocated", "order.blocked": false, "order.expensive": false, "order.stock": 3, "order.qty": 1 }
    },
    {
      "id": "SC-4",
      "kind": "reject",
      "frRefs": ["FR-2"],
      "title": "ブロック顧客の注文が引当済み状態にあることは不可能でなければならない",
      "bindings": { "order.status": "allocated", "order.blocked": true }
    },
    {
      "id": "SC-5",
      "kind": "accept",
      "frRefs": ["FR-2"],
      "title": "（壊れた主張）ブロック顧客の引当済み注文も合法である",
      "bindings": { "order.status": "allocated", "order.blocked": true, "order.expensive": false, "order.stock": 2, "order.qty": 1 }
    }
  ],
  "background": [
    {
      "id": "BG-1",
      "text": "在庫数は定義上非負である。",
      "assert": { "op": "ge", "args": [{ "op": "ref", "path": "order.stock" }, { "op": "int", "value": 0 }] }
    }
  ],
  "unformalized": []
}
```
