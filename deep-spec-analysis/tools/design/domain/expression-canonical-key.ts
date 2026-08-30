// 式ツリーの正準キー — shadow（包摂）検出が「効果が同一か」を判定する比較鍵。
// kernel/adapter の canonicalStringify（正準 JSON）と同一バイトを、型付き
// Expression 上で計算する（ドメインは Json 形式知識を import しない）。
// 同値性は tests が canonicalStringify との突き合わせで機械証明する。

import type { Expression } from "../../kernel/domain/index.ts";

type CanonicalNode = null | boolean | number | string | readonly CanonicalNode[] | { readonly [k: string]: CanonicalNode };

function keyOf(value: CanonicalNode): string {
  if (Array.isArray(value)) {
    return `[${value.map(keyOf).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const record = value as { readonly [k: string]: CanonicalNode };
    const keys = Object.keys(record).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${keyOf(record[k] ?? null)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function expressionCanonicalKeyImpl(e: Expression): string {
  return keyOf(e as unknown as CanonicalNode);
}

// 旧自由関数 expressionCanonicalKey の従属先（OOUI 裁定）。
export class ExpressionCanonicalKey {
  private constructor() {}

  static of(e: Expression): string {
    return expressionCanonicalKeyImpl(e);
  }
}
