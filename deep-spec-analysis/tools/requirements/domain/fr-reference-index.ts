// FrReferenceIndex — IR が主張する frRef の逆索引（FR5.2 逆トレーサビリティ）。
// 「どの frRef を誰が使っているか」を保持し、requirements.md 側の既知 id 集合と
// 突き合わせて未存在参照を報告する。owner の解決（id が無ければ
// `<section>[<i>]`）はアダプタの寛容パースの責務で、ここは索引と照合だけ。
// 旧 ir-valid の collectFrRefs ＋ 照合ループからの逐語移植。

import type { RequirementIds } from "../../kernel/domain/index.ts";
import type { FrRefs } from "./fr-refs.ts";

export interface FrRefClaim {
  readonly owner: string;
  readonly frRefs: FrRefs;
}

export class FrReferenceIndex {
  readonly #ownersByRef: Map<string, string[]>;

  private constructor(ownersByRef: Map<string, string[]>) {
    this.#ownersByRef = ownersByRef;
  }

  // 主張の宣言順に owner を積む（同一 frRef の owner 列は報告時に整列）。
  static of(claims: readonly FrRefClaim[]): FrReferenceIndex {
    const ownersByRef = new Map<string, string[]>();
    for (const claim of claims) {
      for (const ref of claim.frRefs) {
        const owners = ownersByRef.get(ref) ?? [];
        owners.push(claim.owner);
        ownersByRef.set(ref, owners);
      }
    }
    return new FrReferenceIndex(ownersByRef);
  }

  referencedIds(): string[] {
    return [...this.#ownersByRef.keys()];
  }

  // requirements.md に存在しない frRef を、id 昇順・owner 昇順で報告する。
  missingErrors(known: RequirementIds): string[] {
    const missing = [...this.#ownersByRef.keys()].filter((id) => !known.has(id)).sort();
    return missing.map((id) => {
      const owners = (this.#ownersByRef.get(id) ?? []).sort().join(", ");
      return `frRef "${id}" (used by ${owners}) does not exist in requirements.md`;
    });
  }
}
