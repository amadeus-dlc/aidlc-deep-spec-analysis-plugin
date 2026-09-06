import { ErrorMessage, ErrorMessages, type Expression, TargetIdentifier } from "@deep-spec-analysis/kernel-domain";
import { BusinessRuleReference } from "./business-rule-reference.ts";
import type { BusinessRuleReferenceIndex } from "./business-rule-reference-index.ts";
import type { BusinessRuleReferences } from "./business-rule-references.ts";
import { DesignAttributeCatalog } from "./design-attribute-catalog.ts";
import type { DesignBackgroundDeclarations } from "./design-background-declarations.ts";
import type { DesignEntityDeclarations } from "./design-entity-declarations.ts";
import type { DesignMachineDeclarations } from "./design-machine-declarations.ts";
import type { DesignObligationDeclarations } from "./design-obligation-declarations.ts";
import type { DesignScenarioDeclarations } from "./design-scenario-declarations.ts";
import type { DesignUnitIdentifier } from "./design-unit-identifier.ts";
import type { UnformalizedTargets } from "./unformalized-targets.ts";

// 契約3 設計 IR の well-formedness 検査材料。スキーマ検証を通過した設計 IR を、
// アダプタの寛容パースが型付きに解体したもの。ユニットごとの BR 材料
// （construction ディレクトリの有無と rules.md 本文）も、探索と読み込みを
// 済ませた形でここに載る——ドメインは I/O を持たない。
//
// 旧 design-ir-valid センサーの semanticErrors が生 Json を走査していた
// ときの黙殺条件（isObject / typeof チェック）はパーサ側へ移った。
// construction ディレクトリ欠落の判定は宣言自身の知識（#71 波13）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type DesignUnitDeclarationParam = {
  unit: DesignUnitIdentifier;
  entities: DesignEntityDeclarations;
  obligations: DesignObligationDeclarations;
  stateMachines: DesignMachineDeclarations;
  scenarios: DesignScenarioDeclarations;
  background: DesignBackgroundDeclarations;
  unformalizedTargets: UnformalizedTargets;
  directoryExists: boolean;
  rules: BusinessRuleReferenceIndex | null;
};

export class DesignUnitDeclaration {
  readonly #unit: DesignUnitIdentifier;
  readonly #entities: DesignEntityDeclarations;
  readonly #obligations: DesignObligationDeclarations;
  readonly #stateMachines: DesignMachineDeclarations;
  readonly #scenarios: DesignScenarioDeclarations;
  readonly #background: DesignBackgroundDeclarations;
  readonly #unformalizedTargets: UnformalizedTargets;
  // construction/<unit>/ が記録配下に存在するか（記録ルート未解決なら true 扱い
  // ——旧実装は recordRoot === null のときこの検査を出さない）。
  readonly #directoryExists: boolean;
  // construction/<unit>/functional-design/rules.md の本文。無ければ null。
  readonly #rules: BusinessRuleReferenceIndex | null;

  private constructor(props: DesignUnitDeclarationParam) {
    this.#unit = props.unit;
    this.#entities = props.entities;
    this.#obligations = props.obligations;
    this.#stateMachines = props.stateMachines;
    this.#scenarios = props.scenarios;
    this.#background = props.background;
    this.#unformalizedTargets = props.unformalizedTargets;
    this.#directoryExists = props.directoryExists;
    this.#rules = props.rules;
  }

  static of(props: DesignUnitDeclarationParam): DesignUnitDeclaration {
    return new DesignUnitDeclaration(props);
  }

  unit(): DesignUnitIdentifier {
    return this.#unit;
  }

  entities(): DesignEntityDeclarations {
    return this.#entities;
  }

  obligations(): DesignObligationDeclarations {
    return this.#obligations;
  }

  stateMachines(): DesignMachineDeclarations {
    return this.#stateMachines;
  }

  scenarios(): DesignScenarioDeclarations {
    return this.#scenarios;
  }

  background(): DesignBackgroundDeclarations {
    return this.#background;
  }

  unformalizedTargets(): UnformalizedTargets {
    return this.#unformalizedTargets;
  }

  // 記録配下に construction/<unit>/ が無い（記録ルート未解決なら「ある」扱い）。
  lacksConstructionDirectory(): boolean {
    return !this.#directoryExists;
  }

