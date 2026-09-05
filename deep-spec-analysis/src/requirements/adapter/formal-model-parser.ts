import { decodeScenarioBindings } from "@deep-spec/kernel-adapter";
import {
  EnumerationMember,
  EnumerationMembers,
  type Expression,
  IntermediateRepresentationVersion,
  RequirementIdentifier,
  TriggerName,
} from "@deep-spec/kernel-domain";
import { flatMapResult } from "@deep-spec/kernel-infrastructure";

// 契約1 IR（生 Json）→ Parameters<typeof RequirementsModel.of>[0] の寛容パース。欠損・型不一致の
// エントリは黙って落とす（旧 parseIr の凍結挙動——ir-valid センサーが別途
// 厳密検査を担う）。集約として成立しない形はResultのエラーで返す。
// 旧 aidlc-sensor-deep-spec-verify-smt.ts の parseIr からの逐語移植。

import {
  combineResults,
  err,
  isObject,
  type Json,
  ok,
  type Result,
  strArr,
  traverseResult,
} from "@deep-spec/kernel-infrastructure";

import {
  AttributeBound,
  AttributePath,
  BackgroundAssumption,
  BackgroundAssumptionIdentifier,
  BackgroundAssumptions,
  FunctionalRequirementReferences,
  Obligation,
  ObligationIdentifier,
  ObligationNature,
  Obligations,
  RequirementAttributeDeclaration,
  RequirementAttributeDeclarations,
  type RequirementsModel,
  Scenario,
  ScenarioIdentifier,
  Scenarios,
} from "@deep-spec/requirements-domain";

// 恒等（FormalModelIdentifier）は Repository が findById の引数から注入する——
// パーサは文書の中身しか知らない。
export function parseFormalModel(
  raw: Json,
): Result<Omit<Parameters<typeof RequirementsModel.of>[0], "id" | "irHash" | "sourceDocument">, string> {
  if (!isObject(raw)) return err("IR is not a JSON object");
  const irVersion = IntermediateRepresentationVersion.parse(typeof raw.irVersion === "string" ? raw.irVersion : "");
  if (!irVersion.ok) return err("IR lacks a semver irVersion");
  const attributes: RequirementAttributeDeclaration[] = [];
  const schema = isObject(raw.schema) ? raw.schema : {};
  for (const ent of Array.isArray(schema.entities) ? schema.entities : []) {
    if (!isObject(ent) || typeof ent.name !== "string") continue;
    for (const attr of Array.isArray(ent.attributes) ? ent.attributes : []) {
      if (!isObject(attr) || typeof attr.name !== "string" || !isObject(attr.type)) continue;
      const t = attr.type;
      const kind = t.kind;
      if (kind !== "bool" && kind !== "int" && kind !== "enum") continue;
      const parsed = combineResults({
        path: AttributePath.parse(`${ent.name}.${attr.name}`),
        values: Array.isArray(t.values)
          ? flatMapResult(traverseResult(strArr(t.values), EnumerationMember.parse), EnumerationMembers.parse)
          : ok(undefined),
        min: typeof t.min === "number" ? AttributeBound.parse(t.min) : ok(undefined),
        max: typeof t.max === "number" ? AttributeBound.parse(t.max) : ok(undefined),
      });
      if (!parsed.ok) return err(JSON.stringify(parsed.error));
      attributes.push(
        RequirementAttributeDeclaration.of({
          path: parsed.value.path,
          kind,
          min: parsed.value.min,
          max: parsed.value.max,
          values: parsed.value.values === undefined ? undefined : parsed.value.values,
        }),
      );
    }
  }
  const obligations: Obligation[] = [];
  for (const ob of Array.isArray(raw.obligations) ? raw.obligations : []) {
    if (!isObject(ob) || typeof ob.id !== "string" || typeof ob.nature !== "string") continue;
    const parsed = combineResults({
      id: ObligationIdentifier.parse(ob.id),
      nature: ObligationNature.parse(ob.nature),
      frRefs: flatMapResult(
        traverseResult(strArr(ob.frRefs), RequirementIdentifier.parse),
        FunctionalRequirementReferences.parse,
      ),
      trigger: typeof ob.trigger === "string" ? TriggerName.parse(ob.trigger) : ok(undefined),
    });
    if (!parsed.ok) return err(JSON.stringify(parsed.error));
    const constructed = Obligation.parse({
      id: parsed.value.id,
      nature: parsed.value.nature,
      functionalRequirementReferences: parsed.value.frRefs,
      ears: typeof ob.ears === "string" ? ob.ears : undefined,
      assert: isObject(ob.assert) ? (ob.assert as unknown as Expression) : undefined,
      trigger: parsed.value.trigger,
      guard: isObject(ob.guard) ? (ob.guard as unknown as Expression) : undefined,
      effect: isObject(ob.effect) ? (ob.effect as unknown as Expression) : undefined,
      temporal: isObject(ob.temporal)
        ? (ob.temporal as unknown as { pattern: string; assert?: Expression; from?: Expression; to?: Expression })
        : undefined,
    });
    if (!constructed.ok) return err(JSON.stringify(constructed.error));
    obligations.push(constructed.value);
  }
  const scenarios: Scenario[] = [];
  for (const sc of Array.isArray(raw.scenarios) ? raw.scenarios : []) {
    if (!isObject(sc) || typeof sc.id !== "string") continue;
    const kind = sc.kind === "accept" || sc.kind === "reject" ? sc.kind : null;
    if (kind === null || !isObject(sc.bindings)) continue;
    const parsed = combineResults({
      id: ScenarioIdentifier.parse(sc.id),
      bindings: decodeScenarioBindings(sc.bindings),
      frRefs: flatMapResult(
        traverseResult(strArr(sc.frRefs), RequirementIdentifier.parse),
        FunctionalRequirementReferences.parse,
      ),
      trigger:
        isObject(sc.event) && typeof sc.event.trigger === "string"
          ? TriggerName.parse(sc.event.trigger)
          : ok(undefined),
    });
    if (!parsed.ok) return err(JSON.stringify(parsed.error));
    const constructed = Scenario.parse({
      id: parsed.value.id,
      kind,
      functionalRequirementReferences: parsed.value.frRefs,
      bindings: parsed.value.bindings,
      event: parsed.value.trigger === undefined ? undefined : { trigger: parsed.value.trigger },
      expect: isObject(sc.expect) ? (sc.expect as unknown as Expression) : undefined,
    });
    if (!constructed.ok) return err(JSON.stringify(constructed.error));
    scenarios.push(constructed.value);
  }
  const background: BackgroundAssumption[] = [];
  for (const bg of Array.isArray(raw.background) ? raw.background : []) {
    if (!isObject(bg) || typeof bg.id !== "string" || !isObject(bg.assert)) continue;
    const id = BackgroundAssumptionIdentifier.parse(bg.id);
    if (!id.ok) return err(JSON.stringify(id.error));
    const constructed = BackgroundAssumption.parse({ id: id.value, assert: bg.assert as unknown as Expression });
    if (!constructed.ok) return err(JSON.stringify(constructed.error));
    background.push(constructed.value);
  }
  return ok({
    irVersion: irVersion.value,
    attributes: RequirementAttributeDeclarations.of(attributes),
    obligations: Obligations.of(obligations),
    scenarios: Scenarios.of(scenarios),
    background: BackgroundAssumptions.of(background),
  });
}
