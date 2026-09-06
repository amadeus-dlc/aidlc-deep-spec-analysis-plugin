import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import { FunctionalRequirementReferenceClaims } from "./functional-requirement-reference-claims.ts";
// FunctionalRequirementReferenceIndex — 義務・シナリオが指す要件 id → 指した側の id 列の索引
//（逆引き検証の材料）。キーは RequirementIdentifier、値は FunctionalRequirementReferenceClaims、内側は KeyedIndex
//（裁定 3-1、2026-09-03）。claim の集約は構築の門で行い、索引は不変。

import { KeyedIndex, type RequirementIdentifier, type RequirementIdentifiers } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { FunctionalRequirementReferenceClaim } from "./functional-requirement-reference-claim.ts";

export class FunctionalRequirementReferenceIndex
  extends FirstClassCollectionBase<FunctionalRequirementReferenceClaim, FunctionalRequirementReferenceIndex>
  implements FirstClassCollection<FunctionalRequirementReferenceClaim>
{
  readonly #claims: readonly FunctionalRequirementReferenceClaim[];
  readonly #ownersByRef: KeyedIndex<RequirementIdentifier, FunctionalRequirementReferenceClaims>;

  private constructor(claims: readonly FunctionalRequirementReferenceClaim[]) {
    super();
    this.#claims = boundedCollectionSnapshot(claims, 65_536, "too-many-functional-requirement-reference-claims");
    const ownersByRef = new Map<
      string,
      { readonly key: RequirementIdentifier; readonly owners: FunctionalRequirementReferenceClaim[] }
    >();
    for (const claim of this.#claims) claim.claimIntoKeyed(ownersByRef);
    this.#ownersByRef = KeyedIndex.of(
      [...ownersByRef.values()].map(
        ({ key, owners }) => [key, FunctionalRequirementReferenceClaims.of(owners)] as const,
      ),
    );
  }

  static of(claims: readonly FunctionalRequirementReferenceClaim[]): FunctionalRequirementReferenceIndex {
    return new FunctionalRequirementReferenceIndex(claims);
  }

  static parse(
    claims: readonly FunctionalRequirementReferenceClaim[],
  ): Result<FunctionalRequirementReferenceIndex, ParseError> {
    return parseConstruction(() => new FunctionalRequirementReferenceIndex(claims));
  }

  protected rebuild(values: readonly FunctionalRequirementReferenceClaim[]): FunctionalRequirementReferenceIndex {
    return new FunctionalRequirementReferenceIndex(values);
  }

  *[Symbol.iterator](): Iterator<FunctionalRequirementReferenceClaim> {
    yield* this.#claims;
  }

  toArray(): readonly FunctionalRequirementReferenceClaim[] {
    return this.#claims;
  }

  // 境界: 参照された要件 id（描画順は索引の挿入順）。
  referencedIds(): string[] {
    return [...this.#ownersByRef.keys()].map((ref) => ref.asString());
  }

  // requirements.md に存在しない参照の凍結文言（id 昇順、所有者昇順）。
  missingErrors(known: RequirementIdentifiers): string[] {
    const missing = [...this.#ownersByRef.keys()]
      .filter((ref) => !known.has(ref))
      .map((ref) => ref.asString())
      .sort();
    return missing.map((id) => {
      const owners = [...([...this.#ownersByRef].find(([ref]) => ref.asString() === id)?.[1].ownerDescriptions() ?? [])]
        .sort()
        .join(", ");
      return `frRef "${id}" (used by ${owners}) does not exist in requirements.md`;
    });
  }
}
