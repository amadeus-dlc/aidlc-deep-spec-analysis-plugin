import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignBackgroundAssumption } from "./design-background-assumption.ts";

// 設計背景仮定のファーストクラスコレクション。
export class DesignBackgroundAssumptions extends FirstClassCollectionBase<
  DesignBackgroundAssumption,
  DesignBackgroundAssumptions
> {
  readonly #values: readonly DesignBackgroundAssumption[];

  private constructor(values: readonly DesignBackgroundAssumption[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-design-background-assumptions");
  }

  protected override rebuild(values: readonly DesignBackgroundAssumption[]): DesignBackgroundAssumptions {
    return new DesignBackgroundAssumptions(values);
  }

  static of(values: readonly DesignBackgroundAssumption[]): DesignBackgroundAssumptions {
    return new DesignBackgroundAssumptions(values);
  }

  override map(
    transform: (element: DesignBackgroundAssumption) => DesignBackgroundAssumption,
  ): DesignBackgroundAssumptions {
    return this.mapTo(transform, DesignBackgroundAssumptions.of);
  }

  override combine(other: DesignBackgroundAssumptions): DesignBackgroundAssumptions {
    return this.combineTo(other, DesignBackgroundAssumptions.of);
  }

  static parse(values: readonly DesignBackgroundAssumption[]): Result<DesignBackgroundAssumptions, ParseError> {
    return parseConstruction(() => new DesignBackgroundAssumptions(values));
  }

  add(value: DesignBackgroundAssumption): DesignBackgroundAssumptions {
    return new DesignBackgroundAssumptions([...this.#values, value]);
  }

  // lowering の凍結順：id の正準順（DesignTransitions.sortedCanonically と同じ面）。
  sortedCanonically(): DesignBackgroundAssumptions {
    return new DesignBackgroundAssumptions([...this.#values].sort((a, b) => a.compareTo(b)));
  }

  override *[Symbol.iterator](): Iterator<DesignBackgroundAssumption> {
    yield* this.#values;
  }

  toArray(): readonly DesignBackgroundAssumption[] {
    return this.#values;
  }
}
