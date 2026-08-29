// 設計シナリオ（受け入れ／拒否、BR/FR 両参照つき）。逐語移動。

import type { Expression } from "../../kernel/domain/index.ts";

export interface DesignScenario {
  id: string;
  kind: "accept" | "reject";
  brRefs: string[];
  frRefs: string[];
  bindings: { [path: string]: boolean | number | string };
  event?: { trigger: string };
  expect?: Expression;
}
