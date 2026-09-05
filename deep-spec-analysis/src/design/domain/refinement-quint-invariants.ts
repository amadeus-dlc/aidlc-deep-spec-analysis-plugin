// Quint 側の refinement 追加不変量 — checkable な invariant/numeric 要件義務
// ごとの alpha(P)。ユニットの lowering に追加不変量として合流し、違反成分が
// これのトレースは「到達可能な refinement 破れ」になる。導出は
// UnitRefinementPlan#quintInvariants の振る舞い（OOUI 裁定）で、ここは型と
// ファーストクラスコレクションだけを持つ。

import type { RefinementQuintInvariant } from "./refinement-quint-invariant.ts";
import { SkipReason } from "@deep-spec/kernel-domain";
import { DesignFindings } from "./design-findings.ts";
import { DesignSkips } from "./design-skips.ts";
import { DesignSkipped } from "./design-skipped.ts";


// 追加不変量のファーストクラスコレクション（義務 id の正準順で導出される）。
export class RefinementQuintInvariants {
  readonly #values: readonly RefinementQuintInvariant[];

  private constructor(values: readonly RefinementQuintInvariant[]) {
    this.#values = values;
  }

  static of(values: readonly RefinementQuintInvariant[]): RefinementQuintInvariants {
    return new RefinementQuintInvariants([...values]);
  }

  add(value: RefinementQuintInvariant): RefinementQuintInvariants {
    return new RefinementQuintInvariants([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<RefinementQuintInvariant> {
    yield* this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }

  reqIds(): ReadonlySet<string> {
    return new Set(this.#values.map((e) => e.reqId().asString()));
  }

  // 追加した要件不変量の検査結果を、finding と skip を一組で解釈する。
  // 設計本体の記録は既に採用済みなので、追加要件に属するものだけを残す。
  interpret(findings: DesignFindings, skipped: DesignSkips, unit: string): { findings: DesignFindings; skipped: DesignSkips } {
    const reqIds = this.reqIds();
    let violations = DesignFindings.of([]);
    let pending = DesignSkips.of([...skipped].filter((s) => reqIds.has(s.target().asString())));
    let designConflict = false;
    for (const finding of findings) {
      if (!finding.isConflict()) continue;
      const violation = finding.asRefinementViolation(reqIds, unit);
      if (violation !== null) violations = violations.add(violation);
      else designConflict = true;
    }
    if (violations.isEmpty() && designConflict) {
      for (const invariant of this.#values) {
        if ([...pending].some((s) => s.isFor(invariant.reqTarget()))) continue;
        pending = pending.add(DesignSkipped.of({
          target: invariant.reqTarget(), reason: SkipReason.capability(), unit,
          detail: "the machine reachably violates its own design invariants first (see the design conflict findings) — refinement reachability is masked until those are resolved",
        }));
      }
    }
    return { findings: violations, skipped: pending };
  }

  toArray(): readonly RefinementQuintInvariant[] {
    return this.#values;
  }
}
