import type { ErrorMessage, UnitName } from "@deep-spec-analysis/kernel-domain";
import type { CoverageState } from "./coverage-state.ts";
import type { IntentLocation } from "./intent-location.ts";

type UnitCoverageProblemState =
  | { readonly kind: "valid"; readonly unit: UnitName; readonly coverage: CoverageState }
  | { readonly kind: "invalid"; readonly detail: ErrorMessage };

export class UnitCoverageProblem {
  readonly #location: IntentLocation;
  readonly #state: UnitCoverageProblemState;
  private constructor(location: IntentLocation, state: UnitCoverageProblemState) {
    this.#location = location;
    this.#state = state;
  }
  static of(location: IntentLocation, unit: UnitName, state: CoverageState): UnitCoverageProblem {
    return new UnitCoverageProblem(location, { kind: "valid", unit, coverage: state });
  }
  static invalid(location: IntentLocation, detail: ErrorMessage): UnitCoverageProblem {
    return new UnitCoverageProblem(location, { kind: "invalid", detail });
  }
  location(): IntentLocation {
    return this.#location;
  }
  match<T>(handlers: { valid: (unit: UnitName, state: CoverageState) => T; invalid: (detail: ErrorMessage) => T }): T {
    return this.#state.kind === "valid"
      ? handlers.valid(this.#state.unit, this.#state.coverage)
      : handlers.invalid(this.#state.detail);
  }
}
