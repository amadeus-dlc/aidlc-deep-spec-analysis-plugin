// 受け入れ／拒否シナリオ。逐語移動。

import type { Expression } from "./expression.ts";

export interface Scenario {
  id: string;
  kind: "accept" | "reject";
  frRefs: string[];
  bindings: { [path: string]: boolean | number | string };
  event?: { trigger: string };
  expect?: Expression;
}
