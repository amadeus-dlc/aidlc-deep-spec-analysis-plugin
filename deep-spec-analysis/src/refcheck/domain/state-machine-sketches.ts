import {
  type ArtifactPath,
  type FirstClassCollection,
  FirstClassCollectionBase,
} from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DeclaredEntities } from "./declared-entities.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import type { StateMachineSketch } from "./state-machine-sketch.ts";

export class StateMachineSketches
  extends FirstClassCollectionBase<StateMachineSketch, StateMachineSketches>
  implements FirstClassCollection<StateMachineSketch>
{
  readonly #values: readonly StateMachineSketch[];

  private constructor(values: readonly StateMachineSketch[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-state-machine-sketches");
  }

  protected override rebuild(values: readonly StateMachineSketch[]): StateMachineSketches {
    return new StateMachineSketches(values);
  }

  static parse(values: readonly StateMachineSketch[]): Result<StateMachineSketches, ParseError> {
    return parseConstruction(() => new StateMachineSketches(values));
  }

  static of(values: readonly StateMachineSketch[]): StateMachineSketches {
    return new StateMachineSketches(values);
  }

  add(value: StateMachineSketch): StateMachineSketches {
    return new StateMachineSketches([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<StateMachineSketch> {
    yield* this.#values;
  }

  toArray(): readonly StateMachineSketch[] {
    return this.#values;
  }

  // 各図の整合と、ライフサイクル対象全体の被覆を確認する。
  check(
    report: ReferenceCheckReport,
    specArtifact: ArtifactPath,
    entitiesArtifact: ArtifactPath,
    entities: DeclaredEntities,
  ): void {
    for (const entity of entities.entities().lifecycleOnly())
      if (!this.#values.some((machine) => machine.coversLifecycleOf(entity))) entity.reportMissingLifecycleIn(report);
    for (const m of this) {
      m.check(report, specArtifact, entitiesArtifact, entities);
    }
  }
}
