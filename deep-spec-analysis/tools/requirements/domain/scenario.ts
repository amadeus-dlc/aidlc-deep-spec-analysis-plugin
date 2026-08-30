// 受け入れ／拒否シナリオ。逐語移動。

import type { Expression } from "../../kernel/domain/expression.ts";
import type { FrRefs } from "../../kernel/domain/index.ts";

export interface Scenario {
  id: string;
  kind: "accept" | "reject";
  frRefs: FrRefs;
  bindings: { [path: string]: boolean | number | string };
  event?: { trigger: string };
  expect?: Expression;
}

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
    return this.#values.find((s) => s.id === id);
  }

  ids(): readonly string[] {
    return this.#values.map((s) => s.id);
  }

  toArray(): readonly Scenario[] {
    return this.#values;
  }
}
