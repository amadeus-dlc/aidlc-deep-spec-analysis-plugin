// Quint 側の refinement 追加不変量 — checkable な invariant/numeric 要件義務
// ごとの alpha(P)。ユニットの lowering に追加不変量として合流し、違反成分が
// これのトレースは「到達可能な refinement 破れ」になる。導出は
// UnitRefinementPlan#quintInvariants の振る舞い（OOUI 裁定）で、ここは型と
// ファーストクラスコレクションだけを持つ。

import type { Expression, FrRefs } from "../../kernel/domain/index.ts";
import type { ObligationId } from "../../requirements/domain/index.ts";

export interface RefinementQuintInvariant {
  reqId: ObligationId;
  frRefs: FrRefs;
  expr: Expression;
}

// 追加不変量のファーストクラスコレクション（義務 id の正準順で導出される）。
export class RefinementQuintInvariants {
  readonly #values: readonly RefinementQuintInvariant[];

  private constructor(values: readonly RefinementQuintInvariant[]) {
    this.#values = values;
  }

  static of(values: readonly RefinementQuintInvariant[]): RefinementQuintInvariants {
    return new RefinementQuintInvariants([...values]);
  }

  add(value: RefinementQuintInvariant): RefinementQuintInvariants {
    return new RefinementQuintInvariants([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<RefinementQuintInvariant> {
    yield* this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }

  reqIds(): ReadonlySet<string> {
    return new Set(this.#values.map((e) => e.reqId.asString()));
  }

  toArray(): readonly RefinementQuintInvariant[] {
    return this.#values;
  }
}
