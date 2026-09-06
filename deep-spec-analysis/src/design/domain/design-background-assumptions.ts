import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import type { DesignBackgroundAssumption } from "./design-background-assumption.ts";

// 設計背景仮定のファーストクラスコレクション。
export class DesignBackgroundAssumptions
  implements FirstClassCollection, IterableFirstClassCollection<DesignBackgroundAssumption>
{
  readonly #values: readonly DesignBackgroundAssumption[];

  private constructor(values: readonly DesignBackgroundAssumption[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly DesignBackgroundAssumption[]): DesignBackgroundAssumptions {
    return new DesignBackgroundAssumptions(values);
  }

  add(value: DesignBackgroundAssumption): DesignBackgroundAssumptions {
    return new DesignBackgroundAssumptions([...this.#values, value]);
  }

  // lowering の凍結順：id の正準順（DesignTransitions.sortedCanonically と同じ面）。
  sortedCanonically(): DesignBackgroundAssumptions {
    return new DesignBackgroundAssumptions([...this.#values].sort((a, b) => a.compareTo(b)));
  }

  *[Symbol.iterator](): Iterator<DesignBackgroundAssumption> {
    yield* this.#values;
  }

  toArray(): readonly DesignBackgroundAssumption[] {
    return this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
