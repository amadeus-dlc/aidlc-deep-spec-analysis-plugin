import { type ArtifactPath, AttributePath, type Expression, ExpressionTree } from "@deep-spec-analysis/kernel-domain";
import { err, ok, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import { AttributeCoverage } from "./attribute-coverage.ts";
import type { AttributeMapping } from "./attribute-mapping.ts";
import { AttributePaths } from "./attribute-paths.ts";
import type { DesignFinding } from "./design-finding.ts";
import { DesignFindings } from "./design-findings.ts";
import type { DesignUnit } from "./design-unit.ts";
import { RefinementMapDefect } from "./refinement-map-defect.ts";
import type { RefinementRequirements } from "./refinement-requirements.ts";
import type { RefinementUnitMap } from "./refinement-unit-map.ts";
import type { UnmappedDeclarations } from "./unmapped-declarations.ts";

// attrMap の写像のファーストクラスコレクション——要素は要件属性パスで識別される
// エンティティ `AttributeMapping`。要件パスによる検索（重複は最後の宣言が勝つ、
// 旧 byReq 索引の凍結挙動）と、要件の式を設計の式へ書き換える alpha 置換
// （`substitute`——旧 alphaExpr の逐語）、未代入属性のフレーム等式（`equalityFor`）
// はコレクションの知識で、置換の材料は各写像が所有する（種別規律の裁定 10、
// 2026-09-02——旧 `AlphaContext` を吸収）。
export class AttributeMappings {
  readonly #values: readonly AttributeMapping[];

  private constructor(values: readonly AttributeMapping[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly AttributeMapping[]): AttributeMappings {
    return new AttributeMappings(values);
  }

  add(value: AttributeMapping): AttributeMappings {
    return new AttributeMappings([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<AttributeMapping> {
    yield* this.#values;
  }

  coverageOf(required: AttributePaths, unmapped: UnmappedDeclarations): AttributeCoverage {
    const mapped: AttributePath[] = [],
      waived: AttributePath[] = [],
      missing: AttributePath[] = [];
    for (const path of required) {
      if (this.covers(path.asString())) mapped.push(path);
      else if (unmapped.covers(path)) waived.push(path);
      else missing.push(path);
    }
    return AttributeCoverage.of({
      required,
      mapped: AttributePaths.of(mapped),
      waived: AttributePaths.of(waived),
      missing: AttributePaths.of(missing),
    });
  }

  diagnostics(
    unit: DesignUnit,
    requirements: RefinementRequirements,
    map: RefinementUnitMap,
    artifact: ArtifactPath,
  ): DesignFindings {
    const findings: DesignFinding[] = [];
    const seen = new Set<string>();
    for (const mapping of this.#values) {
      const path = mapping.req();
      if (seen.has(path.asString()))
        findings.push(map.attributeGap(path, `attrMap maps "${path.asString()}" more than once`, artifact));
      seen.add(path.asString());
      for (const message of mapping.diagnostics(unit, requirements.attributes()))
        findings.push(map.attributeGap(path, message.asString(), artifact));
    }
    for (const attribute of requirements.attributes().sortedByPath()) {
      const path = attribute.path();
      if (!this.covers(path.asString()) && !map.unmapped().covers(path))
        findings.push(
          map.attributeGap(
            path,
            `requirements attribute "${path.asString()}" is neither mapped by attrMap nor listed in unmapped[] — silence is a contract violation`,
            artifact,
          ),
        );
    }
    return DesignFindings.of(findings);
  }

  // 要件属性パスの写像——重複宣言は最後が勝つ。
  #byRequirementPath(reqPath: string): AttributeMapping | undefined {
    const path = AttributePath.parse(reqPath);
    if (!path.ok) return undefined;
    let found: AttributeMapping | undefined;
    for (const m of this.#values) {
      if (m.isFor(path.value)) found = m;
    }
    return found;
  }

  covers(reqPath: string): boolean {
    return this.#byRequirementPath(reqPath) !== undefined;
  }

  // 要件の式を承認済み写像で設計の式へ書き換える。enum 属性の比較は「その要件値へ
  // 写る設計値」の選言へ展開し、post（primed）文脈では代入式の全参照を prime する。
  substitute(e: Expression, post: boolean): Result<Expression, RefinementMapDefect> {
    const substituted = this.#substitute(e, post);
    if (!substituted.ok) return substituted;
    const parsed = ExpressionTree.parse(substituted.value);
    return parsed.ok ? ok(parsed.value.asExpression()) : err(RefinementMapDefect.invalidExpression(parsed.error));
  }

  #substitute(e: Expression, post: boolean): Result<Expression, RefinementMapDefect> {
    if (e.op === "eq" || e.op === "ne") {
      const [a, b] = e.args ?? [];
      const refArg = a?.op === "ref" ? a : b?.op === "ref" ? b : null;
      const enumArg = a?.op === "enum" ? a : b?.op === "enum" ? b : null;
      if (refArg && enumArg && typeof refArg.path === "string" && typeof enumArg.value === "string") {
        const expanded = this.#byRequirementPath(refArg.path)?.expandComparison(
          e.op,
          enumArg.value,
          post || refArg.prime === true,
        );
        if (expanded !== null && expanded !== undefined) return ok(expanded);
      }
    }
    if (e.op === "ref" && typeof e.path === "string") {
      const mapping = this.#byRequirementPath(e.path);
      if (!mapping) return err(RefinementMapDefect.uncoveredAttribute(e.path));
      return mapping.substituteForReference(e.path, post || e.prime === true);
    }
    if (e.args) {
      // 引数は宣言順に書き換え、最初の欠陥で止まる（旧 throw の順序と同じ）。
      const args: Expression[] = [];
      for (const a of e.args) {
        const sub = this.#substitute(a, post);
        if (!sub.ok) return sub;
        args.push(sub.value);
      }
      return ok({ ...e, args });
    }
    return ok(e);
  }

  // alpha(a)(pre) == alpha(a)(post) — 抽象フレーム（Q2）に使う等式。写像が無ければ null。
  equalityFor(reqPath: string): Result<Expression | null, RefinementMapDefect> {
    const expression = this.#byRequirementPath(reqPath)?.abstractFrameEquality();
    if (expression == null) return ok(null);
    const parsed = ExpressionTree.parse(expression);
    return parsed.ok ? ok(parsed.value.asExpression()) : err(RefinementMapDefect.invalidExpression(parsed.error));
  }

  toArray(): readonly AttributeMapping[] {
    return this.#values;
  }
}
