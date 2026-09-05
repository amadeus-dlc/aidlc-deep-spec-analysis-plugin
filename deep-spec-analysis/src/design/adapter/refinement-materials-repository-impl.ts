import { decodeDomainValues, extractFences, findRecordRoot, relArtifact } from "@deep-spec/kernel-adapter";
import { RequirementId, ArtifactPath, ContentHash, FrRefs, TriggerName, type Expression } from "@deep-spec/kernel-domain";

// RefinementMaterialsRepository の実 Gateway 実装。レコードルート歩行・要件形式
// モデルの取得（不在のみ inactive、取得失敗・不正入力は Result）・refinement map の fence/JSON/
// 契約4 スキーマ検証（凍結エラーメッセージ 4 種）・inputs 台帳（3 成果物の
// 相対パス＋sha256）をここで解決する。契約4 スキーマのパスは entry が注入する。
// 旧 refinement-lib の loadRequirementsIr / loadRefinementMap と旧 entry の
// inputs 組成からの逐語移植。

import { type Result, err, ok } from "@deep-spec/kernel-infrastructure";
import { type Json, isObject, validateSchema, strArr, canonicalStringify } from "@deep-spec/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec/kernel-usecase";
import type { RefinementMaterialsId } from "@deep-spec/design-domain";
import { AttributePath, ObligationId, ObligationNature, ScenarioId } from "@deep-spec/design-domain";
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
  AttributeMapping,
  EventMapping,
  RefinementAttribute,
  RefinementObligation,
  RefinementScenario,
  RefinementUnitMap,
  UnmappedTarget,
  RefinementMap,
  RefinementMaterials,
  RefinementRequirements,
  UnmappedTargetRef,
  TransitionRef,
  RefinementMapAcquisition,
} from "@deep-spec/design-domain";
import { DesignUnitId,
  DesignInputAnchor,
} from "@deep-spec/design-domain";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { RefinementMapParse } from "./refinement-map-parse.ts";
import {
  RefinementMaterialsRepository,
} from "@deep-spec/design-usecase";

