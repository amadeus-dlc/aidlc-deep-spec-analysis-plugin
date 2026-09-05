import { flatMapResult } from "@deep-spec/kernel-infrastructure";
import { EnumerationMembers } from "@deep-spec/kernel-domain";
import { AttributeKind } from "@deep-spec/kernel-domain";
import { EnumerationMember } from "@deep-spec/kernel-domain";
import { ErrorMessage } from "@deep-spec/kernel-domain";
import { decodeDeclaredBindings } from "@deep-spec/kernel-adapter";
import {
  DeclaredDigest,
  RequirementIdentifier,
  ArtifactPath,
  DeclaredBound,
  ErrorMessages,
  IntermediateRepresentationVersion,
  type Expression,
} from "@deep-spec/kernel-domain";
import { extractFences, readContractSchema, writeFileAtomically } from "@deep-spec/kernel-adapter";

// 契約1 IR の検査材料ゲートウェイ。markdown フェンスの抽出、JSON 解釈、
// 契約スキーマの適用、そして「生 Json をどう寛容に読むか」をここに閉じ込め、
// use-case へは型付きの材料だけを渡す。
//
// 旧 aidlc-sensor-deep-spec-ir-valid.ts の main 前半＋ semanticErrors の
// 黙殺条件からの逐語移植。型宣言を欠く属性を kind: "" でカタログに載せる
// 挙動（参照解決の可否が変わる）を含め、そのまま保存する。

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname } from "node:path";

import { type Json, isObject, validateSchema } from "@deep-spec/kernel-infrastructure";
import { type Result, combineResults, traverseResult, err, ok } from "@deep-spec/kernel-infrastructure";

import { RepositoryError } from "@deep-spec/kernel-usecase";
import {
  FunctionalRequirementReferenceClaim,
  IntermediateRepresentationAttributeDeclaration,
  IntermediateRepresentationBackgroundDeclaration,
  IntermediateRepresentationEntityDeclaration,
  FunctionalRequirementReferences,
  IntermediateRepresentationAttributeDeclarations,
  IntermediateRepresentationBackgroundDeclarations,
  IntermediateRepresentationEntityDeclarations,
  IntermediateRepresentationModelDeclaration,
  IntermediateRepresentationObligationDeclarations,
  IntermediateRepresentationScenarioDeclarations,
  IntermediateRepresentationObligationDeclaration,
  IntermediateRepresentationScenarioDeclaration,
  FunctionalRequirementReferenceClaims,
  IntermediateRepresentationValidationMaterials,
  IntermediateRepresentationValidationMaterialsIdentifier,
  RequirementsSourceIdentifier,
  ScenarioIdentifier,
  ObligationIdentifier,
  IntermediateRepresentationEntityName,
  IntermediateRepresentationAttributeName,
  BackgroundAssumptionIdentifier,
  IntermediateRepresentationTemporalDeclaration,
} from "@deep-spec/requirements-domain";
import { IntermediateRepresentationValidationMaterialsRepository } from "@deep-spec/requirements-usecase";
import { IntermediateRepresentationValidationMaterialsConfiguration } from "./intermediate-representation-validation-materials-configuration.ts";

const FORMAL_MODEL_BASENAME = "deep-spec-analysis-formal-model.md";

function asExpression(v: Json): Expression | undefined {
  return isObject(v) ? (v as unknown as Expression) : undefined;
}

