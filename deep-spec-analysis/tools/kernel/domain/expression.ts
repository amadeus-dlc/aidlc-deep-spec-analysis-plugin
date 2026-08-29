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

export function expressionUsesPrime(e: Expression): boolean {
  if (e.op === "ref" && e.prime === true) return true;
  return (e.args ?? []).some(expressionUsesPrime);
}
