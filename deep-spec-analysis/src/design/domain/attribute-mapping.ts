import { ReqAttributeValues } from "./req-attribute-values.ts";
// 属性写像（attrMap の 1 エントリ）。閉じた 3 variant —— 式写像（bool/int）・
// enum 場合分け・unspecified。α置換の材料（enum 比較の展開・写像式の代入・
// 抽象フレーム等式）と全域性チェック（欠けケース・生成値の範囲）は写像自身が
// 所有する。AttributeMappings は索引と置換の駆動、UnitRefinementPlan は
// gap 文言（凍結面）だけを担う（主従の裁定・#71 波5、裁定 10）。
// 写像は要件属性パスで識別されるローカルエンティティ（識別規律、2026-09-02）。

import { ExpressionTree, type Expression } from "@deep-spec/kernel-domain";
import { type AttributePath } from "@deep-spec/requirements-domain";
import { type Result, err, ok } from "@deep-spec/kernel-infrastructure";
import { RefinementMapDefect } from "./refinement-map-defect.ts";

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
    return new AttributeMapping(req, { kind: "expression", expr: ExpressionTree.of(expr).asExpression() });
  }

  static enumCases(req: AttributePath, from: string, cases: { readonly [designValue: string]: string }): AttributeMapping {
    return new AttributeMapping(req, { kind: "enum-cases", from, cases: { ...cases } });
  }

  static unspecified(req: AttributePath): AttributeMapping {
    return new AttributeMapping(req, { kind: "unspecified" });
  }

  // 同一性——この写像がその要件属性のものか。
  isFor(reqPath: string): boolean {
    return this.#req.asString() === reqPath;
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
  // 不適法、unspecified は材料なし——いずれも凍結文言の RefinementMapDefect（旧実装の
  // TypeError 落ちを材料つきに置き換えた意図的逸脱を保存する）。
  substituteForReference(reqPath: string, primed: boolean): Result<Expression, RefinementMapDefect> {
    const variant = this.#variant;
    if (variant.kind === "enum-cases") {
      return err(RefinementMapDefect.enumMappingOutsideEquality(reqPath));
    }
    if (variant.kind === "unspecified") {
      return err(RefinementMapDefect.unspecifiedMapping(reqPath));
    }
    const substituted = variant.expr;
    return ok(primed ? primeAll(substituted) : substituted);
  }

  // 抽象フレーム等式（旧 alphaEquality）: alpha(a)(pre) == alpha(a)(post)。
  // unspecified は等式を持たない（null）。
  abstractFrameEquality(): Expression | null {
    const variant = this.#variant;
    if (variant.kind === "enum-cases") {
      const values = ReqAttributeValues.of(Object.values(variant.cases)).sortedUniqueCanonically().toArray();
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
  // もの（正準順・重複なし）。
  producedValuesOutside(reqValues: { includes(value: string): boolean } | undefined): readonly string[] {
    const variant = this.#variant;
    if (variant.kind !== "enum-cases") return [];
    return ReqAttributeValues.of(Object.values(variant.cases).filter((rv) => !(reqValues?.includes(rv) ?? false))).sortedUniqueCanonically().toArray();
  }

  // 式写像が参照する設計属性パス（昇順・重複なし）。enum-cases / unspecified
  // は参照を持たない（空）。
  referencedPaths(): readonly string[] {
    const variant = this.#variant;
    if (variant.kind !== "expression") return [];
    return ExpressionTree.of(variant.expr).referencedPaths();
  }
}
