import type { RequirementIdentifiers } from "@deep-spec/kernel-domain";
import { type AppliesTo } from "./applies-to.ts";
import { type DeclaredRuleIdentifier } from "./declared-rule-identifier.ts";
import { type ElementPath } from "./element-path.ts";
import { type RuleCategory } from "./rule-category.ts";
import type { SourceIdentifiers } from "./source-identifiers.ts";

// 規則宣言。finding target の選定（BR 形なら自分の id、でなければ族の
// フォールバック）・source id の逆検証・category の閉集合整合を所有する。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type RuleDeclarationParam = {
  readonly id: DeclaredRuleIdentifier | null;
  readonly element: ElementPath;
  readonly category: RuleCategory | null;
  readonly appliesTo: AppliesTo | null;
  readonly sourceIds: SourceIdentifiers;
  // 欠落キー名の列（文言材料——語彙値ではない）。
  readonly missing: readonly string[];
};

export class RuleDeclaration {
  readonly #id: DeclaredRuleIdentifier | null;
  readonly #element: ElementPath;
  readonly #category: RuleCategory | null;
  readonly #appliesTo: AppliesTo | null;
  readonly #sourceIds: SourceIdentifiers;
  readonly #missing: readonly string[];

  private constructor(seed: RuleDeclarationParam) {
    this.#id = seed.id;
    this.#element = seed.element;
    this.#category = seed.category;
    this.#appliesTo = seed.appliesTo;
    this.#sourceIds = seed.sourceIds;
    this.#missing = Object.freeze([...seed.missing]);
  }

  static of(seed: RuleDeclarationParam): RuleDeclaration {
    return new RuleDeclaration(seed);
  }

  id(): DeclaredRuleIdentifier | null {
    return this.#id;
  }

  element(): ElementPath {
    return this.#element;
  }

  category(): RuleCategory | null {
    return this.#category;
  }

  appliesTo(): AppliesTo | null {
    return this.#appliesTo;
  }

  missing(): readonly string[] {
    return this.#missing;
  }

  // 旧 `r.id !== null && /^BR…$/.test(r.id) ? r.id : fallback` の移設。
  findingTarget(fallback: string): string {
    return this.#id !== null && this.#id.matchesShape() ? this.#id.asString() : fallback;
  }

  // FD-R3: requirements.md に存在しない source id（値の昇順——凍結順）。
  sourceIdValuesMissingFrom(known: RequirementIdentifiers): string[] {
    return this.#sourceIds.valuesMissingFrom(known);
  }

  categoryOutsideClosedSet(): boolean {
    return this.#category !== null && !this.#category.isKnownCategory();
  }
}
