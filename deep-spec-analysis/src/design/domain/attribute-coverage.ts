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
    const parts = [props.mapped, props.waived, props.missing];
    const partitions = (path: AttributePath): number => parts.filter((part) => part.has(path)).length;
    if (props.required.exists((path) => partitions(path) !== 1))
      throw new IllegalArgumentException({ kind: "invalid-attribute-coverage-partition" });
    for (const part of parts)
      if (part.exists((path) => !props.required.has(path)))
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
  // 診断文言が並べる対象は waived と missing の和（構築契約により互いに素）。
  #unmapped(): AttributePaths {
    return this.#waived.combine(this.#missing);
  }
  #status(waived: string, gap: string): RefinementStatus {
    if (!this.#required.exists((path) => !this.#mapped.has(path))) return RefinementStatus.checkable();
    return this.#missing.isEmpty() ? RefinementStatus.waived(waived) : RefinementStatus.gap(gap);
  }
  forInvariant(): RefinementStatus {
    const names = this.#unmapped().sortedLexicographically().joined(", ");
    return this.#status(
      `depends on unmapped attribute(s) ${names}`,
      `depends on attribute(s) ${names} that are neither mapped nor in unmapped[]`,
    );
  }
  forEvent(): RefinementStatus {
    const names = this.#unmapped().sortedCanonically().joined(", ");
    return this.#status(
      `depends on unmapped attribute(s) ${names}`,
      `depends on attribute(s) ${names} that are neither mapped nor in unmapped[]`,
    );
  }
  forScenario(): RefinementStatus {
    const names = this.#unmapped().sortedLexicographically().joined(", ");
    return this.#status(
      `binds unmapped attribute(s) ${names}`,
      `binds attribute(s) ${names} that are neither mapped nor in unmapped[]`,
    );
  }
}
