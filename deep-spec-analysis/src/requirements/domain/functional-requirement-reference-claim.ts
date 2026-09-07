import type { FunctionalRequirementReferences, RequirementIdentifier } from "@deep-spec-analysis/kernel-domain";
import { combinedHash, hashOfString } from "@deep-spec-analysis/kernel-infrastructure";

// functionalRequirementReferences の主張 1 件——owner（義務／シナリオ／unformalized の id か位置）が
// 参照する FR 群。逆引き索引は主張自身に owner を積ませる（#71 波25）。
export class FunctionalRequirementReferenceClaim {
  readonly #owner: string;
  readonly #functionalRequirementReferences: FunctionalRequirementReferences;

  private constructor(owner: string, functionalRequirementReferences: FunctionalRequirementReferences) {
    this.#owner = owner;
    this.#functionalRequirementReferences = functionalRequirementReferences;
  }

  static of(
    owner: string,
    functionalRequirementReferences: FunctionalRequirementReferences,
  ): FunctionalRequirementReferenceClaim {
    return new FunctionalRequirementReferenceClaim(owner, functionalRequirementReferences);
  }

  ownerDescription(): string {
    return this.#owner;
  }

  referenceCount(): number {
    return this.#functionalRequirementReferences.count();
  }

  equals(other: FunctionalRequirementReferenceClaim): boolean {
    return (
      this.#owner === other.#owner &&
      this.#functionalRequirementReferences.equals(other.#functionalRequirementReferences)
    );
  }

  hashCode(): number {
    return combinedHash([hashOfString(this.#owner), this.#functionalRequirementReferences.hashCode()]);
  }

  // 参照する FR ごとに owner を積む（主張の宣言順）。
  claimInto(ownersByRef: Map<string, FunctionalRequirementReferenceClaim[]>): void {
    for (const ref of this.#functionalRequirementReferences) {
      const owners = ownersByRef.get(ref.asString()) ?? [];
      owners.push(this);
      ownersByRef.set(ref.asString(), owners);
    }
  }

  claimIntoKeyed(
    ownersByRef: Map<
      string,
      { readonly key: RequirementIdentifier; readonly owners: FunctionalRequirementReferenceClaim[] }
    >,
  ): void {
    for (const ref of this.#functionalRequirementReferences) {
      const existing = ownersByRef.get(ref.asString());
      if (existing === undefined) ownersByRef.set(ref.asString(), { key: ref, owners: [this] });
      else existing.owners.push(this);
    }
  }
}
