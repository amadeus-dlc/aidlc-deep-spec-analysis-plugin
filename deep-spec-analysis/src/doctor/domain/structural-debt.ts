import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec/kernel-infrastructure";
import type { StructuralObservation } from "./structural-observation.ts";

// 診断観測から母数と負債を算定する。取得不能は未走査として保持する。
export class StructuralDebt {
  readonly #observations: readonly StructuralObservation[];
  /** doctor一回の走査予算は65,536成果物。 */
  private constructor(observations: readonly StructuralObservation[]) {
    if (observations.length > 65_536)
      throw new IllegalArgumentException({ kind: "too-many-structural-observations", raw: observations.length });
    this.#observations = Object.freeze([...observations]);
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
  scannedCount(): number {
    return this.#observations.filter((observation) => observation.wasScanned()).length;
  }
  totalFindings(): number {
    return this.#observations.reduce((sum, observation) => sum + observation.findingCount(), 0);
  }
  rows(): readonly StructuralObservation[] {
    return this.#observations.filter((observation) => observation.hasDebt());
  }
}
