// 義務（EARS nature 付き）。逐語移動。id と nature はドメインプリミティブで
// 運ぶ（nature の既知集合は述語として所有——未知 nature は素通しで capability
// 文言に逐語で載る凍結挙動）。





import type { Expression } from "../../kernel/domain/expression.ts";
import type { FrRefs, TriggerName } from "../../kernel/domain/index.ts";
import { ObligationId } from "./obligation-id.ts";
import { ObligationNature } from "./obligation-nature.ts";

export interface Obligation {
  id: ObligationId;
  nature: ObligationNature;
  frRefs: FrRefs;
  ears?: string;
  assert?: Expression;
  trigger?: TriggerName;
  guard?: Expression;
  effect?: Expression;
  temporal?: { pattern: string; assert?: Expression; from?: Expression; to?: Expression };
}


