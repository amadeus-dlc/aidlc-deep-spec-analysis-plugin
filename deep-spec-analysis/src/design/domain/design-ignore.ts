// 状態機械の ignore 宣言（契約3）。(state, trigger) での no-op を人間が承認
// した証跡。compile-down（明示 no-op event——状態は動かない）は ignore 自身が
// 所有する（#71 波5b）。承認理由（reason）は design IR 上の必須注記として
// 文書に残るが、domain から読む者はいないので運ばない（#71 波9）。

import { type Expression, FrRefs, type TriggerName } from "@deep-spec/kernel-domain";
import type { LoweredId } from "./lowered-id.ts";
import { LoweredObligation } from "./lowered-obligation.ts";

export class DesignIgnore {
  readonly #state: string;
  readonly #trigger: TriggerName;

  private constructor(props: Parameters<typeof DesignIgnore.of>[0]) {
    this.#state = props.state;
    this.#trigger = props.trigger;
  }

  static of(props: { state: string; trigger: TriggerName }): DesignIgnore {
    return new DesignIgnore(props);
  }

  state(): string { return this.#state; }
  trigger(): TriggerName { return this.#trigger; }

  // compile-down のガード: その状態に居るときだけ no-op が発火する。
  loweredGuard(attrPath: string): Expression {
    return { op: "eq", args: [{ op: "ref", path: attrPath }, { op: "enum", value: this.#state }] };
  }

  // compile-down の効果: 状態は動かない（state' == state の明示 no-op）。
  loweredEffect(attrPath: string): Expression {
    return { op: "eq", args: [{ op: "ref", path: attrPath, prime: true }, { op: "ref", path: attrPath }] };
  }

  // compile-down された明示 no-op event 義務（帰属は宣言元の機械が答える）。
  loweredAs(id: LoweredId, attrPath: string): LoweredObligation {
    return LoweredObligation.of({
      id,
      nature: "event",
      frRefs: FrRefs.of([]),
      trigger: this.#trigger.asString(),
      guard: this.loweredGuard(attrPath),
      effect: this.loweredEffect(attrPath),
    });
  }
}
