// 状態機械の遷移（契約3）。id はドメインプリミティブで運ぶ。
// compile-down の暗黙部（ガード = state==from ∧ 明示ガード、効果 = state'=to
// ∧ 明示効果、代入表の state 遷移代入）は遷移自身が所有する——lowering と
// イベントカタログの2箇所に重複していた知識をここに戻す（#71 波5b）。

import { Expressions, type Expression, type TriggerName } from "../../kernel/domain/index.ts";
import { type BrRefs } from "./br-refs.ts";
import { DesignTransitionId } from "./design-transition-id.ts";

export class DesignTransition {
  readonly #id: DesignTransitionId;
  readonly #from: string;
  readonly #to: string;
  readonly #trigger: TriggerName;
  readonly #guard: Expression | undefined;
  readonly #effect: Expression | undefined;
  readonly #brRefs: BrRefs;

  private constructor(props: { id: DesignTransitionId; from: string; to: string; trigger: TriggerName; guard?: Expression; effect?: Expression; brRefs: BrRefs }) {
    this.#id = props.id;
    this.#from = props.from;
    this.#to = props.to;
    this.#trigger = props.trigger;
    this.#guard = props.guard;
    this.#effect = props.effect;
    this.#brRefs = props.brRefs;
  }

  static reconstitute(props: { id: DesignTransitionId; from: string; to: string; trigger: TriggerName; guard?: Expression; effect?: Expression; brRefs: BrRefs }): DesignTransition {
    return new DesignTransition(props);
  }

  id(): DesignTransitionId { return this.#id; }
  fromState(): string { return this.#from; }
  toState(): string { return this.#to; }
  trigger(): TriggerName { return this.#trigger; }
  guard(): Expression | undefined { return this.#guard; }
  effect(): Expression | undefined { return this.#effect; }
  brRefs(): BrRefs { return this.#brRefs; }

  // compile-down の暗黙ガード: 遷移は出自状態に居るときだけ発火する。
  loweredGuard(attrPath: string): Expression {
    const base = Expressions.eqRef(attrPath, false, this.#from);
    return this.#guard === undefined ? base : { op: "and", args: [base, this.#guard] };
  }

  // compile-down の暗黙効果: 発火すれば状態は行先へ進む。
  loweredEffect(attrPath: string): Expression {
    const base = Expressions.eqRef(attrPath, true, this.#to);
    return this.#effect === undefined ? base : { op: "and", args: [base, this.#effect] };
  }

  // 代入表（DesignEventCatalog）用の state 遷移代入: attrPath ← enum(to)。
  stateAssignment(attrPath: string): readonly [string, Expression] {
    return [attrPath, { op: "enum", value: this.#to }];
  }
}
