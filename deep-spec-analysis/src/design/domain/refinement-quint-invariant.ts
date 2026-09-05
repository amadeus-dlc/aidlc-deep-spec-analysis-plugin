import { type LoweredIdentifier, LoweredObligation } from "@deep-spec/design-domain";
import type { Expression, FunctionalRequirementReferences, TargetIdentifier } from "@deep-spec/kernel-domain";
import { ExpressionTree } from "@deep-spec/kernel-domain";
import { type ParseError, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
import type { ObligationIdentifier } from "@deep-spec/requirements-domain";

// quint 側の refinement 追加不変量——検査可能な要件義務の alpha 置換済み
// 表明。quint ユースケースは対象 id を問い、lowering へ載せる義務を
// 不変量自身に作らせる（#71 波24）。
export class RefinementQuintInvariant {
  readonly #reqId: ObligationIdentifier;
  readonly #functionalRequirementReferences: FunctionalRequirementReferences;
  readonly #expr: Expression;

  private constructor(
    reqId: ObligationIdentifier,
    functionalRequirementReferences: FunctionalRequirementReferences,
    expr: Expression,
  ) {
    this.#reqId = reqId;
    this.#functionalRequirementReferences = functionalRequirementReferences;
    this.#expr = ExpressionTree.of(expr).asExpression();
  }

  static parse(
    reqId: ObligationIdentifier,
    functionalRequirementReferences: FunctionalRequirementReferences,
    expr: Expression,
  ): Result<RefinementQuintInvariant, ParseError> {
    return parseConstruction(() => new RefinementQuintInvariant(reqId, functionalRequirementReferences, expr));
  }

  static of(
    reqId: ObligationIdentifier,
    functionalRequirementReferences: FunctionalRequirementReferences,
    expr: Expression,
  ): RefinementQuintInvariant {
    return new RefinementQuintInvariant(reqId, functionalRequirementReferences, expr);
  }

  reqId(): ObligationIdentifier {
    return this.#reqId;
  }

  reqTarget(): TargetIdentifier {
    return this.#reqId.asTargetId();
  }

  // 兄弟バックエンドへ渡す lowering 上の invariant 義務（id は呼び手が採番）。
  loweredAs(id: LoweredIdentifier): LoweredObligation {
    return LoweredObligation.of({
      id,
      nature: "invariant",
      functionalRequirementReferences: this.#functionalRequirementReferences,
      assert: this.#expr,
    });
  }
}
