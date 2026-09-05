import { TransitionReference } from "./transition-reference.ts";

// eventMap の transitions（写像先の設計 遷移/義務 id）のコレクション。
export class TransitionReferences {
  readonly #values: readonly TransitionReference[];

  private constructor(values: readonly TransitionReference[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly TransitionReference[]): TransitionReferences {
    return new TransitionReferences(values);
  }

  add(value: TransitionReference): TransitionReferences {
    return new TransitionReferences([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<TransitionReference> {
    yield* this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }

  // 宣言に無い設計 id（gap 文言用の辞書順——旧 .sort() の凍結挙動）。
  unknownAmong(declared: ReadonlySet<string>): string[] {
    return this.#values.map((t) => t.asString()).filter((t) => !declared.has(t)).sort();
  }

  // eventTransitions 索引が持つ正準順（TransitionReference.compareTo）。
  sortedCanonically(): readonly TransitionReference[] {
    return [...this.#values].sort((a, b) => a.compareTo(b));
  }

  toArray(): readonly TransitionReference[] {
    return this.#values;
  }
}
