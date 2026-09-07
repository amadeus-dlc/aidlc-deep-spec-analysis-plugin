import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type Json,
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

  protected override rebuild(values: readonly Skipped[]): Skips {
    return new Skips(values);
  }

  override map(transform: (element: Skipped) => Skipped): Skips {
    return this.mapTo(transform, Skips.of);
  }

  override combine(other: Skips): Skips {
    return this.combineTo(other, Skips.of);
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

  override *[Symbol.iterator](): Iterator<Skipped> {
    yield* this.#values;
  }

  override count(): number {
    return this.#values.length;
  }

  sortedCanonically(): Skips {
    return new Skips([...this.#values].sort((a, b) => a.compareTo(b)));
  }

  // 境界: 描画専用。skipped[] は保持順（sortedCanonically 済みの凍結正準順）。
  toDocuments(): Json[] {
    return this.#values.map((skipped) => skipped.toDocument());
  }

  toArray(): readonly Skipped[] {
    return this.#values;
  }
}
