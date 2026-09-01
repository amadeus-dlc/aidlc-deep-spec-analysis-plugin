import type { FrRefClaim } from "./fr-ref-claim.ts";

// 主張のファーストクラスコレクション（宣言順を保持——索引の owner 列順に効く）。
export class FrRefClaims {
  readonly #values: readonly FrRefClaim[];

  private constructor(values: readonly FrRefClaim[]) {
    this.#values = values;
  }

  static of(values: readonly FrRefClaim[]): FrRefClaims {
    return new FrRefClaims([...values]);
  }

  add(value: FrRefClaim): FrRefClaims {
    return new FrRefClaims([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<FrRefClaim> {
    yield* this.#values;
  }

  toArray(): readonly FrRefClaim[] {
    return this.#values;
  }
}
