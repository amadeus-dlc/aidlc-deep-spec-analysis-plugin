import type { ShapeError } from "./shape-error.ts";

export class ShapeErrors {
  readonly #values: readonly ShapeError[];

  private constructor(values: readonly ShapeError[]) {
    this.#values = values;
  }

  static of(values: readonly ShapeError[]): ShapeErrors {
    return new ShapeErrors([...values]);
  }

  add(value: ShapeError): ShapeErrors {
    return new ShapeErrors([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<ShapeError> {
    yield* this.#values;
  }

  toArray(): readonly ShapeError[] {
    return this.#values;
  }
}
