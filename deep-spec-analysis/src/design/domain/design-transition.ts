// 状態機械の遷移（契約3）。id はドメインプリミティブで運ぶ。
// compile-down の暗黙部（ガード = state==from ∧ 明示ガード、効果 = state'=to
// ∧ 明示効果、代入表の state 遷移代入）は遷移自身が所有する——lowering と
// イベントカタログの2箇所に重複していた知識をここに戻す（#71 波5b）。

import { type Expression, FrRefs, type TriggerName } from "@deep-spec/kernel-domain";
import { type BrRefs } from "./br-refs.ts";
import { DesignTransitionId } from "./design-transition-id.ts";
import type { LoweredId } from "./lowered-id.ts";
import { LoweredObligation } from "./lowered-obligation.ts";
import { LoweredOrigin } from "./lowered-origin.ts";
import { LoweredOriginRef } from "./lowered-origin-ref.ts";

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

  // `attrPath == enum(state)`（prime なら `attrPath' == enum(state)`）——状態機械の
  // 暗黙ガード／効果の符号。ignore の no-op 等式と同じ形（裁定 2）。
  #stateEquality(attrPath: string, state: string, prime: boolean): Expression {
    return { op: "eq", args: [prime ? { op: "ref", path: attrPath, prime: true } : { op: "ref", path: attrPath }, { op: "enum", value: state }] };
  }

  // compile-down の暗黙ガード: 遷移は出自状態に居るときだけ発火する。
  loweredGuard(attrPath: string): Expression {
    const base = this.#stateEquality(attrPath, this.#from, false);
    return this.#guard === undefined ? base : { op: "and", args: [base, this.#guard] };
  }

  // compile-down の暗黙効果: 発火すれば状態は行先へ進む。
  loweredEffect(attrPath: string): Expression {
    const base = this.#stateEquality(attrPath, this.#to, true);
    return this.#effect === undefined ? base : { op: "and", args: [base, this.#effect] };
  }

  // compile-down された event 義務そのもの（暗黙ガード・効果つき）。
  loweredAs(id: LoweredId, attrPath: string): LoweredObligation {
    return LoweredObligation.reconstitute({
      id,
      nature: "event",
      frRefs: FrRefs.of([]),
      trigger: this.#trigger.asString(),
      guard: this.loweredGuard(attrPath),
      effect: this.loweredEffect(attrPath),
    });
  }

  // 降ろし方の帰属：遷移。
  loweredOrigin(): LoweredOrigin {
    return LoweredOrigin.reconstitute({ design: LoweredOriginRef.reconstitute(this.#id.asString()), kind: "transition" });
  }

  // 代入表（DesignEventCatalog）用の state 遷移代入: attrPath ← enum(to)。
  stateAssignment(attrPath: string): readonly [string, Expression] {
    return [attrPath, { op: "enum", value: this.#to }];
  }
}
