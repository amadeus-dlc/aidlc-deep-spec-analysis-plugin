import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import type { ShapeError } from "./shape-error.ts";

export class ShapeErrors implements FirstClassCollection, IterableFirstClassCollection<ShapeError> {
  readonly #values: readonly ShapeError[];

  private constructor(values: readonly ShapeError[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly ShapeError[]): ShapeErrors {
    return new ShapeErrors(values);
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

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
