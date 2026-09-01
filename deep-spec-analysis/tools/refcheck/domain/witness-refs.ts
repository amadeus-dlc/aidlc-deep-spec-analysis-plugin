import type { WitnessRef } from "./witness-ref.ts";

export class WitnessRefs {
  readonly #values: readonly WitnessRef[];

  private constructor(values: readonly WitnessRef[]) {
    this.#values = values;
  }

  static of(values: readonly WitnessRef[]): WitnessRefs {
    return new WitnessRefs([...values]);
  }

  add(value: WitnessRef): WitnessRefs {
    return new WitnessRefs([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<WitnessRef> {
    yield* this.#values;
  }

  toArray(): readonly WitnessRef[] {
    return this.#values;
  }
}
