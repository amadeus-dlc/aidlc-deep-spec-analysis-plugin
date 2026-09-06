import { SkipReason, type TargetIdentifier, UnitName } from "@deep-spec-analysis/kernel-domain";
import type { ParseError } from "@deep-spec-analysis/kernel-infrastructure";
import { AttributePath } from "@deep-spec-analysis/requirements-domain";
import { DesignSkipped } from "./design-skipped.ts";

type RefinementMapDefectState =
  | { kind: "uncovered-attribute" | "enum-mapping-outside-equality" | "unspecified-mapping"; path: AttributePath }
  | { kind: "effect-not-assignment-conjunction" }
  | { kind: "invalid-expression"; problem: ParseError };

// 写像や式合成の不成立を、例外ではない診断値として運ぶ。
export class RefinementMapDefect {
  readonly #state: RefinementMapDefectState;
  private constructor(state: RefinementMapDefectState) {
    this.#state = state.kind === "invalid-expression" ? { ...state, problem: { ...state.problem } } : { ...state };
  }
  static uncoveredAttribute(path: string): RefinementMapDefect {
    return new RefinementMapDefect({ kind: "uncovered-attribute", path: AttributePath.of(path) });
  }
  static enumMappingOutsideEquality(path: string): RefinementMapDefect {
    return new RefinementMapDefect({ kind: "enum-mapping-outside-equality", path: AttributePath.of(path) });
  }
  static unspecifiedMapping(path: string): RefinementMapDefect {
    return new RefinementMapDefect({ kind: "unspecified-mapping", path: AttributePath.of(path) });
  }
  static effectNotAssignmentConjunction(): RefinementMapDefect {
    return new RefinementMapDefect({ kind: "effect-not-assignment-conjunction" });
  }
  static invalidExpression(problem: ParseError): RefinementMapDefect {
    return new RefinementMapDefect({ kind: "invalid-expression", problem });
  }
  message(): string {
    const state = this.#state;
    switch (state.kind) {
      case "uncovered-attribute":
        return `requirements attribute "${state.path.asString()}" is not covered by the attrMap`;
      case "enum-mapping-outside-equality":
        return `enum-mapped requirements attribute "${state.path.asString()}" is only legal inside eq/ne against an enum literal`;
      case "unspecified-mapping":
        return `attrMap entry for "${state.path.asString()}" declares neither an expression nor enum cases`;
      case "effect-not-assignment-conjunction":
        return "requirements effect is not a conjunction of primed assignments";
      case "invalid-expression":
        return `substituted expression could not be constructed: ${state.problem.kind}`;
    }
  }
  asCompileErrorSkip(target: TargetIdentifier, unit: string): DesignSkipped {
    return DesignSkipped.of({
      target,
      reason: SkipReason.compileError(),
      unit: UnitName.of(unit),
      detail: `alpha substitution failed: ${this.message()}`,
    });
  }
}
