// エンティティ属性ひとつを生涯とする状態機械（契約3）。deterministic: false は
// 同一 (state, trigger) 重複の人間承認済み waiver 宣言。逐語移動。

import type { DesignTransition } from "./design-transition.ts";

export interface DesignMachine {
  id: string;
  entity: string;
  attribute: string;
  initial: string[];
  transitions: DesignTransition[];
  ignores: { state: string; trigger: string; reason: string }[];
  deterministic: boolean;
}
