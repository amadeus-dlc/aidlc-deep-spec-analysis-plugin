import type { Expression } from "../../kernel/domain/index.ts";
import { AlphaError } from "./alpha-error.ts";
import type { AttributeMapping } from "./attribute-mapping.ts";

// attrMap の写像のファーストクラスコレクション——要素は要件属性パスで識別される
// エンティティ `AttributeMapping`。要件パスによる検索（重複は最後の宣言が勝つ、
// 旧 byReq 索引の凍結挙動）と、要件の式を設計の式へ書き換える alpha 置換
// （`substitute`——旧 alphaExpr の逐語）、未代入属性のフレーム等式（`equalityFor`）
// はコレクションの知識で、置換の材料は各写像が所有する（種別規律の裁定 10、
// 2026-09-02——旧 `AlphaContext` を吸収）。
export class AttributeMappings {
  readonly #values: readonly AttributeMapping[];

  private constructor(values: readonly AttributeMapping[]) {
    this.#values = values;
  }

  static of(values: readonly AttributeMapping[]): AttributeMappings {
    return new AttributeMappings([...values]);
  }

  add(value: AttributeMapping): AttributeMappings {
    return new AttributeMappings([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<AttributeMapping> {
    yield* this.#values;
  }

  // 要件属性パスの写像——重複宣言は最後が勝つ。
  byRequirementPath(reqPath: string): AttributeMapping | undefined {
    let found: AttributeMapping | undefined;
    for (const m of this.#values) {
      if (m.isFor(reqPath)) found = m;
    }
    return found;
  }

  covers(reqPath: string): boolean {
    return this.byRequirementPath(reqPath) !== undefined;
  }

  // 要件の式を承認済み写像で設計の式へ書き換える。enum 属性の比較は「その要件値へ
  // 写る設計値」の選言へ展開し、post（primed）文脈では代入式の全参照を prime する。
  substitute(e: Expression, post: boolean): Expression {
    if (e.op === "eq" || e.op === "ne") {
      const [a, b] = e.args ?? [];
      const refArg = a?.op === "ref" ? a : b?.op === "ref" ? b : null;
      const enumArg = a?.op === "enum" ? a : b?.op === "enum" ? b : null;
      if (refArg && enumArg && typeof refArg.path === "string" && typeof enumArg.value === "string") {
        const expanded = this.byRequirementPath(refArg.path)?.expandComparison(e.op, enumArg.value, post || refArg.prime === true);
        if (expanded !== null && expanded !== undefined) return expanded;
      }
    }
    if (e.op === "ref" && typeof e.path === "string") {
      const mapping = this.byRequirementPath(e.path);
      if (!mapping) throw new AlphaError(`requirements attribute "${e.path}" is not covered by the attrMap`);
      return mapping.substituteForReference(e.path, post || e.prime === true);
    }
    if (e.args) return { ...e, args: e.args.map((a) => this.substitute(a, post)) };
    return e;
  }

  // alpha(a)(pre) == alpha(a)(post) — 抽象フレーム（Q2）に使う等式。写像が無ければ null。
  equalityFor(reqPath: string): Expression | null {
    return this.byRequirementPath(reqPath)?.abstractFrameEquality() ?? null;
  }

  toArray(): readonly AttributeMapping[] {
    return this.#values;
  }
}
