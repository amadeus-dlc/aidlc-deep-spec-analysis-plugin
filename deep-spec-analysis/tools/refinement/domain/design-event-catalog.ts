// 設計イベントカタログ — 遷移（暗黙 state==from ガード＋state'=to 代入）と
// event 義務を、ガード＋代入表（設計属性パス → prime なし右辺）へ落とす。
// enabledness とワンステップシミュレーションの素材。旧 designEventCatalog の
// 逐語移植——自由関数は DesignEventCatalog.of（構築）と自身の照会になった
// （OOUI 裁定）。

import type { Expression } from "../../kernel/domain/index.ts";
import { DesignMachines } from "../../design/domain/index.ts";
import type { DesignUnit } from "../../design/domain/index.ts";
import { EffectAssignments } from "./effect-assignments.ts";
import { DesignAssignments } from "./design-assignments.ts";
import { DesignEvent } from "./design-event.ts";



export class DesignEventCatalog {
  readonly #events: ReadonlyMap<string, DesignEvent>;

  private constructor(events: ReadonlyMap<string, DesignEvent>) {
    this.#events = events;
  }

  // 旧 designEventCatalog 本体の逐語移植。
  static of(u: DesignUnit): DesignEventCatalog {
    const out = new Map<string, DesignEvent>();
    for (const sm of u.machines()) {
      const attrPath = DesignMachines.attrPathOf(sm);
      for (const tr of sm.transitions()) {
        const guard: Expression = tr.loweredGuard(attrPath);
        const effectAssign = new Map<string, Expression>();
        effectAssign.set(...tr.stateAssignment(attrPath));
        const explicitEffect = tr.effect();
        if (explicitEffect !== undefined) {
          try {
            for (const [path, term] of EffectAssignments.ofEffect(explicitEffect)) {
              const [a, b] = term.args ?? [];
              const rhs = a?.op === "ref" && a.prime === true ? b : a;
              if (rhs) effectAssign.set(path, rhs);
            }
          } catch {
            // コンパイルできない追加効果：設計パスが報告する。この遷移の
            // シミュレーションは下流の SMT コンパイルで fail closed になる。
          }
        }
        out.set(tr.id().asString(), DesignEvent.of(guard, DesignAssignments.of(effectAssign)));
      }
    }
    for (const ob of u.obligations()) {
      const event = ob.guardedEffect();
      if (event === null) continue;
      const effectAssign = new Map<string, Expression>();
      try {
        for (const [path, term] of EffectAssignments.ofEffect(event.effect)) {
          const [a, b] = term.args ?? [];
          const rhs = a?.op === "ref" && a.prime === true ? b : a;
          if (rhs) effectAssign.set(path, rhs);
        }
      } catch {
        continue;
      }
      out.set(ob.id().asString(), DesignEvent.of(event.guard, DesignAssignments.of(effectAssign)));
    }
    return new DesignEventCatalog(out);
  }

  eventOf(id: string): DesignEvent | null {
    return this.#events.get(id) ?? null;
  }
}
