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
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import type { SpecificationBlockAssessment } from "./specification-block-assessment.ts";

export class SpecificationBlockAssessments
  extends FirstClassCollectionBase<SpecificationBlockAssessment, SpecificationBlockAssessments>
  implements FirstClassCollection<SpecificationBlockAssessment>
{
  readonly #values: readonly SpecificationBlockAssessment[];

  private constructor(values: readonly SpecificationBlockAssessment[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-specification-block-assessments");
  }

  protected override rebuild(values: readonly SpecificationBlockAssessment[]): SpecificationBlockAssessments {
    return new SpecificationBlockAssessments(values);
  }

  static parse(values: readonly SpecificationBlockAssessment[]): Result<SpecificationBlockAssessments, ParseError> {
    return parseConstruction(() => new SpecificationBlockAssessments(values));
  }

  static of(values: readonly SpecificationBlockAssessment[]): SpecificationBlockAssessments {
    return new SpecificationBlockAssessments(values);
  }

  add(value: SpecificationBlockAssessment): SpecificationBlockAssessments {
    return new SpecificationBlockAssessments([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<SpecificationBlockAssessment> {
    yield* this.#values;
  }

  toArray(): readonly SpecificationBlockAssessment[] {
    return this.#values;
  }

  // CD-2: 各ブロックに自分の健全性を判定させる（発生順はブロック順、凍結）。
  check(report: ReferenceCheckReport, artifact: ArtifactPath): void {
    for (const block of this) {
      block.check(report, artifact);
    }
  }
}
