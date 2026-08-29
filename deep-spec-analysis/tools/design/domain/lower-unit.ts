// lowering — 設計ユニット（契約3）を契約1 の要件 IR へ落とす COMPILE-DOWN
// REUSE の中核。遷移は state==from の暗黙ガードと state'=to の効果を持つ
// event 義務へ、ignores は明示 no-op event へ（意図された沈黙が gap /
// deadlock として読まれないように）。設計だけの 2 検査は合成トートロジー
// 不変量で v1 の前件空虚クエリに相乗りする：
//   unreachable — implies(guard, true)：前件（ガード）の非充足性が死そのもの
//   redundancy  — implies(and(guardB, not(guardA)), true)：空虚性が
//                 guardB => guardA を証明し、効果が正準同一なら B は包摂される
// 合成不変量はトートロジーなので、大域・gap・シナリオの判定を変えない。
// OB-n / SC-n / BG-n の採番・整列順は文書バイト（子の処理順）に効く凍結面。
// 旧 deep-spec-design-lib.ts の lowerUnit からの逐語移植（Json 組み立ては
// アダプタの serializer が担い、ここは型付き lowering を返す）。

import { idCompare } from "../../kernel/domain/index.ts";
import type { Expression } from "../../kernel/domain/index.ts";
import type { DesignMachine } from "./design-machine.ts";
import type { DesignObligation } from "./design-obligation.ts";
import type { DesignUnit } from "./design-unit.ts";
import { expressionCanonicalKey } from "./expression-canonical-key.ts";

export type LowKind = "passthrough" | "transition" | "ignore" | "vac-dead" | "vac-shadow";

export interface LowEntry {
  design: string;
  kind: LowKind;
  pair?: [string, string];
}

export interface LoweredObligation {
  id: string;
  nature: string;
  frRefs: string[];
  assert?: Expression;
  trigger?: string;
  guard?: Expression;
  effect?: Expression;
  temporal?: DesignObligation["temporal"];
}

export interface LoweredScenario {
  id: string;
  kind: "accept" | "reject";
  frRefs: string[];
  bindings: { [path: string]: boolean | number | string };
  event?: { trigger: string };
  expect?: Expression;
}

export interface LoweredBackground {
  id: string;
  assert: Expression;
}

export interface LoweredUnit {
  obligations: LoweredObligation[];
  scenarios: LoweredScenario[];
  background: LoweredBackground[];
  map: Map<string, LowEntry>;
  scenarioMap: Map<string, string>;
  machineOfTransition: Map<string, DesignMachine>;
  attrPathOfMachine: Map<string, string>;
}

const eqRef = (path: string, prime: boolean, value: string): Expression => ({
  op: "eq",
  args: [{ op: "ref", path, ...(prime ? { prime: true } : {}) }, { op: "enum", value }],
});

