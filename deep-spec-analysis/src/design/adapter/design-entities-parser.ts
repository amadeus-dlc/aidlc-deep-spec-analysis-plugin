import { AttributeKind, EnumerationMember, EnumerationMembers } from "@deep-spec/kernel-domain";
import { flatMapResult, type ParseError } from "@deep-spec/kernel-infrastructure";

// 設計 IR（契約3）の `schema.entities` と型付き宣言（DesignEntityDeclarations）の往復。
// parse は寛容（名前の無い実体・属性は落とす——旧 buildUnitView の凍結挙動）、
// render は lowered 文書（子バックエンドへ渡す契約1 文書）の `schema.entities`
// を組む——キー順は執筆ガイドの順（name / description / attributes、type は
// kind / min / max / values）で、整形された IR とはバイト同一（tests が固定）。

import {
  DesignAttributeDeclaration,
  DesignAttributeDeclarations,
  DesignAttributeName,
  DesignEntityDeclaration,
  DesignEntityDeclarations,
  DesignEntityName,
} from "@deep-spec/design-domain";
import { DeclaredBound } from "@deep-spec/kernel-domain";
import { isObject, type Json, ok, type Result, traverseResult } from "@deep-spec/kernel-infrastructure";

export function parseDesignEntities(schema: {
  readonly [k: string]: Json;
}): Result<DesignEntityDeclarations, ParseError> {
  const entities: DesignEntityDeclaration[] = [];
  for (const ent of Array.isArray(schema.entities) ? schema.entities : []) {
    if (!isObject(ent) || typeof ent.name !== "string") continue;
    const name = DesignEntityName.parse(ent.name);
    if (!name.ok) return name;
    const attributes: DesignAttributeDeclaration[] = [];
    for (const attr of Array.isArray(ent.attributes) ? ent.attributes : []) {
      if (!isObject(attr) || typeof attr.name !== "string") continue;
      const t = isObject(attr.type) ? attr.type : {};
      const kind = AttributeKind.parse(typeof t.kind === "string" ? t.kind : "");
      if (!kind.ok) return kind;
      const name = DesignAttributeName.parse(attr.name);
      if (!name.ok) return name;
      const members = flatMapResult(
        traverseResult(
          Array.isArray(t.values) ? t.values.filter((v): v is string => typeof v === "string") : [],
          EnumerationMember.parse,
        ),
        EnumerationMembers.parse,
      );
      if (!members.ok) return members;
      attributes.push(
        DesignAttributeDeclaration.of({
          name: name.value,
          kind: kind.value,
          ...(typeof attr.description === "string" ? { description: attr.description } : {}),
          ...(Array.isArray(t.values) ? { values: members.value } : {}),
          ...(typeof t.min === "number" ? { min: DeclaredBound.of(t.min) } : {}),
          ...(typeof t.max === "number" ? { max: DeclaredBound.of(t.max) } : {}),
        }),
      );
    }
    entities.push(
      DesignEntityDeclaration.of({
        name: name.value,
        ...(typeof ent.description === "string" ? { description: ent.description } : {}),
        attributes: DesignAttributeDeclarations.of(attributes),
      }),
    );
  }
  return ok(DesignEntityDeclarations.of(entities));
}

export function renderDesignEntities(entities: DesignEntityDeclarations): Json {
  return entities.toArray().map((ent) => {
    const out: { [k: string]: Json } = { name: ent.name().asString() };
    const description = ent.description();
    if (description !== undefined) out.description = description;
    out.attributes = ent
      .attributes()
      .toArray()
      .map((attr) => {
        const a: { [k: string]: Json } = { name: attr.name().asString() };
        const attrDescription = attr.description();
        if (attrDescription !== undefined) a.description = attrDescription;
        const type: { [k: string]: Json } = { kind: attr.kindLabel() };
        const min = attr.minBound();
        if (min !== undefined) type.min = min.asNumber();
        const max = attr.maxBound();
        if (max !== undefined) type.max = max.asNumber();
        const values = attr.enumStates();
        if (values !== null) type.values = values.toArray().map((member) => member.asString());
        a.type = type;
        return a as Json;
      });
    return out as Json;
  });
}
