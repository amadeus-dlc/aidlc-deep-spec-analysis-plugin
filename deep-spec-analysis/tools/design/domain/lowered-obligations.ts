import type { LoweredObligation } from "./lowered-obligation.ts";

// lowered 義務のファーストクラスコレクション。OB-n 採番順は文書バイトに
// 効く凍結面——順序保持で運ぶ。
export class LoweredObligations {
  readonly #values: readonly LoweredObligation[];

  private constructor(values: readonly LoweredObligation[]) {
    this.#values = values;
  }

  static of(values: readonly LoweredObligation[]): LoweredObligations {
    return new LoweredObligations([...values]);
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
}
