import { ErrorMessage, ErrorMessages, KeySet } from "@deep-spec-analysis/kernel-domain";
import { combinedHash, hashOfBoolean, hashOfNullable } from "@deep-spec-analysis/kernel-infrastructure";
import type { BusinessRuleReference } from "./business-rule-reference.ts";
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
import { sameIterable } from "./value-equality.ts";

// 設計ユニットの入力宣言。属性と状態機械の診断を各所有者へ依頼し、
// ユニット内の識別子、成果物の存在、業務規則の被覆を合わせて評価する。
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
  // アダプタが規則文書から取得した索引。文書がなければnull。
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

  equals(other: DesignUnitDeclaration): boolean {
    return (
      this.#unit.equals(other.#unit) &&
      sameIterable(this.#entities, other.#entities, (left, right) => left.equals(right)) &&
      sameIterable(this.#obligations, other.#obligations, (left, right) => left.equals(right)) &&
      sameIterable(this.#stateMachines, other.#stateMachines, (left, right) => left.equals(right)) &&
      sameIterable(this.#scenarios, other.#scenarios, (left, right) => left.equals(right)) &&
      sameIterable(this.#background, other.#background, (left, right) => left.equals(right)) &&
      sameIterable(this.#unformalizedTargets, other.#unformalizedTargets, (left, right) => left.equals(right)) &&
      this.#directoryExists === other.#directoryExists &&
      (this.#rules === null || other.#rules === null
        ? this.#rules === other.#rules
        : sameIterable(this.#rules, other.#rules, (left, right) => left.equals(right)))
    );
  }

  hashCode(): number {
    return combinedHash([
      this.#unit.hashCode(),
      this.#entities.hashCode(),
      this.#obligations.hashCode(),
      this.#stateMachines.hashCode(),
      this.#scenarios.hashCode(),
      this.#background.hashCode(),
      this.#unformalizedTargets.hashCode(),
      hashOfBoolean(this.#directoryExists),
      hashOfNullable(this.#rules, (value) => value.hashCode()),
    ]);
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

  // 型付き診断を宣言順で集める。曖昧な属性カタログに依存する検査は実行しない。
  diagnostics(): ErrorMessages {
    const errors: string[] = [];
    const unitName = this.#unit.asString();
    const where = (s: string): string => `unit ${unitName}: ${s}`;
    // 診断列に unit 文脈を冠して積む（積み先の配列を畳み込みで通す）。
    const locate = (messages: ErrorMessages): void => {
      messages.foldLeft(errors, (acc, message) => {
        acc.push(where(message.asString()));
        return acc;
      });
    };
    locate(this.#entities.diagnostics());
    const parsedCatalog = DesignAttributeCatalog.parse(this.#entities);
    const catalog = parsedCatalog.ok ? parsedCatalog.value : null;
    if (!parsedCatalog.ok && parsedCatalog.error.kind !== "ambiguous-design-attributes")
      errors.push(where(`attribute catalog: ${parsedCatalog.error.kind}`));
    if (catalog !== null) locate(catalog.encodingDiagnostics());
    const seenIds = new Set<string>();
    const dup = (id: string, ctx: string): void => {
      if (seenIds.has(id)) errors.push(where(`${ctx}: duplicate id "${id}"`));
      seenIds.add(id);
    };
    const businessRuleReferencesUsed: BusinessRuleReference[] = [];
    const collectBr = (refs: BusinessRuleReferences | undefined): void => {
      if (refs === undefined) return;
      refs.foldLeft(businessRuleReferencesUsed, (acc, reference) => {
        acc.push(reference);
        return acc;
      });
    };

    for (const ob of this.#obligations) {
      const ctx = `obligation ${ob.id().asString()}`;
      dup(ob.id().asString(), ctx);
      collectBr(ob.businessRuleReferences());
      locate(ob.diagnostics(catalog));
    }

    for (const sm of this.#stateMachines) {
      const ctx = `machine ${sm.id().asString()}`;
      dup(sm.id().asString(), ctx);
      for (const tr of sm.transitions()) {
        dup(tr.id().asString(), `transition ${tr.id().asString()}`);
        collectBr(tr.businessRuleReferences());
      }
      if (catalog !== null) locate(sm.diagnostics(catalog));
    }

    for (const sc of this.#scenarios) {
      const ctx = `scenario ${sc.id().asString()}`;
      dup(sc.id().asString(), ctx);
      collectBr(sc.businessRuleReferences());
      if (catalog !== null) locate(sc.diagnostics(catalog));
    }

    for (const bg of this.#background) {
      const ctx = `background ${bg.id().asString()}`;
      dup(bg.id().asString(), ctx);
      if (catalog !== null) locate(bg.diagnostics(catalog));
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
      if (businessRuleReferencesUsed.length > 0) {
        errors.push(
          where(
            `brRefs are used but construction/${unitName}/functional-design/rules.md was not found — they cannot be reverse-verified`,
          ),
        );
      }
    } else {
      locate(known.diagnostics(KeySet.of(businessRuleReferencesUsed), this.#unformalizedTargets));
    }

    return ErrorMessages.collect(errors.map(ErrorMessage.parse));
  }
}
