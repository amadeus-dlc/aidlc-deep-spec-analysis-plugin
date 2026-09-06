import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { ComponentShapeError } from "./component-shape-error.ts";

export class ComponentShapeErrors
  extends FirstClassCollectionBase<ComponentShapeError, ComponentShapeErrors>
  implements FirstClassCollection<ComponentShapeError>
{
  readonly #values: readonly ComponentShapeError[];

  private constructor(values: readonly ComponentShapeError[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-component-shape-errors");
  }

  protected rebuild(values: readonly ComponentShapeError[]): ComponentShapeErrors {
    return new ComponentShapeErrors(values);
  }

  static parse(values: readonly ComponentShapeError[]): Result<ComponentShapeErrors, ParseError> {
    return parseConstruction(() => new ComponentShapeErrors(values));
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