export const REFINEMENT_MAP_BASENAME = "deep-spec-analysis-refinement-map.md";
export const REQUIREMENTS_MODEL_RELPATH = ["inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md"];

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

  findById(id: RefinementMaterialsId): Result<RefinementMaterials, RepositoryError> {
    const decoded = decodeDomainValues(() => this.#findById(id));
    return decoded.ok ? decoded.value : err({ kind: "corrupt", path: id.modelArtifactPath().asString(), cause: decoded.error });
  }

  #findById(id: RefinementMaterialsId): Result<RefinementMaterials, RepositoryError> {
    const modelPath = id.modelArtifactPath().asString();
    const recordRoot = findRecordRoot(dirname(modelPath));
    if (recordRoot === null) return ok(RefinementMaterials.inactive(id));
    const requirements = this.#loadRequirements(recordRoot);
    if (!requirements.ok) {
      return requirements.error.kind === "not-found" ? ok(RefinementMaterials.inactive(id)) : err(requirements.error);
    }
    const map = this.#loadMap(recordRoot, dirname(modelPath), modelPath, requirements.value.bytes);
    if (!map.ok) return err(map.error);
    return ok(RefinementMaterials.active(id, requirements.value.model, map.value));
  }

  #read(path: string): Result<Uint8Array, RepositoryError> {
    try {
      return ok(new Uint8Array(readFileSync(path)));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return err({ kind: "not-found", path });
      return err({ kind: "io-failed", operation: "read", path, cause: e instanceof Error ? e.message : String(e) });
    }
  }

  #loadRequirements(recordRoot: string): Result<{ model: RefinementRequirements; bytes: Uint8Array }, RepositoryError> {
    const path = join(recordRoot, ...REQUIREMENTS_MODEL_RELPATH);
    const bytes = this.#read(path);
    if (!bytes.ok) return err(bytes.error);
    const fence = extractSingleJsonFence(Buffer.from(bytes.value).toString("utf-8"));
    if (fence === null) return err({ kind: "corrupt", path, cause: "requirements model must contain exactly one JSON fence" });
    let raw: Json;
    try {
      raw = JSON.parse(fence) as Json;
    } catch (e) {
      return err({ kind: "corrupt", path, cause: e instanceof Error ? e.message : String(e) });
    }
    if (!isObject(raw) || typeof raw.irVersion !== "string" || !isObject(raw.schema) ||
      !Array.isArray(raw.schema.entities) || !Array.isArray(raw.obligations) || !Array.isArray(raw.scenarios)) {
      return err({ kind: "corrupt", path, cause: "requirements model lacks its version, schema, obligations or scenarios" });
    }
    const attributes: RefinementAttribute[] = [];
    const schema = isObject(raw.schema) ? raw.schema : {};
    for (const ent of Array.isArray(schema.entities) ? schema.entities : []) {
      if (!isObject(ent) || typeof ent.name !== "string") continue;
      for (const attr of Array.isArray(ent.attributes) ? ent.attributes : []) {
        if (!isObject(attr) || typeof attr.name !== "string" || !isObject(attr.type)) continue;
        const t = attr.type;
        if (t.kind !== "bool" && t.kind !== "int" && t.kind !== "enum") continue;
        attributes.push(RefinementAttribute.of({
          path: AttributePath.of(`${ent.name}.${attr.name}`),
          kind: t.kind,
          values: Array.isArray(t.values) ? ReqAttributeValues.of(t.values.filter((v) => typeof v === "string") as string[]) : undefined,
        }));
      }
    }
    const obligations: RefinementObligation[] = [];
    for (const ob of Array.isArray(raw.obligations) ? raw.obligations : []) {
      if (!isObject(ob) || typeof ob.id !== "string" || typeof ob.nature !== "string") continue;
      obligations.push(RefinementObligation.of({
        id: ObligationId.of(ob.id),
        nature: ObligationNature.of(ob.nature),
        frRefs: FrRefs.of(Array.from(strArr(ob.frRefs), (raw) => RequirementId.of(raw))),
        assert: isObject(ob.assert) ? (ob.assert as unknown as Expression) : undefined,
        trigger: typeof ob.trigger === "string" ? TriggerName.of(ob.trigger) : undefined,
        guard: isObject(ob.guard) ? (ob.guard as unknown as Expression) : undefined,
        effect: isObject(ob.effect) ? (ob.effect as unknown as Expression) : undefined,
      }));
    }
    const scenarios: RefinementScenario[] = [];
    for (const sc of Array.isArray(raw.scenarios) ? raw.scenarios : []) {
      if (!isObject(sc) || typeof sc.id !== "string" || !isObject(sc.bindings)) continue;
      if (sc.kind !== "accept" && sc.kind !== "reject") continue;
      const bindings: Record<string, boolean | number | string> = {};
      for (const [k, v] of Object.entries(sc.bindings)) {
        if (typeof v === "boolean" || typeof v === "number" || typeof v === "string") bindings[k] = v;
      }
      scenarios.push(RefinementScenario.of({
        id: ScenarioId.of(sc.id),
        kind: sc.kind,
        frRefs: FrRefs.of(Array.from(strArr(sc.frRefs), (raw) => RequirementId.of(raw))),
        bindings,
        event: isObject(sc.event) && typeof sc.event.trigger === "string" ? { trigger: TriggerName.of(sc.event.trigger) } : undefined,
      }));
    }
    const model = RefinementRequirements.of({
      id: FormalModelId.of(ArtifactPath.of(path)),
      hash: ContentHash.ofText(canonicalStringify(raw)),
      attributes: RefinementAttributes.of(attributes),
      obligations: RefinementObligations.of(obligations),
      scenarios: RefinementScenarios.of(scenarios),
    });
    return ok({ model, bytes: bytes.value });
  }

  #loadMap(recordRoot: string, stageDir: string, modelPath: string, requirementsBytes: Uint8Array): Result<RefinementMapAcquisition, RepositoryError> {
    const path = join(stageDir, REFINEMENT_MAP_BASENAME);
    const bytes = this.#read(path);
    if (!bytes.ok) {
      return bytes.error.kind === "not-found" ? ok(RefinementMapAcquisition.absent(null)) : err(bytes.error);
    }
    const parsed = parseRefinementMapDocument(bytes.value, RefinementMapId.of(ArtifactPath.of(path)), this.#mapSchemaPath);
    if (parsed.kind === "malformed") return ok(RefinementMapAcquisition.absent(parsed.error));
    const modelBytes = this.#read(modelPath);
    if (!modelBytes.ok) return err(modelBytes.error);
    const reqModelPath = join(recordRoot, ...REQUIREMENTS_MODEL_RELPATH);
    const mapArtifact = relArtifact(recordRoot, path);
    const inputs = [
      DesignInputAnchor.of({ artifact: relArtifact(recordRoot, modelPath), sha256: ContentHash.ofText(Buffer.from(modelBytes.value).toString("utf-8")) }),
      DesignInputAnchor.of({ artifact: mapArtifact, sha256: ContentHash.ofText(Buffer.from(bytes.value).toString("utf-8")) }),
      DesignInputAnchor.of({ artifact: relArtifact(recordRoot, reqModelPath), sha256: ContentHash.ofText(Buffer.from(requirementsBytes).toString("utf-8")) }),
    ];
    return ok(RefinementMapAcquisition.loaded(parsed.map, ArtifactPath.of(mapArtifact), inputs));
  }

}

