// エンティティ属性ひとつを生涯とする状態機械（契約3）。deterministic: false は
// 同一 (state, trigger) 重複の人間承認済み waiver 宣言。逐語移動。

import type { DesignTransitions } from "./design-transition.ts";
import type { InitialStates } from "./design-ir-decl.ts";

export interface DesignIgnore {
  state: string;
  trigger: string;
  reason: string;
}

// ignores 宣言のファーストクラスコレクション。lowering の (state, trigger)
// 文字列順という凍結順を所有する。
export class DesignIgnores {
  readonly #values: readonly DesignIgnore[];

  private constructor(values: readonly DesignIgnore[]) {
    this.#values = values;
  }

  static of(values: readonly DesignIgnore[]): DesignIgnores {
    return new DesignIgnores([...values]);
  }

  add(value: DesignIgnore): DesignIgnores {
    return new DesignIgnores([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignIgnore> {
    yield* this.#values;
  }

  // 旧 lowering の逐語比較器（byte-frozen）。`/` 連結キーだが契約3 の
  // identifier パターン ^[a-z][a-zA-Z0-9_]*$ により state/trigger に `/` は
  // 入り得ず衝突しない。等値時に 1 を返す挙動も凍結面（field-wise + 0 への
  // 正規化は重複 (state,trigger)——well-formedness が collision として報告——の
  // 安定順を変え得るため PR10 の凍結台帳で扱う）。
  sortedByStateTrigger(): DesignIgnores {
    return new DesignIgnores([...this.#values].sort((a, b) => (`${a.state}/${a.trigger}` < `${b.state}/${b.trigger}` ? -1 : 1)));
  }

  toArray(): readonly DesignIgnore[] {
    return this.#values;
  }
}

export interface DesignMachine {
  id: string;
  entity: string;
  attribute: string;
  initial: InitialStates;
  transitions: DesignTransitions;
  ignores: DesignIgnores;
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
    return this.#values.flatMap((m) => [...m.transitions.ids()]);
  }

  toArray(): readonly DesignMachine[] {
    return this.#values;
  }
}
