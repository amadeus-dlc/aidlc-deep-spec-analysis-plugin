// 設計シナリオ（受け入れ／拒否、BR/FR 両参照つき）。逐語移動。

import type { Expression } from "../../kernel/domain/index.ts";

export interface DesignScenario {
  id: string;
  kind: "accept" | "reject";
  brRefs: string[];
  frRefs: string[];
  bindings: { [path: string]: boolean | number | string };
  event?: { trigger: string };
  expect?: Expression;
}

// 設計シナリオのファーストクラスコレクション。
export class DesignScenarios {
  readonly #values: readonly DesignScenario[];

  private constructor(values: readonly DesignScenario[]) {
    this.#values = values;
  }

  static of(values: readonly DesignScenario[]): DesignScenarios {
    return new DesignScenarios([...values]);
  }

  add(value: DesignScenario): DesignScenarios {
    return new DesignScenarios([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignScenario> {
    yield* this.#values;
  }

  ids(): readonly string[] {
    return this.#values.map((s) => s.id);
  }

  toArray(): readonly DesignScenario[] {
    return this.#values;
  }
}
