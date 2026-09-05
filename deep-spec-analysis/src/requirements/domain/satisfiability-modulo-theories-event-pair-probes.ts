import type { SatisfiabilityModuloTheoriesEventPairProbe } from "./satisfiability-modulo-theories-event-pair-probe.ts";

// 同トリガ event 対プローブのファーストクラスコレクション（発行順を保持）。
export class SatisfiabilityModuloTheoriesEventPairProbes {
  readonly #values: readonly SatisfiabilityModuloTheoriesEventPairProbe[];

  private constructor(values: readonly SatisfiabilityModuloTheoriesEventPairProbe[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(
    values: readonly SatisfiabilityModuloTheoriesEventPairProbe[],
  ): SatisfiabilityModuloTheoriesEventPairProbes {
    return new SatisfiabilityModuloTheoriesEventPairProbes(values);
  }

  add(value: SatisfiabilityModuloTheoriesEventPairProbe): SatisfiabilityModuloTheoriesEventPairProbes {
    return new SatisfiabilityModuloTheoriesEventPairProbes([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<SatisfiabilityModuloTheoriesEventPairProbe> {
    yield* this.#values;
  }

  toArray(): readonly SatisfiabilityModuloTheoriesEventPairProbe[] {
    return this.#values;
  }
}
