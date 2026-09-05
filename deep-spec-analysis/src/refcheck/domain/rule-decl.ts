import type { RequirementIds } from "@deep-spec/kernel-domain";
import { type AppliesTo } from "./applies-to.ts";
import { type DeclaredRuleId } from "./declared-rule-id.ts";
import { type ElementPath } from "./element-path.ts";
import { type RuleCategory } from "./rule-category.ts";
import type { SourceIds } from "./source-ids.ts";

// 規則宣言。finding target の選定（BR 形なら自分の id、でなければ族の
// フォールバック）・source id の逆検証・category の閉集合整合を所有する。
export class RuleDecl {
  readonly #seed: {
  readonly id: DeclaredRuleId | null;
  readonly element: ElementPath;
  readonly category: RuleCategory | null;
  readonly appliesTo: AppliesTo | null;
  readonly sourceIds: SourceIds;
  // 欠落キー名の列（文言材料——語彙値ではない）。
  readonly missing: readonly string[];
  };

  private constructor(seed: Parameters<typeof RuleDecl.of>[0]) {
    this.#seed = seed;
  }

  static of(seed: {
    readonly id: DeclaredRuleId | null;
    readonly element: ElementPath;
    readonly category: RuleCategory | null;
    readonly appliesTo: AppliesTo | null;
    readonly sourceIds: SourceIds;
    // 欠落キー名の列（文言材料——語彙値ではない）。
    readonly missing: readonly string[];
  }): RuleDecl {
    return new RuleDecl(seed);
  }

  id(): DeclaredRuleId | null {
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
