// 設計義務（rules 起源の BR 参照つき）。逐語移動。

import type { Expression } from "../../kernel/domain/index.ts";

export interface DesignObligation {
  id: string;
  nature: string;
  origin: string;
  brRefs: string[];
  frRefs: string[];
  assert?: Expression;
  trigger?: string;
  guard?: Expression;
  effect?: Expression;
  temporal?: { pattern: string; assert?: Expression; from?: Expression; to?: Expression };
}
