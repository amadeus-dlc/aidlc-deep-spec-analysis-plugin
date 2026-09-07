import { type ArtifactPath, FindingKind, FindingTargets, TargetIdentifier } from "@deep-spec-analysis/kernel-domain";
import { combinedHash, hashOfString } from "@deep-spec-analysis/kernel-infrastructure";
import type { CheckFamily } from "./check-family.ts";
import type { ElementPath } from "./element-path.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import { WitnessReference } from "./witness-reference.ts";

// entities.md の yaml ブロックの形の誤り 1 件——要素パスと文言。FD-E1 は
// 要素を witness に、文言を finding に載せる（#71 波26）。
export class ShapeError {
  readonly #element: ElementPath;
  readonly #detail: string;

  private constructor(element: ElementPath, detail: string) {
    this.#element = element;
    this.#detail = detail;
  }

  static of(props: { element: ElementPath; detail: string }): ShapeError {
    return new ShapeError(props.element, props.detail);
  }

  equals(other: ShapeError): boolean {
    return this.#element.equals(other.#element) && this.#detail === other.#detail;
  }

  hashCode(): number {
    return combinedHash([this.#element.hashCode(), hashOfString(this.#detail)]);
  }

  recordIn(family: CheckFamily, report: ReferenceCheckReport, artifact: ArtifactPath): void {
    report.finding(
      family,
      FindingKind.structureInvalid(),
      FindingTargets.of(TargetIdentifier.of(family.asCheckTarget()), []),
      [WitnessReference.at(artifact.asString(), this.#element.asString())],
      this.#detail,
    );
  }
}
