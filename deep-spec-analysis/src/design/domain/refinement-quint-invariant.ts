import type { Expression, FrRefs, TargetId } from "@deep-spec/kernel-domain";
import type { ObligationId } from "@deep-spec/requirements-domain";
import { LoweredObligation, type LoweredId } from "@deep-spec/design-domain";

// quint 側の refinement 追加不変量——検査可能な要件義務の alpha 置換済み
// 表明。quint ユースケースは対象 id を問い、lowering へ載せる義務を
// 不変量自身に作らせる（#71 波24）。
export class RefinementQuintInvariant {
  readonly #reqId: ObligationId;
  readonly #frRefs: FrRefs;
  readonly #expr: Expression;

  private constructor(reqId: ObligationId, frRefs: FrRefs, expr: Expression) {
    this.#reqId = reqId;
    this.#frRefs = frRefs;
    this.#expr = expr;
  }

  static of(reqId: ObligationId, frRefs: FrRefs, expr: Expression): RefinementQuintInvariant {
    return new RefinementQuintInvariant(reqId, frRefs, expr);
  }

  reqId(): ObligationId {
    return this.#reqId;
  }

  reqTarget(): TargetId {
    return this.#reqId.asTargetId();
  }

  // 兄弟バックエンドへ渡す lowering 上の invariant 義務（id は呼び手が採番）。
  loweredAs(id: LoweredId): LoweredObligation {
    return LoweredObligation.reconstitute({ id, nature: "invariant", frRefs: this.#frRefs, assert: this.#expr });
  }
}
