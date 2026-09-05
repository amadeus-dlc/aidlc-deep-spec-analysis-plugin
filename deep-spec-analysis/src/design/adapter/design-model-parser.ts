import { decodeDomainValues } from "@deep-spec/kernel-adapter";
import { RequirementId, FrRefs, IrVersion, type Expression, TriggerName } from "@deep-spec/kernel-domain";
import {
  BrRef,
  BrRefs,
  DesignBackgroundId,
  DesignBackgroundAssumption,
  DesignAttributeName,
  DesignEntityName,
  DesignMachineId,
  DesignObligationId,
  DesignObligationNature,
  DesignObligationOrigin,
  DesignScenarioId,
  DesignTransitionId,
  DesignIgnores,
  DesignTransitions,
  DesignUnits,
  InitialStates,
  DesignIgnore,
  DesignBackgroundAssumptions,
  DesignMachines,
  DesignObligations,
  DesignScenarios,
  DesignMachine,
  DesignObligation,
  DesignScenario,
  DesignTransition,
  DesignUnit,
  DesignModel,
} from "@deep-spec/design-domain";

// 契約3 設計 IR（生 Json）→ Parameters<typeof DesignModel.compose>[0] の寛容パース。欠損・型不一致
// のエントリは黙って落とす（旧 parseDesignIr の凍結挙動——design-ir-valid
// センサーが別途厳密検査を担う）。集約として成立しない形は凍結文言の文字列で
// 返す。ユニットのソートは DesignModel.compose の不変条件。
// 旧 deep-spec-design-lib.ts の parseDesignIr からの逐語移植。

import { type Json, isObject, strArr } from "@deep-spec/kernel-infrastructure";

import { parseDesignEntities } from "./design-entities-parser.ts";

export function parseDesignModel(raw: Json): ReturnType<typeof parseDesignModelValue> {
  const decoded = decodeDomainValues(() => parseDesignModelValue(raw));
  return decoded.ok ? decoded.value : decoded.error;
}

function parseDesignModelValue(raw: Json): Omit<Parameters<typeof DesignModel.compose>[0], "id" | "irHash" | "sourceDocument"> | string {
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
      obligations.push(DesignObligation.of({
        id: DesignObligationId.of(ob.id),
        nature: DesignObligationNature.of(ob.nature),
        origin: DesignObligationOrigin.of(typeof ob.origin === "string" ? ob.origin : ""),
        brRefs: BrRefs.of(Array.from(strArr(ob.brRefs), (raw) => BrRef.of(raw))),
        frRefs: FrRefs.of(Array.from(strArr(ob.frRefs), (raw) => RequirementId.of(raw))),
        assert: isObject(ob.assert) ? (ob.assert as unknown as Expression) : undefined,
        trigger: typeof ob.trigger === "string" ? TriggerName.of(ob.trigger) : undefined,
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
        transitions.push(DesignTransition.of({
          id: DesignTransitionId.of(tr.id),
          from: tr.from,
          to: tr.to,
          trigger: TriggerName.of(tr.trigger),
          guard: isObject(tr.guard) ? (tr.guard as unknown as Expression) : undefined,
          effect: isObject(tr.effect) ? (tr.effect as unknown as Expression) : undefined,
          brRefs: BrRefs.of(Array.from(strArr(tr.brRefs), (raw) => BrRef.of(raw))),
        }));
      }
      const ignores: DesignIgnore[] = [];
      for (const ig of Array.isArray(sm.ignores) ? sm.ignores : []) {
        if (!isObject(ig) || typeof ig.state !== "string" || typeof ig.trigger !== "string") continue;
        ignores.push(DesignIgnore.of({ state: ig.state, trigger: TriggerName.of(ig.trigger) }));
      }
      machines.push(
        DesignMachine.of({
          id: DesignMachineId.of(sm.id),
          entity: DesignEntityName.of(sm.entity),
          attribute: DesignAttributeName.of(sm.attribute),
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
      scenarios.push(DesignScenario.of({
        id: DesignScenarioId.of(sc.id),
        kind,
        brRefs: BrRefs.of(Array.from(strArr(sc.brRefs), (raw) => BrRef.of(raw))),
        frRefs: FrRefs.of(Array.from(strArr(sc.frRefs), (raw) => RequirementId.of(raw))),
        bindings,
        event: isObject(sc.event) && typeof sc.event.trigger === "string" ? { trigger: TriggerName.of(sc.event.trigger) } : undefined,
        expect: isObject(sc.expect) ? (sc.expect as unknown as Expression) : undefined,
      }));
    }
    const background: DesignBackgroundAssumption[] = [];
    for (const bg of Array.isArray(rawUnit.background) ? rawUnit.background : []) {
      if (!isObject(bg) || typeof bg.id !== "string" || !isObject(bg.assert)) continue;
      background.push(DesignBackgroundAssumption.of({ id: DesignBackgroundId.of(bg.id), assert: bg.assert as unknown as Expression }));
    }
    units.push(
      DesignUnit.of({
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
