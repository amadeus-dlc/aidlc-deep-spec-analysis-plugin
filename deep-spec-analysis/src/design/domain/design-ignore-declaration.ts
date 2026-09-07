import type { EnumerationMembers, TriggerName } from "@deep-spec-analysis/kernel-domain";
import { combinedHash, hashOfString } from "@deep-spec-analysis/kernel-infrastructure";

// 契約3 設計 IR の ignore 宣言（well-formedness 検査材料）。状態の所属判定と
// (state, trigger) セルのキーは宣言自身の知識（#71 波13）。state は enum
// 宣言値への参照トークン（裁定の恒久除外）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type DesignIgnoreDeclarationParam = { state: string; trigger: TriggerName };

export class DesignIgnoreDeclaration {
  readonly #state: string;
  readonly #trigger: TriggerName;

  private constructor(props: DesignIgnoreDeclarationParam) {
    this.#state = props.state;
    this.#trigger = props.trigger;
  }

  static of(props: DesignIgnoreDeclarationParam): DesignIgnoreDeclaration {
    return new DesignIgnoreDeclaration(props);
  }

  equals(other: DesignIgnoreDeclaration): boolean {
    return this.#state === other.#state && this.#trigger.equals(other.#trigger);
  }

  hashCode(): number {
    return combinedHash([hashOfString(this.#state), this.#trigger.hashCode()]);
  }

  state(): string {
    return this.#state;
  }

  trigger(): TriggerName {
    return this.#trigger;
  }

  // 状態が機械の状態集合（enum 宣言値）に属するか。
  isStateAmong(states: EnumerationMembers): boolean {
    return states.exists((state) => state.matchesLiteral(this.#state));
  }

  // 遷移セルとの衝突判定に使う (state, trigger) キー——DesignTransitionDeclaration.cellKey と同じ形。
  cellKey(): string {
    return `${this.#state}|${this.#trigger.asString()}`;
  }
}
