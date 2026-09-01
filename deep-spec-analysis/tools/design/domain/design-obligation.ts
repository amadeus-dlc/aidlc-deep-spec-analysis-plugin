// 設計義務（rules 起源の BR 参照つき）。逐語移動。id・nature・origin は
// ドメインプリミティブで運ぶ（既知集合は述語、未知は素通しの凍結挙動）。






import type { Expression, FrRefs, TriggerName } from "../../kernel/domain/index.ts";
import { type BrRefs } from "./br-refs.ts";
import { DesignObligationId } from "./design-obligation-id.ts";
import { DesignObligationNature } from "./design-obligation-nature.ts";
import { DesignObligationOrigin } from "./design-obligation-origin.ts";

export interface DesignObligation {
  id: DesignObligationId;
  nature: DesignObligationNature;
  origin: DesignObligationOrigin;
  brRefs: BrRefs;
  frRefs: FrRefs;
  assert?: Expression;
  trigger?: TriggerName;
  guard?: Expression;
  effect?: Expression;
  temporal?: { pattern: string; assert?: Expression; from?: Expression; to?: Expression };
}

