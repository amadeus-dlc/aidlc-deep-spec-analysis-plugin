import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import type { LoweredScenario } from "./lowered-scenario.ts";

// lowered シナリオのファーストクラスコレクション（SC-n 採番順を保持）。
export class LoweredScenarios implements FirstClassCollection, IterableFirstClassCollection<LoweredScenario> {
  readonly #values: readonly LoweredScenario[];

  private constructor(values: readonly LoweredScenario[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly LoweredScenario[]): LoweredScenarios {
    return new LoweredScenarios(values);
  }

  add(value: LoweredScenario): LoweredScenarios {
    return new LoweredScenarios([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<LoweredScenario> {
    yield* this.#values;
  }

  count(): number {
    return this.#values.length;
  }

  toArray(): readonly LoweredScenario[] {
    return this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
