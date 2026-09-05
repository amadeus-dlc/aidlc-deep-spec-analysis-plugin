import { flatMapResult } from "@deep-spec/kernel-infrastructure";
import { InitialState } from "@deep-spec/design-domain";
import { ErrorMessage } from "@deep-spec/kernel-domain";
import { decodeDeclaredBindings } from "@deep-spec/kernel-adapter";
import {
  extractFences,
  findRecordRoot,
  readContractSchema,
  writeFileAtomically,
  readIfExists,
} from "@deep-spec/kernel-adapter";
import { TargetIdentifier, ErrorMessages, IntermediateRepresentationVersion, TriggerName, type Expression } from "@deep-spec/kernel-domain";
import {
  BusinessRuleReference,
  DesignBackgroundDeclaration,
  DesignIgnoreDeclaration,
  DesignMachineDeclaration,
  DesignUnitDeclaration,
  DesignBackgroundIdentifier,
  DesignMachineIdentifier,
  DesignObligationIdentifier,
  DesignObligationDeclaration,
  DesignObligationOrigin,
  DesignScenarioIdentifier,
  DesignScenarioDeclaration,
  DesignTransitionIdentifier,
  DesignTransitionDeclaration,
  DesignUnitIdentifier,
  BusinessRuleReferences,
  DesignBackgroundDeclarations,
  DesignIgnoreDeclarations,
  DesignMachineDeclarations,
  DesignObligationDeclarations,
  DesignScenarioDeclarations,
  DesignTransitionDeclarations,
  DesignUnitDeclarations,
  InitialStates,
  UnformalizedTargets,
  DesignIntermediateRepresentationValidationMaterials,
  DesignIntermediateRepresentationValidationMaterialsIdentifier,
  SUPPORTED_DESIGN_IR_MAJOR,
} from "@deep-spec/design-domain";

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

import { type Json, isObject, validateSchema } from "@deep-spec/kernel-infrastructure";
import { type Result, combineResults, traverseResult, err, ok } from "@deep-spec/kernel-infrastructure";
import { err as repoErr } from "@deep-spec/kernel-infrastructure";

import type { RepositoryError } from "@deep-spec/kernel-usecase";

import type { DesignIntermediateRepresentationValidationMaterialsRepository } from "@deep-spec/design-usecase";
import type { DesignIntermediateRepresentationValidationMaterialsConfiguration } from "./design-intermediate-representation-validation-materials-configuration.ts";
import { parseDesignEntities } from "./design-entities-parser.ts";

const DESIGN_MODEL_BASENAME = "deep-spec-analysis-functional-formal-model.md";

function asExpression(v: Json): Expression | undefined {
  return isObject(v) ? (v as unknown as Expression) : undefined;
}

// 配列でなければ undefined（origin:"rules" の brRefs 必須チェックが見る形）。
function strArrayOrUndefined(v: Json): string[] | undefined {
  return Array.isArray(v) ? (v.filter((x) => typeof x === "string") as string[]) : undefined;
}

// brRefs は「配列でなければ未宣言」——宣言の有無を undefined で保存しつつ
// 宣言済みはコレクションで運ぶ。
function businessRuleReferencesOrUndefined(v: Json) {
  const arr = strArrayOrUndefined(v);
  if (arr === undefined) return ok(undefined);
  const parsed = flatMapResult(traverseResult(arr, BusinessRuleReference.parse), BusinessRuleReferences.parse);
  return parsed.ok ? ok(parsed.value) : parsed;
}

