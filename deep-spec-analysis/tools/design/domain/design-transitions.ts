import { IdOrder } from "../../kernel/domain/index.ts";
import type { DesignTransition } from "./design-transition.ts";

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
    return this.#values.map((t) => t.id.asString());
  }

  sortedCanonically(): DesignTransitions {
    return new DesignTransitions([...this.#values].sort((a, b) => IdOrder.compare(a.id.asString(), b.id.asString())));
  }

  toArray(): readonly DesignTransition[] {
    return this.#values;
  }
}