function buildView(ir: { [k: string]: Json }): Result<IntermediateRepresentationModelDeclaration, string> {
  const entities: IntermediateRepresentationEntityDeclaration[] = [];
  const schema = isObject(ir.schema) ? ir.schema : {};
  for (const ent of Array.isArray(schema.entities) ? schema.entities : []) {
    if (!isObject(ent) || typeof ent.name !== "string") continue;
    const name = IntermediateRepresentationEntityName.parse(ent.name);
    if (!name.ok) return err(JSON.stringify(name.error));
    const attributes: IntermediateRepresentationAttributeDeclaration[] = [];
    for (const attr of Array.isArray(ent.attributes) ? ent.attributes : []) {
      if (!isObject(attr) || typeof attr.name !== "string") continue;
      const t = isObject(attr.type) ? attr.type : {};
      const kind = AttributeKind.parse(typeof t.kind === "string" ? t.kind : "");
      if (!kind.ok) return err(JSON.stringify(kind.error));
      const name = IntermediateRepresentationAttributeName.parse(attr.name);
      if (!name.ok) return err(JSON.stringify(name.error));
      const members = flatMapResult(traverseResult(Array.isArray(t.values) ? t.values.filter((v): v is string => typeof v === "string") : [], EnumerationMember.parse), EnumerationMembers.parse);
      if (!members.ok) return err(JSON.stringify(members.error));
      attributes.push(IntermediateRepresentationAttributeDeclaration.of({
        name: name.value,
        kind: kind.value,
        values: Array.isArray(t.values) ? members.value : undefined,
        min: typeof t.min === "number" ? DeclaredBound.of(t.min) : undefined,
        max: typeof t.max === "number" ? DeclaredBound.of(t.max) : undefined,
      }));
    }
    entities.push(IntermediateRepresentationEntityDeclaration.of({ name: name.value, attributes: IntermediateRepresentationAttributeDeclarations.of(attributes) }));
  }

  const obligations: IntermediateRepresentationObligationDeclaration[] = [];
  for (const ob of Array.isArray(ir.obligations) ? ir.obligations : []) {
    if (!isObject(ob) || typeof ob.id !== "string") continue;
    const temporal = isObject(ob.temporal) ? ob.temporal : null;
    const id = ObligationIdentifier.parse(ob.id);
    if (!id.ok) return err(JSON.stringify(id.error));
    const constructed = IntermediateRepresentationObligationDeclaration.parse({
      id: id.value,
      assert: asExpression(ob.assert ?? null),
      guard: asExpression(ob.guard ?? null),
      effect: asExpression(ob.effect ?? null),
      temporal:
        temporal === null
          ? undefined
          : IntermediateRepresentationTemporalDeclaration.of({
              assert: asExpression(temporal.assert ?? null),
              from: asExpression(temporal.from ?? null),
              to: asExpression(temporal.to ?? null),
            }),
    });
    if (!constructed.ok) return err(JSON.stringify(constructed.error));
    obligations.push(constructed.value);
  }

  const scenarios: IntermediateRepresentationScenarioDeclaration[] = [];
  for (const sc of Array.isArray(ir.scenarios) ? ir.scenarios : []) {
    if (!isObject(sc) || typeof sc.id !== "string") continue;
    const bindings = decodeDeclaredBindings(isObject(sc.bindings) ? sc.bindings : {});
    if (!bindings.ok) return err(bindings.error);
    const id = ScenarioIdentifier.parse(sc.id);
    if (!id.ok) return err(JSON.stringify(id.error));
    const constructed = IntermediateRepresentationScenarioDeclaration.parse({
      id: id.value,
      bindings: bindings.value,
      hasEvent: isObject(sc.event ?? null),
      expect: asExpression(sc.expect ?? null),
    });
    if (!constructed.ok) return err(JSON.stringify(constructed.error));
    scenarios.push(constructed.value);
  }

  const background: IntermediateRepresentationBackgroundDeclaration[] = [];
  for (const bg of Array.isArray(ir.background) ? ir.background : []) {
    if (!isObject(bg) || typeof bg.id !== "string") continue;
    const id = BackgroundAssumptionIdentifier.parse(bg.id);
    if (!id.ok) return err(JSON.stringify(id.error));
    const constructed = IntermediateRepresentationBackgroundDeclaration.parse({ id: id.value, assert: asExpression(bg.assert ?? null) });
    if (!constructed.ok) return err(JSON.stringify(constructed.error));
    background.push(constructed.value);
  }

  return ok(IntermediateRepresentationModelDeclaration.of({
    entities: IntermediateRepresentationEntityDeclarations.of(entities),
    obligations: IntermediateRepresentationObligationDeclarations.of(obligations),
    scenarios: IntermediateRepresentationScenarioDeclarations.of(scenarios),
    background: IntermediateRepresentationBackgroundDeclarations.of(background),
  }));
}

// owner は id、無ければ `<section>[<index>]`（旧 collectFrRefs の逐語）。
function collectFunctionalRequirementReferenceClaims(ir: { [k: string]: Json }): Result<FunctionalRequirementReferenceClaim[], string> {
  const claims: FunctionalRequirementReferenceClaim[] = [];
  for (const section of ["obligations", "scenarios", "unformalized"] as const) {
    const arr = Array.isArray(ir[section]) ? (ir[section] as Json[]) : [];
    for (const [i, entry] of arr.entries()) {
      if (!isObject(entry)) continue;
      const owner = typeof entry.id === "string" ? entry.id : `${section}[${i}]`;
      const refs = entry.frRefs ?? null;
      if (!Array.isArray(refs)) continue;
      const parsed = flatMapResult(traverseResult(refs.filter((r): r is string => typeof r === "string"), RequirementIdentifier.parse), FunctionalRequirementReferences.parse);
      if (!parsed.ok) return err(JSON.stringify(parsed.error));
      claims.push(FunctionalRequirementReferenceClaim.of(owner, parsed.value));
    }
  }
  return ok(claims);
}

