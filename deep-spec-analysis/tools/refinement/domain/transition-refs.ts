import { IdOrder } from "../../kernel/domain/index.ts";
import { TransitionRef } from "./transition-ref.ts";

// eventMap の transitions（写像先の設計 遷移/義務 id）のコレクション。
export class TransitionRefs {
  readonly #values: readonly TransitionRef[];

  private constructor(values: readonly TransitionRef[]) {
    this.#values = values;
  }

  static of(values: readonly TransitionRef[]): TransitionRefs {
    return new TransitionRefs([...values]);
  }

  add(value: TransitionRef): TransitionRefs {
    return new TransitionRefs([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<TransitionRef> {
    yield* this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }

  // 宣言に無い設計 id（gap 文言用の辞書順——旧 .sort() の凍結挙動）。
  unknownAmong(declared: ReadonlySet<string>): string[] {
    return this.#values.map((t) => t.asString()).filter((t) => !declared.has(t)).sort();
  }

  // eventTransitions 索引が持つ正準順（IdOrder.compare）。
  sortedCanonically(): readonly TransitionRef[] {
    return [...this.#values].sort((a, b) => IdOrder.compare(a.asString(), b.asString()));
  }

  toArray(): readonly TransitionRef[] {
    return this.#values;
  }
}
