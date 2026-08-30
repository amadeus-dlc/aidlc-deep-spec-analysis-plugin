// 要件イベント効果の代入分解 — eq(prime(ref), rhs) の連言だけを効果として
// 受理し、代入対象の要件属性ごとに項を返す。旧 reqEffectAssignments の逐語移植。

import type { Expression } from "../../kernel/domain/index.ts";
import { AlphaError } from "./alpha-substitution.ts";

export function reqEffectAssignments(effect: Expression): Map<string, Expression> {
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
  return assignments;
}