export class IntermediateRepresentationValidationMaterialsRepositoryImplementation implements IntermediateRepresentationValidationMaterialsRepository {
  readonly #schemaPath: string;

  constructor(config: IntermediateRepresentationValidationMaterialsConfiguration) {
    this.#schemaPath = config.schemaPath;
  }

  findById(id: IntermediateRepresentationValidationMaterialsIdentifier): Result<IntermediateRepresentationValidationMaterials, RepositoryError> {
    const outputPath = id.modelId().artifactPath().asString();
    // 機能形式モデル以外・不在はこの Repository の収蔵外（not-found——use case
    // が pass-through へ写像する旧 not-applicable の凍結挙動）。
    if (basename(outputPath) !== FORMAL_MODEL_BASENAME || !existsSync(outputPath)) {
      return err({ kind: "not-found", path: outputPath });
    }

    const corrupt = (cause: string): Result<IntermediateRepresentationValidationMaterials, RepositoryError> =>
      err({ kind: "corrupt", path: outputPath, cause });

    // existsSync 後の競合（削除・権限変更・ディレクトリ）でも Result 契約を
    // 守る——読取失敗は io-failed（use case は corrupt と同じ verdict 写像）。
    let bytes: Buffer;
    try {
      bytes = readFileSync(outputPath);
    } catch (e) {
      return err({ kind: "io-failed", operation: "read", path: outputPath, cause: e instanceof Error ? e.message : String(e) });
    }
    const md = bytes.toString("utf-8");
    const fences = extractFences(md, "json").map((f) => f.body);
    if (fences.length !== 1) {
      return corrupt(`formal model must contain exactly one \`\`\`json fence (found ${fences.length})`);
    }

    let ir: Json;
    try {
      ir = JSON.parse(fences[0] ?? "");
    } catch (e) {
      return corrupt(`IR fence is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!isObject(ir)) {
      return corrupt("IR fence must contain a JSON object");
    }

    if (!existsSync(this.#schemaPath)) {
      return corrupt(`IR schema not installed at ${this.#schemaPath} — run plugin sync`);
    }
    const schema = readContractSchema(this.#schemaPath);
    if (!schema.ok) {
      return corrupt(`IR schema unreadable: ${schema.error.cause}`);
    }

    const schemaErrors: string[] = [];
    validateSchema(schema.value, schema.value, ir, "", schemaErrors);
    const messages = flatMapResult(traverseResult(schemaErrors, ErrorMessage.parse), ErrorMessages.parse);
    if (!messages.ok) return corrupt(JSON.stringify(messages.error));

    // dirnameで導出した非空パスは内部の組み立て。違反があればpanicとして伝播する。
    const recordRoot = ArtifactPath.of(dirname(dirname(dirname(outputPath))));
    const parsed = combineResults({
      irVersion: IntermediateRepresentationVersion.parse(typeof ir.irVersion === "string" ? ir.irVersion : ""),
      declaredDigest: typeof ir.sourceDigest === "string" ? DeclaredDigest.parse(ir.sourceDigest) : ok(null),
    });
    if (!parsed.ok) return corrupt(JSON.stringify(parsed.error));
    const view = buildView(ir);
    if (!view.ok) return corrupt(view.error);
    const claims = collectFunctionalRequirementReferenceClaims(ir);
    if (!claims.ok) return corrupt(claims.error);

    return ok(
      IntermediateRepresentationValidationMaterials.of({
        id,
        irVersion: parsed.value.irVersion,
        schemaErrors: messages.value,
        view: view.value,
        functionalRequirementReferenceClaims: FunctionalRequirementReferenceClaims.of(claims.value),
        declaredDigest: parsed.value.declaredDigest,
        sourceId: RequirementsSourceIdentifier.of(recordRoot),
        sourceDocument: new Uint8Array(bytes),
      }),
    );
  }

  // 往復則: findById が読んだ原文をバイト逐語で書き戻す（findById∘store 恒等）。
  store(materials: IntermediateRepresentationValidationMaterials): Result<void, RepositoryError> {
    const outputPath = materials.id().modelId().artifactPath().asString();
    const bytes = materials.sourceDocument();
    try {
      writeFileAtomically(outputPath, bytes);
      return ok(undefined);
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path: outputPath, cause: e instanceof Error ? e.message : String(e) });
    }
  }
}
