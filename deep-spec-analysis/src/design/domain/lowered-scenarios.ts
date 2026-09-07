import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { LoweredScenario } from "./lowered-scenario.ts";

// lowered シナリオのファーストクラスコレクション（SC-n 採番順を保持）。
export class LoweredScenarios extends FirstClassCollectionBase<LoweredScenario, LoweredScenarios> {
  readonly #values: readonly LoweredScenario[];

  private constructor(values: readonly LoweredScenario[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-lowered-scenarios");
  }

  protected override rebuild(values: readonly LoweredScenario[]): LoweredScenarios {
    return new LoweredScenarios(values);
  }

  static of(values: readonly LoweredScenario[]): LoweredScenarios {
    return new LoweredScenarios(values);
  }

  override map(transform: (element: LoweredScenario) => LoweredScenario): LoweredScenarios {
    return this.mapTo(transform, LoweredScenarios.of);
  }

  override combine(other: LoweredScenarios): LoweredScenarios {
    return this.combineTo(other, LoweredScenarios.of);
  }

  static parse(values: readonly LoweredScenario[]): Result<LoweredScenarios, ParseError> {
    return parseConstruction(() => new LoweredScenarios(values));
  }

  add(value: LoweredScenario): LoweredScenarios {
    return new LoweredScenarios([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<LoweredScenario> {
    yield* this.#values;
  }

  override count(): number {
    return this.#values.length;
  }

  toArray(): readonly LoweredScenario[] {
    return this.#values;
  }
}
