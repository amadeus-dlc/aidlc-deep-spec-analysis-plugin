import { type AppliesTo } from "./applies-to.ts";
import { type BusinessRuleId } from "./business-rule-id.ts";
import { type ElementPath } from "./element-path.ts";
import { type RuleCategory } from "./rule-category.ts";
import { type SourceIds } from "./source-ids.ts";

// ---- rules.md ---------------------------------------------------------------

export interface RuleDeclSeed {
  readonly id: BusinessRuleId | null;
  readonly element: ElementPath;
  readonly category: RuleCategory | null;
  readonly appliesTo: AppliesTo | null;
  readonly sourceIds: SourceIds;
  // 欠落キー名の列（文言材料——語彙値ではない）。
  readonly missing: readonly string[];
}
