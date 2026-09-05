import { FenceCount } from "@deep-spec/refcheck-domain";
// components.md の解析 — 形式（fence/YAML/Json 歩き）の知識をここに封じ、
// 型付きの ComponentCatalogOutcome へ解く。抽出ロジックは旧センサーの
// extractComponents の逐語移動。

import { extractFences } from "@deep-spec/kernel-adapter";
import { parseYamlSubset } from "@deep-spec/kernel-adapter";
import { type Json, combineResults, ok, isObject } from "@deep-spec/kernel-infrastructure";

import {
  AttributeName,
  Component,
  ComponentEntities,
  ComponentEntity,
  ComponentName,
  ComponentReference,
  ComponentReferences,
  Components,
  ComponentShapeErrors,
  ElementPath,
  EntityName,
  EntityReferences,
} from "@deep-spec/refcheck-domain";
import { ComponentCatalogOutcome, ComponentShapeError, EntityReference, LineNumber } from "@deep-spec/refcheck-domain";

function str(v: Json): string | null {
  return typeof v === "string" ? v : null;
}

function extractComponents(value: Json): { comps: Components; shapeErrors: ComponentShapeErrors } {
  const shapeErrors: ComponentShapeError[] = [];
  const comps: Component[] = [];
  if (!isObject(value) || !Array.isArray(value.components)) {
    shapeErrors.push(ComponentShapeError.of({ element: ElementPath.of("components"), detail: "top-level `components:` list is missing" }));
    return { comps: Components.of(comps), shapeErrors: ComponentShapeErrors.of(shapeErrors) };
  }
  value.components.forEach((raw, i) => {
    const element = `components[${i}]`;
    if (!isObject(raw)) {
      shapeErrors.push(ComponentShapeError.of({ element: ElementPath.of(element), detail: "component entry is not a mapping" }));
      return;
    }
    const name = str(raw.name);
    if (name === null) {
      shapeErrors.push(ComponentShapeError.of({ element: ElementPath.of(`${element}.name`), detail: "component has no string `name`" }));
      return;
    }
    const parsedName = ComponentName.parse(name);
    if (!parsedName.ok) {
      shapeErrors.push(ComponentShapeError.of({ element: ElementPath.of(`${element}.name`), detail: JSON.stringify(parsedName.error) }));
      return;
    }
    const refs = (key: "depends_on" | "dependents"): ComponentReferences => {
      const out: ComponentReference[] = [];
      if (!Array.isArray(raw[key])) return ComponentReferences.of(out);
      (raw[key] as Json[]).forEach((entry, j) => {
        const el = `${element}.${key}[${j}].component`;
        const comp = isObject(entry) ? str(entry.component) : str(entry);
        if (comp === null) return;
        const component = ComponentName.parse(comp);
        if (!component.ok) {
          shapeErrors.push(ComponentShapeError.of({ element: ElementPath.of(el), detail: JSON.stringify(component.error) }));
          return;
        }
        out.push(ComponentReference.of({ component: component.value, element: ElementPath.of(el) }));
      });
      return ComponentReferences.of(out);
    };
    const entities: ComponentEntity[] = [];
    if (Array.isArray(raw.entities)) {
      (raw.entities as Json[]).forEach((entry, j) => {
        if (!isObject(entry)) return;
        const ename = str(entry.name);
        if (ename === null) return;
        const entity = EntityName.parse(ename);
        if (!entity.ok) {
          shapeErrors.push(ComponentShapeError.of({ element: ElementPath.of(`${element}.entities[${j}].name`), detail: JSON.stringify(entity.error) }));
          return;
        }
        const references: EntityReference[] = [];
        if (Array.isArray(entry.references)) {
          (entry.references as Json[]).forEach((ref, k) => {
            if (!isObject(ref)) return;
            const target = str(ref.entity);
            const ownedBy = str(ref.owned_by);
            if (target !== null && ownedBy !== null) {
              const fields = combineResults({ entity: EntityName.parse(target), ownedBy: ComponentName.parse(ownedBy) });
              if (!fields.ok) {
                shapeErrors.push(ComponentShapeError.of({ element: ElementPath.of(`${element}.entities[${j}].references[${k}]`), detail: JSON.stringify(fields.error) }));
                return;
              }
              references.push(EntityReference.of({
                entity: fields.value.entity,
                ownedBy: fields.value.ownedBy,
                element: ElementPath.of(`${element}.entities[${j}].references[${k}]`),
              }));
            }
          });
        }
        const identifier = str(entry.identifier);
        const parsedIdentifier = identifier === null || identifier === "" ? ok(null) : AttributeName.parse(identifier);
        if (!parsedIdentifier.ok) {
          shapeErrors.push(ComponentShapeError.of({ element: ElementPath.of(`${element}.entities[${j}].identifier`), detail: JSON.stringify(parsedIdentifier.error) }));
          return;
        }
        entities.push(ComponentEntity.of({
          name: entity.value,
          element: ElementPath.of(`${element}.entities[${j}]`),
          identifier: parsedIdentifier.value,
          references: EntityReferences.of(references),
        }));
      });
    }
    comps.push(Component.of({
      name: parsedName.value,
      element: ElementPath.of(element),
      dependsOn: refs("depends_on"),
      dependents: refs("dependents"),
      entities: ComponentEntities.of(entities),
    }));
  });
  return { comps: Components.of(comps), shapeErrors: ComponentShapeErrors.of(shapeErrors) };
}

export function parseComponentCatalog(md: string): ComponentCatalogOutcome {
  const fences = extractFences(md, "yaml");
  if (fences.length !== 1) {
    return ComponentCatalogOutcome.wrongFenceCount(FenceCount.of(fences.length));
  }
  const parsed = parseYamlSubset(fences[0]?.body ?? "");
  if (parsed.error !== undefined) {
    return ComponentCatalogOutcome.unparseable(LineNumber.of(fences[0]?.line ?? 0), parsed.error);
  }
  const { comps, shapeErrors } = extractComponents(parsed.value ?? null);
  return ComponentCatalogOutcome.extracted(comps, shapeErrors);
}
