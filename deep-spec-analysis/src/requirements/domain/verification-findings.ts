import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { VerificationFinding } from "./verification-finding.ts";

// 診断の正準順とconflictの重複排除はコレクションが所有する。
function sortVerificationFindings(findings: readonly VerificationFinding[]): VerificationFinding[] {
  return [...findings].sort((a, b) => a.compareTo(b));
}

export class VerificationFindings
  extends FirstClassCollectionBase<VerificationFinding, VerificationFindings>
  implements FirstClassCollection<VerificationFinding>
{
  readonly #values: readonly VerificationFinding[];

  private constructor(values: readonly VerificationFinding[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-verification-findings");
  }

  protected rebuild(values: readonly VerificationFinding[]): VerificationFindings {
    return new VerificationFindings(values);
  }

  static parse(values: readonly VerificationFinding[]): Result<VerificationFindings, ParseError> {
    return parseConstruction(() => new VerificationFindings(values));
  }

  static of(values: readonly VerificationFinding[]): VerificationFindings {
    return new VerificationFindings(values);
  }

  add(value: VerificationFinding): VerificationFindings {
    return new VerificationFindings([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<VerificationFinding> {
    yield* this.#values;
  }

  sortedCanonically(): VerificationFindings {
    return new VerificationFindings(sortVerificationFindings(this.#values));
  }

  count(): number {
    return this.#values.length;
  }

  distinctConflicts(): VerificationFindings {
    const seen = new Set<string>();
    return new VerificationFindings(
      this.#values.filter((finding) => {
        if (!finding.isConflict()) return true;
        const key = finding.targets().joined(",");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    );
  }

  toArray(): readonly VerificationFinding[] {
    return this.#values;
  }
}
