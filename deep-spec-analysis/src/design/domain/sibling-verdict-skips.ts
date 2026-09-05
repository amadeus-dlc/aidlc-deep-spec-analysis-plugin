import type { SiblingVerdictSkip } from "./sibling-verdict-skip.ts";

// 兄弟バックエンド判定 skip のファーストクラスコレクション（文書順を保持）。
export class SiblingVerdictSkips {
  readonly #values: readonly SiblingVerdictSkip[];

  private constructor(values: readonly SiblingVerdictSkip[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly SiblingVerdictSkip[]): SiblingVerdictSkips {
    return new SiblingVerdictSkips(values);
  }

  add(value: SiblingVerdictSkip): SiblingVerdictSkips {
    return new SiblingVerdictSkips([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<SiblingVerdictSkip> {
    yield* this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }

  toArray(): readonly SiblingVerdictSkip[] {
    return this.#values;
  }
}
