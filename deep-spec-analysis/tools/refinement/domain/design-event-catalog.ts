// 設計イベントカタログ — 遷移（暗黙 state==from ガード＋state'=to 代入）と
// event 義務を、ガード＋代入表（設計属性パス → prime なし右辺）へ落とす。
// enabledness とワンステップシミュレーションの素材。旧 designEventCatalog の
// 逐語移植。

import type { Expression } from "../../kernel/domain/index.ts";
import type { DesignUnit } from "../../design/domain/index.ts";
import { reqEffectAssignments } from "./effect-assignments.ts";

export interface DesignEvent {
  guard: Expression;
  effectAssign: Map<string, Expression>; // 設計属性パス → prime なし右辺
}

export function designEventCatalog(u: DesignUnit): Map<string, DesignEvent> {
  const out = new Map<string, DesignEvent>();
  const eqRef = (path: string, value: string): Expression => ({ op: "eq", args: [{ op: "ref", path }, { op: "enum", value }] });
  for (const sm of u.machines()) {
    const attrPath = `${sm.entity}.${sm.attribute}`;
    for (const tr of sm.transitions) {
      const guard: Expression = tr.guard ? { op: "and", args: [eqRef(attrPath, tr.from), tr.guard] } : eqRef(attrPath, tr.from);
      const effectAssign = new Map<string, Expression>();
      effectAssign.set(attrPath, { op: "enum", value: tr.to });
      if (tr.effect) {
        try {
          for (const [path, term] of reqEffectAssignments(tr.effect)) {
            const [a, b] = term.args ?? [];
            const rhs = a?.op === "ref" && a.prime === true ? b : a;
            if (rhs) effectAssign.set(path, rhs);
          }
        } catch {
          // コンパイルできない追加効果：設計パスが報告する。この遷移の
          // シミュレーションは下流の SMT コンパイルで fail closed になる。
        }
      }
      out.set(tr.id, { guard, effectAssign });
    }
  }
  for (const ob of u.obligations()) {
    if (ob.nature !== "event" || !ob.guard || !ob.effect) continue;
    const effectAssign = new Map<string, Expression>();
    try {
      for (const [path, term] of reqEffectAssignments(ob.effect)) {
        const [a, b] = term.args ?? [];
        const rhs = a?.op === "ref" && a.prime === true ? b : a;
        if (rhs) effectAssign.set(path, rhs);
      }
    } catch {
      continue;
    }
    out.set(ob.id, { guard: ob.guard, effectAssign });
  }
  return out;
}
