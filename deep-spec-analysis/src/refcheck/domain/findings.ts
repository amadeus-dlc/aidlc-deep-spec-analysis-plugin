import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { Finding } from "./finding.ts";

// finding のファーストクラスコレクション。正準ソート（kind 順位 → targets →
// detail）は要素の `compareTo` に問う（kind 順位は kernel の FindingKind）。
export class Findings extends FirstClassCollectionBase<Finding, Findings> implements FirstClassCollection<Finding> {
  readonly #values: readonly Finding[];

  private constructor(values: readonly Finding[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-findings");
  }

  protected rebuild(values: readonly Finding[]): Findings {
    return new Findings(values);
  }

  static parse(values: readonly Finding[]): Result<Findings, ParseError> {
    return parseConstruction(() => new Findings(values));
  }

  static of(values: readonly Finding[]): Findings {
    return new Findings(values);
  }

  add(value: Finding): Findings {
    return new Findings([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<Finding> {
    yield* this.#values;
  }

  count(): number {
    return this.#values.length;
  }

  sortedCanonically(): Findings {
    return new Findings([...this.#values].sort((a, b) => a.compareTo(b)));
  }

  toArray(): readonly Finding[] {
    return this.#values;
  }
}
