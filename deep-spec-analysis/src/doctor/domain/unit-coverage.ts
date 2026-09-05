import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec/kernel-infrastructure";
import type { FunctionalObservation } from "./functional-observation.ts";
import type { IntentLocation } from "./intent-location.ts";
import type { StageScopes } from "./stage-scopes.ts";
import type { UnitCoverageProblem } from "./unit-coverage-problem.ts";

export class UnitCoverage {
  readonly #observations: readonly FunctionalObservation[];
  readonly #scopes: StageScopes;
  /** doctor一回の走査予算は65,536intentかつ総計65,536unit。多段集合で予算を乗算させない。 */
  private constructor(observations: readonly FunctionalObservation[], scopes: StageScopes) {
    if (observations.length > 65_536)
      throw new IllegalArgumentException({ kind: "too-many-functional-observations", raw: observations.length });
    let units = 0;
    for (const observation of observations) {
      units += observation.eligibleCount();
      if (units > 65_536) throw new IllegalArgumentException({ kind: "too-many-covered-units", raw: units });
    }
    this.#observations = Object.freeze([...observations]);
    this.#scopes = scopes;
  }
  static of(observations: readonly FunctionalObservation[], scopes: StageScopes): UnitCoverage {
    return new UnitCoverage(observations, scopes);
  }
  static parse(observations: readonly FunctionalObservation[], scopes: StageScopes): Result<UnitCoverage, ParseError> {
    return parseConstruction(() => new UnitCoverage(observations, scopes));
  }
  hasEligible(): boolean {
    return this.eligibleCount() > 0;
  }
  isClean(): boolean {
    return this.problems().length === 0;
  }
  verifiedCount(): number {
    return this.eligibleCount() - this.problems().length;
  }
  eligibleCount(): number {
    return this.#observations.reduce((sum, observation) => sum + observation.eligibleCount(), 0);
  }
  problems(): readonly UnitCoverageProblem[] {
    return this.#observations.flatMap((observation) => observation.problems());
  }
  refinementStale(): readonly IntentLocation[] {
    return this.#observations
      .filter((observation) => observation.refinementIsStale())
      .map((observation) => observation.location());
  }
  scopes(): StageScopes {
    return this.#scopes;
  }
}
