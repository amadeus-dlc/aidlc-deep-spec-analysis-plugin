import { InitialState } from "@deep-spec/design-domain";
import { decodeScenarioBindings } from "@deep-spec/kernel-adapter";
import { UnitName, RequirementId, FunctionalRequirementReferences, IrVersion, type Expression, TriggerName } from "@deep-spec/kernel-domain";
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
// センサーが別途厳密検査を担う）。集約として成立しない形はResultのエラーで返す。ユニットのソートは DesignModel.compose の不変条件。
// 旧 deep-spec-design-lib.ts の parseDesignIr からの逐語移植。

import { type Json, type Result, err, combineResults, traverseResult, ok, isObject, strArr } from "@deep-spec/kernel-infrastructure";

import { parseDesignEntities } from "./design-entities-parser.ts";

export function parseDesignModel(raw: Json): Result<Omit<Parameters<typeof DesignModel.compose>[0], "id" | "irHash" | "sourceDocument">, string> {
  if (!isObject(raw)) return err("design IR is not a JSON object");
  if (raw.irKind !== "design") return err('document is not a design IR (missing `"irKind": "design"`)');
  const irVersion = IrVersion.parse(typeof raw.irVersion === "string" ? raw.irVersion : "");
  if (!irVersion.ok) return err("design IR lacks a semver irVersion");
  if (!Array.isArray(raw.units) || raw.units.length === 0) return err("design IR carries no units[]");
  const units: DesignUnit[] = [];
  for (const rawUnit of raw.units) {
    if (!isObject(rawUnit) || typeof rawUnit.unit !== "string") continue;
    const schema = isObject(rawUnit.schema) ? rawUnit.schema : {};
    const entities = parseDesignEntities(schema);
    if (!entities.ok) return err(JSON.stringify(entities.error));
    const unit = UnitName.parse(rawUnit.unit);
    if (!unit.ok) return err(JSON.stringify(unit.error));
    const obligations: DesignObligation[] = [];
    for (const ob of Array.isArray(rawUnit.obligations) ? rawUnit.obligations : []) {
      if (!isObject(ob) || typeof ob.id !== "string" || typeof ob.nature !== "string") continue;
      const parsed = combineResults({
        id: DesignObligationId.parse(ob.id),
        origin: DesignObligationOrigin.parse(typeof ob.origin === "string" ? ob.origin : ""),
        nature: DesignObligationNature.parse(ob.nature),
        brRefs: traverseResult(strArr(ob.brRefs), BrRef.parse),
        frRefs: traverseResult(strArr(ob.frRefs), RequirementId.parse),
        trigger: typeof ob.trigger === "string" ? TriggerName.parse(ob.trigger) : ok(undefined),
      });
      if (!parsed.ok) return err(JSON.stringify(parsed.error));
      obligations.push(DesignObligation.of({
        id: parsed.value.id,
        nature: parsed.value.nature,
        origin: parsed.value.origin,
        brRefs: BrRefs.of(parsed.value.brRefs),
        functionalRequirementReferences: FunctionalRequirementReferences.of(parsed.value.frRefs),
        assert: isObject(ob.assert) ? (ob.assert as unknown as Expression) : undefined,
        trigger: parsed.value.trigger,
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
        const parsed = combineResults({
          id: DesignTransitionId.parse(tr.id),
          trigger: TriggerName.parse(tr.trigger),
          brRefs: traverseResult(strArr(tr.brRefs), BrRef.parse),
        });
        if (!parsed.ok) return err(JSON.stringify(parsed.error));
        transitions.push(DesignTransition.of({
          id: parsed.value.id,
          from: tr.from,
          to: tr.to,
          trigger: parsed.value.trigger,
          guard: isObject(tr.guard) ? (tr.guard as unknown as Expression) : undefined,
          effect: isObject(tr.effect) ? (tr.effect as unknown as Expression) : undefined,
          brRefs: BrRefs.of(parsed.value.brRefs),
        }));
      }
      const ignores: DesignIgnore[] = [];
      for (const ig of Array.isArray(sm.ignores) ? sm.ignores : []) {
        if (!isObject(ig) || typeof ig.state !== "string" || typeof ig.trigger !== "string") continue;
        const trigger = TriggerName.parse(ig.trigger);
        if (!trigger.ok) return err(JSON.stringify(trigger.error));
        ignores.push(DesignIgnore.of({ state: ig.state, trigger: trigger.value }));
      }
      const parsed = combineResults({
        id: DesignMachineId.parse(sm.id),
        initial: traverseResult(strArr(sm.initial), InitialState.parse),
        entity: DesignEntityName.parse(sm.entity),
        attribute: DesignAttributeName.parse(sm.attribute),
      });
      if (!parsed.ok) return err(JSON.stringify(parsed.error));
      machines.push(
        DesignMachine.of({
          id: parsed.value.id,
          entity: parsed.value.entity,
          attribute: parsed.value.attribute,
          initial: InitialStates.of(parsed.value.initial),
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
      const parsed = combineResults({
        id: DesignScenarioId.parse(sc.id),
      bindings: decodeScenarioBindings(sc.bindings),
        brRefs: traverseResult(strArr(sc.brRefs), BrRef.parse),
        frRefs: traverseResult(strArr(sc.frRefs), RequirementId.parse),
        trigger: isObject(sc.event) && typeof sc.event.trigger === "string" ? TriggerName.parse(sc.event.trigger) : ok(undefined),
      });
      if (!parsed.ok) return err(JSON.stringify(parsed.error));
      scenarios.push(DesignScenario.of({
        id: parsed.value.id,
        kind,
        brRefs: BrRefs.of(parsed.value.brRefs),
        functionalRequirementReferences: FunctionalRequirementReferences.of(parsed.value.frRefs),
        bindings: parsed.value.bindings,
        event: parsed.value.trigger === undefined ? undefined : { trigger: parsed.value.trigger },
        expect: isObject(sc.expect) ? (sc.expect as unknown as Expression) : undefined,
      }));
    }
    const background: DesignBackgroundAssumption[] = [];
    for (const bg of Array.isArray(rawUnit.background) ? rawUnit.background : []) {
      if (!isObject(bg) || typeof bg.id !== "string" || !isObject(bg.assert)) continue;
      const id = DesignBackgroundId.parse(bg.id);
      if (!id.ok) return err(JSON.stringify(id.error));
      background.push(DesignBackgroundAssumption.of({ id: id.value, assert: bg.assert as unknown as Expression }));
    }
    units.push(
      DesignUnit.of({
        unit: unit.value.asString(),
        entities: entities.value,
        obligations: DesignObligations.of(obligations),
        machines: DesignMachines.of(machines),
        scenarios: DesignScenarios.of(scenarios),
        background: DesignBackgroundAssumptions.of(background),
      }),
    );
  }
  if (units.length === 0) return err("design IR carries no parseable units");
  return ok({ irVersion: irVersion.value, units: DesignUnits.of(units) });
}
