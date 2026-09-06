import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import type { RefinementScenario } from "./refinement-scenario.ts";

// 要件シナリオのファーストクラスコレクション。id 索引は最後の宣言が勝つ。
export class RefinementScenarios implements FirstClassCollection, IterableFirstClassCollection<RefinementScenario> {
  readonly #values: readonly RefinementScenario[];

  private constructor(values: readonly RefinementScenario[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly RefinementScenario[]): RefinementScenarios {
    return new RefinementScenarios(values);
  }

  add(value: RefinementScenario): RefinementScenarios {
    return new RefinementScenarios([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<RefinementScenario> {
    yield* this.#values;
  }

  byId(id: string): RefinementScenario | undefined {
    let found: RefinementScenario | undefined;
    for (const s of this.#values) {
      if (s.id().asString() === id) found = s;
    }
    return found;
  }

  sortedCanonically(): RefinementScenarios {
    return new RefinementScenarios(
      [...this.#values].sort((a, b) => a.id().asTargetId().compareTo(b.id().asTargetId())),
    );
  }

  toArray(): readonly RefinementScenario[] {
    return this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
