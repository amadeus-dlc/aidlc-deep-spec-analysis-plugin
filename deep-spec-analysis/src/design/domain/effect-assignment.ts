import { AttributePath, type Expression, ExpressionTree } from "@deep-spec-analysis/kernel-domain";
import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import { DesignAssignment } from "./design-assignment.ts";

function assignmentTerms(equation: Expression): { path: string; rightHandSide: Expression } | null {
  if (equation.op !== "eq" || equation.args?.length !== 2) return null;
  const [left, right] = equation.args;
  if (left?.op === "ref" && left.prime === true)
    return left.path !== undefined && right !== undefined ? { path: left.path, rightHandSide: right } : null;
  if (right?.op === "ref" && right.prime === true && right.path !== undefined && left !== undefined)
    return { path: right.path, rightHandSide: left };
  return null;
}

/** prime参照への代入を表す等式。左右の表記順を保存する。 */
export class EffectAssignment {
  readonly #target: AttributePath;
  readonly #equation: ExpressionTree;
  readonly #rightHandSide: ExpressionTree;

  private constructor(target: AttributePath, equation: ExpressionTree) {
    const terms = assignmentTerms(equation.asExpression());
    if (terms === null || terms.path !== target.asString())
      throw new IllegalArgumentException({ kind: "effect-not-assignment-conjunction" });
    this.#target = target;
    this.#equation = equation;
    this.#rightHandSide = ExpressionTree.of(terms.rightHandSide);
  }

  static of(target: AttributePath, equation: ExpressionTree): EffectAssignment {
    return new EffectAssignment(target, equation);
  }

  static parse(target: AttributePath, equation: ExpressionTree): Result<EffectAssignment, ParseError> {
    return parseConstruction(() => new EffectAssignment(target, equation));
  }

  static fromEquation(equation: ExpressionTree): Result<EffectAssignment, ParseError> {
    const terms = assignmentTerms(equation.asExpression());
    if (terms === null) return { ok: false, error: { kind: "effect-not-assignment-conjunction" } };
    const target = AttributePath.parse(terms.path);
    return target.ok ? EffectAssignment.parse(target.value, equation) : target;
  }

  target(): AttributePath {
    return this.#target;
  }

  equation(): ExpressionTree {
    return this.#equation;
  }

  asDesignAssignment(): DesignAssignment {
    return DesignAssignment.of(this.#target, this.#rightHandSide);
  }
}