export function parseRefinementMapDocument(bytes: Uint8Array, id: RefinementMapId, mapSchemaPath: string): ReturnType<typeof parseRefinementMapDocumentValue> {
  const decoded = decodeDomainValues(() => parseRefinementMapDocumentValue(bytes, id, mapSchemaPath));
  return decoded.ok ? decoded.value : { kind: "malformed", error: decoded.error };
}

function parseRefinementMapDocumentValue(bytes: Uint8Array, id: RefinementMapId, mapSchemaPath: string): RefinementMapParse {
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
        attrMap.push(AttributeMapping.enumCases(AttributePath.of(m.req), m.enumMap.from, cases));
      } else if (isObject(m.expr)) {
        attrMap.push(AttributeMapping.expression(AttributePath.of(m.req), m.expr as unknown as Expression));
      } else {
        attrMap.push(AttributeMapping.unspecified(AttributePath.of(m.req)));
      }
    }
    const eventMap: EventMapping[] = [];
    for (const e of Array.isArray(u.eventMap) ? u.eventMap : []) {
      if (!isObject(e) || typeof e.reqTrigger !== "string") continue;
      eventMap.push(EventMapping.of({
        reqTrigger: TriggerName.of(e.reqTrigger),
        transitions: TransitionRefs.of(strArr(e.transitions).map((t) => TransitionRef.of(t))),
        waived: isObject(e.waived) && typeof e.waived.reason === "string" ? { reason: e.waived.reason } : undefined,
      }));
    }
    const unmapped: UnmappedTarget[] = [];
    for (const un of Array.isArray(u.unmapped) ? u.unmapped : []) {
      if (isObject(un) && typeof un.target === "string") {
        unmapped.push(UnmappedTarget.of({ target: UnmappedTargetRef.of(un.target), reason: typeof un.reason === "string" ? un.reason : "" }));
      }
    }
    units.push(RefinementUnitMap.of({
      unit: DesignUnitId.of(u.unit),
      attrMap: AttributeMappings.of(attrMap),
      eventMap: EventMappings.of(eventMap),
      unmapped: UnmappedDeclarations.of(unmapped),
    }));
  }
  return {
    kind: "parsed",
    map: RefinementMap.of({
      id,
      requirementsIrHash: ContentHash.of(typeof doc.requirementsIrHash === "string" ? doc.requirementsIrHash : ""),
      designIrHash: ContentHash.of(typeof doc.designIrHash === "string" ? doc.designIrHash : ""),
      units: RefinementUnitMaps.of(units),
      sourceDocument: bytes,
    }),
  };
}
