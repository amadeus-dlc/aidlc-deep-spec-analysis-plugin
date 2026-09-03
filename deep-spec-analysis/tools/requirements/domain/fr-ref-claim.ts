import type { FrRefs } from "../../kernel/domain/index.ts";

// frRefs の主張 1 件——owner（義務／シナリオ／unformalized の id か位置）が
// 参照する FR 群。逆引き索引は主張自身に owner を積ませる（#71 波25）。
export class FrRefClaim {
  readonly #owner: string;
  readonly #frRefs: FrRefs;

  private constructor(owner: string, frRefs: FrRefs) {
    this.#owner = owner;
    this.#frRefs = frRefs;
  }

  static of(owner: string, frRefs: FrRefs): FrRefClaim {
    return new FrRefClaim(owner, frRefs);
  }

  // 参照する FR ごとに owner を積む（主張の宣言順）。
  claimInto(ownersByRef: Map<string, string[]>): void {
    for (const ref of this.#frRefs) {
      const owners = ownersByRef.get(ref.asString()) ?? [];
      owners.push(this.#owner);
      ownersByRef.set(ref.asString(), owners);
    }
  }
}
