import { FunctionalRequirementReferenceClaims } from "./functional-requirement-reference-claims.ts";
// FunctionalRequirementReferenceIndex — 義務・シナリオが指す要件 id → 指した側の id 列の索引
//（逆引き検証の材料）。キーは RequirementIdentifier、値は FunctionalRequirementReferenceClaims、内側は KeyedIndex
//（裁定 3-1、2026-09-03）。claim の集約は構築の門で行い、索引は不変。

import { KeyedIndex, RequirementIdentifier, type RequirementIdentifiers } from "@deep-spec/kernel-domain";
import type { FunctionalRequirementReferenceClaim } from "./functional-requirement-reference-claim.ts";

export class FunctionalRequirementReferenceIndex {
  readonly #ownersByRef: KeyedIndex<RequirementIdentifier, FunctionalRequirementReferenceClaims>;

  private constructor(ownersByRef: KeyedIndex<RequirementIdentifier, FunctionalRequirementReferenceClaims>) {
    this.#ownersByRef = ownersByRef;
  }

  static of(claims: readonly FunctionalRequirementReferenceClaim[]): FunctionalRequirementReferenceIndex {
    const ownersByRef = new Map<string, FunctionalRequirementReferenceClaim[]>();
    for (const claim of claims) claim.claimInto(ownersByRef);
    return new FunctionalRequirementReferenceIndex(KeyedIndex.of([...ownersByRef].map(([ref, owners]) => [RequirementIdentifier.of(ref), FunctionalRequirementReferenceClaims.of(owners)] as const)));
  }

  // 境界: 参照された要件 id（描画順は索引の挿入順）。
  referencedIds(): string[] {
    return [...this.#ownersByRef.keys()].map((ref) => ref.asString());
  }

  // requirements.md に存在しない参照の凍結文言（id 昇順、所有者昇順）。
  missingErrors(known: RequirementIdentifiers): string[] {
    const missing = [...this.#ownersByRef.keys()].filter((ref) => !known.has(ref)).map((ref) => ref.asString()).sort();
    return missing.map((id) => {
      const owners = [...(this.#ownersByRef.get(RequirementIdentifier.of(id))?.ownerDescriptions() ?? [])].sort().join(", ");
      return `frRef "${id}" (used by ${owners}) does not exist in requirements.md`;
    });
  }
}
