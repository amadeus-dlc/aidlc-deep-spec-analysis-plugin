// ソルバ 1 クエリ分の型付き判定。SMT-LIB・z3 の生表現（テキストモデル等）は
// アダプタが decode 済みで渡すため、ドメインは形式を知らない。
// core のラベルは計画側の labelToTarget でのみ意味を持つ不透明文字列。

export type SmtQueryStatus = "sat" | "unsat" | "unknown" | "budget" | "error";

export interface SmtQueryVerdict {
  readonly status: SmtQueryStatus;
  readonly decodedModel?: { [path: string]: boolean | number | string };
  readonly core?: string[];
}
