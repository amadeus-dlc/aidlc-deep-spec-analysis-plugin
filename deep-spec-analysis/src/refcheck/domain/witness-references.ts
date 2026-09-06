import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
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

  protected rebuild(values: readonly WitnessReference[]): WitnessReferences {
    return new WitnessReferences(values);
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

  *[Symbol.iterator](): Iterator<WitnessReference> {
    yield* this.#values;
  }

  toArray(): readonly WitnessReference[] {
    return this.#values;
  }
}
