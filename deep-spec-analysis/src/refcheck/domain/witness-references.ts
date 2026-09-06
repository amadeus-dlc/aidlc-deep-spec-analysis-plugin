import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import type { WitnessReference } from "./witness-reference.ts";

export class WitnessReferences implements FirstClassCollection, IterableFirstClassCollection<WitnessReference> {
  readonly #values: readonly WitnessReference[];

  private constructor(values: readonly WitnessReference[]) {
    this.#values = Object.freeze([...values]);
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

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
