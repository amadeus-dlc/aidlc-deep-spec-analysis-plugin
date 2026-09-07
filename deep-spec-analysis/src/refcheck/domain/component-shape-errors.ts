import {
  type ArtifactPath,
  FindingKind,
  FindingTargets,
  type FirstClassCollection,
  FirstClassCollectionBase,
  TargetIdentifier,
} from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { CheckFamily } from "./check-family.ts";
import type { ComponentShapeError } from "./component-shape-error.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import { WitnessReference } from "./witness-reference.ts";

export class ComponentShapeErrors
  extends FirstClassCollectionBase<ComponentShapeError, ComponentShapeErrors>
  implements FirstClassCollection<ComponentShapeError>
{
  readonly #values: readonly ComponentShapeError[];

  private constructor(values: readonly ComponentShapeError[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-component-shape-errors");
  }

  protected override rebuild(values: readonly ComponentShapeError[]): ComponentShapeErrors {
    return new ComponentShapeErrors(values);
  }

  override map(transform: (element: ComponentShapeError) => ComponentShapeError): ComponentShapeErrors {
    return this.mapTo(transform, ComponentShapeErrors.of);
  }

  override combine(other: ComponentShapeErrors): ComponentShapeErrors {
    return this.combineTo(other, ComponentShapeErrors.of);
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

  override *[Symbol.iterator](): Iterator<ComponentShapeError> {
    yield* this.#values;
  }

  override count(): number {
    return this.#values.length;
  }

  // 形の誤りすべてを検出順のまま family の finding にする（DD-0）。
  recordIn(family: CheckFamily, report: ReferenceCheckReport, artifact: ArtifactPath): void {
    for (const error of this.#values)
      report.finding(
        family,
        FindingKind.structureInvalid(),
        FindingTargets.of(TargetIdentifier.of(family.asCheckTarget()), []),
        [WitnessReference.at(artifact.asString(), error.element().asString())],
        error.detail(),
      );
  }

  toArray(): readonly ComponentShapeError[] {
    return this.#values;
  }
}
