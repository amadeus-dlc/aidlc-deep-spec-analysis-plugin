import type { ContentHash, ErrorMessage, SkipReason, UnitName } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";

type VerificationEvidenceParam = {
  irHash: ContentHash;
  unavailable: ErrorMessage | null;
  skippedReasons: readonly SkipReason[];
  checkedUnits: readonly UnitName[];
};

const INCOMPLETE_SKIP_REASONS = new Set([
  "timeout",
  "unavailable",
  "compile-error",
  "ir-version-mismatch",
  "unrecognized-format",
]);

export class VerificationEvidence {
  readonly #irHash: ContentHash;
  readonly #unavailable: ErrorMessage | null;
  readonly #skippedReasons: readonly SkipReason[];
  readonly #checkedUnits: readonly UnitName[];

  private constructor(props: VerificationEvidenceParam) {
    this.#irHash = props.irHash;
    this.#unavailable = props.unavailable;
    this.#skippedReasons = boundedCollectionSnapshot(props.skippedReasons, 65_536, "too-many-skip-reasons");
    this.#checkedUnits = boundedCollectionSnapshot(props.checkedUnits, 65_536, "too-many-checked-units");
  }

  static of(props: VerificationEvidenceParam): VerificationEvidence {
    return new VerificationEvidence(props);
  }

  static parse(props: VerificationEvidenceParam): Result<VerificationEvidence, ParseError> {
    return parseConstruction(() => new VerificationEvidence(props));
  }

  countsFor(hash: ContentHash): boolean {
    return (
      this.#irHash.equals(hash) &&
      this.#unavailable === null &&
      this.#skippedReasons.every((reason) => !INCOMPLETE_SKIP_REASONS.has(reason.asString()))
    );
  }

  completedUnitsFor(hash: ContentHash): readonly UnitName[] {
    return this.countsFor(hash) ? [...this.#checkedUnits] : [];
  }

  equals(other: VerificationEvidence): boolean {
    return (
      this.#irHash.equals(other.#irHash) &&
      (this.#unavailable === null
        ? other.#unavailable === null
        : other.#unavailable !== null && this.#unavailable.equals(other.#unavailable)) &&
      this.#skippedReasons.length === other.#skippedReasons.length &&
      this.#skippedReasons.every((reason, index) => reason.asString() === other.#skippedReasons[index]?.asString()) &&
      this.#checkedUnits.length === other.#checkedUnits.length &&
      this.#checkedUnits.every((unit, index) => {
        const otherUnit = other.#checkedUnits[index];
        return otherUnit !== undefined && unit.equals(otherUnit);
      })
    );
  }
}
