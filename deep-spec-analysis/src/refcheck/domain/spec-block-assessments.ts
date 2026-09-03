import type { SpecBlockAssessment } from "./spec-block-assessment.ts";
import type { ArtifactPath } from "@deep-spec/kernel-domain";
import type { ReferenceCheckReport } from "./reference-check-report.ts";

export class SpecBlockAssessments {
  readonly #values: readonly SpecBlockAssessment[];

  private constructor(values: readonly SpecBlockAssessment[]) {
    this.#values = values;
  }

  static of(values: readonly SpecBlockAssessment[]): SpecBlockAssessments {
    return new SpecBlockAssessments([...values]);
  }

  add(value: SpecBlockAssessment): SpecBlockAssessments {
    return new SpecBlockAssessments([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<SpecBlockAssessment> {
    yield* this.#values;
  }

  toArray(): readonly SpecBlockAssessment[] {
    return this.#values;
  }


  // CD-2: 各ブロックに自分の健全性を判定させる（発生順はブロック順、凍結）。
  check(report: ReferenceCheckReport, artifact: ArtifactPath): void {
    for (const block of this) {
      block.check(report, artifact);
    }
  }
}
