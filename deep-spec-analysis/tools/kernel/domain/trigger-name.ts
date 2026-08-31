// イベントトリガ名 — 要件義務(event)・設計遷移/ignore・refinement eventMap が
// 共有する語彙のため kernel に置く(FrRefs / AttributeBound と同じ扱い)。
// 旧実装の真偽値判定(`!ob.trigger`)は「未宣言 または 空文字」を一括で捕えて
// いた——空文字は reconstitute で素通しし、判定は isEmpty() が所有する
// (Tell-Don't-Ask 裁定)。

import { type Result, err, ok } from "../infrastructure/index.ts";

export type TriggerNameError = { readonly kind: "empty-trigger-name"; readonly raw: string };

export class TriggerName {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<TriggerName, TriggerNameError> {
    if (raw === "") return err({ kind: "empty-trigger-name", raw });
    return ok(new TriggerName(raw));
  }

  static reconstitute(raw: string): TriggerName {
    return new TriggerName(raw);
  }

  equals(other: TriggerName): boolean {
    return this.#value === other.#value;
  }

  asString(): string {
    return this.#value;
  }

  // 旧 `!trigger` 真偽値判定の空文字側(凍結挙動の材料)。
  isEmpty(): boolean {
    return this.#value === "";
  }
}
