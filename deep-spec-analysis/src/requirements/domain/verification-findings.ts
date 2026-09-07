import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type Json,
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

  protected override rebuild(values: readonly VerificationFinding[]): VerificationFindings {
    return new VerificationFindings(values);
  }

  override map(transform: (element: VerificationFinding) => VerificationFinding): VerificationFindings {
    return this.mapTo(transform, VerificationFindings.of);
  }

  override combine(other: VerificationFindings): VerificationFindings {
    return this.combineTo(other, VerificationFindings.of);
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

  override *[Symbol.iterator](): Iterator<VerificationFinding> {
    yield* this.#values;
  }

  sortedCanonically(): VerificationFindings {
    return new VerificationFindings(sortVerificationFindings(this.#values));
  }

  override count(): number {
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

  // 境界: 描画専用。契約2 の finding キー順（kind, frRefs, targets, witness,
  // detail）は旧構築サイトの挿入順そのもの（golden バイト凍結）。witness
  // ユニオンの内側は素通し値（材料）で逐語描画する。
  toDocuments(): Json[] {
    return this.#values.map((finding) => {
      const out: { [k: string]: Json } = {
        kind: finding.kind(),
        frRefs: finding.functionalRequirementReferences().toStrings() as unknown as Json,
        targets: finding.targets().toStrings() as unknown as Json,
        witness: finding.witness().toDocument() as unknown as Json,
        detail: finding.detail(),
      };
      return out as Json;
    });
  }

  toArray(): readonly VerificationFinding[] {
    return this.#values;
  }
}
