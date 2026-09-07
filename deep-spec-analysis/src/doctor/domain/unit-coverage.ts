import {
  boundedCollectionSnapshot,
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { FunctionalObservation } from "./functional-observation.ts";
import type { IntentLocation } from "./intent-location.ts";
import type { StageScopes } from "./stage-scopes.ts";
import type { UnitCoverageProblem } from "./unit-coverage-problem.ts";

export class UnitCoverage {
  readonly #observations: readonly FunctionalObservation[];
  readonly #scopes: StageScopes;
  readonly #invalidProblems: readonly UnitCoverageProblem[];

  /** 走査予算は65,536intentかつ総計65,536unit。不正な単位名の診断も総計に含める。 */
  private constructor(
    observations: readonly FunctionalObservation[],
    scopes: StageScopes,
    invalidProblems: readonly UnitCoverageProblem[],
  ) {
    const snapshot = boundedCollectionSnapshot(observations, 65_536, "too-many-functional-observations");
    const invalidSnapshot = boundedCollectionSnapshot(invalidProblems, 65_536, "too-many-invalid-functional-units");
    let units = invalidSnapshot.length;
    for (const observation of snapshot) {
      units += observation.eligibleCount();
      if (units > 65_536) throw new IllegalArgumentException({ kind: "too-many-covered-units", raw: units });
    }
    this.#observations = snapshot;
    this.#scopes = scopes;
    this.#invalidProblems = invalidSnapshot;
  }

  static of(
    observations: readonly FunctionalObservation[],
    scopes: StageScopes,
    invalidProblems: readonly UnitCoverageProblem[],
  ): UnitCoverage {
    return new UnitCoverage(observations, scopes, invalidProblems);
  }

  static parse(
    observations: readonly FunctionalObservation[],
    scopes: StageScopes,
    invalidProblems: readonly UnitCoverageProblem[],
  ): Result<UnitCoverage, ParseError> {
    return parseConstruction(() => new UnitCoverage(observations, scopes, invalidProblems));
  }

  hasEligible(): boolean {
    return this.eligibleCount() > 0;
  }
  isClean(): boolean {
    return this.problems().length === 0;
  }
  verifiedCount(): number {
    return this.eligibleCount() - this.#observations.flatMap((observation) => observation.problems()).length;
  }
  eligibleCount(): number {
    return this.#observations.reduce((sum, observation) => sum + observation.eligibleCount(), 0);
  }
  problems(): readonly UnitCoverageProblem[] {
    return [...this.#invalidProblems, ...this.#observations.flatMap((observation) => observation.problems())];
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
