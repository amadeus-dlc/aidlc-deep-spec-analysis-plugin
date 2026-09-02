import type { Check } from "./check.ts";

// doctor 判定書のファーストクラスコレクション。checks 配列順（＝ユースケース
// 実行順）が凍結された観測面で、境界へは document() だけが素の形を出す。
export class HealthVerdict {
  readonly #values: readonly Check[];

  private constructor(values: readonly Check[]) {
    this.#values = values;
  }

  static of(values: readonly Check[]): HealthVerdict {
    return new HealthVerdict([...values]);
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
}
