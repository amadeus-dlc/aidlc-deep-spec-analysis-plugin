// alpha 置換 — 要件の式を、承認済み写像（attrMap）で設計の式へ機械的に
// 書き換える。bool/int 属性は写像式をそのまま代入し、enum 属性（enum-cases）
// は enum リテラルとの eq/ne の内側でのみ適法——比較は「その要件値へ写る設計値」
// の選言へ展開する。post（primed）文脈では代入式の全参照を prime する。
// 旧 refinement-lib の primeAll / alphaExpr / alphaEquality からの逐語移植で、
// 自由関数は AlphaContext 自身の振る舞い（substitute / equalityFor）になった。
// 索引キーは Expression（published language）の生パス——境界で string を受ける。

import { idCompare, sortedUnique } from "../../kernel/domain/index.ts";
import type { Expression } from "../../kernel/domain/index.ts";
import type { AttributeMapping } from "./refinement-map.ts";

export class AlphaError extends Error {
  constructor(message: string) {
    super(message);
  }
}

function primeAll(e: Expression): Expression {
  if (e.op === "ref") return { ...e, prime: true };
  return { ...e, args: (e.args ?? []).map(primeAll) };
}

// 承認済み写像の適用文脈。要件属性パス → AttributeMapping の索引を閉じ込め、
// 置換（substitute）と抽象フレーム等式（equalityFor）を自身の振る舞いとして
// 提供する。
export class AlphaContext {
  readonly #byReq: ReadonlyMap<string, AttributeMapping>;

  private constructor(byReq: ReadonlyMap<string, AttributeMapping>) {
    this.#byReq = byReq;
  }

  static of(byReq: ReadonlyMap<string, AttributeMapping>): AlphaContext {
    return new AlphaContext(new Map(byReq));
  }

  covers(reqPath: string): boolean {
    return this.#byReq.has(reqPath);
  }

  // 旧 alphaExpr の逐語移植。
  substitute(e: Expression, post: boolean): Expression {
    if (e.op === "eq" || e.op === "ne") {
      const [a, b] = e.args ?? [];
      const refArg = a?.op === "ref" ? a : b?.op === "ref" ? b : null;
      const enumArg = a?.op === "enum" ? a : b?.op === "enum" ? b : null;
      if (refArg && enumArg && typeof refArg.path === "string" && typeof enumArg.value === "string") {
        const mapping = this.#byReq.get(refArg.path);
        if (mapping?.kind === "enum-cases") {
          const usePost = post || refArg.prime === true;
          const from: Expression = { op: "ref", path: mapping.from, ...(usePost ? { prime: true } : {}) };
          const matching = Object.entries(mapping.cases)
            .filter(([, reqValue]) => reqValue === enumArg.value)
            .map(([designValue]) => designValue)
            .sort();
          const disjunction: Expression =
            matching.length === 0
              ? { op: "bool", value: false }
              : matching.length === 1
                ? { op: "eq", args: [from, { op: "enum", value: matching[0] as string }] }
                : { op: "or", args: matching.map((d) => ({ op: "eq", args: [from, { op: "enum", value: d }] }) as Expression) };
          return e.op === "eq" ? disjunction : { op: "not", args: [disjunction] };
        }
      }
    }
    if (e.op === "ref" && typeof e.path === "string") {
      const mapping = this.#byReq.get(e.path);
      if (!mapping) throw new AlphaError(`requirements attribute "${e.path}" is not covered by the attrMap`);
      if (mapping.kind === "enum-cases") {
        throw new AlphaError(`enum-mapped requirements attribute "${e.path}" is only legal inside eq/ne against an enum literal`);
      }
      if (mapping.kind === "unspecified") {
        // 契約4 スキーマ検証を通った文書では到達しない（expr / enumMap の
        // どちらも無い entry）。旧実装は未定義 expr の代入で TypeError 落ち
        // だった——材料つきの AlphaError へ置き換える（意図的逸脱・記録済み）。
        throw new AlphaError(`attrMap entry for "${e.path}" declares neither an expression nor enum cases`);
      }
      const substituted = mapping.expr;
      return post || e.prime === true ? primeAll(substituted) : substituted;
    }
    if (e.args) return { ...e, args: e.args.map((a) => this.substitute(a, post)) };
    return e;
  }

  // alpha(a)(pre) == alpha(a)(post) — 抽象フレーム（Q2）に使う等式。
  // 旧 alphaEquality の逐語移植。
  equalityFor(reqPath: string): Expression | null {
    const mapping = this.#byReq.get(reqPath);
    if (!mapping) return null;
    if (mapping.kind === "enum-cases") {
      const values = sortedUnique(Object.values(mapping.cases), idCompare);
      // 2 つの設計値が等しく抽象されるのは同じ要件値へ写るとき：要件値ごとに
      // 「pre がその類に居る iff post がその類に居る」。
      const classes = values.map((reqValue) => {
        const members = Object.entries(mapping.cases)
          .filter(([, rv]) => rv === reqValue)
          .map(([d]) => d)
          .sort();
        const inClass = (primed: boolean): Expression => {
          const refNode: Expression = { op: "ref", path: mapping.from, ...(primed ? { prime: true } : {}) };
          const eqs = members.map((d) => ({ op: "eq", args: [refNode, { op: "enum", value: d }] }) as Expression);
          return eqs.length === 1 ? (eqs[0] as Expression) : { op: "or", args: eqs };
        };
        return { op: "iff", args: [inClass(false), inClass(true)] } as Expression;
      });
      return classes.length === 1 ? (classes[0] as Expression) : { op: "and", args: classes };
    }
    if (mapping.kind === "unspecified") return null;
    const preE = mapping.expr;
    return { op: "eq", args: [preE, primeAll(preE)] };
  }
}
