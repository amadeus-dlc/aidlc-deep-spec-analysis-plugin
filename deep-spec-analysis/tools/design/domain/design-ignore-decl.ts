import type { TriggerName } from "../../kernel/domain/index.ts";
import type { DeclaredValues } from "./declared-values.ts";

// 契約3 設計 IR の ignore 宣言（well-formedness 検査材料）。状態の所属判定と
// (state, trigger) セルのキーは宣言自身の知識（#71 波13）。state は enum
// 宣言値への参照トークン（裁定の恒久除外）。
export class DesignIgnoreDecl {
  readonly #state: string;
  readonly #trigger: TriggerName;

  private constructor(props: { state: string; trigger: TriggerName }) {
    this.#state = props.state;
    this.#trigger = props.trigger;
  }

  static reconstitute(props: { state: string; trigger: TriggerName }): DesignIgnoreDecl {
    return new DesignIgnoreDecl(props);
  }

  state(): string {
    return this.#state;
  }

  trigger(): TriggerName {
    return this.#trigger;
  }

  // 状態が機械の状態集合（enum 宣言値）に属するか。
  isStateAmong(states: DeclaredValues): boolean {
    return states.includes(this.#state);
  }

  // 遷移セルとの衝突判定に使う (state, trigger) キー——DesignTransitionDecl.cellKey と同じ形。
  cellKey(): string {
    return `${this.#state}|${this.#trigger.asString()}`;
  }
}
