import { AttributePath, type Expression, ExpressionTree, KeyedIndex } from "@deep-spec/kernel-domain";
// EffectAssignments — 効果式（prime 代入の連言）を属性パス → 代入項の索引に
// 解いたもの。キーは AttributePath、内側は KeyedIndex（裁定 3-1、2026-09-03）。
// 連言でない・代入でない効果はコンストラクタで拒否し、parseはParseErrorを返す
//（裁定 15）。同じ属性への重複代入は後勝ち（Map と同じ——位置は最初のまま、
// 凍結挙動）。

import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec/kernel-infrastructure";

export class EffectAssignments {
  readonly #values: KeyedIndex<AttributePath, Expression>;

  private constructor(effect: Expression) {
    const snapshot = ExpressionTree.of(effect).asExpression();
    const assignments: (readonly [AttributePath, Expression])[] = [];
    const terms: Expression[] = [];
    const flatten = (e: Expression): void => {
      if (e.op === "and") for (const a of e.args ?? []) flatten(a);
      else terms.push(e);
    };
    flatten(snapshot);
    for (const term of terms) {
      if (term.op !== "eq" || term.args?.length !== 2)
        throw new IllegalArgumentException({ kind: "effect-not-assignment-conjunction" });
      const [a, b] = term.args ?? [];
      const target = a?.op === "ref" && a.prime === true ? a : b?.op === "ref" && b.prime === true ? b : null;
      if (!target || target.path === undefined)
        throw new IllegalArgumentException({ kind: "effect-not-assignment-conjunction" });
      assignments.push([AttributePath.of(target.path), term]);
    }
    this.#values = KeyedIndex.of(assignments);
  }

  static of(effect: Expression): EffectAssignments {
    return new EffectAssignments(effect);
  }

  static parse(effect: Expression): Result<EffectAssignments, ParseError> {
    return parseConstruction(() => new EffectAssignments(effect));
  }

  covers(path: AttributePath): boolean {
    return this.#values.has(path);
  }

  *[Symbol.iterator](): Iterator<readonly [AttributePath, Expression]> {
    yield* this.#values;
  }
}
