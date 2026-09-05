import type { WitnessReference } from "./witness-reference.ts";

export class WitnessReferences {
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
}
