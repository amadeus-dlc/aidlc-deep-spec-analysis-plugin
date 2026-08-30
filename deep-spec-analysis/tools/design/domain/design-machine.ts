// エンティティ属性ひとつを生涯とする状態機械（契約3）。deterministic: false は
// 同一 (state, trigger) 重複の人間承認済み waiver 宣言。逐語移動。

import type { DesignTransition } from "./design-transition.ts";

export interface DesignMachine {
  id: string;
  entity: string;
  attribute: string;
  initial: string[];
  transitions: DesignTransition[];
  ignores: { state: string; trigger: string; reason: string }[];
  deterministic: boolean;
}

// 状態機械のファーストクラスコレクション。全遷移 id の導出を所有する。
export class DesignMachines {
  readonly #values: readonly DesignMachine[];

  private constructor(values: readonly DesignMachine[]) {
    this.#values = values;
  }

  static of(values: readonly DesignMachine[]): DesignMachines {
    return new DesignMachines([...values]);
  }

  add(value: DesignMachine): DesignMachines {
    return new DesignMachines([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignMachine> {
    yield* this.#values;
  }

  transitionIds(): readonly string[] {
    return this.#values.flatMap((m) => m.transitions.map((t) => t.id));
  }

  toArray(): readonly DesignMachine[] {
    return this.#values;
  }
}
