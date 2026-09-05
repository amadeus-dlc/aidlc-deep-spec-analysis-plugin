import { parseConstruction, type ParseError, type Result } from "@deep-spec/kernel-infrastructure";
import { ExpressionTree } from "@deep-spec/kernel-domain";
import { type Expression, ObligationNature, TriggerName } from "@deep-spec/kernel-domain";
import type { FunctionalRequirementReferences } from "@deep-spec/kernel-domain";

import type { LoweredIdentifier } from "./lowered-identifier.ts";

// lowered v1 義務（兄弟バックエンドへ渡す契約1 の形）。id は lowered 語彙
// （OB-n）、nature は分類文字列、trigger は lowered 文書の生トリガ名。ペイロード
// の面（どの任意部が存在するか）は義務自身の知識（#71 波20）。temporal は
// 契約1 の時相宣言そのまま（pattern と assert / from / to）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type LoweredObligationParam = {
  id: LoweredIdentifier;
  nature: string;
  functionalRequirementReferences: FunctionalRequirementReferences;
  assert?: Expression;
  trigger?: string;
  guard?: Expression;
  effect?: Expression;
  temporal?: { readonly pattern: string; readonly assert?: Expression; readonly from?: Expression; readonly to?: Expression };
};

export class LoweredObligation {
  readonly #id: LoweredIdentifier;
  readonly #nature: ObligationNature;
  readonly #functionalRequirementReferences: FunctionalRequirementReferences;
  readonly #assert: Expression | undefined;
  readonly #trigger: TriggerName | undefined;
  readonly #guard: Expression | undefined;
  readonly #effect: Expression | undefined;
  readonly #temporal: { readonly pattern: string; readonly assert?: Expression; readonly from?: Expression; readonly to?: Expression } | undefined;

  private constructor(props: LoweredObligationParam) {
    this.#id = props.id;
    this.#nature = ObligationNature.of(props.nature);
    this.#functionalRequirementReferences = props.functionalRequirementReferences;
    this.#assert = props.assert === undefined ? undefined : ExpressionTree.of(props.assert).asExpression();
    this.#trigger = props.trigger === undefined ? undefined : TriggerName.of(props.trigger);
    this.#guard = props.guard === undefined ? undefined : ExpressionTree.of(props.guard).asExpression();
    this.#effect = props.effect === undefined ? undefined : ExpressionTree.of(props.effect).asExpression();
    this.#temporal = props.temporal === undefined ? undefined : {
      ...props.temporal,
      ...(props.temporal.assert !== undefined ? { assert: ExpressionTree.of(props.temporal.assert).asExpression() } : {}),
      ...(props.temporal.from !== undefined ? { from: ExpressionTree.of(props.temporal.from).asExpression() } : {}),
      ...(props.temporal.to !== undefined ? { to: ExpressionTree.of(props.temporal.to).asExpression() } : {}),
    };
  }

  static parse(props: LoweredObligationParam): Result<LoweredObligation, ParseError> {
    return parseConstruction(() => new LoweredObligation(props));
  }

  static of(props: LoweredObligationParam): LoweredObligation {
    return new LoweredObligation(props);
  }

  id(): LoweredIdentifier {
    return this.#id;
  }

  nature(): string {
    return this.#nature.asString();
  }

  functionalRequirementReferences(): FunctionalRequirementReferences {
    return this.#functionalRequirementReferences;
  }

  assertion(): Expression | undefined {
    return this.#assert;
  }

  trigger(): string | undefined {
    return this.#trigger?.asString();
  }

  guard(): Expression | undefined {
    return this.#guard;
  }

  effect(): Expression | undefined {
    return this.#effect;
  }

  temporal(): { readonly pattern: string; readonly assert?: Expression; readonly from?: Expression; readonly to?: Expression } | undefined {
    return this.#temporal === undefined ? undefined : { ...this.#temporal };
  }

  isEvent(): boolean {
    return this.#trigger !== undefined;
  }
}
