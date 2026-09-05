import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec/kernel-infrastructure";
import type { StageScopes } from "./stage-scopes.ts";
import type { VerificationObservation } from "./verification-observation.ts";

// 観測した適格intentを所有し、母数と検証済み件数を同じ証拠から査定する。
export class CoverageAssessment {
  readonly #observations: readonly VerificationObservation[];
  readonly #scopes: StageScopes;
  /** doctor一回の走査予算は65,536intent。 */
  private constructor(observations: readonly VerificationObservation[], scopes: StageScopes) {
    if (observations.length > 65_536)
      throw new IllegalArgumentException({ kind: "too-many-verification-observations", raw: observations.length });
    this.#observations = Object.freeze([...observations]);
    this.#scopes = scopes;
  }
  static of(observations: readonly VerificationObservation[], scopes: StageScopes): CoverageAssessment {
    return new CoverageAssessment(observations, scopes);
  }
  static parse(
    observations: readonly VerificationObservation[],
    scopes: StageScopes,
  ): Result<CoverageAssessment, ParseError> {
    return parseConstruction(() => new CoverageAssessment(observations, scopes));
  }
  isClean(): boolean {
    return this.problems().length === 0;
  }
  verifiedCount(): number {
    return this.#observations.length - this.problems().length;
  }
  eligibleCount(): number {
    return this.#observations.length;
  }
  problems(): readonly VerificationObservation[] {
    return this.#observations.filter((observation) => observation.problemState() !== null);
  }
  scopes(): StageScopes {
    return this.#scopes;
  }
}
