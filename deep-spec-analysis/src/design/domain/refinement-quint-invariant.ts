import { ExpressionTree } from "@deep-spec/kernel-domain";
import type { Expression, FunctionalRequirementReferences, TargetId } from "@deep-spec/kernel-domain";

import type { ObligationId } from "@deep-spec/requirements-domain";
import { LoweredObligation, type LoweredId } from "@deep-spec/design-domain";

// quint 側の refinement 追加不変量——検査可能な要件義務の alpha 置換済み
// 表明。quint ユースケースは対象 id を問い、lowering へ載せる義務を
// 不変量自身に作らせる（#71 波24）。
export class RefinementQuintInvariant {
  readonly #reqId: ObligationId;
  readonly #functionalRequirementReferences: FunctionalRequirementReferences;
  readonly #expr: Expression;

  private constructor(reqId: ObligationId, functionalRequirementReferences: FunctionalRequirementReferences, expr: Expression) {
    this.#reqId = reqId;
    this.#functionalRequirementReferences = functionalRequirementReferences;
    this.#expr = ExpressionTree.of(expr).asExpression();
  }

  static of(reqId: ObligationId, functionalRequirementReferences: FunctionalRequirementReferences, expr: Expression): RefinementQuintInvariant {
    return new RefinementQuintInvariant(reqId, functionalRequirementReferences, expr);
  }

  reqId(): ObligationId {
    return this.#reqId;
  }

  reqTarget(): TargetId {
    return this.#reqId.asTargetId();
  }

  // 兄弟バックエンドへ渡す lowering 上の invariant 義務（id は呼び手が採番）。
  loweredAs(id: LoweredId): LoweredObligation {
    return LoweredObligation.of({ id, nature: "invariant", functionalRequirementReferences: this.#functionalRequirementReferences, assert: this.#expr });
  }
}
