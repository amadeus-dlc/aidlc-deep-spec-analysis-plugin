import { RequirementId, IrVersion, type Expression, TriggerName } from "@deep-spec/kernel-domain";

// 契約1 IR（生 Json）→ Parameters<typeof RequirementsModel.of>[0] の寛容パース。欠損・型不一致の
// エントリは黙って落とす（旧 parseIr の凍結挙動——ir-valid センサーが別途
// 厳密検査を担う）。集約として成立しない形はResultのエラーで返す。
// 旧 aidlc-sensor-deep-spec-verify-smt.ts の parseIr からの逐語移植。

import { type Json, type Result, err, combineResults, traverseResult, ok, isObject, strArr } from "@deep-spec/kernel-infrastructure";

import {
  AttributeBound,
  AttributePath,
  AttributeValues,
  BackgroundAssumptionId,
  FrRefs,
  ObligationId,
  ObligationNature,
  ScenarioId,
  AttributeDeclaration,
  BackgroundAssumption,
  Obligation,
  Scenario,
  AttributeDeclarations,
  BackgroundAssumptions,
  Obligations,
  Scenarios,
  RequirementsModel,
} from "@deep-spec/requirements-domain";

// 恒等（FormalModelId）は Repository が findById の引数から注入する——
// パーサは文書の中身しか知らない。
export function parseFormalModel(raw: Json): Result<Omit<Parameters<typeof RequirementsModel.of>[0], "id" | "irHash" | "sourceDocument">, string> {
  if (!isObject(raw)) return err("IR is not a JSON object");
  const irVersion = IrVersion.parse(typeof raw.irVersion === "string" ? raw.irVersion : "");
  if (!irVersion.ok) return err("IR lacks a semver irVersion");
  const attributes: AttributeDeclaration[] = [];
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
        min: typeof t.min === "number" ? AttributeBound.parse(t.min) : ok(undefined),
        max: typeof t.max === "number" ? AttributeBound.parse(t.max) : ok(undefined),
      });
      if (!parsed.ok) return err(JSON.stringify(parsed.error));
      attributes.push(AttributeDeclaration.of({
        path: parsed.value.path,
        kind,
        min: parsed.value.min,
        max: parsed.value.max,
        values: Array.isArray(t.values) ? AttributeValues.of(t.values.filter((v) => typeof v === "string") as string[]) : undefined,
      }));
    }
  }
  const obligations: Obligation[] = [];
  for (const ob of Array.isArray(raw.obligations) ? raw.obligations : []) {
    if (!isObject(ob) || typeof ob.id !== "string" || typeof ob.nature !== "string") continue;
    const parsed = combineResults({
      id: ObligationId.parse(ob.id),
      frRefs: traverseResult(strArr(ob.frRefs), RequirementId.parse),
      trigger: typeof ob.trigger === "string" ? TriggerName.parse(ob.trigger) : ok(undefined),
    });
    if (!parsed.ok) return err(JSON.stringify(parsed.error));
    obligations.push(Obligation.of({
      id: parsed.value.id,
      nature: ObligationNature.of(ob.nature),
      frRefs: FrRefs.of(parsed.value.frRefs),
      ears: typeof ob.ears === "string" ? ob.ears : undefined,
      assert: isObject(ob.assert) ? (ob.assert as unknown as Expression) : undefined,
      trigger: parsed.value.trigger,
      guard: isObject(ob.guard) ? (ob.guard as unknown as Expression) : undefined,
      effect: isObject(ob.effect) ? (ob.effect as unknown as Expression) : undefined,
      temporal: isObject(ob.temporal) ? (ob.temporal as unknown as { pattern: string; assert?: Expression; from?: Expression; to?: Expression }) : undefined,
    }));
  }
  const scenarios: Scenario[] = [];
  for (const sc of Array.isArray(raw.scenarios) ? raw.scenarios : []) {
    if (!isObject(sc) || typeof sc.id !== "string") continue;
    const kind = sc.kind === "accept" || sc.kind === "reject" ? sc.kind : null;
    if (kind === null || !isObject(sc.bindings)) continue;
    const bindings: Record<string, boolean | number | string> = {};
    for (const [k, v] of Object.entries(sc.bindings)) {
      if (typeof v === "boolean" || typeof v === "number" || typeof v === "string") bindings[k] = v;
    }
    const parsed = combineResults({
      id: ScenarioId.parse(sc.id),
      frRefs: traverseResult(strArr(sc.frRefs), RequirementId.parse),
      trigger: isObject(sc.event) && typeof sc.event.trigger === "string" ? TriggerName.parse(sc.event.trigger) : ok(undefined),
    });
    if (!parsed.ok) return err(JSON.stringify(parsed.error));
    scenarios.push(Scenario.of({
      id: parsed.value.id,
      kind,
      frRefs: FrRefs.of(parsed.value.frRefs),
      bindings,
      event: parsed.value.trigger === undefined ? undefined : { trigger: parsed.value.trigger },
      expect: isObject(sc.expect) ? (sc.expect as unknown as Expression) : undefined,
    }));
  }
  const background: BackgroundAssumption[] = [];
  for (const bg of Array.isArray(raw.background) ? raw.background : []) {
    if (!isObject(bg) || typeof bg.id !== "string" || !isObject(bg.assert)) continue;
    const id = BackgroundAssumptionId.parse(bg.id);
    if (!id.ok) return err(JSON.stringify(id.error));
    background.push(BackgroundAssumption.of({ id: id.value, assert: bg.assert as unknown as Expression }));
  }
  return ok({
    irVersion: irVersion.value,
    attributes: AttributeDeclarations.of(attributes),
    obligations: Obligations.of(obligations),
    scenarios: Scenarios.of(scenarios),
    background: BackgroundAssumptions.of(background),
  });
}
