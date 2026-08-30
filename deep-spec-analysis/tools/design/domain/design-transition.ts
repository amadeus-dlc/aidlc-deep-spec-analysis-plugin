// 状態機械の遷移（契約3）。逐語移動。

import { IdOrder } from "../../kernel/domain/index.ts";
import type { Expression } from "../../kernel/domain/index.ts";
import type { BrRefs } from "./design-ir-decl.ts";

export interface DesignTransition {
  id: string;
  from: string;
  to: string;
  trigger: string;
  guard?: Expression;
  effect?: Expression;
  brRefs: BrRefs;
}

// 遷移のファーストクラスコレクション。id の正準順（lowering の凍結順）を所有。
export class DesignTransitions {
  readonly #values: readonly DesignTransition[];

  private constructor(values: readonly DesignTransition[]) {
    this.#values = values;
  }

  static of(values: readonly DesignTransition[]): DesignTransitions {
    return new DesignTransitions([...values]);
  }

  add(value: DesignTransition): DesignTransitions {
    return new DesignTransitions([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignTransition> {
    yield* this.#values;
  }

  ids(): readonly string[] {
    return this.#values.map((t) => t.id);
  }

  sortedCanonically(): DesignTransitions {
    return new DesignTransitions([...this.#values].sort((a, b) => IdOrder.compare(a.id, b.id)));
  }

  toArray(): readonly DesignTransition[] {
    return this.#values;
  }
}
