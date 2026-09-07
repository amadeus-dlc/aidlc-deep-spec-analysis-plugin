import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { StructuralObservation } from "./structural-observation.ts";

// 診断観測から母数と負債を算定する。取得不能は未走査として保持する。
export class StructuralDebt extends FirstClassCollectionBase<StructuralObservation, StructuralDebt> {
  readonly #observations: readonly StructuralObservation[];
  /** doctor一回の走査予算は65,536成果物。 */
  private constructor(observations: readonly StructuralObservation[]) {
    super();
    this.#observations = boundedCollectionSnapshot(observations, 65_536, "too-many-structural-observations");
  }

  protected rebuild(values: readonly StructuralObservation[]): StructuralDebt {
    return new StructuralDebt(values);
  }

  *[Symbol.iterator](): Iterator<StructuralObservation> {
    yield* this.#observations;
  }
  static of(observations: readonly StructuralObservation[]): StructuralDebt {
    return new StructuralDebt(observations);
  }
  static parse(observations: readonly StructuralObservation[]): Result<StructuralDebt, ParseError> {
    return parseConstruction(() => new StructuralDebt(observations));
  }
  hasScans(): boolean {
    return this.#observations.some((observation) => observation.wasScanned());
  }

  isComplete(): boolean {
    return this.#observations.every((observation) => observation.isComplete());
  }
  scannedCount(): number {
    return this.#observations.filter((observation) => observation.wasScanned()).length;
  }
  totalFindings(): number {
    return this.#observations.reduce(
      (sum, observation) =>
        sum +
        observation.match({
          complete: (findings) => findings.asNumber(),
          partial: (findings) => findings.asNumber(),
          unavailable: () => 0,
        }),
      0,
    );
  }
  rows(): readonly StructuralObservation[] {
    return this.#observations.filter((observation) => !observation.isComplete() || observation.hasDebt());
  }
}
