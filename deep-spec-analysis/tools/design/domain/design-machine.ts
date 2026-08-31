// エンティティ属性ひとつを生涯とする状態機械（契約3）。deterministic: false は
// 同一 (state, trigger) 重複の人間承認済み waiver 宣言。逐語移動。id と
// 生涯属性の座標（entity / attribute）はドメインプリミティブで運ぶ。

import { type Result, err, ok } from "../../kernel/infrastructure/index.ts";

export type DesignMachineTokenError = { readonly kind: "empty-machine-token"; readonly raw: string };

export class DesignMachineId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<DesignMachineId, DesignMachineTokenError> {
    if (raw === "") return err({ kind: "empty-machine-token", raw });
    return ok(new DesignMachineId(raw));
  }

  static reconstitute(raw: string): DesignMachineId {
    return new DesignMachineId(raw);
  }

  equals(other: DesignMachineId): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}

export class DesignEntityName {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<DesignEntityName, DesignMachineTokenError> {
    if (raw === "") return err({ kind: "empty-machine-token", raw });
    return ok(new DesignEntityName(raw));
  }

  static reconstitute(raw: string): DesignEntityName {
    return new DesignEntityName(raw);
  }

  equals(other: DesignEntityName): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}

export class DesignAttributeName {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<DesignAttributeName, DesignMachineTokenError> {
    if (raw === "") return err({ kind: "empty-machine-token", raw });
    return ok(new DesignAttributeName(raw));
  }

  static reconstitute(raw: string): DesignAttributeName {
    return new DesignAttributeName(raw);
  }

  equals(other: DesignAttributeName): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }
}

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
  id: DesignMachineId;
  entity: DesignEntityName;
  attribute: DesignAttributeName;
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
