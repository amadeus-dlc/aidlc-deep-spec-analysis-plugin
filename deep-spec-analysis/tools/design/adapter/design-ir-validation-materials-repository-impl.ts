// 契約3 設計 IR の検査材料ゲートウェイ。markdown フェンスの抽出、JSON 解釈、
// 契約スキーマの適用、生 Json の寛容な解体、そしてユニットごとの BR 材料
// （construction ディレクトリの有無と rules.md 本文）の解決をここに閉じ込める。
//
// 旧 aidlc-sensor-deep-spec-design-ir-valid.ts の main 前半＋ semanticErrors の
// 黙殺条件と記録ルート探索からの逐語移植。記録ルートが解決できないときは
// ディレクトリ検査を出さない（directoryExists: true）——旧実装の
// `recordRoot !== null &&` ガードの保存。

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  type Json,
  extractFences,
  findRecordRoot,
  isObject,
  readContractSchema,
  readIfExists,
  validateSchema,
} from "../../kernel/adapter/index.ts";
import { AttributeBound } from "../../kernel/domain/index.ts";
import type { Expression } from "../../kernel/domain/index.ts";
import type {
  DesignAttributeDecl,
  DesignBackgroundDecl,
  DesignEntityDecl,
  DesignIgnoreDecl,
  DesignMachineDecl,
  DesignObligationDecl,
  DesignScenarioDecl,
  DesignTransitionDecl,
  DesignUnitDecl,
} from "../domain/index.ts";
import {
  DesignAttributeName,
  DesignBackgroundId,
  DesignEntityName,
  DesignMachineId,
  DesignObligationId,
  DesignObligationOrigin,
  DesignScenarioId,
  DesignTransitionId,
  DesignUnitId,
  BindingPairs,
  BrRefs,
  DeclaredValues,
  DesignAttributeDecls,
  DesignBackgroundDecls,
  DesignEntityDecls,
  DesignIgnoreDecls,
  DesignMachineDecls,
  DesignObligationDecls,
  DesignScenarioDecls,
  DesignTransitionDecls,
  DesignUnitDecls,
  InitialStates,
  UnformalizedTargets,
} from "../domain/index.ts";
import { type DesignModelId, SUPPORTED_DESIGN_IR_MAJOR } from "../domain/index.ts";
import type {
  DesignIrMaterialsAcquisition,
  DesignIrValidationMaterialsRepository,
} from "../usecase/index.ts";

const DESIGN_MODEL_BASENAME = "deep-spec-analysis-functional-formal-model.md";

export interface DesignIrValidationMaterialsConfig {
  readonly schemaPath: string;
}

function asExpression(v: Json): Expression | undefined {
  return isObject(v) ? (v as unknown as Expression) : undefined;
}

// 配列でなければ undefined（origin:"rules" の brRefs 必須チェックが見る形）。
function strArrayOrUndefined(v: Json): string[] | undefined {
  return Array.isArray(v) ? (v.filter((x) => typeof x === "string") as string[]) : undefined;
}

// brRefs は「配列でなければ未宣言」——宣言の有無を undefined で保存しつつ
// 宣言済みはコレクションで運ぶ。
function brRefsOrUndefined(v: Json): BrRefs | undefined {
  const arr = strArrayOrUndefined(v);
  return arr === undefined ? undefined : BrRefs.of(arr);
}

