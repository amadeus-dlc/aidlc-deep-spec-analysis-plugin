import { FenceCount } from "@deep-spec-analysis/refcheck-domain";
// components.md の解析 — 形式（fence/YAML/Json 歩き）の知識をここに封じ、
// 型付きの ComponentCatalogOutcome へ解く。抽出ロジックは旧センサーの
// extractComponents の逐語移動。

import { extractFences, parseYamlSubset } from "@deep-spec-analysis/kernel-adapter";
import { combineResults, err, isObject, type Json, ok, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import {
  AttributeName,
  Component,
  ComponentCatalogOutcome,
  ComponentEntities,
  ComponentEntity,
  ComponentName,
  ComponentReference,
  ComponentReferences,
  ComponentShapeError,
  ComponentShapeErrors,
  Components,
  ElementPath,
  EntityName,
  EntityReference,
  EntityReferences,
  LineNumber,
} from "@deep-spec-analysis/refcheck-domain";

function str(v: Json): string | null {
  return typeof v === "string" ? v : null;
}

function extractComponents(value: Json): Result<{ comps: Components; shapeErrors: ComponentShapeErrors }, string> {
  const shapeErrors: ComponentShapeError[] = [];
  const comps: Component[] = [];
  if (!isObject(value) || !Array.isArray(value.components)) {
    shapeErrors.push(
      ComponentShapeError.of({
        element: ElementPath.of("components"),
        detail: "top-level `components:` list is missing",
      }),
    );
    const parsed = combineResults({
      comps: Components.parse(comps),
      shapeErrors: ComponentShapeErrors.parse(shapeErrors),
    });
    return parsed.ok ? ok(parsed.value) : err(JSON.stringify(parsed.error));
  }
  for (const [i, raw] of value.components.entries()) {
    const element = `components[${i}]`;
    if (!isObject(raw)) {
      shapeErrors.push(
        ComponentShapeError.of({ element: ElementPath.of(element), detail: "component entry is not a mapping" }),
      );
      continue;
    }
    const name = str(raw.name);
    if (name === null) {
      shapeErrors.push(
        ComponentShapeError.of({
          element: ElementPath.of(`${element}.name`),
          detail: "component has no string `name`",
        }),
      );
      continue;
    }
    const parsedName = ComponentName.parse(name);
    if (!parsedName.ok) {
      shapeErrors.push(
        ComponentShapeError.of({
          element: ElementPath.of(`${element}.name`),
          detail: JSON.stringify(parsedName.error),
        }),
      );
      continue;
    }
    const refs = (key: "depends_on" | "dependents"): Result<ComponentReferences, string> => {
      const out: ComponentReference[] = [];
      if (!Array.isArray(raw[key])) {
        const parsed = ComponentReferences.parse(out);
        return parsed.ok ? ok(parsed.value) : err(JSON.stringify(parsed.error));
      }
      (raw[key] as Json[]).forEach((entry, j) => {
        const el = `${element}.${key}[${j}].component`;
        const comp = isObject(entry) ? str(entry.component) : str(entry);
        if (comp === null) return;
        const component = ComponentName.parse(comp);
        if (!component.ok) {
          shapeErrors.push(
            ComponentShapeError.of({ element: ElementPath.of(el), detail: JSON.stringify(component.error) }),
          );
          return;
        }
        out.push(ComponentReference.of({ component: component.value, element: ElementPath.of(el) }));
      });
      const parsed = ComponentReferences.parse(out);
      return parsed.ok ? ok(parsed.value) : err(JSON.stringify(parsed.error));
    };
    const entities: ComponentEntity[] = [];
    if (Array.isArray(raw.entities)) {
      for (const [j, entry] of (raw.entities as Json[]).entries()) {
        if (!isObject(entry)) continue;
        const ename = str(entry.name);
        if (ename === null) continue;
        const entity = EntityName.parse(ename);
        if (!entity.ok) {
          shapeErrors.push(
            ComponentShapeError.of({
              element: ElementPath.of(`${element}.entities[${j}].name`),
              detail: JSON.stringify(entity.error),
            }),
          );
          continue;
        }
        const references: EntityReference[] = [];
        if (Array.isArray(entry.references)) {
          (entry.references as Json[]).forEach((ref, k) => {
            if (!isObject(ref)) return;
            const target = str(ref.entity);
            const ownedBy = str(ref.owned_by);
            if (target !== null && ownedBy !== null) {
              const fields = combineResults({
                entity: EntityName.parse(target),
                ownedBy: ComponentName.parse(ownedBy),
              });
              if (!fields.ok) {
                shapeErrors.push(
                  ComponentShapeError.of({
                    element: ElementPath.of(`${element}.entities[${j}].references[${k}]`),
                    detail: JSON.stringify(fields.error),
                  }),
                );
                return;
              }
              references.push(
                EntityReference.of({
                  entity: fields.value.entity,
                  ownedBy: fields.value.ownedBy,
                  element: ElementPath.of(`${element}.entities[${j}].references[${k}]`),
                }),
              );
            }
          });
        }
        const identifier = str(entry.identifier);
        const parsedIdentifier = identifier === null || identifier === "" ? ok(null) : AttributeName.parse(identifier);
        if (!parsedIdentifier.ok) {
          shapeErrors.push(
            ComponentShapeError.of({
              element: ElementPath.of(`${element}.entities[${j}].identifier`),
              detail: JSON.stringify(parsedIdentifier.error),
            }),
          );
          continue;
        }
        const parsedReferences = EntityReferences.parse(references);
        if (!parsedReferences.ok) return err(JSON.stringify(parsedReferences.error));
        entities.push(
          ComponentEntity.of({
            name: entity.value,
            element: ElementPath.of(`${element}.entities[${j}]`),
            identifier: parsedIdentifier.value,
            references: parsedReferences.value,
          }),
        );
      }
    }
    const dependsOn = refs("depends_on");
    if (!dependsOn.ok) return err(dependsOn.error);
    const dependents = refs("dependents");
    if (!dependents.ok) return err(dependents.error);
    const parsedEntities = ComponentEntities.parse(entities);
    if (!parsedEntities.ok) return err(JSON.stringify(parsedEntities.error));
    comps.push(
      Component.of({
        name: parsedName.value,
        element: ElementPath.of(element),
        dependsOn: dependsOn.value,
        dependents: dependents.value,
        entities: parsedEntities.value,
      }),
    );
  }
  const parsed = combineResults({
    comps: Components.parse(comps),
    shapeErrors: ComponentShapeErrors.parse(shapeErrors),
  });
  return parsed.ok ? ok(parsed.value) : err(JSON.stringify(parsed.error));
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
  const extracted = extractComponents(parsed.value ?? null);
  return extracted.ok
    ? ComponentCatalogOutcome.extracted(extracted.value.comps, extracted.value.shapeErrors)
    : ComponentCatalogOutcome.unparseable(LineNumber.of(fences[0]?.line ?? 0), extracted.error);
}
