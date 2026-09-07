import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { BackgroundAssumption } from "./background-assumption.ts";

// 背景仮定のファーストクラスコレクション。
export class BackgroundAssumptions
  extends FirstClassCollectionBase<BackgroundAssumption, BackgroundAssumptions>
  implements FirstClassCollection<BackgroundAssumption>
{
  readonly #values: readonly BackgroundAssumption[];

  private constructor(values: readonly BackgroundAssumption[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-background-assumptions");
  }

  protected override rebuild(values: readonly BackgroundAssumption[]): BackgroundAssumptions {
    return new BackgroundAssumptions(values);
  }

  override map(transform: (element: BackgroundAssumption) => BackgroundAssumption): BackgroundAssumptions {
    return this.mapTo(transform, BackgroundAssumptions.of);
  }

  override combine(other: BackgroundAssumptions): BackgroundAssumptions {
    return this.combineTo(other, BackgroundAssumptions.of);
  }

  static parse(values: readonly BackgroundAssumption[]): Result<BackgroundAssumptions, ParseError> {
    return parseConstruction(() => new BackgroundAssumptions(values));
  }

  static of(values: readonly BackgroundAssumption[]): BackgroundAssumptions {
    return new BackgroundAssumptions(values);
  }

  add(value: BackgroundAssumption): BackgroundAssumptions {
    return new BackgroundAssumptions([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<BackgroundAssumption> {
    yield* this.#values;
  }

  toArray(): readonly BackgroundAssumption[] {
    return this.#values;
  }
}
