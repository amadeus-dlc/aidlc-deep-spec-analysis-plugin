import type { ErrorMessage } from "@deep-spec-analysis/kernel-domain";
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

type UnitCoverageState =
  | {
      readonly kind: "ready";
      readonly observations: readonly FunctionalObservation[];
      readonly scopes: StageScopes;
      readonly invalidProblems: readonly UnitCoverageProblem[];
    }
  | { readonly kind: "unavailable"; readonly scopes: StageScopes; readonly reason: ErrorMessage };

export class UnitCoverage {
  readonly #state: UnitCoverageState;

  /** doctor一回の走査予算は65,536intentかつ総計65,536unit。invalid unit診断も総計へ含め、多段集合で予算を乗算させない。 */
  private constructor(state: UnitCoverageState) {
    if (state.kind === "unavailable") {
      this.#state = state;
      return;
    }
    const snapshot = boundedCollectionSnapshot(state.observations, 65_536, "too-many-functional-observations");
    const invalidSnapshot = boundedCollectionSnapshot(
      state.invalidProblems,
      65_536,
      "too-many-invalid-functional-units",
    );
    let units = invalidSnapshot.length;
    for (const observation of snapshot) {
      units += observation.eligibleCount();
      if (units > 65_536) throw new IllegalArgumentException({ kind: "too-many-covered-units", raw: units });
    }
    this.#state = { kind: "ready", observations: snapshot, scopes: state.scopes, invalidProblems: invalidSnapshot };
  }

  static of(
    observations: readonly FunctionalObservation[],
    scopes: StageScopes,
    invalidProblems: readonly UnitCoverageProblem[],
  ): UnitCoverage {
    return new UnitCoverage({ kind: "ready", observations, scopes, invalidProblems });
  }

  static unavailable(scopes: StageScopes, reason: ErrorMessage): UnitCoverage {
    return new UnitCoverage({ kind: "unavailable", scopes, reason });
  }

  static parse(
    observations: readonly FunctionalObservation[],
    scopes: StageScopes,
    invalidProblems: readonly UnitCoverageProblem[],
  ): Result<UnitCoverage, ParseError> {
    return parseConstruction(() => new UnitCoverage({ kind: "ready", observations, scopes, invalidProblems }));
  }

  hasEligible(): boolean {
    return this.#state.kind === "ready" && this.eligibleCount() > 0;
  }

  isClean(): boolean {
    return this.#state.kind === "ready" && this.problems().length === 0;
  }

  verifiedCount(): number {
    return this.#state.kind === "ready"
      ? this.eligibleCount() - this.#state.observations.flatMap((observation) => observation.problems()).length
      : 0;
  }

  eligibleCount(): number {
    return this.#state.kind === "ready"
      ? this.#state.observations.reduce((sum, observation) => sum + observation.eligibleCount(), 0)
      : 0;
  }

  problems(): readonly UnitCoverageProblem[] {
    return this.#state.kind === "ready"
      ? [...this.#state.invalidProblems, ...this.#state.observations.flatMap((observation) => observation.problems())]
      : [];
  }

  refinementStale(): readonly IntentLocation[] {
    return this.#state.kind === "ready"
      ? this.#state.observations
          .filter((observation) => observation.refinementIsStale())
          .map((observation) => observation.location())
      : [];
  }

  scopes(): StageScopes {
    return this.#state.scopes;
  }

  unavailableReason(): ErrorMessage | null {
    return this.#state.kind === "unavailable" ? this.#state.reason : null;
  }
}
