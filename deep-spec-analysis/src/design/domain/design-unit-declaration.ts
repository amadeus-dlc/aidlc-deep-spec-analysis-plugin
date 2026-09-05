import { type Expression, ExpressionTree, TargetIdentifier } from "@deep-spec/kernel-domain";
import { BusinessRuleReferenceIndex } from "./business-rule-reference-index.ts";
import { type BusinessRuleReferences } from "./business-rule-references.ts";
import { type DesignAttributeDeclaration } from "./design-attribute-declaration.ts";
import { type DesignBackgroundDeclarations } from "./design-background-declarations.ts";
import { type DesignEntityDeclarations } from "./design-entity-declarations.ts";
import { type DesignMachineDeclarations } from "./design-machine-declarations.ts";
import { type DesignObligationDeclarations } from "./design-obligation-declarations.ts";
import { type DesignScenarioDeclarations } from "./design-scenario-declarations.ts";
import { type DesignUnitIdentifier } from "./design-unit-identifier.ts";
import { type UnformalizedTargets } from "./unformalized-targets.ts";
import { BusinessRuleReference } from "./business-rule-reference.ts";

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
  rulesMarkdown: string | null;
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
  readonly #rulesMarkdown: string | null;

  private constructor(props: DesignUnitDeclarationParam) {
    this.#unit = props.unit;
    this.#entities = props.entities;
    this.#obligations = props.obligations;
    this.#stateMachines = props.stateMachines;
    this.#scenarios = props.scenarios;
    this.#background = props.background;
    this.#unformalizedTargets = props.unformalizedTargets;
    this.#directoryExists = props.directoryExists;
    this.#rulesMarkdown = props.rulesMarkdown;
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

  rulesMarkdown(): string | null {
    return this.#rulesMarkdown;
  }

  // 契約3 設計 IR のスキーマを超えた意味的整合性——ユニット自身の不変条件
  // （種別規律の裁定 6、2026-09-02——旧自由関数 designWellFormednessErrors を
  // 吸収）。id の一意性（DOB/DSC/DBG/SM/TR 横断）、属性参照の解決、enum リテラル
  // の所属（兄弟 ref への束縛つき）、prime の合法性、状態機械の整合、brRefs の
  // 逆検証と BR カバレッジ。文言と発生順序はそのまま観測面に出る（凍結）。
  // 部分の判断は各宣言に問い、ここは順序と文言（凍結面）だけを所有する。
  wellFormednessErrors(): string[] {
    const errors: string[] = [];
    const unitName = this.#unit.asString();
    const where = (s: string): string => `unit ${unitName}: ${s}`;
    // Attribute catalogue for reference/enum checks.
    // 主従の裁定（#71 波1）: カタログは宣言そのものを保持し、判断は宣言へ
    // 命じる——判事は文言（凍結面）だけを所有する。
    const attrTypes = new Map<string, DesignAttributeDeclaration>();
    for (const ent of this.#entities) {
      // 座標と重複はエンティティ宣言に問う（#71 波13）。
      ent.inspectAttributes((coord, attr, duplicated) => {
        if (duplicated) errors.push(where(`duplicate attribute "${coord}"`));
        if (attr.lacksIntBounds()) {
          errors.push(
            where(`${coord}: int attributes require min and max — the Quint backend needs bounded domains`),
          );
        }
        if (attr.boundsInverted()) {
          errors.push(where(`${coord}: min > max`));
        }
        if (attr.boundsOutsideSafeRange()) {
          errors.push(where(`${coord}: bounds must be safe integers`));
        }
        attrTypes.set(coord, attr);
      });
    }

    // SMT 変数符号化はドットを下線に潰すため、下線を含む識別子どうしで
    // パスが衝突しうる（凍結解除 #34 項 1、requirements 側と対）。
    const encoded = new Map<string, string>();
    for (const path of attrTypes.keys()) {
      const key = path.replace(/\./g, "_");
      const prior = encoded.get(key);
      if (prior !== undefined) {
        errors.push(where(`attribute paths "${prior}" and "${path}" collide under the solver variable encoding (dots become underscores)`));
      } else {
        encoded.set(key, path);
      }
    }

    const checkExpr = (e: Expression, ctx: string, primesAllowed: boolean): void => {
      // An enum literal in a binary comparison binds to its sibling ref: the
      // value must belong to THAT attribute, not to any enum somewhere in the
      // unit (a "closed" literal on ticket.channel must not legalize
      // "closed" against ticket.status).
      const boundEnum = new Map<Expression, string>();
      const tree = ExpressionTree.of(e);
      tree.walk((node) => {
        const args = node.args ?? [];
        if (args.length === 2) {
          const ref = args.find((a) => a.op === "ref" && typeof a.path === "string");
          const en = args.find((a) => a.op === "enum");
          if (ref && en) boundEnum.set(en, ref.path as string);
        }
      });
      tree.walk((node) => {
        if (node.op === "ref" && typeof node.path === "string") {
          if (!attrTypes.has(node.path)) errors.push(where(`${ctx}: unresolvable reference "${node.path}"`));
          if (node.prime === true && !primesAllowed) {
            errors.push(where(`${ctx}: primed reference "${node.path}" is only legal in effects and event-scenario expectations`));
          }
        }
        if (node.op === "enum" && typeof node.value === "string") {
          const sibling = boundEnum.get(node);
          const siblingType = sibling === undefined ? undefined : attrTypes.get(sibling);
          if (siblingType !== undefined) {
            if (!siblingType.isEnum()) {
              errors.push(where(`${ctx}: enum literal "${node.value}" is compared against non-enum attribute "${sibling}"`));
            } else if (!siblingType.admitsEnumLiteral(node.value)) {
              errors.push(where(`${ctx}: enum literal "${node.value}" is not a value of "${sibling}"`));
            }
          } else if (sibling === undefined) {
            const known = [...attrTypes.values()].some((t) => t.admitsEnumLiteral(node.value as string));
            if (!known) errors.push(where(`${ctx}: enum literal "${node.value}" is not a value of any declared enum attribute`));
          }
          // An unresolvable sibling ref is already reported by the ref check.
        }
      });
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
      const attrPath = sm.attrPath();
      const attr = attrTypes.get(attrPath);
      if (!attr) {
        errors.push(where(`${ctx}: lifecycle attribute "${attrPath}" is not declared`));
        continue;
      }
      const states = attr.enumStates();
      if (states === null) {
        errors.push(where(`${ctx}: lifecycle attribute "${attrPath}" is not an enum — its values are the state set`));
        continue;
      }
      for (const s of sm.initialStatesOutside(states)) {
        errors.push(where(`${ctx}: initial state "${s}" is not a value of ${attrPath}`));
      }
      const transitionCells = new Set<string>();
      for (const tr of sm.transitions()) {
        const tctx = `transition ${tr.id().asString()}`;
        dup(tr.id().asString(), tctx);
        collectBr(tr.businessRuleReferences());
        for (const [k, v] of tr.stateEntries()) {
          if (v !== undefined && !states.includes(v)) {
            errors.push(where(`${tctx}: ${k} state "${v}" is not a value of ${attrPath}`));
          }
        }
        const cellKey = tr.cellKey();
        if (cellKey !== null) transitionCells.add(cellKey);
        tr.inspectExpressions((expression, primesAllowed) => checkExpr(expression, tctx, primesAllowed));
        if (tr.assignsPrimedReferenceTo(attrPath)) {
          errors.push(where(`${tctx}: the effect assigns the machine's own attribute "${attrPath}" — state' = to is implicit`));
        }
      }
      for (const ig of sm.ignores()) {
        if (!ig.isStateAmong(states)) {
          errors.push(where(`${ctx}: ignores state "${ig.state()}" is not a value of ${attrPath}`));
        }
        if (transitionCells.has(ig.cellKey())) {
          errors.push(
            where(`${ctx}: ignores (${ig.state()}, ${ig.trigger().asString()}) collides with a declared transition for the same (state, trigger)`),
          );
        }
      }
    }

    for (const sc of this.#scenarios) {
      const ctx = `scenario ${sc.id().asString()}`;
      dup(sc.id().asString(), ctx);
      collectBr(sc.businessRuleReferences());
      for (const binding of sc.bindings()) {
        const path = binding.path();
        const val = binding.value();
        const t = attrTypes.get(path.asString());
        if (!t) {
          errors.push(where(`${ctx}: binding for unknown attribute "${path.asString()}"`));
          continue;
        }
        const ok = t.fitsBinding(val);
        if (!ok) errors.push(where(`${ctx}: binding value ${val.describe()} does not fit ${t.kindLabel()} attribute "${path.asString()}"`));
      }
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
        where(`no construction/${unitName}/ directory exists under this record — the unit name matches no unit-of-work, so BR coverage cannot be verified`),
      );
    }
    const rulesMd = this.#rulesMarkdown;
    if (rulesMd === null) {
      if (businessRuleReferencesUsed.size > 0) {
        errors.push(
          where(`brRefs are used but construction/${unitName}/functional-design/rules.md was not found — they cannot be reverse-verified`),
        );
      }
    } else {
      const known = BusinessRuleReferenceIndex.fromRules(rulesMd);
      for (const br of [...businessRuleReferencesUsed].sort()) {
        if (!known.has(BusinessRuleReference.of(br))) errors.push(where(`brRef "${br}" does not exist in rules.md`));
      }
      const unformalizedTargets = this.#unformalizedTargets;
      for (const br of known.sortedIds()) {
        if (!businessRuleReferencesUsed.has(br) && !unformalizedTargets.covers(TargetIdentifier.of(br))) {
          errors.push(
            where(`BR coverage: rule ${br} in rules.md is neither referenced by any obligation/transition/scenario nor listed in unformalized[] — silence is a contract violation`),
          );
        }
      }
    }
    return errors;
  }
}
