// 要件イベント効果の代入分解 — eq(prime(ref), rhs) の連言だけを効果として
// 受理し、代入対象の要件属性ごとに項を持つ。旧 reqEffectAssignments の
// 逐語移植——自由関数は EffectAssignments.ofEffect（構築）と自身の照会に
// なった（OOUI 裁定）。

import type { Expression } from "../../kernel/domain/index.ts";
import { AlphaError } from "./alpha-substitution.ts";

export class EffectAssignments {
  readonly #values: ReadonlyMap<string, Expression>;

  private constructor(values: ReadonlyMap<string, Expression>) {
    this.#values = values;
  }

  // 効果式を分解して構築する。連言の primed 代入以外は AlphaError（凍結文言）。
  static ofEffect(effect: Expression): EffectAssignments {
    const assignments = new Map<string, Expression>();
    const terms: Expression[] = [];
    const flatten = (e: Expression): void => {
      if (e.op === "and") for (const a of e.args ?? []) flatten(a);
      else terms.push(e);
    };
    flatten(effect);
    for (const term of terms) {
      if (term.op !== "eq") throw new AlphaError("requirements effect is not a conjunction of primed assignments");
      const [a, b] = term.args ?? [];
      const target = a?.op === "ref" && a.prime === true ? a : b?.op === "ref" && b.prime === true ? b : null;
      if (!target || typeof target.path !== "string") throw new AlphaError("requirements effect is not a conjunction of primed assignments");
      assignments.set(target.path, term);
    }
    return new EffectAssignments(assignments);
  }

  covers(path: string): boolean {
    return this.#values.has(path);
  }

  *[Symbol.iterator](): Iterator<readonly [string, Expression]> {
    yield* this.#values.entries();
  }
}
