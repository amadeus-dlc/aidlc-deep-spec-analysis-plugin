import { ExpressionTree } from "@deep-spec/kernel-domain";
import type { Expression } from "@deep-spec/kernel-domain";
import type { DesignAssignments } from "./design-assignments.ts";
import { AttributePath } from "@deep-spec/kernel-domain";

// 設計側の 1 イベント（遷移または guarded effect 義務）の lowering 面——
// ガードと、効果が代入する属性ごとの右辺。refinement クエリはガードを
// 読み、属性ごとの右辺をイベントに問う（#71 波24）。
export class DesignEvent {
  readonly #guard: Expression;
  readonly #effectAssign: DesignAssignments;

  private constructor(guard: Expression, effectAssign: DesignAssignments) {
    this.#guard = ExpressionTree.of(guard).asExpression();
    this.#effectAssign = effectAssign;
  }

  static of(guard: Expression, effectAssign: DesignAssignments): DesignEvent {
    return new DesignEvent(guard, effectAssign);
  }

  guard(): Expression {
    return this.#guard;
  }

  // 効果が属性 path へ代入する右辺。代入しなければ undefined（フレーム）。
  assignedRhsOf(path: string): Expression | undefined {
    return this.#effectAssign.rhsOf(AttributePath.reconstitute(path));
  }
}
