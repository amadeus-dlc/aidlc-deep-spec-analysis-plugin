import { StateMachineSketch } from "./state-machine-sketch.ts";
import type { ArtifactPath } from "@deep-spec/kernel-domain";
import type { DeclaredEntities } from "./declared-entities.ts";
import { FD_S1, FD_S2 } from "./functional-check-families.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";

export class StateMachineSketches {
  readonly #values: readonly StateMachineSketch[];

  private constructor(values: readonly StateMachineSketch[]) {
    this.#values = values;
  }

  static of(values: readonly StateMachineSketch[]): StateMachineSketches {
    return new StateMachineSketches([...values]);
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


  // FD-S1／S2（種別規律の裁定 13）: 機械が一つも無ければライフサイクル実体
  // ごとに skip、あれば各機械に entities.md との整合を判定させる（発生順は
  // 機械の出現順、凍結）。
  check(report: ReferenceCheckReport, specArtifact: ArtifactPath, entitiesArtifact: ArtifactPath, entities: DeclaredEntities): void {
    if (this.isEmpty()) {
      for (const e of entities.entities().lifecycleOnly()) {
        report.skip(FD_S1, "unrecognized-format",
          `no \`### State Machine: ${e.name().asString()}\` heading with a stateDiagram fence found for lifecycle entity "${e.name().asString()}"`);
        report.skip(FD_S2, "unrecognized-format",
          `no \`### State Machine: ${e.name().asString()}\` heading with a stateDiagram fence found for lifecycle entity "${e.name().asString()}"`);
      }
    }
    for (const m of this) {
      m.check(report, specArtifact, entitiesArtifact, entities);
    }
  }
}
