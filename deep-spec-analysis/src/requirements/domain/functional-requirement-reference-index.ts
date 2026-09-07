import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import { FunctionalRequirementReferenceClaims } from "./functional-requirement-reference-claims.ts";
// FunctionalRequirementReferenceIndex — 義務・シナリオが指す要件 id → 指した側の id 列の索引
//（逆引き検証の材料）。キーは RequirementIdentifier、値は FunctionalRequirementReferenceClaims、内側は KeyedIndex
//（裁定 3-1、2026-09-03）。claim の集約は構築の門で行い、索引は不変。

import { KeyedIndex, type RequirementIdentifier, type RequirementIdentifiers } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { FunctionalRequirementReferenceClaim } from "./functional-requirement-reference-claim.ts";

// 索引化前の参照展開（重複を除く前）も、単一コレクションと同じ65,536件の
// 処理予算で制限する。claim数だけを制限すると、1 claimあたり10,000件の
// FunctionalRequirementReferencesによって、逆引きの走査・所有者列の予算が乗算される。
const MAX_REFERENCE_EXPANSIONS = 65_536;

export class FunctionalRequirementReferenceIndex
  extends FirstClassCollectionBase<FunctionalRequirementReferenceClaim, FunctionalRequirementReferenceIndex>
  implements FirstClassCollection<FunctionalRequirementReferenceClaim>
{
  readonly #claims: readonly FunctionalRequirementReferenceClaim[];
  readonly #ownersByRef: KeyedIndex<RequirementIdentifier, FunctionalRequirementReferenceClaims>;

  private constructor(claims: readonly FunctionalRequirementReferenceClaim[]) {
    super();
    this.#claims = boundedCollectionSnapshot(claims, 65_536, "too-many-functional-requirement-reference-claims");
    let referenceExpansions = 0;
    for (const claim of this.#claims) {
      referenceExpansions += claim.referenceCount();
      if (referenceExpansions > MAX_REFERENCE_EXPANSIONS)
        throw new IllegalArgumentException({
          kind: "too-many-functional-requirement-reference-index-entries",
          raw: referenceExpansions,
        });
    }
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

  override map(
    transform: (element: FunctionalRequirementReferenceClaim) => FunctionalRequirementReferenceClaim,
  ): FunctionalRequirementReferenceIndex {
    return this.mapTo(transform, FunctionalRequirementReferenceIndex.of);
  }

  override combine(other: FunctionalRequirementReferenceIndex): FunctionalRequirementReferenceIndex {
    return this.combineTo(other, FunctionalRequirementReferenceIndex.of);
  }

  static parse(
    claims: readonly FunctionalRequirementReferenceClaim[],
  ): Result<FunctionalRequirementReferenceIndex, ParseError> {
    return parseConstruction(() => new FunctionalRequirementReferenceIndex(claims));
  }

  // 主張のコレクションから宣言順のまま索引を組む口。
  static parseClaims(
    claims: FunctionalRequirementReferenceClaims,
  ): Result<FunctionalRequirementReferenceIndex, ParseError> {
    return parseConstruction(() => new FunctionalRequirementReferenceIndex([...claims]));
  }

  protected override rebuild(
    values: readonly FunctionalRequirementReferenceClaim[],
  ): FunctionalRequirementReferenceIndex {
    return new FunctionalRequirementReferenceIndex(values);
  }

  override *[Symbol.iterator](): Iterator<FunctionalRequirementReferenceClaim> {
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
