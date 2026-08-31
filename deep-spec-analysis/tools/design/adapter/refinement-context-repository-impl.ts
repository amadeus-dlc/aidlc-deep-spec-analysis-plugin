// RefinementMaterialsRepository の実 Gateway 実装。レコードルート歩行・要件形式
// モデルの寛容読取（不読は null → inactive）・refinement map の fence/JSON/
// 契約4 スキーマ検証（凍結エラーメッセージ 4 種）・inputs 台帳（3 成果物の
// 相対パス＋sha256）をここで解決する。契約4 スキーマのパスは entry が注入する。
// 旧 refinement-lib の loadRequirementsIr / loadRefinementMap と旧 entry の
// inputs 組成からの逐語移植。

import type { RefinementMaterialsId } from "../domain/index.ts";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ArtifactPath, ContentHash, FrRefs } from "../../kernel/domain/index.ts";
import { AttributeBound, AttributePath, ObligationId, ObligationNature, ScenarioId } from "../../refinement/domain/index.ts";
import type { Expression } from "../../kernel/domain/index.ts";
import {
  type Json,
  canonicalStringify,
  extractFences,
  findRecordRoot,
  isObject,
  relArtifact,
  validateSchema,
} from "../../kernel/adapter/index.ts";
import {
  AttributeMappings,
  EventMappings,
  FormalModelId,
  RefinementAttributes,
  RefinementMapId,
  RefinementObligations,
  RefinementScenarios,
  RefinementUnitMaps,
  ReqAttributeValues,
  TransitionRefs,
  UnmappedDeclarations,
  type AttributeMapping,
  type EventMapping,
  type RefinementAttribute,
  type RefinementObligation,
  type RefinementScenario,
  type RefinementUnitMap,
  type UnmappedTarget,
  RefinementMap,
  RefinementMaterials,
  RefinementRequirements,
  UnmappedTargetRef,
  TransitionRef,
  type RefinementMapAcquisition,
} from "../../refinement/domain/index.ts";
import { DesignUnitId } from "../domain/index.ts";
import type {
  RefinementMaterialsRepository,
} from "../usecase/index.ts";

export const REFINEMENT_MAP_BASENAME = "deep-spec-analysis-refinement-map.md";
export const REQUIREMENTS_MODEL_RELPATH = ["inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md"];

const strArr = (v: Json): string[] => (Array.isArray(v) ? (v.filter((x) => typeof x === "string") as string[]) : []);

// 旧 design-lib 系の extractSingleJsonFence と同値（唯一の json fence のみ採用）。
function extractSingleJsonFence(md: string): string | null {
  const fences = extractFences(md, "json");
  return fences.length === 1 ? (fences[0]?.body ?? null) : null;
}

export class RefinementMaterialsRepositoryImpl implements RefinementMaterialsRepository {
  readonly #mapSchemaPath: string;

  constructor(mapSchemaPath: string) {
    this.#mapSchemaPath = mapSchemaPath;
  }

