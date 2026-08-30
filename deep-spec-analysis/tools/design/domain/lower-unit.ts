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

export type LoweringKind = "passthrough" | "transition" | "ignore" | "vac-dead" | "vac-shadow";

export interface LoweredOrigin {
  design: string;
  kind: LoweringKind;
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
  readonly obligations: LoweredObligations;
  readonly scenarios: LoweredScenarios;
  readonly background: LoweredBackgrounds;
  readonly index: LoweringIndex;
}

// lowered 義務のファーストクラスコレクション。OB-n 採番順は文書バイトに
// 効く凍結面——順序保持で運ぶ。
export class LoweredObligations {
  readonly #values: readonly LoweredObligation[];

  private constructor(values: readonly LoweredObligation[]) {
    this.#values = values;
  }

  static of(values: readonly LoweredObligation[]): LoweredObligations {
    return new LoweredObligations([...values]);
  }

  add(value: LoweredObligation): LoweredObligations {
    return new LoweredObligations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<LoweredObligation> {
    yield* this.#values;
  }

  count(): number {
    return this.#values.length;
  }

  // 境界（serializer・テスト）専用のエスケープハッチ。
  toArray(): readonly LoweredObligation[] {
    return this.#values;
  }
}

// lowered シナリオのファーストクラスコレクション（SC-n 採番順を保持）。
export class LoweredScenarios {
  readonly #values: readonly LoweredScenario[];

  private constructor(values: readonly LoweredScenario[]) {
    this.#values = values;
  }

  static of(values: readonly LoweredScenario[]): LoweredScenarios {
    return new LoweredScenarios([...values]);
  }

