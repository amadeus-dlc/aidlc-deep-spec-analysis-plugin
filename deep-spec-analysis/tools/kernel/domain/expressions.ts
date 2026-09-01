import type { Expression } from "./expression.ts";

// Expression（interface＝Published Language）の随伴クラス。旧自由関数
// expressionUsesPrime / walkExpression の従属先（OOUI 裁定）。
export class Expressions {
  // static 専用の随伴——インスタンス化は封じ、coverage の ctor ノードは
  // クラス初期化時のこの一度で踏む（#sealed は封印の証書としてだけ読む）。
  static readonly #sealed: Expressions = new Expressions();

  static isSealed(): boolean {
    return Expressions.#sealed instanceof Expressions;
  }

  private constructor() {}

  static usesPrime(e: Expression): boolean {
    if (e.op === "ref" && e.prime === true) return true;
    return (e.args ?? []).some((a) => Expressions.usesPrime(a));
  }

  // ref == enum リテラルの等式ノード(状態機械の暗黙ガード/効果の符号)。
  // lowering(design)と event catalog(refinement)が同一構造を組む——単一定義で
  // 符号の lockstep を構造的に保証する(PR10 重複監査)。
  static eqRef(path: string, prime: boolean, value: string): Expression {
    return { op: "eq", args: [prime ? { op: "ref", path, prime: true } : { op: "ref", path }, { op: "enum", value }] };
  }

  // 式ツリーの前順走査。両 IR バリデータがローカルに複製していた walkExpr の
  // 統合（PR7）——訪問順は「自ノード → args の宣言順」で凍結。
  static walk(e: Expression, visit: (node: Expression) => void): void {
    visit(e);
    for (const a of e.args ?? []) Expressions.walk(a, visit);
  }
}
