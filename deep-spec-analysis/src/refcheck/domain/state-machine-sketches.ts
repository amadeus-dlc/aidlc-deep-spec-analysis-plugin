import type {
  ArtifactPath,
  FirstClassCollection,
  IterableFirstClassCollection,
} from "@deep-spec-analysis/kernel-domain";
import type { DeclaredEntities } from "./declared-entities.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import type { StateMachineSketch } from "./state-machine-sketch.ts";

export class StateMachineSketches implements FirstClassCollection, IterableFirstClassCollection<StateMachineSketch> {
  readonly #values: readonly StateMachineSketch[];

  private constructor(values: readonly StateMachineSketch[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly StateMachineSketch[]): StateMachineSketches {
    return new StateMachineSketches(values);
  }

  add(value: StateMachineSketch): StateMachineSketches {
    return new StateMachineSketches([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<StateMachineSketch> {
    yield* this.#values;
  }

  isEmpty(): boolean {
    return this.#values.length === 0;
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
