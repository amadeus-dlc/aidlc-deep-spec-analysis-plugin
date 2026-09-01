import { IdOrder } from "../../kernel/domain/index.ts";
import type { DesignBackgroundAssumption } from "./design-background-assumption.ts";

// 設計背景仮定のファーストクラスコレクション。
export class DesignBackgroundAssumptions {
  readonly #values: readonly DesignBackgroundAssumption[];

  private constructor(values: readonly DesignBackgroundAssumption[]) {
    this.#values = values;
  }

  static of(values: readonly DesignBackgroundAssumption[]): DesignBackgroundAssumptions {
    return new DesignBackgroundAssumptions([...values]);
  }

  add(value: DesignBackgroundAssumption): DesignBackgroundAssumptions {
    return new DesignBackgroundAssumptions([...this.#values, value]);
  }

  // lowering の凍結順：IdOrder 正準順（DesignTransitions.sortedCanonically と同じ面）。
  sortedCanonically(): DesignBackgroundAssumptions {
    return new DesignBackgroundAssumptions([...this.#values].sort((a, b) => IdOrder.compare(a.id.asString(), b.id.asString())));
  }

  *[Symbol.iterator](): Iterator<DesignBackgroundAssumption> {
    yield* this.#values;
  }

  toArray(): readonly DesignBackgroundAssumption[] {
    return this.#values;
  }
}
