// EffectAssignments — 効果式（prime 代入の連言）を属性パス → 代入項の索引に
// 解いたもの。キーは AttributePath、内側は KeyedIndex（裁定 3-1、2026-09-03）。
// 連言でない・代入でない効果は RefinementMapDefect として Result で返す
//（裁定 15）。同じ属性への重複代入は後勝ち（Map と同じ——位置は最初のまま、
// 凍結挙動）。

import { AttributePath, KeyedIndex, type Expression } from "../../kernel/domain/index.ts";
import { type Result, err, ok } from "../../kernel/infrastructure/index.ts";
import { RefinementMapDefect } from "./refinement-map-defect.ts";

export class EffectAssignments {
  readonly #values: KeyedIndex<AttributePath, Expression>;

  private constructor(values: KeyedIndex<AttributePath, Expression>) {
    this.#values = values;
  }

  static ofEffect(effect: Expression): Result<EffectAssignments, RefinementMapDefect> {
    const assignments: (readonly [AttributePath, Expression])[] = [];
    const terms: Expression[] = [];
    const flatten = (e: Expression): void => {
      if (e.op === "and") for (const a of e.args ?? []) flatten(a);
      else terms.push(e);
    };
    flatten(effect);
    for (const term of terms) {
      if (term.op !== "eq") return err(RefinementMapDefect.effectNotAssignmentConjunction());
      const [a, b] = term.args ?? [];
      const target = a?.op === "ref" && a.prime === true ? a : b?.op === "ref" && b.prime === true ? b : null;
      if (!target || typeof target.path !== "string") return err(RefinementMapDefect.effectNotAssignmentConjunction());
      assignments.push([AttributePath.reconstitute(target.path), term]);
    }
    return ok(new EffectAssignments(KeyedIndex.of(assignments)));
  }

  covers(path: AttributePath): boolean {
    return this.#values.has(path);
  }

  *[Symbol.iterator](): Iterator<readonly [AttributePath, Expression]> {
    yield* this.#values;
  }
}
