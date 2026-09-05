// エンティティ属性ひとつを生涯とする状態機械（契約3）。deterministic: false は
// 同一 (state, trigger) 重複の人間承認済み waiver 宣言。逐語移動。id と
// 生涯属性の座標（entity / attribute）はドメインプリミティブで運ぶ。
// 到達不能プローブの候補選別（初期状態でない宣言値）と deterministic:false
// waiver の判定は機械自身が所有する（#71 波7）。

import { type DesignTransitions } from "./design-transitions.ts";
import { type InitialStates } from "./initial-states.ts";
import { DesignAttributeName } from "./design-attribute-name.ts";
import { DesignEntityName } from "./design-entity-name.ts";
import { DesignIgnores } from "./design-ignores.ts";
import { DesignMachineIdentifier } from "./design-machine-identifier.ts";
import { LoweredOrigin } from "./lowered-origin.ts";
import { LoweredOriginReference } from "./lowered-origin-reference.ts";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type DesignMachineParam = {
  id: DesignMachineIdentifier;
  entity: DesignEntityName;
  attribute: DesignAttributeName;
  initial: InitialStates;
  transitions: DesignTransitions;
  ignores: DesignIgnores;
  deterministic: boolean;
};

export class DesignMachine {
  readonly #id: DesignMachineIdentifier;
  readonly #entity: DesignEntityName;
  readonly #attribute: DesignAttributeName;
  readonly #initial: InitialStates;
  readonly #transitions: DesignTransitions;
  readonly #ignores: DesignIgnores;
  readonly #deterministic: boolean;

  private constructor(props: DesignMachineParam) {
    this.#id = props.id;
    this.#entity = props.entity;
    this.#attribute = props.attribute;
    this.#initial = props.initial;
    this.#transitions = props.transitions;
    this.#ignores = props.ignores;
    this.#deterministic = props.deterministic;
  }

  static of(props: DesignMachineParam): DesignMachine {
    return new DesignMachine(props);
  }

  id(): DesignMachineIdentifier {
    return this.#id;
  }

  entity(): DesignEntityName {
    return this.#entity;
  }

  attribute(): DesignAttributeName {
    return this.#attribute;
  }

  transitions(): DesignTransitions {
    return this.#transitions;
  }

  ignores(): DesignIgnores {
    return this.#ignores;
  }

  // 降ろし方の帰属：ignore の no-op event は宣言元の機械に帰属する。
  loweredIgnoreOrigin(): LoweredOrigin {
    return LoweredOrigin.of({ design: LoweredOriginReference.of(this.#id.asString()), kind: "ignore" });
  }

  // 到達不能プローブの候補：enum 宣言値のうち初期状態でないもの（昇順——
  // capability skip 文言の states 列挙順もこの順に従う凍結面）。
  nonInitialCandidates(values: readonly string[]): string[] {
    return values.filter((s) => !this.#initial.includes(s)).sort();
  }

  // deterministic:false waiver —— conflict の対象がすべてこの機械の遷移で
  // あり、かつ非決定を宣言済みのとき、同一 (state,trigger) 重複検査は
  // モデルが放棄する。
  waivesOverlapOf(machines: readonly (DesignMachine | null)[]): boolean {
    return machines.every((m) => m === this) && !this.#deterministic;
  }
}
