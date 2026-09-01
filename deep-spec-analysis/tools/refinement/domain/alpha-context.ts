// alpha 置換 — 要件の式を、承認済み写像（attrMap）で設計の式へ機械的に
// 書き換える。bool/int 属性は写像式をそのまま代入し、enum 属性（enum-cases）
// は enum リテラルとの eq/ne の内側でのみ適法——比較は「その要件値へ写る設計値」
// の選言へ展開する。post（primed）文脈では代入式の全参照を prime する。
// 旧 refinement-lib の primeAll / alphaExpr / alphaEquality からの逐語移植で、
// 自由関数は AlphaContext 自身の振る舞い（substitute / equalityFor）になった。
// 索引キーは Expression（published language）の生パス——境界で string を受ける。
//
// 波5（#71）: 置換・展開・等式の材料は写像自身（AttributeMapping）が所有し、
// この文脈は索引と未カバー検出だけを担う。

import type { Expression } from "../../kernel/domain/index.ts";
import { type AttributeMapping } from "./attribute-mapping.ts";
import { AlphaError } from "./alpha-error.ts";

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
        const expanded = this.#byReq.get(refArg.path)?.expandComparison(e.op, enumArg.value, post || refArg.prime === true);
        if (expanded !== null && expanded !== undefined) return expanded;
      }
    }
    if (e.op === "ref" && typeof e.path === "string") {
      const mapping = this.#byReq.get(e.path);
      if (!mapping) throw new AlphaError(`requirements attribute "${e.path}" is not covered by the attrMap`);
      return mapping.substituteForReference(e.path, post || e.prime === true);
    }
    if (e.args) return { ...e, args: e.args.map((a) => this.substitute(a, post)) };
    return e;
  }

  // alpha(a)(pre) == alpha(a)(post) — 抽象フレーム（Q2）に使う等式。
  // 旧 alphaEquality の逐語移植。
  equalityFor(reqPath: string): Expression | null {
    return this.#byReq.get(reqPath)?.abstractFrameEquality() ?? null;
  }
}
