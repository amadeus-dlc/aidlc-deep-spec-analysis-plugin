import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { SatisfiabilityModuloTheoriesEventPairProbe } from "./satisfiability-modulo-theories-event-pair-probe.ts";

// 同トリガ event 対プローブのファーストクラスコレクション（発行順を保持）。
export class SatisfiabilityModuloTheoriesEventPairProbes
  extends FirstClassCollectionBase<
    SatisfiabilityModuloTheoriesEventPairProbe,
    SatisfiabilityModuloTheoriesEventPairProbes
  >
  implements FirstClassCollection<SatisfiabilityModuloTheoriesEventPairProbe>
{
  readonly #values: readonly SatisfiabilityModuloTheoriesEventPairProbe[];

  private constructor(values: readonly SatisfiabilityModuloTheoriesEventPairProbe[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-satisfiability-event-pair-probes");
  }

  protected rebuild(
    values: readonly SatisfiabilityModuloTheoriesEventPairProbe[],
  ): SatisfiabilityModuloTheoriesEventPairProbes {
    return new SatisfiabilityModuloTheoriesEventPairProbes(values);
  }

  static parse(
    values: readonly SatisfiabilityModuloTheoriesEventPairProbe[],
  ): Result<SatisfiabilityModuloTheoriesEventPairProbes, ParseError> {
    return parseConstruction(() => new SatisfiabilityModuloTheoriesEventPairProbes(values));
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
