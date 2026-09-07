import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { RequirementsModel } from "./requirements-model.ts";
import type { SatisfiabilityModuloTheoriesEventPairProbe } from "./satisfiability-modulo-theories-event-pair-probe.ts";
import type { SatisfiabilityModuloTheoriesQueryVerdicts } from "./satisfiability-modulo-theories-query-verdicts.ts";
import type { VerificationFindings } from "./verification-findings.ts";
import type { VerificationSkips } from "./verification-skips.ts";

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

  protected override rebuild(
    values: readonly SatisfiabilityModuloTheoriesEventPairProbe[],
  ): SatisfiabilityModuloTheoriesEventPairProbes {
    return new SatisfiabilityModuloTheoriesEventPairProbes(values);
  }

  override map(
    transform: (element: SatisfiabilityModuloTheoriesEventPairProbe) => SatisfiabilityModuloTheoriesEventPairProbe,
  ): SatisfiabilityModuloTheoriesEventPairProbes {
    return this.mapTo(transform, SatisfiabilityModuloTheoriesEventPairProbes.of);
  }

  override combine(other: SatisfiabilityModuloTheoriesEventPairProbes): SatisfiabilityModuloTheoriesEventPairProbes {
    return this.combineTo(other, SatisfiabilityModuloTheoriesEventPairProbes.of);
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

  override *[Symbol.iterator](): Iterator<SatisfiabilityModuloTheoriesEventPairProbe> {
    yield* this.#values;
  }

  // 各対の解釈を発行順に流す（呼び手が最初の失敗で打ち切れるよう、
  // 解釈は要求されたぶんだけ進める）。
  *interpretations(
    model: RequirementsModel,
    results: SatisfiabilityModuloTheoriesQueryVerdicts,
  ): IterableIterator<Result<{ findings: VerificationFindings; skipped: VerificationSkips }, ParseError>> {
    for (const probe of this.#values) yield probe.interpret(model, results);
  }

  toArray(): readonly SatisfiabilityModuloTheoriesEventPairProbe[] {
    return this.#values;
  }
}
