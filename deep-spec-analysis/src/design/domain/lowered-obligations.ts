import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import type { LoweredObligation } from "./lowered-obligation.ts";

// lowered 義務のファーストクラスコレクション。OB-n 採番順は文書バイトに
// 効く凍結面——順序保持で運ぶ。
export class LoweredObligations implements FirstClassCollection, IterableFirstClassCollection<LoweredObligation> {
  readonly #values: readonly LoweredObligation[];

  private constructor(values: readonly LoweredObligation[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly LoweredObligation[]): LoweredObligations {
    return new LoweredObligations(values);
  }

  add(value: LoweredObligation): LoweredObligations {
    return new LoweredObligations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<LoweredObligation> {
    yield* this.#values;
  }

  count(): number {
    return this.#values.length;
  }

  // 境界（serializer・テスト）専用のエスケープハッチ。
  toArray(): readonly LoweredObligation[] {
    return this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
