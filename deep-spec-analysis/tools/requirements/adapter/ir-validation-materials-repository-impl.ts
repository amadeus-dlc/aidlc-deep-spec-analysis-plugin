// 契約1 IR の検査材料ゲートウェイ。markdown フェンスの抽出、JSON 解釈、
// 契約スキーマの適用、そして「生 Json をどう寛容に読むか」をここに閉じ込め、
// use-case へは型付きの材料だけを渡す。
//
// 旧 aidlc-sensor-deep-spec-ir-valid.ts の main 前半＋ semanticErrors の
// 黙殺条件からの逐語移植。型宣言を欠く属性を kind: "" でカタログに載せる
// 挙動（参照解決の可否が変わる）を含め、そのまま保存する。

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import {
  type Json,
  extractFences,
  isObject,
  readContractSchema,
  validateSchema,
  writeFileAtomically,
} from "../../kernel/adapter/index.ts";
import { ArtifactPath, AttributeBound, ErrorMessages, IrVersion, type Expression } from "../../kernel/domain/index.ts";
import { type Result, err, ok } from "../../kernel/infrastructure/index.ts";
import type { RepositoryError } from "../../kernel/usecase/index.ts";
import {
  type FrRefClaim,
  IrAttributeDecl,
  type IrBackgroundDecl,
  type IrEntityDecl,
  FrRefs,
  IrAttributeDecls,
  IrBackgroundDecls,
  IrBindingPairs,
  IrDeclaredValues,
  IrEntityDecls,
  IrModelDecl,
  IrObligationDecls,
  IrScenarioDecls,
  type IrObligationDecl,
  type IrScenarioDecl,
  FrRefClaims,
  IrValidationMaterials,
  IrValidationMaterialsId,
  RequirementsSourceId,
  ScenarioId,
  ObligationId,
  IrEntityName,
  IrAttributeName,
  BackgroundAssumptionId,
} from "../domain/index.ts";
import type { IrValidationMaterialsRepository } from "../usecase/index.ts";
import type { IrValidationMaterialsConfig } from "./ir-validation-materials-config.ts";

const FORMAL_MODEL_BASENAME = "deep-spec-analysis-formal-model.md";


function asExpression(v: Json): Expression | undefined {
  return isObject(v) ? (v as unknown as Expression) : undefined;
}

function buildView(ir: { [k: string]: Json }): IrModelDecl {
  const entities: IrEntityDecl[] = [];
  const schema = isObject(ir.schema) ? ir.schema : {};
  for (const ent of Array.isArray(schema.entities) ? schema.entities : []) {
    if (!isObject(ent) || typeof ent.name !== "string") continue;
    const attributes: IrAttributeDecl[] = [];
    for (const attr of Array.isArray(ent.attributes) ? ent.attributes : []) {
      if (!isObject(attr) || typeof attr.name !== "string") continue;
      const t = isObject(attr.type) ? attr.type : {};
      attributes.push(IrAttributeDecl.reconstitute({
        name: IrAttributeName.reconstitute(attr.name),
        kind: typeof t.kind === "string" ? t.kind : "",
        values: Array.isArray(t.values) ? IrDeclaredValues.of(t.values.filter((v) => typeof v === "string") as string[]) : undefined,
        min: typeof t.min === "number" ? AttributeBound.reconstitute(t.min) : undefined,
        max: typeof t.max === "number" ? AttributeBound.reconstitute(t.max) : undefined,
      }));
    }
    entities.push({ name: IrEntityName.reconstitute(ent.name), attributes: IrAttributeDecls.of(attributes) });
  }

  const obligations: IrObligationDecl[] = [];
  for (const ob of Array.isArray(ir.obligations) ? ir.obligations : []) {
    if (!isObject(ob) || typeof ob.id !== "string") continue;
    const temporal = isObject(ob.temporal) ? ob.temporal : null;
    obligations.push({
      id: ObligationId.reconstitute(ob.id),
      assert: asExpression(ob.assert ?? null),
      guard: asExpression(ob.guard ?? null),
      effect: asExpression(ob.effect ?? null),
      temporal:
        temporal === null
          ? undefined
          : {
              assert: asExpression(temporal.assert ?? null),
              from: asExpression(temporal.from ?? null),
              to: asExpression(temporal.to ?? null),
            },
    });
  }

  const scenarios: IrScenarioDecl[] = [];
  for (const sc of Array.isArray(ir.scenarios) ? ir.scenarios : []) {
    if (!isObject(sc) || typeof sc.id !== "string") continue;
    const bindings = isObject(sc.bindings) ? sc.bindings : {};
    scenarios.push({
      id: ScenarioId.reconstitute(sc.id),
      bindings: IrBindingPairs.of(Object.entries(bindings)),
      hasEvent: isObject(sc.event ?? null),
      expect: asExpression(sc.expect ?? null),
    });
  }

  const background: IrBackgroundDecl[] = [];
  for (const bg of Array.isArray(ir.background) ? ir.background : []) {
    if (!isObject(bg) || typeof bg.id !== "string") continue;
    background.push({ id: BackgroundAssumptionId.reconstitute(bg.id), assert: asExpression(bg.assert ?? null) });
  }

  return IrModelDecl.reconstitute({
    entities: IrEntityDecls.of(entities),
    obligations: IrObligationDecls.of(obligations),
    scenarios: IrScenarioDecls.of(scenarios),
    background: IrBackgroundDecls.of(background),
  });
}

