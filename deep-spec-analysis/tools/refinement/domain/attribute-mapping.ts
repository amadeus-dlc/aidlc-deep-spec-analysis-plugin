// 属性写像（attrMap の 1 エントリ）。閉じた 3 variant —— 式写像（bool/int）・
// enum 場合分け・unspecified。α置換の材料（enum 比較の展開・写像式の代入・
// 抽象フレーム等式）と全域性チェック（欠けケース・生成値の範囲）は写像自身が
// 所有する。AlphaContext は文脈（索引と未カバー検出）、UnitRefinementPlan は
// gap 文言（凍結面）だけを担う（主従の裁定・#71 波5）。

import { Expressions, IdOrder, type Expression } from "../../kernel/domain/index.ts";
import { type AttributePath } from "../../requirements/domain/index.ts";
import { AlphaError } from "./alpha-error.ts";

type Variant =
  | { readonly kind: "expression"; readonly expr: Expression }
  | { readonly kind: "enum-cases"; readonly from: string; readonly cases: { readonly [designValue: string]: string } }
  | { readonly kind: "unspecified" };

// 旧 refinement-lib の primeAll —— post 文脈では代入式の全参照を prime する。
function primeAll(e: Expression): Expression {
  if (e.op === "ref") return { ...e, prime: true };
  return { ...e, args: (e.args ?? []).map(primeAll) };
}

export class AttributeMapping {
  readonly #req: AttributePath;
  readonly #variant: Variant;

  private constructor(req: AttributePath, variant: Variant) {
    this.#req = req;
    this.#variant = variant;
  }

  static expression(req: AttributePath, expr: Expression): AttributeMapping {
    return new AttributeMapping(req, { kind: "expression", expr });
  }

  static enumCases(req: AttributePath, from: string, cases: { readonly [designValue: string]: string }): AttributeMapping {
    return new AttributeMapping(req, { kind: "enum-cases", from, cases: { ...cases } });
  }

  static unspecified(req: AttributePath): AttributeMapping {
    return new AttributeMapping(req, { kind: "unspecified" });
  }

  req(): AttributePath {
    return this.#req;
  }

  isEnumCases(): boolean {
    return this.#variant.kind === "enum-cases";
  }

  isExpression(): boolean {
    return this.#variant.kind === "expression";
  }

  // enum-cases の写像元（設計属性パス）。enum-cases でなければ undefined。
  enumFrom(): string | undefined {
    return this.#variant.kind === "enum-cases" ? this.#variant.from : undefined;
  }

  // eq/ne 比較の展開（旧 alphaExpr の enum 分岐）: その要件値へ写る設計値の
  // 選言を組み立てる。enum-cases でなければ null（呼び出し側は素の代入へ進む）。
  expandComparison(op: "eq" | "ne", reqValue: string, primed: boolean): Expression | null {
    const variant = this.#variant;
    if (variant.kind !== "enum-cases") return null;
    const from: Expression = { op: "ref", path: variant.from, ...(primed ? { prime: true } : {}) };
    const matching = Object.entries(variant.cases)
      .filter(([, rv]) => rv === reqValue)
      .map(([designValue]) => designValue)
      .sort();
    const disjunction: Expression =
      matching.length === 0
        ? { op: "bool", value: false }
        : matching.length === 1
          ? { op: "eq", args: [from, { op: "enum", value: matching[0] as string }] }
          : { op: "or", args: matching.map((d) => ({ op: "eq", args: [from, { op: "enum", value: d }] }) as Expression) };
    return op === "eq" ? disjunction : { op: "not", args: [disjunction] };
  }

  // 素の参照への代入（旧 alphaExpr の ref 分岐）。enum-cases は eq/ne の外では
  // 不適法、unspecified は材料なし——いずれも凍結文言の AlphaError（旧実装の
  // TypeError 落ちを材料つきに置き換えた意図的逸脱を保存する）。
  substituteForReference(reqPath: string, primed: boolean): Expression {
    const variant = this.#variant;
    if (variant.kind === "enum-cases") {
      throw new AlphaError(`enum-mapped requirements attribute "${reqPath}" is only legal inside eq/ne against an enum literal`);
    }
    if (variant.kind === "unspecified") {
      throw new AlphaError(`attrMap entry for "${reqPath}" declares neither an expression nor enum cases`);
    }
    const substituted = variant.expr;
    return primed ? primeAll(substituted) : substituted;
  }

  // 抽象フレーム等式（旧 alphaEquality）: alpha(a)(pre) == alpha(a)(post)。
  // unspecified は等式を持たない（null）。
  abstractFrameEquality(): Expression | null {
    const variant = this.#variant;
    if (variant.kind === "enum-cases") {
      const values = IdOrder.sortedUnique(Object.values(variant.cases), IdOrder.compare);
      // 2 つの設計値が等しく抽象されるのは同じ要件値へ写るとき：要件値ごとに
      // 「pre がその類に居る iff post がその類に居る」。
      const classes = values.map((reqValue) => {
        const members = Object.entries(variant.cases)
          .filter(([, rv]) => rv === reqValue)
          .map(([d]) => d)
          .sort();
        const inClass = (primed: boolean): Expression => {
          const refNode: Expression = { op: "ref", path: variant.from, ...(primed ? { prime: true } : {}) };
          const eqs = members.map((d) => ({ op: "eq", args: [refNode, { op: "enum", value: d }] }) as Expression);
          return eqs.length === 1 ? (eqs[0] as Expression) : { op: "or", args: eqs };
        };
        return { op: "iff", args: [inClass(false), inClass(true)] } as Expression;
      });
      return classes.length === 1 ? (classes[0] as Expression) : { op: "and", args: classes };
    }
    if (variant.kind === "unspecified") return null;
    const preE = variant.expr;
    return { op: "eq", args: [preE, primeAll(preE)] };
  }

  // 全域性（enum-cases 専門）: from の宣言値のうち cases に現れないもの（昇順）。
  missingCasesOver(fromValues: readonly string[]): readonly string[] {
    const variant = this.#variant;
    if (variant.kind !== "enum-cases") return [];
    // `in` は継承プロパティ（"toString" 等）も命中させるため、own 判定に限る。
    return fromValues.filter((v) => !Object.hasOwn(variant.cases, v)).sort();
  }

  // 生成値の範囲（enum-cases 専門）: cases の生成値のうち要件属性の値でない
  // もの（IdOrder 昇順・重複なし）。
  producedValuesOutside(reqValues: { includes(value: string): boolean } | undefined): readonly string[] {
    const variant = this.#variant;
    if (variant.kind !== "enum-cases") return [];
    return IdOrder.sortedUnique(Object.values(variant.cases).filter((rv) => !(reqValues?.includes(rv) ?? false)), IdOrder.compare);
  }

  // 式写像が参照する設計属性パス（昇順・重複なし）。enum-cases / unspecified
  // は参照を持たない（空）。
  referencedPaths(): readonly string[] {
    const variant = this.#variant;
    if (variant.kind !== "expression") return [];
    const refs = new Set<string>();
    Expressions.walk(variant.expr, (node) => {
      if (node.op === "ref" && typeof node.path === "string") refs.add(node.path);
    });
    return [...refs].sort();
  }
}
