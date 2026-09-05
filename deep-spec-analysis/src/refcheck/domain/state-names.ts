import { StateName } from "./state-name.ts";

export class StateNames {
  readonly #values: readonly StateName[];

  private constructor(values: readonly StateName[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly StateName[]): StateNames {
    return new StateNames(values);
  }

  add(value: StateName): StateNames {
    return new StateNames([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<StateName> {
    yield* this.#values;
  }

  toArray(): readonly StateName[] {
    return this.#values;
  }
}