// owner は id、無ければ `<section>[<index>]`（旧 collectFrRefs の逐語）。
function collectFrClaims(ir: { [k: string]: Json }): FrRefClaim[] {
  const claims: FrRefClaim[] = [];
  for (const section of ["obligations", "scenarios", "unformalized"] as const) {
    const arr = Array.isArray(ir[section]) ? (ir[section] as Json[]) : [];
    arr.forEach((entry, i) => {
      if (!isObject(entry)) return;
      const owner = typeof entry.id === "string" ? entry.id : `${section}[${i}]`;
      const refs = entry.frRefs ?? null;
      if (!Array.isArray(refs)) return;
      claims.push({ owner, frRefs: FrRefs.of(refs.filter((r) => typeof r === "string") as string[]) });
    });
  }
  return claims;
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

    // <record>/<phase>/<stage>/… → 記録ルートは 3 階層上（旧
    // findRequirementsFile の導出の逐語——識別子の導出はパス知識）。dirname は
    // 空文字列を返さないため parse は失敗し得ない；分岐は型の網羅のみで、
    // 到達すれば defect として corrupt に落とす（黙殺しない）。
    const recordRoot = ArtifactPath.parse(dirname(dirname(dirname(outputPath))));
    if (!recordRoot.ok) {
      return corrupt("defect: record-root derivation produced an empty path");
    }

    return ok(
      IrValidationMaterials.reconstitute({
        id,
        irVersion: IrVersion.reconstitute(typeof ir.irVersion === "string" ? ir.irVersion : ""),
        schemaErrors: ErrorMessages.of(schemaErrors),
        view: buildView(ir),
        frClaims: FrRefClaims.of(collectFrClaims(ir)),
        declaredDigest: typeof ir.sourceDigest === "string" ? ir.sourceDigest : null,
        sourceId: RequirementsSourceId.of(recordRoot.value),
        sourceDocument: new Uint8Array(bytes),
      }),
    );
  }

  // 往復則: findById が読んだ原文をバイト逐語で書き戻す（findById∘store 恒等）。
  store(materials: IrValidationMaterials): Result<void, RepositoryError> {
    const outputPath = materials.id().modelId().artifactPath().asString();
    try {
      writeFileAtomically(outputPath, materials.sourceDocument());
      return ok(undefined);
    } catch (e) {
      return err({ kind: "io-failed", operation: "write", path: outputPath, cause: e instanceof Error ? e.message : String(e) });
    }
  }
}
