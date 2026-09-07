import {
  type FirstClassCollection,
  FirstClassCollectionBase,
  type KeyedIndex,
  type KeySet,
  type QueryLabel,
  type TargetIdentifier,
} from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  ok,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { QuintMachineComponents } from "./quint-machine-components.ts";
import type { QuintRuns } from "./quint-runs.ts";
import type { RequirementsModel } from "./requirements-model.ts";
import { SatisfiabilityModuloTheoriesProbe } from "./satisfiability-modulo-theories-probe.ts";
import type { SatisfiabilityModuloTheoriesQueryVerdicts } from "./satisfiability-modulo-theories-query-verdicts.ts";
import type { Scenario } from "./scenario.ts";
import type { ScenarioIdentifier } from "./scenario-identifier.ts";
import { VerificationFindings } from "./verification-findings.ts";
import { VerificationSkips } from "./verification-skips.ts";

// シナリオのファーストクラスコレクション。id 検索と id 列の導出を所有する。
export class Scenarios extends FirstClassCollectionBase<Scenario, Scenarios> implements FirstClassCollection<Scenario> {
  readonly #values: readonly Scenario[];

  private constructor(values: readonly Scenario[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-scenarios");
  }

  protected override rebuild(values: readonly Scenario[]): Scenarios {
    return new Scenarios(values);
  }

  override map(transform: (element: Scenario) => Scenario): Scenarios {
    return this.mapTo(transform, Scenarios.of);
  }

  override combine(other: Scenarios): Scenarios {
    return this.combineTo(other, Scenarios.of);
  }

  static parse(values: readonly Scenario[]): Result<Scenarios, ParseError> {
    return parseConstruction(() => new Scenarios(values));
  }

  static of(values: readonly Scenario[]): Scenarios {
    return new Scenarios(values);
  }

  add(value: Scenario): Scenarios {
    return new Scenarios([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<Scenario> {
    yield* this.#values;
  }

  // 各シナリオを宣言順に quint 判定へかける。最初の失敗で打ち切る。
  interpretQuint(
    model: RequirementsModel,
    runs: QuintRuns,
    scenariosWithInit: KeySet<ScenarioIdentifier>,
    components: QuintMachineComponents,
  ): Result<{ findings: VerificationFindings; skipped: VerificationSkips }, ParseError> {
    let findings = VerificationFindings.of([]);
    let skipped = VerificationSkips.of([]);
    for (const scenario of this.#values) {
      const interpreted = scenario.interpretQuint(
        model,
        runs.scenarioOf(scenario.id()),
        scenariosWithInit.has(scenario.id()),
        components,
      );
      if (!interpreted.ok) return interpreted;
      findings = findings.combine(interpreted.value.findings);
      skipped = skipped.combine(interpreted.value.skipped);
    }
    return ok({ findings, skipped });
  }

  // SMT のシナリオ問いを宣言順に解釈へ流す（問いを持たないシナリオは飛ばす）。
  // 呼び手が最初の失敗で打ち切れるよう、解釈は要求されたぶんだけ進める。
  *interpretSatisfiability(
    model: RequirementsModel,
    results: SatisfiabilityModuloTheoriesQueryVerdicts,
    queries: KeyedIndex<ScenarioIdentifier, QueryLabel>,
    labelToTarget: KeyedIndex<QueryLabel, TargetIdentifier>,
  ): IterableIterator<Result<{ findings: VerificationFindings; skipped: VerificationSkips }, ParseError>> {
    for (const scenario of this.#values) {
      const query = queries.get(scenario.id());
      if (query !== undefined)
        yield SatisfiabilityModuloTheoriesProbe.scenario(query, scenario, labelToTarget).interpret(model, results);
    }
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
