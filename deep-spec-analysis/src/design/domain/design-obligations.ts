import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignObligation } from "./design-obligation.ts";

// 設計義務のファーストクラスコレクション。id 列の導出を所有する。
export class DesignObligations extends FirstClassCollectionBase<DesignObligation, DesignObligations> {
  readonly #values: readonly DesignObligation[];

  private constructor(values: readonly DesignObligation[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-design-obligations");
  }

  protected override rebuild(values: readonly DesignObligation[]): DesignObligations {
    return new DesignObligations(values);
  }

  static of(values: readonly DesignObligation[]): DesignObligations {
    return new DesignObligations(values);
  }

  override map(transform: (element: DesignObligation) => DesignObligation): DesignObligations {
    return this.mapTo(transform, DesignObligations.of);
  }

  override combine(other: DesignObligations): DesignObligations {
    return this.combineTo(other, DesignObligations.of);
  }

  static parse(values: readonly DesignObligation[]): Result<DesignObligations, ParseError> {
    return parseConstruction(() => new DesignObligations(values));
  }

  add(value: DesignObligation): DesignObligations {
    return new DesignObligations([...this.#values, value]);
  }

  // lowering の凍結順：id の正準順（DesignTransitions.sortedCanonically と同じ面）。
  sortedCanonically(): DesignObligations {
    return new DesignObligations([...this.#values].sort((a, b) => a.id().compareTo(b.id())));
  }

  override *[Symbol.iterator](): Iterator<DesignObligation> {
    yield* this.#values;
  }

  ids(): readonly string[] {
    return this.#values.map((o) => o.id().asString());
  }

  toArray(): readonly DesignObligation[] {
    return this.#values;
  }
}
