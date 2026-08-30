// 契約1 IR（生 Json）→ RequirementsModelSeed の寛容パース。欠損・型不一致の
// エントリは黙って落とす（旧 parseIr の凍結挙動——ir-valid センサーが別途
// 厳密検査を担う）。集約として成立しない形は凍結文言の文字列で返す。
// 旧 aidlc-sensor-deep-spec-verify-smt.ts の parseIr からの逐語移植。

import { type Json, isObject } from "../../kernel/adapter/index.ts";
import { IrVersion, type Expression } from "../../kernel/domain/index.ts";
import type {
  AttributeDeclaration,
  Obligation,
  RequirementsModelSeed,
  Scenario,
} from "../domain/index.ts";

export function parseFormalModel(raw: Json): RequirementsModelSeed | string {
  if (!isObject(raw)) return "IR is not a JSON object";
  const irVersion = IrVersion.parse(typeof raw.irVersion === "string" ? raw.irVersion : "");
  if (!irVersion.ok) return "IR lacks a semver irVersion";
  const attributes: AttributeDeclaration[] = [];
  const schema = isObject(raw.schema) ? raw.schema : {};
  for (const ent of Array.isArray(schema.entities) ? schema.entities : []) {
    if (!isObject(ent) || typeof ent.name !== "string") continue;
    for (const attr of Array.isArray(ent.attributes) ? ent.attributes : []) {
      if (!isObject(attr) || typeof attr.name !== "string" || !isObject(attr.type)) continue;
      const t = attr.type;
      const kind = t.kind;
      if (kind !== "bool" && kind !== "int" && kind !== "enum") continue;
      attributes.push({
        path: `${ent.name}.${attr.name}`,
        kind,
        min: typeof t.min === "number" ? t.min : undefined,
        max: typeof t.max === "number" ? t.max : undefined,
        values: Array.isArray(t.values) ? (t.values.filter((v) => typeof v === "string") as string[]) : undefined,
      });
    }
  }
  const strArr = (v: Json): string[] => (Array.isArray(v) ? (v.filter((x) => typeof x === "string") as string[]) : []);
  const obligations: Obligation[] = [];
  for (const ob of Array.isArray(raw.obligations) ? raw.obligations : []) {
    if (!isObject(ob) || typeof ob.id !== "string" || typeof ob.nature !== "string") continue;
    obligations.push({
      id: ob.id,
      nature: ob.nature,
      frRefs: strArr(ob.frRefs),
      ears: typeof ob.ears === "string" ? ob.ears : undefined,
      assert: isObject(ob.assert) ? (ob.assert as unknown as Expression) : undefined,
      trigger: typeof ob.trigger === "string" ? ob.trigger : undefined,
      guard: isObject(ob.guard) ? (ob.guard as unknown as Expression) : undefined,
      effect: isObject(ob.effect) ? (ob.effect as unknown as Expression) : undefined,
      temporal: isObject(ob.temporal) ? (ob.temporal as unknown as Obligation["temporal"]) : undefined,
    });
  }
  const scenarios: Scenario[] = [];
  for (const sc of Array.isArray(raw.scenarios) ? raw.scenarios : []) {
    if (!isObject(sc) || typeof sc.id !== "string") continue;
    const kind = sc.kind === "accept" || sc.kind === "reject" ? sc.kind : null;
    if (kind === null || !isObject(sc.bindings)) continue;
    const bindings: Scenario["bindings"] = {};
    for (const [k, v] of Object.entries(sc.bindings)) {
      if (typeof v === "boolean" || typeof v === "number" || typeof v === "string") bindings[k] = v;
    }
    scenarios.push({
      id: sc.id,
      kind,
      frRefs: strArr(sc.frRefs),
      bindings,
      event: isObject(sc.event) && typeof sc.event.trigger === "string" ? { trigger: sc.event.trigger } : undefined,
      expect: isObject(sc.expect) ? (sc.expect as unknown as Expression) : undefined,
    });
  }
  const background: { id: string; assert: Expression }[] = [];
  for (const bg of Array.isArray(raw.background) ? raw.background : []) {
    if (!isObject(bg) || typeof bg.id !== "string" || !isObject(bg.assert)) continue;
    background.push({ id: bg.id, assert: bg.assert as unknown as Expression });
  }
  return { irVersion: irVersion.value, attributes, obligations, scenarios, background };
}
