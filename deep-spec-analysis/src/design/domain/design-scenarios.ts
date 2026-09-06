import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignScenario } from "./design-scenario.ts";

// 設計シナリオのファーストクラスコレクション。
export class DesignScenarios extends FirstClassCollectionBase<DesignScenario, DesignScenarios> {
  readonly #values: readonly DesignScenario[];

  private constructor(values: readonly DesignScenario[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-design-scenarios");
  }

  protected rebuild(values: readonly DesignScenario[]): DesignScenarios {
    return new DesignScenarios(values);
  }

  static of(values: readonly DesignScenario[]): DesignScenarios {
    return new DesignScenarios(values);
  }

  static parse(values: readonly DesignScenario[]): Result<DesignScenarios, ParseError> {
    return parseConstruction(() => new DesignScenarios(values));
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
