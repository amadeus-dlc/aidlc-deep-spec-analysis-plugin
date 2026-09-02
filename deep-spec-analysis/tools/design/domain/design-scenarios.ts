import type { DesignScenario } from "./design-scenario.ts";

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

  // lowering の凍結順：id の正準順（DesignTransitions.sortedCanonically と同じ面）。
  sortedCanonically(): DesignScenarios {
    return new DesignScenarios([...this.#values].sort((a, b) => a.id().compareTo(b.id())));
  }

  *[Symbol.iterator](): Iterator<DesignScenario> {
    yield* this.#values;
  }

  ids(): readonly string[] {
    return this.#values.map((s) => s.id().asString());
  }

  toArray(): readonly DesignScenario[] {
    return this.#values;
  }
}
