// 契約3 設計 IR（生 Json）→ Parameters<typeof DesignModel.compose>[0] の寛容パース。欠損・型不一致
// のエントリは黙って落とす（旧 parseDesignIr の凍結挙動——design-ir-valid
// センサーが別途厳密検査を担う）。集約として成立しない形は凍結文言の文字列で
// 返す。ユニットのソートは DesignModel.compose の不変条件。
// 旧 deep-spec-design-lib.ts の parseDesignIr からの逐語移植。

import { type Json, isObject, strArr } from "@deep-spec/kernel-infrastructure";
import { FrRefs, IrVersion, type Expression, TriggerName } from "@deep-spec/kernel-domain";
import { BrRefs, DesignBackgroundId, DesignBackgroundAssumption, DesignAttributeName, DesignEntityName, DesignMachineId, DesignObligationId, DesignObligationNature, DesignObligationOrigin, DesignScenarioId, DesignTransitionId, DesignIgnores, DesignTransitions, DesignUnits, InitialStates, DesignIgnore, DesignBackgroundAssumptions, DesignMachines, DesignObligations, DesignScenarios, DesignMachine, DesignObligation, DesignScenario, DesignTransition, DesignUnit,
  DesignModel,
} from "@deep-spec/design-domain";
import { parseDesignEntities } from "./design-entities-parser.ts";


export function parseDesignModel(raw: Json): Omit<Parameters<typeof DesignModel.compose>[0], "id" | "irHash" | "sourceDocument"> | string {
  if (!isObject(raw)) return "design IR is not a JSON object";
  if (raw.irKind !== "design") return 'document is not a design IR (missing `"irKind": "design"`)';
  const irVersion = IrVersion.parse(typeof raw.irVersion === "string" ? raw.irVersion : "");
  if (!irVersion.ok) return "design IR lacks a semver irVersion";
  if (!Array.isArray(raw.units) || raw.units.length === 0) return "design IR carries no units[]";
  const units: DesignUnit[] = [];
  for (const rawUnit of raw.units) {
    if (!isObject(rawUnit) || typeof rawUnit.unit !== "string") continue;
    const schema = isObject(rawUnit.schema) ? rawUnit.schema : {};
    const entities = parseDesignEntities(schema);
    const obligations: DesignObligation[] = [];
    for (const ob of Array.isArray(rawUnit.obligations) ? rawUnit.obligations : []) {
      if (!isObject(ob) || typeof ob.id !== "string" || typeof ob.nature !== "string") continue;
      obligations.push(DesignObligation.reconstitute({
        id: DesignObligationId.reconstitute(ob.id),
        nature: DesignObligationNature.reconstitute(ob.nature),
        origin: DesignObligationOrigin.reconstitute(typeof ob.origin === "string" ? ob.origin : ""),
        brRefs: BrRefs.reconstitute(strArr(ob.brRefs)),
        frRefs: FrRefs.reconstitute(strArr(ob.frRefs)),
        assert: isObject(ob.assert) ? (ob.assert as unknown as Expression) : undefined,
        trigger: typeof ob.trigger === "string" ? TriggerName.reconstitute(ob.trigger) : undefined,
        guard: isObject(ob.guard) ? (ob.guard as unknown as Expression) : undefined,
        effect: isObject(ob.effect) ? (ob.effect as unknown as Expression) : undefined,
        temporal: isObject(ob.temporal) ? (ob.temporal as unknown as { pattern: string; assert?: Expression; from?: Expression; to?: Expression }) : undefined,
      }));
    }
    const machines: DesignMachine[] = [];
    for (const sm of Array.isArray(rawUnit.stateMachines) ? rawUnit.stateMachines : []) {
      if (!isObject(sm) || typeof sm.id !== "string" || typeof sm.entity !== "string" || typeof sm.attribute !== "string") continue;
      const transitions: DesignTransition[] = [];
      for (const tr of Array.isArray(sm.transitions) ? sm.transitions : []) {
        if (!isObject(tr) || typeof tr.id !== "string") continue;
        if (typeof tr.from !== "string" || typeof tr.to !== "string" || typeof tr.trigger !== "string") continue;
        transitions.push(DesignTransition.reconstitute({
          id: DesignTransitionId.reconstitute(tr.id),
          from: tr.from,
          to: tr.to,
          trigger: TriggerName.reconstitute(tr.trigger),
          guard: isObject(tr.guard) ? (tr.guard as unknown as Expression) : undefined,
          effect: isObject(tr.effect) ? (tr.effect as unknown as Expression) : undefined,
          brRefs: BrRefs.reconstitute(strArr(tr.brRefs)),
        }));
      }
      const ignores: DesignIgnore[] = [];
      for (const ig of Array.isArray(sm.ignores) ? sm.ignores : []) {
        if (!isObject(ig) || typeof ig.state !== "string" || typeof ig.trigger !== "string") continue;
        ignores.push(DesignIgnore.reconstitute({ state: ig.state, trigger: TriggerName.reconstitute(ig.trigger) }));
      }
      machines.push(
        DesignMachine.reconstitute({
          id: DesignMachineId.reconstitute(sm.id),
          entity: DesignEntityName.reconstitute(sm.entity),
          attribute: DesignAttributeName.reconstitute(sm.attribute),
          initial: InitialStates.of(strArr(sm.initial)),
          transitions: DesignTransitions.of(transitions),
          ignores: DesignIgnores.of(ignores),
          deterministic: sm.deterministic !== false,
        }),
      );
    }
    const scenarios: DesignScenario[] = [];
    for (const sc of Array.isArray(rawUnit.scenarios) ? rawUnit.scenarios : []) {
      if (!isObject(sc) || typeof sc.id !== "string") continue;
      const kind = sc.kind === "accept" || sc.kind === "reject" ? sc.kind : null;
      if (kind === null || !isObject(sc.bindings)) continue;
      const bindings: Record<string, boolean | number | string> = {};
      for (const [k, v] of Object.entries(sc.bindings)) {
        if (typeof v === "boolean" || typeof v === "number" || typeof v === "string") bindings[k] = v;
      }
      scenarios.push(DesignScenario.reconstitute({
        id: DesignScenarioId.reconstitute(sc.id),
        kind,
        brRefs: BrRefs.reconstitute(strArr(sc.brRefs)),
        frRefs: FrRefs.reconstitute(strArr(sc.frRefs)),
        bindings,
        event: isObject(sc.event) && typeof sc.event.trigger === "string" ? { trigger: TriggerName.reconstitute(sc.event.trigger) } : undefined,
        expect: isObject(sc.expect) ? (sc.expect as unknown as Expression) : undefined,
      }));
    }
    const background: DesignBackgroundAssumption[] = [];
    for (const bg of Array.isArray(rawUnit.background) ? rawUnit.background : []) {
      if (!isObject(bg) || typeof bg.id !== "string" || !isObject(bg.assert)) continue;
      background.push(DesignBackgroundAssumption.reconstitute({ id: DesignBackgroundId.reconstitute(bg.id), assert: bg.assert as unknown as Expression }));
    }
    units.push(
      DesignUnit.reconstitute({
        unit: rawUnit.unit,
        entities,
        obligations: DesignObligations.of(obligations),
        machines: DesignMachines.of(machines),
        scenarios: DesignScenarios.of(scenarios),
        background: DesignBackgroundAssumptions.of(background),
      }),
    );
  }
  if (units.length === 0) return "design IR carries no parseable units";
  return { irVersion: irVersion.value, units: DesignUnits.of(units) };
}