  findById(id: RefinementMaterialsId): RefinementMaterials {
    const modelPath = id.modelArtifactPath().asString();
    const recordRoot = findRecordRoot(dirname(modelPath));
    const requirements = recordRoot === null ? null : this.#loadRequirements(recordRoot);
    if (recordRoot === null || requirements === null) return RefinementMaterials.inactive(id);
    const stageDir = dirname(modelPath);
    return RefinementMaterials.active(id, requirements, this.#loadMap(recordRoot, stageDir, modelPath));
  }

  #loadRequirements(recordRoot: string): RefinementRequirements | null {
    const path = join(recordRoot, ...REQUIREMENTS_MODEL_RELPATH);
    // join は空文字列を返さないため parse は失敗し得ない（型の網羅のみ——
    // 到達すれば inactive 側へ落ちるが、それは defect であって仕様ではない）。
    const idPath = ArtifactPath.parse(path);
    if (!idPath.ok) return null;
    if (!existsSync(path)) return null;
    const fence = extractSingleJsonFence(readFileSync(path, "utf-8"));
    if (fence === null) return null;
    let raw: Json;
    try {
      raw = JSON.parse(fence) as Json;
    } catch {
      return null;
    }
    if (!isObject(raw)) return null;
    const attributes: RefinementAttribute[] = [];
    const schema = isObject(raw.schema) ? raw.schema : {};
    for (const ent of Array.isArray(schema.entities) ? schema.entities : []) {
      if (!isObject(ent) || typeof ent.name !== "string") continue;
      for (const attr of Array.isArray(ent.attributes) ? ent.attributes : []) {
        if (!isObject(attr) || typeof attr.name !== "string" || !isObject(attr.type)) continue;
        const t = attr.type;
        if (t.kind !== "bool" && t.kind !== "int" && t.kind !== "enum") continue;
        attributes.push({
          path: AttributePath.reconstitute(`${ent.name}.${attr.name}`),
          kind: t.kind,
          min: typeof t.min === "number" ? AttributeBound.reconstitute(t.min) : undefined,
          max: typeof t.max === "number" ? AttributeBound.reconstitute(t.max) : undefined,
          values: Array.isArray(t.values) ? ReqAttributeValues.of(t.values.filter((v) => typeof v === "string") as string[]) : undefined,
        });
      }
    }
    const obligations: RefinementObligation[] = [];
    for (const ob of Array.isArray(raw.obligations) ? raw.obligations : []) {
      if (!isObject(ob) || typeof ob.id !== "string" || typeof ob.nature !== "string") continue;
      obligations.push({
        id: ObligationId.reconstitute(ob.id),
        nature: ObligationNature.reconstitute(ob.nature),
        frRefs: FrRefs.of(strArr(ob.frRefs)),
        assert: isObject(ob.assert) ? (ob.assert as unknown as Expression) : undefined,
        trigger: typeof ob.trigger === "string" ? ob.trigger : undefined,
        guard: isObject(ob.guard) ? (ob.guard as unknown as Expression) : undefined,
        effect: isObject(ob.effect) ? (ob.effect as unknown as Expression) : undefined,
      });
    }
    const scenarios: RefinementScenario[] = [];
    for (const sc of Array.isArray(raw.scenarios) ? raw.scenarios : []) {
      if (!isObject(sc) || typeof sc.id !== "string" || !isObject(sc.bindings)) continue;
      if (sc.kind !== "accept" && sc.kind !== "reject") continue;
      const bindings: RefinementScenario["bindings"] = {};
      for (const [k, v] of Object.entries(sc.bindings)) {
        if (typeof v === "boolean" || typeof v === "number" || typeof v === "string") bindings[k] = v;
      }
      scenarios.push({
        id: ScenarioId.reconstitute(sc.id),
        kind: sc.kind,
        frRefs: FrRefs.of(strArr(sc.frRefs)),
        bindings,
        event: isObject(sc.event) && typeof sc.event.trigger === "string" ? { trigger: sc.event.trigger } : undefined,
      });
    }
    return RefinementRequirements.reconstitute({
      id: FormalModelId.of(idPath.value),
      hash: ContentHash.ofText(canonicalStringify(raw)),
      attributes: RefinementAttributes.of(attributes),
      obligations: RefinementObligations.of(obligations),
      scenarios: RefinementScenarios.of(scenarios),
    });
  }

  #loadMap(recordRoot: string, stageDir: string, modelPath: string): RefinementMapAcquisition {
    const path = join(stageDir, REFINEMENT_MAP_BASENAME);
    if (!existsSync(path)) return { kind: "absent", error: null };
    // join は空文字列を返さないため parse は失敗し得ない（型の網羅のみ）。
    const mapPath = ArtifactPath.parse(path);
    if (!mapPath.ok) return { kind: "absent", error: "defect: refinement map path derivation produced an empty path" };
    const parsed = parseRefinementMapDocument(new Uint8Array(readFileSync(path)), RefinementMapId.of(mapPath.value), this.#mapSchemaPath);
    if (parsed.kind === "malformed") return { kind: "absent", error: parsed.error };
    const map = parsed.map;
    const reqModelPath = join(recordRoot, ...REQUIREMENTS_MODEL_RELPATH);
    const mapArtifact = relArtifact(recordRoot, path);
    const inputs = [
      { artifact: relArtifact(recordRoot, modelPath), sha256: ContentHash.ofText(readFileSync(modelPath, "utf-8")) },
      { artifact: mapArtifact, sha256: ContentHash.ofText(readFileSync(path, "utf-8")) },
      { artifact: relArtifact(recordRoot, reqModelPath), sha256: ContentHash.ofText(readFileSync(reqModelPath, "utf-8")) },
    ];
    return { kind: "loaded", map, mapArtifact, inputs };
  }
}

