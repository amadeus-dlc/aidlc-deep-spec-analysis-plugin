// DesignEventCatalog — 設計ユニットのイベント（遷移と guard/effect つき義務）を
// design id → DesignEvent に引く索引。キーは TargetIdentifier（遷移 id と義務 id の
// 混成）、内側は KeyedIndex（裁定 3-1、2026-09-03）。効果は属性パス → 右辺式に
// 解いて持つ（明示効果が代入の連言でなければその項を落とす——凍結挙動）。

import type { DesignUnit } from "@deep-spec/design-domain";
import { DesignMachines } from "@deep-spec/design-domain";
import { AttributePath, type Expression, KeyedIndex, TargetIdentifier } from "@deep-spec/kernel-domain";
import { DesignAssignments } from "./design-assignments.ts";
import { DesignEvent } from "./design-event.ts";
import { EffectAssignments } from "./effect-assignments.ts";

function rhsOf(term: Expression): Expression | undefined {
  const [a, b] = term.args ?? [];
  return a?.op === "ref" && a.prime === true ? b : a;
}

export class DesignEventCatalog {
  readonly #events: KeyedIndex<TargetIdentifier, DesignEvent>;

  private constructor(events: KeyedIndex<TargetIdentifier, DesignEvent>) {
    this.#events = events;
  }

  static of(u: DesignUnit): DesignEventCatalog {
    const out: (readonly [TargetIdentifier, DesignEvent])[] = [];
    for (const sm of u.machines()) {
      const attrPath = DesignMachines.attrPathOf(sm);
      for (const tr of sm.transitions()) {
        const guard: Expression = tr.loweredGuard(attrPath);
        const effectAssign: (readonly [AttributePath, Expression])[] = [];
        const [statePath, stateRhs] = tr.stateAssignment(attrPath);
        effectAssign.push([AttributePath.of(statePath), stateRhs]);
        const explicitEffect = tr.effect();
        if (explicitEffect !== undefined) {
          const assigned = EffectAssignments.parse(explicitEffect);
          if (assigned.ok) {
            for (const [path, term] of assigned.value) {
              const rhs = rhsOf(term);
              if (rhs) effectAssign.push([path, rhs]);
            }
          }
        }
        out.push([
          TargetIdentifier.of(tr.id().asString()),
          DesignEvent.of(guard, DesignAssignments.of(KeyedIndex.of(effectAssign))),
        ]);
      }
    }
    for (const ob of u.obligations()) {
      const event = ob.guardedEffect();
      if (event === null) continue;
      const effectAssign: (readonly [AttributePath, Expression])[] = [];
      const assigned = EffectAssignments.parse(event.effect);
      if (!assigned.ok) continue;
      for (const [path, term] of assigned.value) {
        const rhs = rhsOf(term);
        if (rhs) effectAssign.push([path, rhs]);
      }
      out.push([
        TargetIdentifier.of(ob.id().asString()),
        DesignEvent.of(event.guard, DesignAssignments.of(KeyedIndex.of(effectAssign))),
      ]);
    }
    return new DesignEventCatalog(KeyedIndex.of(out));
  }

  eventOf(id: TargetIdentifier): DesignEvent | null {
    return this.#events.get(id) ?? null;
  }
}
