import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type Json,
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

  protected override rebuild(values: readonly Finding[]): Findings {
    return new Findings(values);
  }

  override map(transform: (element: Finding) => Finding): Findings {
    return this.mapTo(transform, Findings.of);
  }

  override combine(other: Findings): Findings {
    return this.combineTo(other, Findings.of);
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

  override *[Symbol.iterator](): Iterator<Finding> {
    yield* this.#values;
  }

  override count(): number {
    return this.#values.length;
  }

  sortedCanonically(): Findings {
    return new Findings([...this.#values].sort((a, b) => a.compareTo(b)));
  }

  // 境界: 描画専用。findings[] は保持順（sortedCanonically 済みの凍結正準順）。
  toDocuments(): Json[] {
    return this.#values.map((finding) => finding.toDocument());
  }

  toArray(): readonly Finding[] {
    return this.#values;
  }
}
