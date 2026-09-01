// 状態機械の遷移（契約3）。逐語移動。id はドメインプリミティブで運ぶ。




import type { Expression, TriggerName } from "../../kernel/domain/index.ts";
import { type BrRefs } from "./br-refs.ts";
import { DesignTransitionId } from "./design-transition-id.ts";

export interface DesignTransition {
  id: DesignTransitionId;
  from: string;
  to: string;
  trigger: TriggerName;
  guard?: Expression;
  effect?: Expression;
  brRefs: BrRefs;
}

