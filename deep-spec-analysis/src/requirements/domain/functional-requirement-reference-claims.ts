import type { FunctionalRequirementReferenceClaim } from "./functional-requirement-reference-claim.ts";

// 主張のファーストクラスコレクション（宣言順を保持——索引の owner 列順に効く）。
export class FunctionalRequirementReferenceClaims {
  readonly #values: readonly FunctionalRequirementReferenceClaim[];

  private constructor(values: readonly FunctionalRequirementReferenceClaim[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly FunctionalRequirementReferenceClaim[]): FunctionalRequirementReferenceClaims {
    return new FunctionalRequirementReferenceClaims(values);
  }

  add(value: FunctionalRequirementReferenceClaim): FunctionalRequirementReferenceClaims {
    return new FunctionalRequirementReferenceClaims([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<FunctionalRequirementReferenceClaim> {
    yield* this.#values;
  }

  ownerDescriptions(): string[] { return this.#values.map((claim) => claim.ownerDescription()); }

  toArray(): readonly FunctionalRequirementReferenceClaim[] {
    return this.#values;
  }
}
