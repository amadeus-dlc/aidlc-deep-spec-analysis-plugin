import type { AttributePath } from "@deep-spec-analysis/kernel-domain";
import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { AttributePaths } from "./attribute-paths.ts";
import { RefinementStatus } from "./refinement-status.ts";

type AttributeCoverageParam = {
  required: AttributePaths;
  mapped: AttributePaths;
  waived: AttributePaths;
  missing: AttributePaths;
};
export class AttributeCoverage {
  readonly #required: AttributePaths;
  readonly #mapped: AttributePaths;
  readonly #waived: AttributePaths;
  readonly #missing: AttributePaths;
  private constructor(props: AttributeCoverageParam) {
    const required = [...props.required];
    for (const path of required) {
      const occurrences = [props.mapped, props.waived, props.missing].filter((part) => part.has(path)).length;
      if (occurrences !== 1) throw new IllegalArgumentException({ kind: "invalid-attribute-coverage-partition" });
    }
    for (const part of [props.mapped, props.waived, props.missing])
      for (const path of part)
        if (!props.required.has(path))
          throw new IllegalArgumentException({ kind: "attribute-coverage-outside-subject" });
    this.#required = props.required;
    this.#mapped = props.mapped;
    this.#waived = props.waived;
    this.#missing = props.missing;
  }
  static of(props: AttributeCoverageParam): AttributeCoverage {
    return new AttributeCoverage(props);
  }
  static parse(props: AttributeCoverageParam): Result<AttributeCoverage, ParseError> {
    return parseConstruction(() => new AttributeCoverage(props));
  }
  #names(compare: (a: AttributePath, b: AttributePath) => number): string {
    return [...this.#waived, ...this.#missing]
      .sort(compare)
      .map((path) => path.asString())
      .join(", ");
  }
  #status(waived: string, gap: string): RefinementStatus {
    if ([...this.#required].every((path) => this.#mapped.has(path))) return RefinementStatus.checkable();
    return [...this.#missing].length === 0 ? RefinementStatus.waived(waived) : RefinementStatus.gap(gap);
  }
  forInvariant(): RefinementStatus {
    const names = this.#names((a, b) => (a.asString() < b.asString() ? -1 : a.asString() > b.asString() ? 1 : 0));
    return this.#status(
      `depends on unmapped attribute(s) ${names}`,
      `depends on attribute(s) ${names} that are neither mapped nor in unmapped[]`,
    );
  }
  forEvent(): RefinementStatus {
    const names = this.#names((a, b) => a.compareTo(b));
    return this.#status(
      `depends on unmapped attribute(s) ${names}`,
      `depends on attribute(s) ${names} that are neither mapped nor in unmapped[]`,
    );
  }
  forScenario(): RefinementStatus {
    const names = this.#names((a, b) => (a.asString() < b.asString() ? -1 : a.asString() > b.asString() ? 1 : 0));
    return this.#status(
      `binds unmapped attribute(s) ${names}`,
      `binds attribute(s) ${names} that are neither mapped nor in unmapped[]`,
    );
  }
}