// 契約4 文書の共有パーサ——凍結エラー文言はここが唯一の発生点で、composite の
// absent(error) と RefinementMapRepository の corrupt.cause が常に一致する。
export type RefinementMapParse =
  | { readonly kind: "parsed"; readonly map: RefinementMap }
  | { readonly kind: "malformed"; readonly error: string };

export function parseRefinementMapDocument(bytes: Uint8Array, id: RefinementMapId, mapSchemaPath: string): RefinementMapParse {
  const md = Buffer.from(bytes).toString("utf-8");
  const fence = extractSingleJsonFence(md);
  if (fence === null) return { kind: "malformed", error: "refinement map does not contain exactly one ```json fence" };
  let raw: Json;
  try {
    raw = JSON.parse(fence) as Json;
  } catch (err) {
    return { kind: "malformed", error: `refinement map fence is not valid JSON: ${err instanceof Error ? err.message : String(err)}` };
  }
  try {
    const schemaDoc = JSON.parse(readFileSync(mapSchemaPath, "utf-8"));
    const errors: string[] = [];
    validateSchema(schemaDoc as never, schemaDoc as never, raw as never, "", errors);
    if (errors.length > 0) return { kind: "malformed", error: `refinement map does not conform to contract 4: ${errors[0]}` };
  } catch (err) {
    return { kind: "malformed", error: `refinement map schema unreadable: ${err instanceof Error ? err.message : String(err)}` };
  }
  const doc = raw as { [k: string]: Json };
  const units: RefinementUnitMap[] = [];
  for (const u of Array.isArray(doc.units) ? doc.units : []) {
    if (!isObject(u) || typeof u.unit !== "string") continue;
    const attrMap: AttributeMapping[] = [];
    for (const m of Array.isArray(u.attrMap) ? u.attrMap : []) {
      if (!isObject(m) || typeof m.req !== "string") continue;
      // enumMap が成立するときは enumMap が勝つ（旧実装の分岐順の保存）。
      if (isObject(m.enumMap) && typeof m.enumMap.from === "string" && isObject(m.enumMap.cases)) {
        const cases: { [k: string]: string } = {};
        for (const [k, v] of Object.entries(m.enumMap.cases)) {
          if (typeof v === "string") cases[k] = v;
        }
        attrMap.push({ kind: "enum-cases", req: AttributePath.reconstitute(m.req), from: m.enumMap.from, cases });
      } else if (isObject(m.expr)) {
        attrMap.push({ kind: "expression", req: AttributePath.reconstitute(m.req), expr: m.expr as unknown as Expression });
      } else {
        attrMap.push({ kind: "unspecified", req: AttributePath.reconstitute(m.req) });
      }
    }
    const eventMap: EventMapping[] = [];
    for (const e of Array.isArray(u.eventMap) ? u.eventMap : []) {
      if (!isObject(e) || typeof e.reqTrigger !== "string") continue;
      eventMap.push({
        reqTrigger: e.reqTrigger,
        transitions: TransitionRefs.of(strArr(e.transitions).map((t) => TransitionRef.reconstitute(t))),
        waived: isObject(e.waived) && typeof e.waived.reason === "string" ? { reason: e.waived.reason } : undefined,
      });
    }
    const unmapped: UnmappedTarget[] = [];
    for (const un of Array.isArray(u.unmapped) ? u.unmapped : []) {
      if (isObject(un) && typeof un.target === "string") {
        unmapped.push({ target: UnmappedTargetRef.reconstitute(un.target), reason: typeof un.reason === "string" ? un.reason : "" });
      }
    }
    units.push({
      unit: DesignUnitId.of(u.unit),
      attrMap: AttributeMappings.of(attrMap),
      eventMap: EventMappings.of(eventMap),
      unmapped: UnmappedDeclarations.of(unmapped),
    });
  }
  return {
    kind: "parsed",
    map: RefinementMap.reconstitute({
      id,
      requirementsIrHash: ContentHash.reconstitute(typeof doc.requirementsIrHash === "string" ? doc.requirementsIrHash : ""),
      designIrHash: ContentHash.reconstitute(typeof doc.designIrHash === "string" ? doc.designIrHash : ""),
      units: RefinementUnitMaps.of(units),
      sourceDocument: bytes,
    }),
  };
}
