// FrReferenceIndex — 義務・シナリオが指す要件 id → 指した側の id 列の索引
//（逆引き検証の材料）。キーは RequirementId、値は TargetIds、内側は KeyedIndex
//（裁定 3-1、2026-09-03）。claim の集約は構築の門で行い、索引は不変。

import { KeyedIndex, RequirementId, type RequirementIds, TargetIds } from "@deep-spec/kernel-domain";
import type { FrRefClaim } from "./fr-ref-claim.ts";

export class FrReferenceIndex {
  readonly #ownersByRef: KeyedIndex<RequirementId, TargetIds>;

  private constructor(ownersByRef: KeyedIndex<RequirementId, TargetIds>) {
    this.#ownersByRef = ownersByRef;
  }

  static of(claims: readonly FrRefClaim[]): FrReferenceIndex {
    const ownersByRef = new Map<string, string[]>();
    for (const claim of claims) claim.claimInto(ownersByRef);
    return new FrReferenceIndex(KeyedIndex.of([...ownersByRef].map(([ref, owners]) => [RequirementId.reconstitute(ref), TargetIds.reconstitute(owners)] as const)));
  }

  // 境界: 参照された要件 id（描画順は索引の挿入順）。
  referencedIds(): string[] {
    return [...this.#ownersByRef.keys()].map((ref) => ref.asString());
  }

  // requirements.md に存在しない参照の凍結文言（id 昇順、所有者昇順）。
  missingErrors(known: RequirementIds): string[] {
    const missing = [...this.#ownersByRef.keys()].filter((ref) => !known.has(ref)).map((ref) => ref.asString()).sort();
    return missing.map((id) => {
      const owners = [...(this.#ownersByRef.get(RequirementId.reconstitute(id))?.toStrings() ?? [])].sort().join(", ");
      return `frRef "${id}" (used by ${owners}) does not exist in requirements.md`;
    });
  }
}
