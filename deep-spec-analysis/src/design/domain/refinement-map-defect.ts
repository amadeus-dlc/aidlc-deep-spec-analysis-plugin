import { DesignSkipped } from "@deep-spec/design-domain";
import { SkipReason, type TargetIdentifier, UnitName } from "@deep-spec/kernel-domain";
import { AttributePath } from "@deep-spec/requirements-domain";

// refinement map の欠陥——alpha 置換（要件の式を設計の式へ書き換える処理）が
// 進めない、地図側の 4 つの事態。ユビキタス言語で名づけた抽象データ型で、
// 予期された失敗として `Result` の値で運ぶ（種別規律の裁定 15、2026-09-02——
// 旧例外 `AlphaError` を吸収）。凍結文言は各バリアントが描画し、公開語彙
// （skip 理由 `compile-error`）への対応もこの型が知る。
export class RefinementMapDefect {
  readonly #kind:
    | "uncovered-attribute"
    | "enum-mapping-outside-equality"
    | "unspecified-mapping"
    | "effect-not-assignment-conjunction";
  readonly #reqPath: AttributePath | null;

  private constructor(
    kind:
      | "uncovered-attribute"
      | "enum-mapping-outside-equality"
      | "unspecified-mapping"
      | "effect-not-assignment-conjunction",
    reqPath: AttributePath | null,
  ) {
    this.#kind = kind;
    this.#reqPath = reqPath;
  }

  // 要件属性が attrMap に無い。
  static uncoveredAttribute(reqPath: string): RefinementMapDefect {
    return new RefinementMapDefect("uncovered-attribute", AttributePath.of(reqPath));
  }

  // enum 写像の属性が eq/ne の外で参照された。
  static enumMappingOutsideEquality(reqPath: string): RefinementMapDefect {
    return new RefinementMapDefect("enum-mapping-outside-equality", AttributePath.of(reqPath));
  }

  // attrMap の項目が式も enum 対応も持たない。
  static unspecifiedMapping(reqPath: string): RefinementMapDefect {
    return new RefinementMapDefect("unspecified-mapping", AttributePath.of(reqPath));
  }

  // 要件の効果が prime 代入の連言でない。
  static effectNotAssignmentConjunction(): RefinementMapDefect {
    return new RefinementMapDefect("effect-not-assignment-conjunction", null);
  }

  // 凍結文言（旧 AlphaError.message と逐語で同一）。
  message(): string {
    const path = this.#reqPath?.asString() ?? "";
    switch (this.#kind) {
      case "uncovered-attribute":
        return `requirements attribute "${path}" is not covered by the attrMap`;
      case "enum-mapping-outside-equality":
        return `enum-mapped requirements attribute "${path}" is only legal inside eq/ne against an enum literal`;
      case "unspecified-mapping":
        return `attrMap entry for "${path}" declares neither an expression nor enum cases`;
      default:
        return "requirements effect is not a conjunction of primed assignments";
    }
  }

  // 公開語彙への対応：compile-error skip（文言は golden 凍結）。
  asCompileErrorSkip(target: TargetIdentifier, unit: string): DesignSkipped {
    return DesignSkipped.of({
      target,
      reason: SkipReason.compileError(),
      unit: UnitName.of(unit),
      detail: `alpha substitution failed: ${this.message()}`,
    });
  }
}
