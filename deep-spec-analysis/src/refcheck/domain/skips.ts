import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { Skipped } from "./skipped.ts";

// skip 記録のファーストクラスコレクション。正準ソート（target → reason）を
// 所有する。
export class Skips extends FirstClassCollectionBase<Skipped, Skips> implements FirstClassCollection<Skipped> {
  readonly #values: readonly Skipped[];

  private constructor(values: readonly Skipped[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-skips");
  }

  protected rebuild(values: readonly Skipped[]): Skips {
    return new Skips(values);
  }

  static parse(values: readonly Skipped[]): Result<Skips, ParseError> {
    return parseConstruction(() => new Skips(values));
  }

  static of(values: readonly Skipped[]): Skips {
    return new Skips(values);
  }

  add(value: Skipped): Skips {
    return new Skips([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<Skipped> {
    yield* this.#values;
  }

  count(): number {
    return this.#values.length;
  }

  sortedCanonically(): Skips {
    return new Skips([...this.#values].sort((a, b) => a.compareTo(b)));
  }

  toArray(): readonly Skipped[] {
    return this.#values;
  }
}
