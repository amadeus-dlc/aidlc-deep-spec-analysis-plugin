import type {
  ArtifactPath,
  FirstClassCollection,
  IterableFirstClassCollection,
} from "@deep-spec-analysis/kernel-domain";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import type { SpecificationBlockAssessment } from "./specification-block-assessment.ts";

export class SpecificationBlockAssessments
  implements FirstClassCollection, IterableFirstClassCollection<SpecificationBlockAssessment>
{
  readonly #values: readonly SpecificationBlockAssessment[];

  private constructor(values: readonly SpecificationBlockAssessment[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly SpecificationBlockAssessment[]): SpecificationBlockAssessments {
    return new SpecificationBlockAssessments(values);
  }

  add(value: SpecificationBlockAssessment): SpecificationBlockAssessments {
    return new SpecificationBlockAssessments([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<SpecificationBlockAssessment> {
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

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