function buildUnitView(rawUnit: { [k: string]: Json }, unitName: string, recordRoot: string | null): DesignUnitDecl {
  const entities: DesignEntityDecl[] = [];
  const schema = isObject(rawUnit.schema) ? rawUnit.schema : {};
  for (const ent of Array.isArray(schema.entities) ? schema.entities : []) {
    if (!isObject(ent) || typeof ent.name !== "string") continue;
    const attributes: DesignAttributeDecl[] = [];
    for (const attr of Array.isArray(ent.attributes) ? ent.attributes : []) {
      if (!isObject(attr) || typeof attr.name !== "string") continue;
      const t = isObject(attr.type) ? attr.type : {};
      attributes.push({
        name: DesignAttributeName.reconstitute(attr.name),
        kind: typeof t.kind === "string" ? t.kind : "",
        values: Array.isArray(t.values) ? DeclaredValues.of(t.values.filter((v) => typeof v === "string") as string[]) : undefined,
        min: typeof t.min === "number" ? AttributeBound.reconstitute(t.min) : undefined,
        max: typeof t.max === "number" ? AttributeBound.reconstitute(t.max) : undefined,
      });
    }
    entities.push({ name: DesignEntityName.reconstitute(ent.name), attributes: DesignAttributeDecls.of(attributes) });
  }

  const obligations: DesignObligationDecl[] = [];
  for (const ob of Array.isArray(rawUnit.obligations) ? rawUnit.obligations : []) {
    if (!isObject(ob) || typeof ob.id !== "string") continue;
    const temporal = isObject(ob.temporal) ? ob.temporal : null;
    obligations.push({
      id: DesignObligationId.reconstitute(ob.id),
      origin: typeof ob.origin === "string" ? DesignObligationOrigin.reconstitute(ob.origin) : undefined,
      brRefs: brRefsOrUndefined(ob.brRefs ?? null),
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

  const stateMachines: DesignMachineDecl[] = [];
  for (const sm of Array.isArray(rawUnit.stateMachines) ? rawUnit.stateMachines : []) {
    if (!isObject(sm) || typeof sm.id !== "string") continue;
    const attrPath = `${typeof sm.entity === "string" ? sm.entity : "?"}.${typeof sm.attribute === "string" ? sm.attribute : "?"}`;
    const initial = (Array.isArray(sm.initial) ? sm.initial : []).filter((s) => typeof s === "string") as string[];
    const transitions: DesignTransitionDecl[] = [];
    for (const tr of Array.isArray(sm.transitions) ? sm.transitions : []) {
      if (!isObject(tr) || typeof tr.id !== "string") continue;
      transitions.push({
        id: DesignTransitionId.reconstitute(tr.id),
        from: typeof tr.from === "string" ? tr.from : undefined,
        to: typeof tr.to === "string" ? tr.to : undefined,
        trigger: typeof tr.trigger === "string" ? tr.trigger : undefined,
        brRefs: brRefsOrUndefined(tr.brRefs ?? null),
        guard: asExpression(tr.guard ?? null),
        effect: asExpression(tr.effect ?? null),
      });
    }
    const ignores: DesignIgnoreDecl[] = [];
    for (const ig of Array.isArray(sm.ignores) ? sm.ignores : []) {
      if (!isObject(ig) || typeof ig.state !== "string" || typeof ig.trigger !== "string") continue;
      ignores.push({ state: ig.state, trigger: ig.trigger });
    }
    stateMachines.push({ id: DesignMachineId.reconstitute(sm.id), attrPath, initial: InitialStates.of(initial), transitions: DesignTransitionDecls.of(transitions), ignores: DesignIgnoreDecls.of(ignores) });
  }

  const scenarios: DesignScenarioDecl[] = [];
  for (const sc of Array.isArray(rawUnit.scenarios) ? rawUnit.scenarios : []) {
    if (!isObject(sc) || typeof sc.id !== "string") continue;
    const bindings = isObject(sc.bindings) ? sc.bindings : {};
    scenarios.push({
      id: DesignScenarioId.reconstitute(sc.id),
      bindings: BindingPairs.of(Object.entries(bindings)),
      hasEvent: isObject(sc.event ?? null),
      expect: asExpression(sc.expect ?? null),
      brRefs: brRefsOrUndefined(sc.brRefs ?? null),
    });
  }

  const background: DesignBackgroundDecl[] = [];
  for (const bg of Array.isArray(rawUnit.background) ? rawUnit.background : []) {
    if (!isObject(bg) || typeof bg.id !== "string") continue;
    background.push({ id: DesignBackgroundId.reconstitute(bg.id), assert: asExpression(bg.assert ?? null) });
  }

  const unformalizedTargets: string[] = [];
  for (const uf of Array.isArray(rawUnit.unformalized) ? rawUnit.unformalized : []) {
    if (!isObject(uf)) continue;
    for (const t of Array.isArray(uf.targets) ? uf.targets : []) {
      if (typeof t === "string") unformalizedTargets.push(t);
    }
  }

  const directoryExists = recordRoot === null ? true : existsSync(join(recordRoot, "construction", unitName));
  const rulesPath = recordRoot === null ? null : join(recordRoot, "construction", unitName, "functional-design", "rules.md");
  const rulesMarkdown = rulesPath === null ? null : readIfExists(rulesPath);

  return {
    unit: DesignUnitId.of(unitName),
    entities: DesignEntityDecls.of(entities),
    obligations: DesignObligationDecls.of(obligations),
    stateMachines: DesignMachineDecls.of(stateMachines),
    scenarios: DesignScenarioDecls.of(scenarios),
    background: DesignBackgroundDecls.of(background),
    unformalizedTargets: UnformalizedTargets.of(unformalizedTargets),
    directoryExists,
    rulesMarkdown,
  };
}

export class DesignIrValidationMaterialsRepositoryImpl implements DesignIrValidationMaterialsRepository {
  readonly #schemaPath: string;

  constructor(config: DesignIrValidationMaterialsConfig) {
    this.#schemaPath = config.schemaPath;
  }

  acquire(id: DesignModelId): DesignIrMaterialsAcquisition {
    const outputPath = id.artifactPath().asString();
    if (basename(outputPath) !== DESIGN_MODEL_BASENAME || !existsSync(outputPath)) {
      return { kind: "not-applicable" };
    }

    const md = readFileSync(outputPath, "utf-8");
    const fences = extractFences(md, "json");
    if (fences.length !== 1) {
      return { kind: "unreadable", errors: ["formal model must contain exactly one ```json fence"] };
    }

    let ir: Json;
    try {
      ir = JSON.parse(fences[0]?.body ?? "") as Json;
    } catch (err) {
      return {
        kind: "unreadable",
        errors: [`design IR fence is not valid JSON: ${err instanceof Error ? err.message : String(err)}`],
      };
    }
    if (!isObject(ir)) {
      return { kind: "unreadable", errors: ["design IR fence must contain a JSON object"] };
    }

    if (!existsSync(this.#schemaPath)) {
      return {
        kind: "unreadable",
        errors: [`design IR schema not installed at ${this.#schemaPath} — run plugin sync`],
      };
    }
    const schema = readContractSchema(this.#schemaPath);
    if (!schema.ok) {
      return { kind: "unreadable", errors: [`design IR schema unreadable: ${schema.error.cause}`] };
    }

    const schemaErrors: string[] = [];
    validateSchema(schema.value, schema.value, ir, "", schemaErrors);

    const irVersion = typeof ir.irVersion === "string" ? ir.irVersion : "";

    // 旧 main は「バージョン一致かつスキーマ妥当」のときだけ semanticErrors を
    // 呼んだ——unit view の構築（construction/<unit>/ の existsSync と rules.md
    // 読み）はその内側の I/O なので、同じゲートで組む。ゲートが閉じている間は
    // ユニット名がスキーマの ^[a-z0-9][a-z0-9-]{0,63}$ 制約を通過していない
    // 可能性があり、生の名前を join へ渡さない（レガシーの I/O プロファイルと
    // 経路制限の保存）。use case 側も errors 非空なら units を読まない。
    const major = Number.parseInt(irVersion.split(".")[0] ?? "", 10);
    const semanticGateOpen = schemaErrors.length === 0 && !(Number.isInteger(major) && major !== SUPPORTED_DESIGN_IR_MAJOR);

    const units: DesignUnitDecl[] = [];
    if (semanticGateOpen) {
      const recordRoot = findRecordRoot(dirname(outputPath));
      for (const rawUnit of Array.isArray(ir.units) ? ir.units : []) {
        if (!isObject(rawUnit) || typeof rawUnit.unit !== "string") continue;
        units.push(buildUnitView(rawUnit, rawUnit.unit, recordRoot));
      }
    }

    return {
      kind: "acquired",
      materials: {
        irVersion,
        schemaErrors,
        units: DesignUnitDecls.of(units),
      },
    };
  }
}
