import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import { type AttributePath, type Expression, ExpressionTree, KeyedIndex } from "@deep-spec-analysis/kernel-domain";
import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import { EffectAssignment } from "./effect-assignment.ts";

/** 効果の代入集合。同じ属性は後の代入を採用し、最初の出現位置を保つ。 */
export class EffectAssignments implements FirstClassCollection, IterableFirstClassCollection<EffectAssignment> {
  readonly #values: KeyedIndex<AttributePath, EffectAssignment>;

  private constructor(values: readonly EffectAssignment[]) {
    if (values.length > 10_000) throw new IllegalArgumentException({ kind: "expression-too-large" });
    let nodes = 0;
    const entries: (readonly [AttributePath, EffectAssignment])[] = [];
    for (const assignment of values) {
      assignment.equation().walk(() => {
        if (++nodes > 10_000) throw new IllegalArgumentException({ kind: "expression-too-large" });
      });
      entries.push([assignment.target(), assignment]);
    }
    this.#values = KeyedIndex.of(entries);
  }

  static of(values: readonly EffectAssignment[]): EffectAssignments {
    return new EffectAssignments(values);
  }

  static parse(values: readonly EffectAssignment[]): Result<EffectAssignments, ParseError> {
    return parseConstruction(() => new EffectAssignments(values));
  }

  static fromEffect(effect: ExpressionTree): Result<EffectAssignments, ParseError> {
    const terms: Expression[] = [];
    const flatten = (expression: Expression): void => {
      if (expression.op === "and") for (const child of expression.args ?? []) flatten(child);
      else terms.push(expression);
    };
    flatten(effect.asExpression());
    const assignments: EffectAssignment[] = [];
    for (const term of terms) {
      const assignment = EffectAssignment.fromEquation(ExpressionTree.of(term));
      if (!assignment.ok) return assignment;
      assignments.push(assignment.value);
    }
    return EffectAssignments.parse(assignments);
  }

  covers(path: AttributePath): boolean {
    return this.#values.has(path);
  }

  *[Symbol.iterator](): Iterator<EffectAssignment> {
    yield* this.#values.values();
  }

  isEmpty(): boolean {
    return this.#values.isEmpty();
  }
}
