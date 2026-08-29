// 契約1 の式ツリー（domain 語彙）。演算子の集合は契約スキーマの Published
// Language そのもの。SMT-LIB/Quint への写像は形式知識なのでアダプタが持つ。
// 旧 aidlc-sensor-deep-spec-verify-smt.ts からの型・関数の逐語移動。

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
