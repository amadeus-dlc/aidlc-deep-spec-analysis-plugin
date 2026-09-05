import { KeySet, type UnitName } from "@deep-spec/kernel-domain";
import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec/kernel-infrastructure";
import type { ArtifactModifiedAt } from "./artifact-modified-at.ts";
import { CoverageState } from "./coverage-state.ts";
import type { FunctionalUnitObservation } from "./functional-unit-observation.ts";
import type { IntentLocation } from "./intent-location.ts";
import { UnitCoverageProblem } from "./unit-coverage-problem.ts";

type FunctionalObservationParam = {
  location: IntentLocation;
  units: readonly FunctionalUnitObservation[];
  modelModifiedAt: ArtifactModifiedAt | null;
  modelUnits: readonly UnitName[];
  completedUnits: readonly UnitName[];
  hasFindings: boolean;
  requirementsModelModifiedAt: ArtifactModifiedAt | null;
};

// 実backendが到達したunitだけを検証済みとし、設計変更とrefinement失効を査定する。
export class FunctionalObservation {
  readonly #location: IntentLocation;
  readonly #units: readonly FunctionalUnitObservation[];
  readonly #modelModifiedAt: ArtifactModifiedAt | null;
  readonly #modelUnits: KeySet<UnitName>;
  readonly #completedUnits: KeySet<UnitName>;
  readonly #hasFindings: boolean;
  readonly #requirementsModelModifiedAt: ArtifactModifiedAt | null;
  /** intent単位のunit台帳は各65,536件まで。走査・コピーの前に制限する。 */
  private constructor(props: FunctionalObservationParam) {
    if (props.units.length > 65_536 || props.modelUnits.length > 65_536 || props.completedUnits.length > 65_536)
      throw new IllegalArgumentException({ kind: "too-many-functional-units" });
    this.#location = props.location;
    this.#units = Object.freeze([...props.units]);
    this.#modelModifiedAt = props.modelModifiedAt;
    this.#modelUnits = KeySet.of(props.modelUnits);
    this.#completedUnits = KeySet.of(props.completedUnits);
    this.#hasFindings = props.hasFindings;
    this.#requirementsModelModifiedAt = props.requirementsModelModifiedAt;
  }
  static of(props: FunctionalObservationParam): FunctionalObservation {
    return new FunctionalObservation(props);
  }
  static parse(props: FunctionalObservationParam): Result<FunctionalObservation, ParseError> {
    return parseConstruction(() => new FunctionalObservation(props));
  }
  location(): IntentLocation {
    return this.#location;
  }
  eligibleCount(): number {
    return this.#units.length;
  }
  problems(): readonly UnitCoverageProblem[] {
    const out: UnitCoverageProblem[] = [];
    for (const unit of this.#units) {
      if (
        this.#modelModifiedAt === null ||
        !this.#modelUnits.has(unit.name()) ||
        !this.#hasFindings ||
        !this.#completedUnits.has(unit.name())
      ) {
        out.push(UnitCoverageProblem.of(this.#location, unit.name(), CoverageState.unverified()));
      } else if (unit.changedAfter(this.#modelModifiedAt)) {
        out.push(UnitCoverageProblem.of(this.#location, unit.name(), CoverageState.stale()));
      }
    }
    return out;
  }
  refinementIsStale(): boolean {
    return (
      this.#modelModifiedAt !== null &&
      this.#hasFindings &&
      (this.#requirementsModelModifiedAt?.isAfter(this.#modelModifiedAt) ?? false)
    );
  }
}