  // 契約3 設計 IR のスキーマを超えた意味的整合性——ユニット自身の不変条件
  // （種別規律の裁定 6、2026-09-02——旧自由関数 designWellFormednessErrors を
  // 吸収）。id の一意性（DOB/DSC/DBG/SM/TR 横断）、属性参照の解決、enum リテラル
  // の所属（兄弟 ref への束縛つき）、prime の合法性、状態機械の整合、brRefs の
  // 逆検証と BR カバレッジ。文言と発生順序はそのまま観測面に出る（凍結）。
  // 部分の判断は各宣言に問い、ここは順序と文言（凍結面）だけを所有する。
  diagnostics(): ErrorMessages {
    const errors: string[] = [];
    const unitName = this.#unit.asString();
    const where = (s: string): string => `unit ${unitName}: ${s}`;
    for (const message of this.#entities.diagnostics()) errors.push(where(message.asString()));
    const parsedCatalog = DesignAttributeCatalog.parse(this.#entities);
    const catalog = parsedCatalog.ok ? parsedCatalog.value : null;
    if (!parsedCatalog.ok && parsedCatalog.error.kind !== "ambiguous-design-attributes")
      errors.push(where(`attribute catalog: ${parsedCatalog.error.kind}`));
    if (catalog !== null) for (const message of catalog.encodingDiagnostics()) errors.push(where(message.asString()));
    const checkExpr = (expression: Expression, context: string, primesAllowed: boolean): void => {
      if (catalog !== null)
        for (const message of catalog.expressionDiagnostics(expression, context, primesAllowed))
          errors.push(where(message.asString()));
    };

    const seenIds = new Set<string>();
    const dup = (id: string, ctx: string): void => {
      if (seenIds.has(id)) errors.push(where(`${ctx}: duplicate id "${id}"`));
      seenIds.add(id);
    };
    const businessRuleReferencesUsed = new Set<string>();
    const collectBr = (refs: BusinessRuleReferences | undefined): void => {
      if (refs === undefined) return;
      for (const b of refs) businessRuleReferencesUsed.add(b.asString());
    };

    for (const ob of this.#obligations) {
      const ctx = `obligation ${ob.id().asString()}`;
      dup(ob.id().asString(), ctx);
      collectBr(ob.businessRuleReferences());
      if (ob.missesRequiredBusinessRuleReferences()) {
        errors.push(where(`${ctx}: origin "rules" requires brRefs`));
      }
      ob.inspectExpressions((expression, primesAllowed) => checkExpr(expression, ctx, primesAllowed));
    }

    for (const sm of this.#stateMachines) {
      const ctx = `machine ${sm.id().asString()}`;
      dup(sm.id().asString(), ctx);
      for (const tr of sm.transitions()) {
        dup(tr.id().asString(), `transition ${tr.id().asString()}`);
        collectBr(tr.businessRuleReferences());
      }
      if (catalog !== null) for (const message of sm.diagnostics(catalog)) errors.push(where(message.asString()));
    }

    for (const sc of this.#scenarios) {
      const ctx = `scenario ${sc.id().asString()}`;
      dup(sc.id().asString(), ctx);
      collectBr(sc.businessRuleReferences());
      if (catalog !== null)
        for (const message of catalog.bindingDiagnostics(sc.bindings(), ctx)) errors.push(where(message.asString()));
      sc.inspectExpectation((expression, primesAllowed) => checkExpr(expression, ctx, primesAllowed));
    }

    for (const bg of this.#background) {
      const ctx = `background ${bg.id().asString()}`;
      dup(bg.id().asString(), ctx);
      bg.inspectExpressions((expression, primesAllowed) => checkExpr(expression, ctx, primesAllowed));
    }

    // brRefs reverse-verification + BR coverage against this unit's rules.md.
    // A unit name that matches no construction directory is an error even
    // with zero brRefs: a typo would otherwise erase the whole BR coverage
    // check silently ("Silence is a contract violation").
    if (this.lacksConstructionDirectory()) {
      errors.push(
        where(
          `no construction/${unitName}/ directory exists under this record — the unit name matches no unit-of-work, so BR coverage cannot be verified`,
        ),
      );
    }
    const known = this.#rules;
    if (known === null) {
      if (businessRuleReferencesUsed.size > 0) {
        errors.push(
          where(
            `brRefs are used but construction/${unitName}/functional-design/rules.md was not found — they cannot be reverse-verified`,
          ),
        );
      }
    } else {
      for (const br of [...businessRuleReferencesUsed].sort()) {
        if (!known.has(BusinessRuleReference.of(br))) errors.push(where(`brRef "${br}" does not exist in rules.md`));
      }
      const unformalizedTargets = this.#unformalizedTargets;
      for (const br of known.sortedIds()) {
        if (!businessRuleReferencesUsed.has(br) && !unformalizedTargets.covers(TargetIdentifier.of(br))) {
          errors.push(
            where(
              `BR coverage: rule ${br} in rules.md is neither referenced by any obligation/transition/scenario nor listed in unformalized[] — silence is a contract violation`,
            ),
          );
        }
      }
    }
    return ErrorMessages.collect(errors.map(ErrorMessage.parse));
  }
}
