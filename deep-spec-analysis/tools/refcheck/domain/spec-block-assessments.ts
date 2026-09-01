import type { SpecBlockAssessment } from "./spec-block-assessment.ts";

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
}
