import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { FunctionalRequirementReferenceClaim } from "./functional-requirement-reference-claim.ts";

// 主張のファーストクラスコレクション（宣言順を保持——索引の owner 列順に効く）。
export class FunctionalRequirementReferenceClaims
  extends FirstClassCollectionBase<FunctionalRequirementReferenceClaim, FunctionalRequirementReferenceClaims>
  implements FirstClassCollection<FunctionalRequirementReferenceClaim>
{
  readonly #values: readonly FunctionalRequirementReferenceClaim[];

  private constructor(values: readonly FunctionalRequirementReferenceClaim[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-functional-requirement-reference-claims");
  }

  protected rebuild(values: readonly FunctionalRequirementReferenceClaim[]): FunctionalRequirementReferenceClaims {
    return new FunctionalRequirementReferenceClaims(values);
  }

  static of(values: readonly FunctionalRequirementReferenceClaim[]): FunctionalRequirementReferenceClaims {
    return new FunctionalRequirementReferenceClaims(values);
  }

  static parse(
    values: readonly FunctionalRequirementReferenceClaim[],
  ): Result<FunctionalRequirementReferenceClaims, ParseError> {
    return parseConstruction(() => new FunctionalRequirementReferenceClaims(values));
  }

  add(value: FunctionalRequirementReferenceClaim): FunctionalRequirementReferenceClaims {
    return new FunctionalRequirementReferenceClaims([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<FunctionalRequirementReferenceClaim> {
    yield* this.#values;
  }

  ownerDescriptions(): string[] {
    return this.#values.map((claim) => claim.ownerDescription());
  }

  toArray(): readonly FunctionalRequirementReferenceClaim[] {
    return this.#values;
  }
}
