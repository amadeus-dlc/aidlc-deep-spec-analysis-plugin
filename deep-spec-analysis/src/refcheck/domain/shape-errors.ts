import {
  type ArtifactPath,
  type FirstClassCollection,
  FirstClassCollectionBase,
} from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { CheckFamily } from "./check-family.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import type { ShapeError } from "./shape-error.ts";

export class ShapeErrors
  extends FirstClassCollectionBase<ShapeError, ShapeErrors>
  implements FirstClassCollection<ShapeError>
{
  readonly #values: readonly ShapeError[];

  private constructor(values: readonly ShapeError[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-shape-errors");
  }

  protected override rebuild(values: readonly ShapeError[]): ShapeErrors {
    return new ShapeErrors(values);
  }

  override map(transform: (element: ShapeError) => ShapeError): ShapeErrors {
    return this.mapTo(transform, ShapeErrors.of);
  }

  override combine(other: ShapeErrors): ShapeErrors {
    return this.combineTo(other, ShapeErrors.of);
  }

  static parse(values: readonly ShapeError[]): Result<ShapeErrors, ParseError> {
    return parseConstruction(() => new ShapeErrors(values));
  }

  static of(values: readonly ShapeError[]): ShapeErrors {
    return new ShapeErrors(values);
  }

  add(value: ShapeError): ShapeErrors {
    return new ShapeErrors([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<ShapeError> {
    yield* this.#values;
  }

  // 形の誤りすべてを検出順のまま family の finding にする。
  recordIn(family: CheckFamily, report: ReferenceCheckReport, artifact: ArtifactPath): void {
    for (const error of this.#values) error.recordIn(family, report, artifact);
  }

  toArray(): readonly ShapeError[] {
    return this.#values;
  }
}
