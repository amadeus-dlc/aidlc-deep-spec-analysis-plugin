import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import type { Check } from "./check.ts";

// doctor 判定書のファーストクラスコレクション。checks 配列順（＝ユースケース
// 実行順）が凍結された観測面で、境界へは document() だけが素の形を出す。
export class HealthVerdict implements FirstClassCollection, IterableFirstClassCollection<Check> {
  readonly #values: readonly Check[];

  private constructor(values: readonly Check[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly Check[]): HealthVerdict {
    return new HealthVerdict(values);
  }

  add(value: Check): HealthVerdict {
    return new HealthVerdict([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<Check> {
    yield* this.#values;
  }

  // 境界: stdout へ直列化される published 形。
  document(): { checks: readonly ReturnType<Check["toDocument"]>[] } {
    return { checks: this.#values.map((c) => c.toDocument()) };
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
