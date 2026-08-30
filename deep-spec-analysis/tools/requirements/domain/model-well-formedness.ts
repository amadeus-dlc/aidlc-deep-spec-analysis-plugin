// ModelWellFormedness — 契約1 IR のスキーマを超えた意味的整合性。
// 一意な id、解決可能な属性参照、enum リテラルの所属、prime の合法性。
// 旧 aidlc-sensor-deep-spec-ir-valid.ts の semanticErrors からの逐語移植で、
// 文言と発生順序は ir-valid の errors[] としてそのまま観測面に出る。

import { type Expression, walkExpression } from "../../kernel/domain/index.ts";
import type { IrModelView } from "./ir-model-view.ts";

interface AttributeType {
  readonly kind: string;
  readonly values?: readonly string[];
}

export function modelWellFormednessErrors(view: IrModelView): string[] {
  const errors: string[] = [];
  const attrTypes = new Map<string, AttributeType>();

  const entityNames = new Set<string>();
  for (const ent of view.entities) {
    if (entityNames.has(ent.name)) errors.push(`schema: duplicate entity "${ent.name}"`);
    entityNames.add(ent.name);
    const attrNames = new Set<string>();
    for (const attr of ent.attributes) {
      if (attrNames.has(attr.name)) {
        errors.push(`schema: duplicate attribute "${ent.name}.${attr.name}"`);
      }
      attrNames.add(attr.name);
      if (attr.kind === "int" && attr.min !== undefined && attr.max !== undefined && attr.min > attr.max) {
        errors.push(`schema: ${ent.name}.${attr.name}: min > max`);
      }
      attrTypes.set(`${ent.name}.${attr.name}`, { kind: attr.kind, values: attr.values });
    }
  }

  const checkExpr = (e: Expression, where: string, primesAllowed: boolean): void => {
    walkExpression(e, (node) => {
      if (node.op === "ref" && typeof node.path === "string") {
        if (!attrTypes.has(node.path)) {
          errors.push(`${where}: unresolvable reference "${node.path}"`);
        }
        if (node.prime === true && !primesAllowed) {
          errors.push(`${where}: primed reference "${node.path}" is only legal in event effects and event-scenario expectations`);
        }
      }
      if (node.op === "enum" && typeof node.value === "string") {
        const known = [...attrTypes.values()].some((t) => t.kind === "enum" && t.values?.includes(node.value as string));
        if (!known) {
          errors.push(`${where}: enum literal "${node.value}" is not a value of any declared enum attribute`);
        }
      }
    });
  };

  const seenIds = new Set<string>();
  const dupCheck = (id: string, where: string): void => {
    if (seenIds.has(id)) errors.push(`${where}: duplicate id "${id}"`);
    seenIds.add(id);
  };

  for (const ob of view.obligations) {
    const where = `obligation ${ob.id}`;
    dupCheck(ob.id, where);
    if (ob.assert !== undefined) checkExpr(ob.assert, where, false);
    if (ob.guard !== undefined) checkExpr(ob.guard, where, false);
    if (ob.effect !== undefined) checkExpr(ob.effect, where, true);
    if (ob.temporal !== undefined) {
      const t = ob.temporal;
      if (t.assert !== undefined) checkExpr(t.assert, where, false);
      if (t.from !== undefined) checkExpr(t.from, where, false);
      if (t.to !== undefined) checkExpr(t.to, where, false);
    }
  }

  for (const sc of view.scenarios) {
    const where = `scenario ${sc.id}`;
    dupCheck(sc.id, where);
    for (const [path, val] of sc.bindings) {
      const t = attrTypes.get(path);
      if (!t) {
        errors.push(`${where}: binding for unknown attribute "${path}"`);
        continue;
      }
      const ok =
        (t.kind === "bool" && typeof val === "boolean") ||
        (t.kind === "int" && typeof val === "number" && Number.isInteger(val)) ||
        (t.kind === "enum" && typeof val === "string" && (t.values ?? []).includes(val));
      if (!ok) {
        errors.push(`${where}: binding value ${JSON.stringify(val)} does not fit ${t.kind} attribute "${path}"`);
      }
    }
    if (sc.expect !== undefined) checkExpr(sc.expect, where, sc.hasEvent);
  }

  for (const bg of view.background) {
    dupCheck(bg.id, `background ${bg.id}`);
    if (bg.assert !== undefined) checkExpr(bg.assert, `background ${bg.id}`, false);
  }

  return errors;
}
