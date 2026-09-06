# 到達性の再現

```json
{
  "irVersion": "1.0.0",
  "schema": {
    "entities": [
      {
        "name": "ticket",
        "description": "A support ticket and its lifecycle.",
        "attributes": [
          {
            "name": "status",
            "type": {
              "kind": "enum",
              "values": [
                "open",
                "triaged",
                "closed",
                "archived"
              ]
            }
          },
          {
            "name": "priority",
            "type": {
              "kind": "int",
              "min": 0,
              "max": 2
            }
          },
          {
            "name": "escalated",
            "type": {
              "kind": "bool"
            }
          },
          {
            "name": "flagged",
            "type": {
              "kind": "bool"
            }
          }
        ]
      }
    ]
  },
  "obligations": [
    {
      "id": "OB-2",
      "nature": "event",
      "frRefs": [],
      "trigger": "escalate",
      "guard": {
        "op": "eq",
        "args": [
          {
            "op": "ref",
            "path": "ticket.status"
          },
          {
            "op": "enum",
            "value": "triaged"
          }
        ]
      },
      "effect": {
        "op": "eq",
        "args": [
          {
            "op": "ref",
            "path": "ticket.escalated",
            "prime": true
          },
          {
            "op": "bool",
            "value": true
          }
        ]
      }
    },
    {
      "id": "OB-3",
      "nature": "event",
      "frRefs": [],
      "trigger": "flag",
      "guard": {
        "op": "eq",
        "args": [
          {
            "op": "ref",
            "path": "ticket.status"
          },
          {
            "op": "enum",
            "value": "closed"
          }
        ]
      },
      "effect": {
        "op": "eq",
        "args": [
          {
            "op": "ref",
            "path": "ticket.flagged",
            "prime": true
          },
          {
            "op": "bool",
            "value": true
          }
        ]
      }
    },
    {
      "id": "OB-4",
      "nature": "event",
      "frRefs": [],
      "trigger": "flag",
      "guard": {
        "op": "and",
        "args": [
          {
            "op": "eq",
            "args": [
              {
                "op": "ref",
                "path": "ticket.status"
              },
              {
                "op": "enum",
                "value": "closed"
              }
            ]
          },
          {
            "op": "ge",
            "args": [
              {
                "op": "ref",
                "path": "ticket.priority"
              },
              {
                "op": "int",
                "value": 0
              }
            ]
          }
        ]
      },
      "effect": {
        "op": "eq",
        "args": [
          {
            "op": "ref",
            "path": "ticket.flagged",
            "prime": true
          },
          {
            "op": "bool",
            "value": true
          }
        ]
      }
    },
    {
      "id": "OB-5",
      "nature": "event",
      "frRefs": [],
      "trigger": "triage",
      "guard": {
        "op": "and",
        "args": [
          {
            "op": "eq",
            "args": [
              {
                "op": "ref",
                "path": "ticket.status"
              },
              {
                "op": "enum",
                "value": "open"
              }
            ]
          },
          {
            "op": "ge",
            "args": [
              {
                "op": "ref",
                "path": "ticket.priority"
              },
              {
                "op": "int",
                "value": 1
              }
            ]
          }
        ]
      },
      "effect": {
        "op": "eq",
        "args": [
          {
            "op": "ref",
            "path": "ticket.status",
            "prime": true
          },
          {
            "op": "enum",
            "value": "triaged"
          }
        ]
      }
    },
    {
      "id": "OB-6",
      "nature": "event",
      "frRefs": [],
      "trigger": "triage",
      "guard": {
        "op": "eq",
        "args": [
          {
            "op": "ref",
            "path": "ticket.status"
          },
          {
            "op": "enum",
            "value": "open"
          }
        ]
      },
      "effect": {
        "op": "eq",
        "args": [
          {
            "op": "ref",
            "path": "ticket.status",
            "prime": true
          },
          {
            "op": "enum",
            "value": "closed"
          }
        ]
      }
    },
    {
      "id": "OB-7",
      "nature": "event",
      "frRefs": [],
      "trigger": "close",
      "guard": {
        "op": "eq",
        "args": [
          {
            "op": "ref",
            "path": "ticket.status"
          },
          {
            "op": "enum",
            "value": "triaged"
          }
        ]
      },
      "effect": {
        "op": "eq",
        "args": [
          {
            "op": "ref",
            "path": "ticket.status",
            "prime": true
          },
          {
            "op": "enum",
            "value": "closed"
          }
        ]
      }
    },
    {
      "id": "OB-8",
      "nature": "event",
      "frRefs": [],
      "trigger": "close",
      "guard": {
        "op": "and",
        "args": [
          {
            "op": "eq",
            "args": [
              {
                "op": "ref",
                "path": "ticket.status"
              },
              {
                "op": "enum",
                "value": "open"
              }
            ]
          },
          {
            "op": "and",
            "args": [
              {
                "op": "ge",
                "args": [
                  {
                    "op": "ref",
                    "path": "ticket.priority"
                  },
                  {
                    "op": "int",
                    "value": 2
                  }
                ]
              },
              {
                "op": "le",
                "args": [
                  {
                    "op": "ref",
                    "path": "ticket.priority"
                  },
                  {
                    "op": "int",
                    "value": 0
                  }
                ]
              }
            ]
          }
        ]
      },
      "effect": {
        "op": "eq",
        "args": [
          {
            "op": "ref",
            "path": "ticket.status",
            "prime": true
          },
          {
            "op": "enum",
            "value": "closed"
          }
        ]
      }
    },
    {
      "id": "OB-9",
      "nature": "event",
      "frRefs": [],
      "trigger": "close",
      "guard": {
        "op": "eq",
        "args": [
          {
            "op": "ref",
            "path": "ticket.status"
          },
          {
            "op": "enum",
            "value": "closed"
          }
        ]
      },
      "effect": {
        "op": "eq",
        "args": [
          {
            "op": "ref",
            "path": "ticket.status",
            "prime": true
          },
          {
            "op": "ref",
            "path": "ticket.status"
          }
        ]
      }
    },
    {
      "id": "OB-9999",
      "nature": "invariant",
      "frRefs": [],
      "assert": {
        "op": "ne",
        "args": [
          {
            "op": "ref",
            "path": "ticket.status"
          },
          {
            "op": "enum",
            "value": "archived"
          }
        ]
      }
    }
  ],
  "scenarios": [],
  "background": []
}
```
