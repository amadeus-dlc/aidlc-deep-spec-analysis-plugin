import type { Obligation } from "./obligation.ts";

export class Obligations {
  readonly #values: readonly Obligation[];

  private constructor(values: readonly Obligation[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly Obligation[]): Obligations {
    return new Obligations(values);
  }

  add(value: Obligation): Obligations {
    return new Obligations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<Obligation> {
    yield* this.#values;
  }

  byId(id: string): Obligation | undefined {
    return this.#values.find((o) => o.id().asString() === id);
  }

  ids(): readonly string[] {
    return this.#values.map((o) => o.id().asString());
  }

  toArray(): readonly Obligation[] {
    return this.#values;
  }
}
