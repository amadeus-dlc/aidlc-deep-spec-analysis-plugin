import type { ComponentShapeError } from "./component-shape-error.ts";

export class ComponentShapeErrors {
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
}
