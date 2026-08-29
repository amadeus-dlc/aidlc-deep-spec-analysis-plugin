// 義務（EARS nature 付き）。逐語移動。

import type { Expression } from "../../kernel/domain/expression.ts";

export interface Obligation {
  id: string;
  nature: string;
  frRefs: string[];
  ears?: string;
  assert?: Expression;
  trigger?: string;
  guard?: Expression;
  effect?: Expression;
  temporal?: { pattern: string; assert?: Expression; from?: Expression; to?: Expression };
}
