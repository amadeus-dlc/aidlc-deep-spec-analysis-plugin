// 契約1/契約3 が共有する式ツリー（kernel 語彙）。演算子の集合は契約スキーマの
// Published Language そのもの。SMT-LIB/Quint への写像は形式知識なのでアダプタが
// 持つ。requirements と design の両コンテキストが消費するため kernel が所有する。

export interface Expression {
  op: string;
  args?: Expression[];
  path?: string;
  prime?: boolean;
  value?: boolean | number | string;
}

// Expression（interface＝Published Language）の随伴クラス。旧自由関数
// expressionUsesPrime / walkExpression の従属先（OOUI 裁定）。
export class Expressions {
  private constructor() {}

  static usesPrime(e: Expression): boolean {
    if (e.op === "ref" && e.prime === true) return true;
    return (e.args ?? []).some((a) => Expressions.usesPrime(a));
  }

  // 式ツリーの前順走査。両 IR バリデータがローカルに複製していた walkExpr の
  // 統合（PR7）——訪問順は「自ノード → args の宣言順」で凍結。
  static walk(e: Expression, visit: (node: Expression) => void): void {
    visit(e);
    for (const a of e.args ?? []) Expressions.walk(a, visit);
  }
}
