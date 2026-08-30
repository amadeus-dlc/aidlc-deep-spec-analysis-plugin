// 契約1 IR の検査材料ゲートウェイ。markdown フェンスの抽出、JSON 解釈、
// 契約スキーマの適用、そして「生 Json をどう寛容に読むか」をここに閉じ込め、
// use-case へは型付きの材料だけを渡す。
//
// 旧 aidlc-sensor-deep-spec-ir-valid.ts の main 前半＋ semanticErrors の
// 黙殺条件からの逐語移植。型宣言を欠く属性を kind: "" でカタログに載せる
// 挙動（参照解決の可否が変わる）を含め、そのまま保存する。

import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import {
  type Json,
  extractFences,
  isObject,
  readContractSchema,
  validateSchema,
} from "../../kernel/adapter/index.ts";
import type { Expression } from "../../kernel/domain/index.ts";
import type {
  FrRefClaim,
  IrAttributeView,
  IrBackgroundView,
  IrEntityView,
  IrModelView,
  IrObligationView,
  IrScenarioView,
} from "../domain/index.ts";
import type { IrMaterialsAcquisition, IrValidationMaterialsRepository } from "../usecase/index.ts";

const FORMAL_MODEL_BASENAME = "deep-spec-analysis-formal-model.md";

export interface IrValidationMaterialsConfig {
  readonly schemaPath: string;
}

function asExpression(v: Json): Expression | undefined {
  return isObject(v) ? (v as unknown as Expression) : undefined;
}

function buildView(ir: { [k: string]: Json }): IrModelView {
  const entities: IrEntityView[] = [];
  const schema = isObject(ir.schema) ? ir.schema : {};
  for (const ent of Array.isArray(schema.entities) ? schema.entities : []) {
    if (!isObject(ent) || typeof ent.name !== "string") continue;
    const attributes: IrAttributeView[] = [];
    for (const attr of Array.isArray(ent.attributes) ? ent.attributes : []) {
      if (!isObject(attr) || typeof attr.name !== "string") continue;
      const t = isObject(attr.type) ? attr.type : {};
      attributes.push({
        name: attr.name,
        kind: typeof t.kind === "string" ? t.kind : "",
        values: Array.isArray(t.values) ? (t.values.filter((v) => typeof v === "string") as string[]) : undefined,
        min: typeof t.min === "number" ? t.min : undefined,
        max: typeof t.max === "number" ? t.max : undefined,
      });
    }
    entities.push({ name: ent.name, attributes });
  }

  const obligations: IrObligationView[] = [];
  for (const ob of Array.isArray(ir.obligations) ? ir.obligations : []) {
    if (!isObject(ob) || typeof ob.id !== "string") continue;
    const temporal = isObject(ob.temporal) ? ob.temporal : null;
    obligations.push({
      id: ob.id,
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

  const scenarios: IrScenarioView[] = [];
  for (const sc of Array.isArray(ir.scenarios) ? ir.scenarios : []) {
    if (!isObject(sc) || typeof sc.id !== "string") continue;
    const bindings = isObject(sc.bindings) ? sc.bindings : {};
    scenarios.push({
      id: sc.id,
      bindings: Object.entries(bindings),
      hasEvent: isObject(sc.event ?? null),
      expect: asExpression(sc.expect ?? null),
    });
  }

  const background: IrBackgroundView[] = [];
  for (const bg of Array.isArray(ir.background) ? ir.background : []) {
    if (!isObject(bg) || typeof bg.id !== "string") continue;
    background.push({ id: bg.id, assert: asExpression(bg.assert ?? null) });
  }

  return { entities, obligations, scenarios, background };
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
      claims.push({ owner, frRefs: refs.filter((r) => typeof r === "string") as string[] });
    });
  }
  return claims;
}

export class IrValidationMaterialsRepositoryImpl implements IrValidationMaterialsRepository {
  readonly #schemaPath: string;

  constructor(config: IrValidationMaterialsConfig) {
    this.#schemaPath = config.schemaPath;
  }

  acquire(outputPath: string): IrMaterialsAcquisition {
    if (basename(outputPath) !== FORMAL_MODEL_BASENAME || !existsSync(outputPath)) {
      return { kind: "not-applicable" };
    }

    const md = readFileSync(outputPath, "utf-8");
    const fences = extractFences(md, "json").map((f) => f.body);
    if (fences.length !== 1) {
      return {
        kind: "unreadable",
        errors: [`formal model must contain exactly one \`\`\`json fence (found ${fences.length})`],
      };
    }

    let ir: Json;
    try {
      ir = JSON.parse(fences[0] ?? "");
    } catch (err) {
      return {
        kind: "unreadable",
        errors: [`IR fence is not valid JSON: ${err instanceof Error ? err.message : String(err)}`],
      };
    }
    if (!isObject(ir)) {
      return { kind: "unreadable", errors: ["IR fence must contain a JSON object"] };
    }

    if (!existsSync(this.#schemaPath)) {
      return { kind: "unreadable", errors: [`IR schema not installed at ${this.#schemaPath} — run plugin sync`] };
    }
    const schema = readContractSchema(this.#schemaPath);
    if (!schema.ok) {
      return { kind: "unreadable", errors: [`IR schema unreadable: ${schema.error.cause}`] };
    }

    const schemaErrors: string[] = [];
    validateSchema(schema.value, schema.value, ir, "", schemaErrors);

    return {
      kind: "acquired",
      materials: {
        irVersion: typeof ir.irVersion === "string" ? ir.irVersion : "",
        schemaErrors,
        view: buildView(ir),
        frClaims: collectFrClaims(ir),
        declaredDigest: typeof ir.sourceDigest === "string" ? ir.sourceDigest : null,
      },
    };
  }
}
