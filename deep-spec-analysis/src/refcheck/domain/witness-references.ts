import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type Json,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { WitnessReference } from "./witness-reference.ts";

export class WitnessReferences
  extends FirstClassCollectionBase<WitnessReference, WitnessReferences>
  implements FirstClassCollection<WitnessReference>
{
  readonly #values: readonly WitnessReference[];

  private constructor(values: readonly WitnessReference[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-witness-references");
  }

  protected override rebuild(values: readonly WitnessReference[]): WitnessReferences {
    return new WitnessReferences(values);
  }

  override map(transform: (element: WitnessReference) => WitnessReference): WitnessReferences {
    return this.mapTo(transform, WitnessReferences.of);
  }

  override combine(other: WitnessReferences): WitnessReferences {
    return this.combineTo(other, WitnessReferences.of);
  }

  static parse(values: readonly WitnessReference[]): Result<WitnessReferences, ParseError> {
    return parseConstruction(() => new WitnessReferences(values));
  }

  static of(values: readonly WitnessReference[]): WitnessReferences {
    return new WitnessReferences(values);
  }

  add(value: WitnessReference): WitnessReferences {
    return new WitnessReferences([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<WitnessReference> {
    yield* this.#values;
  }

  // 境界: 描画専用。witness.refs は記録順（golden 凍結）。
  toDocuments(): Json[] {
    return this.#values.map((reference) => reference.toDocument());
  }

  toArray(): readonly WitnessReference[] {
    return this.#values;
  }
}
