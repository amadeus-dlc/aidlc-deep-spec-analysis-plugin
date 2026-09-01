import type { RequirementIds } from "../../kernel/domain/index.ts";
import { type AppliesTo } from "./applies-to.ts";
import { type BusinessRuleId } from "./business-rule-id.ts";
import { type ElementPath } from "./element-path.ts";
import { type RuleCategory } from "./rule-category.ts";
import type { RuleDeclSeed } from "./rule-decl-seed.ts";

// 規則宣言。finding target の選定（BR 形なら自分の id、でなければ族の
// フォールバック）・source id の逆検証・category の閉集合整合を所有する。
export class RuleDecl {
  readonly #seed: RuleDeclSeed;

  private constructor(seed: RuleDeclSeed) {
    this.#seed = seed;
  }

  static reconstitute(seed: RuleDeclSeed): RuleDecl {
    return new RuleDecl(seed);
  }

  id(): BusinessRuleId | null {
    return this.#seed.id;
  }

  element(): ElementPath {
    return this.#seed.element;
  }

  category(): RuleCategory | null {
    return this.#seed.category;
  }

  appliesTo(): AppliesTo | null {
    return this.#seed.appliesTo;
  }

  missing(): readonly string[] {
    return this.#seed.missing;
  }

  // 旧 `r.id !== null && /^BR…$/.test(r.id) ? r.id : fallback` の移設。
  findingTarget(fallback: string): string {
    return this.#seed.id !== null && this.#seed.id.matchesShape() ? this.#seed.id.asString() : fallback;
  }

  // FD-R3: requirements.md に存在しない source id（値の昇順——凍結順）。
  sourceIdValuesMissingFrom(known: RequirementIds): string[] {
    return this.#seed.sourceIds.valuesMissingFrom(known);
  }

  categoryOutsideClosedSet(): boolean {
    return this.#seed.category !== null && !this.#seed.category.isKnownCategory();
  }
}
