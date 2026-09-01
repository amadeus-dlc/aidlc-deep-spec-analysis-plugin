import type { RefinementScenario } from "./refinement-scenario.ts";

// 要件シナリオのファーストクラスコレクション。id 索引は最後の宣言が勝つ。
export class RefinementScenarios {
  readonly #values: readonly RefinementScenario[];

  private constructor(values: readonly RefinementScenario[]) {
    this.#values = values;
  }

  static of(values: readonly RefinementScenario[]): RefinementScenarios {
    return new RefinementScenarios([...values]);
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
      if (s.id.asString() === id) found = s;
    }
    return found;
  }

  toArray(): readonly RefinementScenario[] {
    return this.#values;
  }
}
