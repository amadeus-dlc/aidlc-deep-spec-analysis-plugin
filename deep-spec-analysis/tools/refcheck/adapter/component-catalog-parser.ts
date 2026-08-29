// components.md の解析 — 形式（fence/YAML/Json 歩き）の知識をここに封じ、
// 型付きの ComponentCatalogOutcome へ解く。抽出ロジックは旧センサーの
// extractComponents の逐語移動。

import { extractFences } from "../../kernel/adapter/markdown-fences.ts";
import { type Json, isObject } from "../../kernel/adapter/json-value.ts";
import { parseYamlSubset } from "../../kernel/adapter/yaml-subset.ts";
import type {
  Component,
  ComponentCatalogOutcome,
  ComponentEntity,
  ComponentShapeError,
} from "../domain/index.ts";

function str(v: Json): string | null {
  return typeof v === "string" ? v : null;
}

function extractComponents(value: Json): { comps: Component[]; shapeErrors: ComponentShapeError[] } {
  const shapeErrors: ComponentShapeError[] = [];
  const comps: Component[] = [];
  if (!isObject(value) || !Array.isArray(value.components)) {
    shapeErrors.push({ element: "components", detail: "top-level `components:` list is missing" });
    return { comps, shapeErrors };
  }
  value.components.forEach((raw, i) => {
    const element = `components[${i}]`;
    if (!isObject(raw)) {
      shapeErrors.push({ element, detail: "component entry is not a mapping" });
      return;
    }
    const name = str(raw.name);
    if (name === null) {
      shapeErrors.push({ element: `${element}.name`, detail: "component has no string `name`" });
      return;
    }
    const refs = (key: "depends_on" | "dependents"): Component["dependsOn"] => {
      const out: Component["dependsOn"] = [];
      if (!Array.isArray(raw[key])) return out;
      (raw[key] as Json[]).forEach((entry, j) => {
        const el = `${element}.${key}[${j}].component`;
        const comp = isObject(entry) ? str(entry.component) : str(entry);
        if (comp !== null) out.push({ component: comp, element: el });
      });
      return out;
    };
    const entities: ComponentEntity[] = [];
    if (Array.isArray(raw.entities)) {
      (raw.entities as Json[]).forEach((entry, j) => {
        if (!isObject(entry)) return;
        const ename = str(entry.name);
        if (ename === null) return;
        const references: ComponentEntity["references"] = [];
        if (Array.isArray(entry.references)) {
          (entry.references as Json[]).forEach((ref, k) => {
            if (!isObject(ref)) return;
            const target = str(ref.entity);
            const ownedBy = str(ref.owned_by);
            if (target !== null && ownedBy !== null) {
              references.push({ entity: target, ownedBy, element: `${element}.entities[${j}].references[${k}]` });
            }
          });
        }
        entities.push({
          name: ename,
          element: `${element}.entities[${j}]`,
          identifier: str(entry.identifier),
          references,
        });
      });
    }
    comps.push({ name, element, dependsOn: refs("depends_on"), dependents: refs("dependents"), entities });
  });
  return { comps, shapeErrors };
}

export function parseComponentCatalog(md: string): ComponentCatalogOutcome {
  const fences = extractFences(md, "yaml");
  if (fences.length !== 1) {
    return { kind: "wrong-fence-count", found: fences.length };
  }
  const parsed = parseYamlSubset(fences[0]?.body ?? "");
  if (parsed.error !== undefined) {
    return { kind: "unparseable", line: fences[0]?.line ?? 0, error: parsed.error };
  }
  const { comps, shapeErrors } = extractComponents(parsed.value ?? null);
  return { kind: "extracted", components: comps, shapeErrors };
}
