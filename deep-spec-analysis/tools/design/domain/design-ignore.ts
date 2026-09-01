// 状態機械の ignore 宣言（契約3）。(state, trigger) での no-op を人間が承認
// した証跡。compile-down（明示 no-op event——状態は動かない）は ignore 自身が
// 所有する（#71 波5b）。

import { Expressions, type Expression, type TriggerName } from "../../kernel/domain/index.ts";

export class DesignIgnore {
  readonly #state: string;
  readonly #trigger: TriggerName;
  readonly #reason: string;

  private constructor(props: { state: string; trigger: TriggerName; reason: string }) {
    this.#state = props.state;
    this.#trigger = props.trigger;
    this.#reason = props.reason;
  }

  static reconstitute(props: { state: string; trigger: TriggerName; reason: string }): DesignIgnore {
    return new DesignIgnore(props);
  }

  state(): string { return this.#state; }
  trigger(): TriggerName { return this.#trigger; }
  reason(): string { return this.#reason; }

  // compile-down のガード: その状態に居るときだけ no-op が発火する。
  loweredGuard(attrPath: string): Expression {
    return Expressions.eqRef(attrPath, false, this.#state);
  }

  // compile-down の効果: 状態は動かない（state' == state の明示 no-op）。
  loweredEffect(attrPath: string): Expression {
    return { op: "eq", args: [{ op: "ref", path: attrPath, prime: true }, { op: "ref", path: attrPath }] };
  }
}
