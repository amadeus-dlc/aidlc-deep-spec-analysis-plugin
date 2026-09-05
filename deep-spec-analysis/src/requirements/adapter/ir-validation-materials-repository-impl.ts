import { AttributeKind } from "@deep-spec/kernel-domain";
import { EnumMember } from "@deep-spec/kernel-domain";
import { ErrorMessage } from "@deep-spec/kernel-domain";
import { decodeDeclaredBindings } from "@deep-spec/kernel-adapter";
import {
  DeclaredDigest,
  RequirementId,
  ArtifactPath,
  DeclaredBound,
  ErrorMessages,
  IrVersion,
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

import type { RepositoryError } from "@deep-spec/kernel-usecase";
import {
  FunctionalRequirementReferenceClaim,
  IrAttributeDecl,
  IrBackgroundDecl,
  IrEntityDecl,
  FunctionalRequirementReferences,
  IrAttributeDecls,
  IrBackgroundDecls,
  IrDeclaredValues,
  IrEntityDecls,
  IrModelDecl,
  IrObligationDecls,
  IrScenarioDecls,
  IrObligationDecl,
  IrScenarioDecl,
  FunctionalRequirementReferenceClaims,
  IrValidationMaterials,
  IrValidationMaterialsId,
  RequirementsSourceId,
  ScenarioId,
  ObligationId,
  IrEntityName,
  IrAttributeName,
  BackgroundAssumptionId, IrTemporalDecl } from "@deep-spec/requirements-domain";
import type { IrValidationMaterialsRepository } from "@deep-spec/requirements-usecase";
import type { IrValidationMaterialsConfig } from "./ir-validation-materials-config.ts";

const FORMAL_MODEL_BASENAME = "deep-spec-analysis-formal-model.md";

function asExpression(v: Json): Expression | undefined {
  return isObject(v) ? (v as unknown as Expression) : undefined;
}

function buildView(ir: { [k: string]: Json }): Result<IrModelDecl, string> {
  const entities: IrEntityDecl[] = [];
  const schema = isObject(ir.schema) ? ir.schema : {};
  for (const ent of Array.isArray(schema.entities) ? schema.entities : []) {
    if (!isObject(ent) || typeof ent.name !== "string") continue;
    const name = IrEntityName.parse(ent.name);
    if (!name.ok) return err(JSON.stringify(name.error));
    const attributes: IrAttributeDecl[] = [];
    for (const attr of Array.isArray(ent.attributes) ? ent.attributes : []) {
      if (!isObject(attr) || typeof attr.name !== "string") continue;
      const t = isObject(attr.type) ? attr.type : {};
      const kind = AttributeKind.parse(typeof t.kind === "string" ? t.kind : "");
      if (!kind.ok) return err(JSON.stringify(kind.error));
      const name = IrAttributeName.parse(attr.name);
      if (!name.ok) return err(JSON.stringify(name.error));
      const members = traverseResult(Array.isArray(t.values) ? t.values.filter((v): v is string => typeof v === "string") : [], EnumMember.parse);
      if (!members.ok) return err(JSON.stringify(members.error));
      attributes.push(IrAttributeDecl.of({
        name: name.value,
        kind: kind.value,
        values: Array.isArray(t.values) ? IrDeclaredValues.of(members.value) : undefined,
        min: typeof t.min === "number" ? DeclaredBound.of(t.min) : undefined,
        max: typeof t.max === "number" ? DeclaredBound.of(t.max) : undefined,
      }));
    }
    entities.push(IrEntityDecl.of({ name: name.value, attributes: IrAttributeDecls.of(attributes) }));
  }

  const obligations: IrObligationDecl[] = [];
  for (const ob of Array.isArray(ir.obligations) ? ir.obligations : []) {
    if (!isObject(ob) || typeof ob.id !== "string") continue;
    const temporal = isObject(ob.temporal) ? ob.temporal : null;
    const id = ObligationId.parse(ob.id);
    if (!id.ok) return err(JSON.stringify(id.error));
    obligations.push(IrObligationDecl.of({
      id: id.value,
      assert: asExpression(ob.assert ?? null),
      guard: asExpression(ob.guard ?? null),
      effect: asExpression(ob.effect ?? null),
      temporal:
        temporal === null
          ? undefined
          : IrTemporalDecl.of({
              assert: asExpression(temporal.assert ?? null),
              from: asExpression(temporal.from ?? null),
              to: asExpression(temporal.to ?? null),
            }),
    }));
  }

  const scenarios: IrScenarioDecl[] = [];
  for (const sc of Array.isArray(ir.scenarios) ? ir.scenarios : []) {
    if (!isObject(sc) || typeof sc.id !== "string") continue;
    const bindings = decodeDeclaredBindings(isObject(sc.bindings) ? sc.bindings : {});
    if (!bindings.ok) return err(bindings.error);
    const id = ScenarioId.parse(sc.id);
    if (!id.ok) return err(JSON.stringify(id.error));
    scenarios.push(IrScenarioDecl.of({
      id: id.value,
      bindings: bindings.value,
      hasEvent: isObject(sc.event ?? null),
      expect: asExpression(sc.expect ?? null),
    }));
  }

  const background: IrBackgroundDecl[] = [];
  for (const bg of Array.isArray(ir.background) ? ir.background : []) {
    if (!isObject(bg) || typeof bg.id !== "string") continue;
    const id = BackgroundAssumptionId.parse(bg.id);
    if (!id.ok) return err(JSON.stringify(id.error));
    background.push(IrBackgroundDecl.of({ id: id.value, assert: asExpression(bg.assert ?? null) }));
  }

  return ok(IrModelDecl.of({
    entities: IrEntityDecls.of(entities),
    obligations: IrObligationDecls.of(obligations),
    scenarios: IrScenarioDecls.of(scenarios),
    background: IrBackgroundDecls.of(background),
  }));
}

// owner は id、無ければ `<section>[<index>]`（旧 collectFrRefs の逐語）。
function collectFrClaims(ir: { [k: string]: Json }): Result<FunctionalRequirementReferenceClaim[], string> {
  const claims: FunctionalRequirementReferenceClaim[] = [];
  for (const section of ["obligations", "scenarios", "unformalized"] as const) {
    const arr = Array.isArray(ir[section]) ? (ir[section] as Json[]) : [];
    for (const [i, entry] of arr.entries()) {
      if (!isObject(entry)) continue;
      const owner = typeof entry.id === "string" ? entry.id : `${section}[${i}]`;
      const refs = entry.frRefs ?? null;
      if (!Array.isArray(refs)) continue;
      const parsed = traverseResult(refs.filter((r): r is string => typeof r === "string"), RequirementId.parse);
      if (!parsed.ok) return err(JSON.stringify(parsed.error));
      claims.push(FunctionalRequirementReferenceClaim.of(owner, FunctionalRequirementReferences.of(parsed.value)));
    }
  }
  return ok(claims);
}

export class IrValidationMaterialsRepositoryImpl implements IrValidationMaterialsRepository {
  readonly #schemaPath: string;

  constructor(config: IrValidationMaterialsConfig) {
    this.#schemaPath = config.schemaPath;
  }

  findById(id: IrValidationMaterialsId): Result<IrValidationMaterials, RepositoryError> {
    const outputPath = id.modelId().artifactPath().asString();
    // 機能形式モデル以外・不在はこの Repository の収蔵外（not-found——use case
    // が pass-through へ写像する旧 not-applicable の凍結挙動）。
    if (basename(outputPath) !== FORMAL_MODEL_BASENAME || !existsSync(outputPath)) {
      return err({ kind: "not-found", path: outputPath });
    }

    const corrupt = (cause: string): Result<IrValidationMaterials, RepositoryError> =>
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
    const messages = traverseResult(schemaErrors, ErrorMessage.parse);
    if (!messages.ok) return corrupt(JSON.stringify(messages.error));

    // dirnameで導出した非空パスは内部の組み立て。違反があればpanicとして伝播する。
    const recordRoot = ArtifactPath.of(dirname(dirname(dirname(outputPath))));
    const parsed = combineResults({
      irVersion: IrVersion.parse(typeof ir.irVersion === "string" ? ir.irVersion : ""),
      declaredDigest: typeof ir.sourceDigest === "string" ? DeclaredDigest.parse(ir.sourceDigest) : ok(null),
    });
    if (!parsed.ok) return corrupt(JSON.stringify(parsed.error));
    const view = buildView(ir);
    if (!view.ok) return corrupt(view.error);
    const claims = collectFrClaims(ir);
    if (!claims.ok) return corrupt(claims.error);

    return ok(
      IrValidationMaterials.of({
        id,
        irVersion: parsed.value.irVersion,
        schemaErrors: ErrorMessages.of(messages.value),
        view: view.value,
        frClaims: FunctionalRequirementReferenceClaims.of(claims.value),
        declaredDigest: parsed.value.declaredDigest,
        sourceId: RequirementsSourceId.of(recordRoot),
        sourceDocument: new Uint8Array(bytes),
      }),
    );
  }

  // 往復則: findById が読んだ原文をバイト逐語で書き戻す（findById∘store 恒等）。
  store(materials: IrValidationMaterials): Result<void, RepositoryError> {
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
