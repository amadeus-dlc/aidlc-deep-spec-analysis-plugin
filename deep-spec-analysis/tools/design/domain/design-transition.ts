// 状態機械の遷移（契約3）。逐語移動。

import type { Expression } from "../../kernel/domain/index.ts";

export interface DesignTransition {
  id: string;
  from: string;
  to: string;
  trigger: string;
  guard?: Expression;
  effect?: Expression;
  brRefs: string[];
}