function buildUnitView(rawUnit: { [k: string]: Json }, unitName: string, recordRoot: string | null): Result<DesignUnitDeclaration, string> {
  const unit = DesignUnitIdentifier.parse(unitName);
  if (!unit.ok) return err(JSON.stringify(unit.error));
  const entities = parseDesignEntities(isObject(rawUnit.schema) ? rawUnit.schema : {});
  if (!entities.ok) return err(JSON.stringify(entities.error));

  const obligations: DesignObligationDeclaration[] = [];
  for (const ob of Array.isArray(rawUnit.obligations) ? rawUnit.obligations : []) {
    if (!isObject(ob) || typeof ob.id !== "string") continue;
    const temporal = isObject(ob.temporal) ? ob.temporal : null;
    const parsed = combineResults({
      id: DesignObligationIdentifier.parse(ob.id),
      origin: typeof ob.origin === "string" ? DesignObligationOrigin.parse(ob.origin) : ok(undefined),
      brRefs: businessRuleReferencesOrUndefined(ob.brRefs ?? null),
    });
    if (!parsed.ok) return err(JSON.stringify(parsed.error));
    const constructed = DesignObligationDeclaration.parse({
      id: parsed.value.id,
      origin: parsed.value.origin,
      businessRuleReferences: parsed.value.brRefs,
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
    if (!constructed.ok) return err(JSON.stringify(constructed.error));
    obligations.push(constructed.value);
  }

  const stateMachines: DesignMachineDeclaration[] = [];
  for (const sm of Array.isArray(rawUnit.stateMachines) ? rawUnit.stateMachines : []) {
    if (!isObject(sm) || typeof sm.id !== "string") continue;
    const attrPath = `${typeof sm.entity === "string" ? sm.entity : "?"}.${typeof sm.attribute === "string" ? sm.attribute : "?"}`;
    const initial = (Array.isArray(sm.initial) ? sm.initial : []).filter((s) => typeof s === "string") as string[];
    const transitions: DesignTransitionDeclaration[] = [];
    for (const tr of Array.isArray(sm.transitions) ? sm.transitions : []) {
      if (!isObject(tr) || typeof tr.id !== "string") continue;
      const parsed = combineResults({
        id: DesignTransitionIdentifier.parse(tr.id),
        trigger: typeof tr.trigger === "string" ? TriggerName.parse(tr.trigger) : ok(undefined),
        brRefs: businessRuleReferencesOrUndefined(tr.brRefs ?? null),
      });
      if (!parsed.ok) return err(JSON.stringify(parsed.error));
      const constructed = DesignTransitionDeclaration.parse({
        id: parsed.value.id,
        from: typeof tr.from === "string" ? tr.from : undefined,
        to: typeof tr.to === "string" ? tr.to : undefined,
        trigger: parsed.value.trigger,
        businessRuleReferences: parsed.value.brRefs,
        guard: asExpression(tr.guard ?? null),
        effect: asExpression(tr.effect ?? null),
      });
      if (!constructed.ok) return err(JSON.stringify(constructed.error));
      transitions.push(constructed.value);
    }
    const ignores: DesignIgnoreDeclaration[] = [];
    for (const ig of Array.isArray(sm.ignores) ? sm.ignores : []) {
      if (!isObject(ig) || typeof ig.state !== "string" || typeof ig.trigger !== "string") continue;
      const trigger = TriggerName.parse(ig.trigger);
      if (!trigger.ok) return err(JSON.stringify(trigger.error));
      ignores.push(DesignIgnoreDeclaration.of({ state: ig.state, trigger: trigger.value }));
    }
    const states = flatMapResult(traverseResult(initial, InitialState.parse), InitialStates.parse);
    if (!states.ok) return err(JSON.stringify(states.error));
    const id = DesignMachineIdentifier.parse(sm.id);
    if (!id.ok) return err(JSON.stringify(id.error));
    stateMachines.push(DesignMachineDeclaration.of({ id: id.value, attrPath, initial: states.value, transitions: DesignTransitionDeclarations.of(transitions), ignores: DesignIgnoreDeclarations.of(ignores) }));
  }

  const scenarios: DesignScenarioDeclaration[] = [];
  for (const sc of Array.isArray(rawUnit.scenarios) ? rawUnit.scenarios : []) {
    if (!isObject(sc) || typeof sc.id !== "string") continue;
    const bindings = decodeDeclaredBindings(isObject(sc.bindings) ? sc.bindings : {});
    if (!bindings.ok) return err(bindings.error);
    const parsed = combineResults({
      id: DesignScenarioIdentifier.parse(sc.id),
      brRefs: businessRuleReferencesOrUndefined(sc.brRefs ?? null),
    });
    if (!parsed.ok) return err(JSON.stringify(parsed.error));
    const constructed = DesignScenarioDeclaration.parse({
      id: parsed.value.id,
      bindings: bindings.value,
      hasEvent: isObject(sc.event ?? null),
      expect: asExpression(sc.expect ?? null),
      businessRuleReferences: parsed.value.brRefs,
    });
    if (!constructed.ok) return err(JSON.stringify(constructed.error));
    scenarios.push(constructed.value);
  }

  const background: DesignBackgroundDeclaration[] = [];
  for (const bg of Array.isArray(rawUnit.background) ? rawUnit.background : []) {
    if (!isObject(bg) || typeof bg.id !== "string") continue;
    const id = DesignBackgroundIdentifier.parse(bg.id);
    if (!id.ok) return err(JSON.stringify(id.error));
    const constructed = DesignBackgroundDeclaration.parse({ id: id.value, assert: asExpression(bg.assert ?? null) });
    if (!constructed.ok) return err(JSON.stringify(constructed.error));
    background.push(constructed.value);
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

  const targets = traverseResult(unformalizedTargets, TargetIdentifier.parse);
  if (!targets.ok) return err(JSON.stringify(targets.error));
  return ok(DesignUnitDeclaration.of({
    unit: unit.value,
    entities: entities.value,
    obligations: DesignObligationDeclarations.of(obligations),
    stateMachines: DesignMachineDeclarations.of(stateMachines),
    scenarios: DesignScenarioDeclarations.of(scenarios),
    background: DesignBackgroundDeclarations.of(background),
    unformalizedTargets: UnformalizedTargets.of(targets.value),
    directoryExists,
    rulesMarkdown,
  }));
}

export class DesignIntermediateRepresentationValidationMaterialsRepositoryImplementation implements DesignIntermediateRepresentationValidationMaterialsRepository {
  readonly #schemaPath: string;

  constructor(config: DesignIntermediateRepresentationValidationMaterialsConfiguration) {
    this.#schemaPath = config.schemaPath;
  }

  findById(id: DesignIntermediateRepresentationValidationMaterialsIdentifier): Result<DesignIntermediateRepresentationValidationMaterials, RepositoryError> {
    const outputPath = id.modelId().artifactPath().asString();
    // 機能形式モデル以外・不在はこの Repository の収蔵外（not-found——use case
    // が pass-through へ写像する旧 not-applicable の凍結挙動）。
    if (basename(outputPath) !== DESIGN_MODEL_BASENAME || !existsSync(outputPath)) {
      return repoErr({ kind: "not-found", path: outputPath });
    }

    const corrupt = (cause: string): Result<DesignIntermediateRepresentationValidationMaterials, RepositoryError> =>
      repoErr({ kind: "corrupt", path: outputPath, cause });

    // existsSync 後の競合（削除・権限変更・ディレクトリ）でも Result 契約を
    // 守る——読取失敗は io-failed（use case は corrupt と同じ verdict 写像）。
    let bytes: Buffer;
    try {
      bytes = readFileSync(outputPath);
    } catch (e) {
      return repoErr({ kind: "io-failed", operation: "read", path: outputPath, cause: e instanceof Error ? e.message : String(e) });
    }
    const md = bytes.toString("utf-8");
    const fences = extractFences(md, "json");
    if (fences.length !== 1) {
      return corrupt("formal model must contain exactly one ```json fence");
    }

    let ir: Json;
    try {
      ir = JSON.parse(fences[0]?.body ?? "") as Json;
    } catch (err) {
      return corrupt(`design IR fence is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!isObject(ir)) {
      return corrupt("design IR fence must contain a JSON object");
    }

    if (!existsSync(this.#schemaPath)) {
      return corrupt(`design IR schema not installed at ${this.#schemaPath} — run plugin sync`);
    }
    const schema = readContractSchema(this.#schemaPath);
    if (!schema.ok) {
      return corrupt(`design IR schema unreadable: ${schema.error.cause}`);
    }

    const schemaErrors: string[] = [];
    validateSchema(schema.value, schema.value, ir, "", schemaErrors);
    const messages = flatMapResult(traverseResult(schemaErrors, ErrorMessage.parse), ErrorMessages.parse);
    if (!messages.ok) return corrupt(JSON.stringify(messages.error));

    const irVersion = IntermediateRepresentationVersion.parse(typeof ir.irVersion === "string" ? ir.irVersion : "");
    if (!irVersion.ok) return corrupt(JSON.stringify(irVersion.error));

    // 旧 main は「バージョン一致かつスキーマ妥当」のときだけ semanticErrors を
    // 呼んだ——unit view の構築（construction/<unit>/ の existsSync と rules.md
    // 読み）はその内側の I/O なので、同じゲートで組む。ゲートが閉じている間は
    // ユニット名がスキーマの ^[a-z0-9][a-z0-9-]{0,63}$ 制約を通過していない
    // 可能性があり、生の名前を join へ渡さない（レガシーの I/O プロファイルと
    // 経路制限の保存）。use case 側も errors 非空なら units を読まない。
    const major = irVersion.value.majorVersion();
    const semanticGateOpen = schemaErrors.length === 0 && !(Number.isInteger(major) && major !== SUPPORTED_DESIGN_IR_MAJOR);

    const units: DesignUnitDeclaration[] = [];
    if (semanticGateOpen) {
      const recordRoot = findRecordRoot(dirname(outputPath));
      for (const rawUnit of Array.isArray(ir.units) ? ir.units : []) {
        if (!isObject(rawUnit) || typeof rawUnit.unit !== "string") continue;
        const parsed = buildUnitView(rawUnit, rawUnit.unit, recordRoot);
        if (!parsed.ok) return corrupt(parsed.error);
        units.push(parsed.value);
      }
    }

    return ok(
      DesignIntermediateRepresentationValidationMaterials.of({
        id,
        irVersion: irVersion.value,
        schemaErrors: messages.value,
        units: DesignUnitDeclarations.of(units),
        sourceDocument: new Uint8Array(bytes),
      }),
    );
  }

  // 往復則: findById が読んだ原文をバイト逐語で書き戻す（findById∘store 恒等）。
  store(materials: DesignIntermediateRepresentationValidationMaterials): Result<void, RepositoryError> {
    const outputPath = materials.id().modelId().artifactPath().asString();
    const bytes = materials.sourceDocument();
    try {
      writeFileAtomically(outputPath, bytes);
      return ok(undefined);
    } catch (e) {
      return repoErr({ kind: "io-failed", operation: "write", path: outputPath, cause: e instanceof Error ? e.message : String(e) });
    }
  }
}
