// 設計 IR（契約3）の `schema.entities` と型付き宣言（DesignEntityDecls）の往復。
// parse は寛容（名前の無い実体・属性は落とす——旧 buildUnitView の凍結挙動）、
// render は lowered 文書（子バックエンドへ渡す契約1 文書）の `schema.entities`
// を組む——キー順は執筆ガイドの順（name / description / attributes、type は
// kind / min / max / values）で、整形された IR とはバイト同一（tests が固定）。

import type { Json } from "../../kernel/adapter/index.ts";
import { isObject } from "../../kernel/adapter/index.ts";
import { AttributeBound } from "../../kernel/domain/index.ts";
import {
  DeclaredValues,
  DesignAttributeDecl,
  DesignAttributeDecls,
  DesignAttributeName,
  DesignEntityDecl,
  DesignEntityDecls,
  DesignEntityName,
} from "../domain/index.ts";

export function parseDesignEntities(schema: { readonly [k: string]: Json }): DesignEntityDecls {
  const entities: DesignEntityDecl[] = [];
  for (const ent of Array.isArray(schema.entities) ? schema.entities : []) {
    if (!isObject(ent) || typeof ent.name !== "string") continue;
    const attributes: DesignAttributeDecl[] = [];
    for (const attr of Array.isArray(ent.attributes) ? ent.attributes : []) {
      if (!isObject(attr) || typeof attr.name !== "string") continue;
      const t = isObject(attr.type) ? attr.type : {};
      attributes.push(DesignAttributeDecl.reconstitute({
        name: DesignAttributeName.reconstitute(attr.name),
        kind: typeof t.kind === "string" ? t.kind : "",
        ...(typeof attr.description === "string" ? { description: attr.description } : {}),
        ...(Array.isArray(t.values) ? { values: DeclaredValues.of(t.values.filter((v) => typeof v === "string") as string[]) } : {}),
        ...(typeof t.min === "number" ? { min: AttributeBound.reconstitute(t.min) } : {}),
        ...(typeof t.max === "number" ? { max: AttributeBound.reconstitute(t.max) } : {}),
      }));
    }
    entities.push(DesignEntityDecl.reconstitute({
      name: DesignEntityName.reconstitute(ent.name),
      ...(typeof ent.description === "string" ? { description: ent.description } : {}),
      attributes: DesignAttributeDecls.of(attributes),
    }));
  }
  return DesignEntityDecls.of(entities);
}

export function renderDesignEntities(entities: DesignEntityDecls): Json {
  return entities.toArray().map((ent) => {
    const out: { [k: string]: Json } = { name: ent.name().asString() };
    const description = ent.description();
    if (description !== undefined) out.description = description;
    out.attributes = ent.attributes().toArray().map((attr) => {
      const a: { [k: string]: Json } = { name: attr.name().asString() };
      const attrDescription = attr.description();
      if (attrDescription !== undefined) a.description = attrDescription;
      const type: { [k: string]: Json } = { kind: attr.kindLabel() };
      const min = attr.minBound();
      if (min !== undefined) type.min = min.asNumber();
      const max = attr.maxBound();
      if (max !== undefined) type.max = max.asNumber();
      const values = attr.enumStates();
      if (values !== null) type.values = [...values.toArray()];
      a.type = type;
      return a as Json;
    });
    return out as Json;
  });
}
