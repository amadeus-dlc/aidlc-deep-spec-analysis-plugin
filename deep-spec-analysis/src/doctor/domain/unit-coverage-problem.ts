import type { UnitName } from "@deep-spec/kernel-domain";
import type { CoverageState } from "./coverage-state.ts";
import type { IntentLocation } from "./intent-location.ts";

export class UnitCoverageProblem {
  readonly #location: IntentLocation;
  readonly #unit: UnitName;
  readonly #state: CoverageState;
  private constructor(location: IntentLocation, unit: UnitName, state: CoverageState) {
    this.#location = location;
    this.#unit = unit;
    this.#state = state;
  }
  static of(location: IntentLocation, unit: UnitName, state: CoverageState): UnitCoverageProblem {
    return new UnitCoverageProblem(location, unit, state);
  }
  location(): IntentLocation {
    return this.#location;
  }
  unit(): UnitName {
    return this.#unit;
  }
  matchState<T>(handlers: { unverified: () => T; stale: () => T }): T {
    return this.#state.match(handlers);
  }
}