export function lowerUnit(u: DesignUnit, opts: { synthetics: boolean }): LoweredUnit {
  const map = new Map<string, LowEntry>();
  const scenarioMap = new Map<string, string>();
  const machineOfTransition = new Map<string, DesignMachine>();
  const attrPathOfMachine = new Map<string, string>();
  const obligations: LoweredObligation[] = [];
  let n = 0;
  const nextId = (): string => {
    n += 1;
    return `OB-${n}`;
  };
  const push = (ob: Omit<LoweredObligation, "id">, entry: LowEntry): string => {
    const id = nextId();
    obligations.push({ id, ...ob });
    map.set(id, entry);
    return id;
  };

  interface EventCandidate {
    lowId: string;
    design: string;
    trigger: string;
    guard: Expression;
    effect: Expression;
  }
  const candidates: EventCandidate[] = [];

  // 1) 設計義務は素通し（frRefs は帰属のため保持。空の frRefs は lowered
  //    文書で適法——v1 バックエンドは frRefs を不透明な帰属文字列として扱う）。
  for (const ob of [...u.obligations()].sort((a, b) => idCompare(a.id, b.id))) {
    const lowered: Omit<LoweredObligation, "id"> = {
      nature: ob.nature,
      frRefs: ob.frRefs,
    };
    if (ob.assert) lowered.assert = ob.assert;
    if (ob.trigger !== undefined) lowered.trigger = ob.trigger;
    if (ob.guard) lowered.guard = ob.guard;
    if (ob.effect) lowered.effect = ob.effect;
    if (ob.temporal) lowered.temporal = ob.temporal;
    const lowId = push(lowered, { design: ob.id, kind: "passthrough" });
    if (ob.nature === "event" && ob.guard && ob.effect && ob.trigger) {
      candidates.push({ lowId, design: ob.id, trigger: ob.trigger, guard: ob.guard, effect: ob.effect });
    }
  }

  // 2) 状態機械のコンパイルダウン：遷移 → 暗黙ガード・効果つき event 義務、
  //    ignores → 明示 no-op event。
  for (const sm of [...u.machines()].sort((a, b) => idCompare(a.id, b.id))) {
    const attrPath = `${sm.entity}.${sm.attribute}`;
    attrPathOfMachine.set(sm.id, attrPath);
    for (const tr of [...sm.transitions].sort((a, b) => idCompare(a.id, b.id))) {
      const guard: Expression = tr.guard ? { op: "and", args: [eqRef(attrPath, false, tr.from), tr.guard] } : eqRef(attrPath, false, tr.from);
      const effect: Expression = tr.effect ? { op: "and", args: [eqRef(attrPath, true, tr.to), tr.effect] } : eqRef(attrPath, true, tr.to);
      const lowId = push(
        { nature: "event", frRefs: [], trigger: tr.trigger, guard, effect },
        { design: tr.id, kind: "transition" },
      );
      machineOfTransition.set(tr.id, sm);
      candidates.push({ lowId, design: tr.id, trigger: tr.trigger, guard, effect });
    }
    const sortedIgnores = [...sm.ignores].sort((a, b) => (`${a.state}/${a.trigger}` < `${b.state}/${b.trigger}` ? -1 : 1));
    for (const ig of sortedIgnores) {
      const effect: Expression = { op: "eq", args: [{ op: "ref", path: attrPath, prime: true }, { op: "ref", path: attrPath }] };
      push(
        { nature: "event", frRefs: [], trigger: ig.trigger, guard: eqRef(attrPath, false, ig.state), effect },
        { design: sm.id, kind: "ignore" },
      );
    }
  }

  // 3) 合成トートロジー（SMT lowering のみ）：死ガードと包摂が v1 の前件
  //    空虚検査に相乗りする。
  if (opts.synthetics) {
    for (const c of candidates) {
      push(
        { nature: "invariant", frRefs: [], assert: { op: "implies", args: [c.guard, { op: "bool", value: true }] } },
        { design: c.design, kind: "vac-dead" },
      );
    }
    const byTrigger = new Map<string, EventCandidate[]>();
    for (const c of candidates) {
      const list = byTrigger.get(c.trigger) ?? [];
      list.push(c);
      byTrigger.set(c.trigger, list);
    }
    for (const trigger of [...byTrigger.keys()].sort()) {
      const list = byTrigger.get(trigger) ?? [];
      for (const a of list) {
        for (const b of list) {
          if (a === b) continue;
          if (expressionCanonicalKey(a.effect) !== expressionCanonicalKey(b.effect)) continue;
          // (guardB and not guardA) の空虚性は guardB => guardA を証明する：
          // b は a に包摂される（同トリガ・証明可能に狭いガード・同一効果）。
          push(
            {
              nature: "invariant",
              frRefs: [],
              assert: {
                op: "implies",
                args: [{ op: "and", args: [b.guard, { op: "not", args: [a.guard] }] }, { op: "bool", value: true }],
              },
            },
            { design: `${a.design}|${b.design}`, kind: "vac-shadow", pair: [a.design, b.design] },
          );
        }
      }
    }
  }

  // 4) シナリオと背景。
  const scenarios: LoweredScenario[] = [];
  let scN = 0;
  for (const sc of [...u.scenarios()].sort((a, b) => idCompare(a.id, b.id))) {
    scN += 1;
    const lowId = `SC-${scN}`;
    scenarioMap.set(lowId, sc.id);
    const lowered: LoweredScenario = {
      id: lowId,
      kind: sc.kind,
      frRefs: sc.frRefs,
      bindings: sc.bindings,
    };
    if (sc.event) lowered.event = sc.event;
    if (sc.expect) lowered.expect = sc.expect;
    scenarios.push(lowered);
  }
  const background: LoweredBackground[] = [];
  let bgN = 0;
  for (const bg of [...u.background()].sort((a, b) => idCompare(a.id, b.id))) {
    bgN += 1;
    background.push({ id: `BG-${bgN}`, assert: bg.assert });
  }

  return { obligations, scenarios, background, map, scenarioMap, machineOfTransition, attrPathOfMachine };
}
