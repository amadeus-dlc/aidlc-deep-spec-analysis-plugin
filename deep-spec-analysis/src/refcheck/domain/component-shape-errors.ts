import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import type { ComponentShapeError } from "./component-shape-error.ts";

export class ComponentShapeErrors implements FirstClassCollection, IterableFirstClassCollection<ComponentShapeError> {
  readonly #values: readonly ComponentShapeError[];

  private constructor(values: readonly ComponentShapeError[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly ComponentShapeError[]): ComponentShapeErrors {
    return new ComponentShapeErrors(values);
  }

  add(value: ComponentShapeError): ComponentShapeErrors {
    return new ComponentShapeErrors([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<ComponentShapeError> {
    yield* this.#values;
  }

  count(): number {
    return this.#values.length;
  }

  toArray(): readonly ComponentShapeError[] {
    return this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
