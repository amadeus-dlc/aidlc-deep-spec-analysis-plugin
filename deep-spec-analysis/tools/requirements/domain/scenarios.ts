import type { Scenario } from "./scenario.ts";

// シナリオのファーストクラスコレクション。id 検索と id 列の導出を所有する。
export class Scenarios {
  readonly #values: readonly Scenario[];

  private constructor(values: readonly Scenario[]) {
    this.#values = values;
  }

  static of(values: readonly Scenario[]): Scenarios {
    return new Scenarios([...values]);
  }

  add(value: Scenario): Scenarios {
    return new Scenarios([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<Scenario> {
    yield* this.#values;
  }

  byId(id: string): Scenario | undefined {
    return this.#values.find((s) => s.id().asString() === id);
  }

  ids(): readonly string[] {
    return this.#values.map((s) => s.id().asString());
  }

  toArray(): readonly Scenario[] {
    return this.#values;
  }
}