  add(value: LoweredScenario): LoweredScenarios {
    return new LoweredScenarios([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<LoweredScenario> {
    yield* this.#values;
  }

  count(): number {
    return this.#values.length;
  }

  toArray(): readonly LoweredScenario[] {
    return this.#values;
  }
}

// lowered 背景のファーストクラスコレクション（BG-n 採番順を保持）。
export class LoweredBackgrounds {
  readonly #values: readonly LoweredBackground[];

  private constructor(values: readonly LoweredBackground[]) {
    this.#values = values;
  }

  static of(values: readonly LoweredBackground[]): LoweredBackgrounds {
    return new LoweredBackgrounds([...values]);
  }

  add(value: LoweredBackground): LoweredBackgrounds {
    return new LoweredBackgrounds([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<LoweredBackground> {
    yield* this.#values;
  }

  count(): number {
    return this.#values.length;
  }

  toArray(): readonly LoweredBackground[] {
    return this.#values;
  }
}

// SMT 変数名は設計 id の英数字化（remap の witness core 書き換えと同じ規則）。
function designToken(id: string): string {
  return id.replace(/[^A-Za-z0-9_]/g, "_");
}

// lowering 索引——lowered id と設計語彙（DOB/TR/SM/DSC id・機械・属性パス）の
// 対応を閉じ込める。remap はこの索引に「訊く」のではなく「頼む」：lowered id
// の設計帰属解決とテキスト書き換えは索引自身の振る舞い。
export class LoweringIndex {
  readonly #origins: ReadonlyMap<string, LoweredOrigin>;
  readonly #scenarioDesignIds: ReadonlyMap<string, string>;
  readonly #machinesByTransition: ReadonlyMap<string, DesignMachine>;
  readonly #attrPathsByMachine: ReadonlyMap<string, string>;

  private constructor(props: {
    origins: ReadonlyMap<string, LoweredOrigin>;
    scenarioDesignIds: ReadonlyMap<string, string>;
    machinesByTransition: ReadonlyMap<string, DesignMachine>;
    attrPathsByMachine: ReadonlyMap<string, string>;
  }) {
    this.#origins = props.origins;
    this.#scenarioDesignIds = props.scenarioDesignIds;
    this.#machinesByTransition = props.machinesByTransition;
    this.#attrPathsByMachine = props.attrPathsByMachine;
  }

  static of(props: {
    origins: ReadonlyMap<string, LoweredOrigin>;
    scenarioDesignIds: ReadonlyMap<string, string>;
    machinesByTransition: ReadonlyMap<string, DesignMachine>;
    attrPathsByMachine: ReadonlyMap<string, string>;
  }): LoweringIndex {
    return new LoweringIndex({
      origins: new Map(props.origins),
      scenarioDesignIds: new Map(props.scenarioDesignIds),
      machinesByTransition: new Map(props.machinesByTransition),
      attrPathsByMachine: new Map(props.attrPathsByMachine),
    });
  }

  originOf(loweredId: string): LoweredOrigin | null {
    return this.#origins.get(loweredId) ?? null;
  }

  // lowered 対象 → 設計帰属。義務・合成の origin → シナリオ → 逐語、の
  // 解決順は remap の凍結挙動。
  resolveDesignTarget(loweredId: string): { design: string; entry: LoweredOrigin | null } {
    const entry = this.#origins.get(loweredId) ?? null;
    if (entry) return { design: entry.design, entry };
    const dsc = this.#scenarioDesignIds.get(loweredId);
    if (dsc) return { design: dsc, entry: null };
    return { design: loweredId, entry: null };
  }

  // v1 detail 内の OB-n 参照を設計 id へ書き換える（"DOB-2" は \bOB-2\b
  // 境界を含まないため二重書き換えは起きない）。
  rewriteLoweredIds(text: string): string {
    return text.replace(/\bOB-([0-9]+)\b/g, (m, num) => this.#origins.get(`OB-${num}`)?.design ?? m);
  }

  // witness core のラベル内 OB_n トークンを設計 id の英数字化へ書き換える。
  rewriteLoweredIdTokens(label: string): string {
    return label.replace(/OB_([0-9]+)/g, (m, num) => {
      const entry = this.#origins.get(`OB-${num}`);
      return entry ? designToken(entry.design) : m;
    });
  }

  isTransition(designId: string): boolean {
    return this.#machinesByTransition.has(designId);
  }

  machineOfTransition(designId: string): DesignMachine | null {
    return this.#machinesByTransition.get(designId) ?? null;
  }

  attrPathOfMachine(machineId: string): string | null {
    return this.#attrPathsByMachine.get(machineId) ?? null;
  }

  // refinement 追加パス用：lowered id を素通し帰属として索引に足した新索引。
  withPassthrough(loweredId: string, designId: string): LoweringIndex {
    const origins = new Map(this.#origins);
    origins.set(loweredId, { design: designId, kind: "passthrough" });
    return new LoweringIndex({
      origins,
      scenarioDesignIds: this.#scenarioDesignIds,
      machinesByTransition: this.#machinesByTransition,
      attrPathsByMachine: this.#attrPathsByMachine,
    });
  }

  // 境界（テスト）専用のエスケープハッチ：帰属表の全エントリ。
  toOriginEntries(): readonly (readonly [string, LoweredOrigin])[] {
    return [...this.#origins.entries()];
  }
}

const eqRef = (path: string, prime: boolean, value: string): Expression => ({
  op: "eq",
  args: [{ op: "ref", path, ...(prime ? { prime: true } : {}) }, { op: "enum", value }],
});

export function lowerUnit(u: DesignUnit, opts: { synthetics: boolean }): LoweredUnit {
  const map = new Map<string, LoweredOrigin>();
  const scenarioMap = new Map<string, string>();
  const machineOfTransition = new Map<string, DesignMachine>();
  const attrPathOfMachine = new Map<string, string>();
  const obligations: LoweredObligation[] = [];
  let n = 0;
  const nextId = (): string => {
    n += 1;
    return `OB-${n}`;
  };
  const push = (ob: Omit<LoweredObligation, "id">, entry: LoweredOrigin): string => {
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

  return {
    obligations: LoweredObligations.of(obligations),
    scenarios: LoweredScenarios.of(scenarios),
    background: LoweredBackgrounds.of(background),
    index: LoweringIndex.of({
      origins: map,
      scenarioDesignIds: scenarioMap,
      machinesByTransition: machineOfTransition,
      attrPathsByMachine: attrPathOfMachine,
    }),
  };
}
