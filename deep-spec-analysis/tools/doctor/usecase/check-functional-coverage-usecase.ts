import { CoverageState } from "../domain/index.ts";
import { RefinementStaleRow } from "./read-model/refinement-stale-row.ts";
import { UnitCoverage } from "./read-model/unit-coverage.ts";
import { UnitCoverageRow } from "./read-model/unit-coverage-row.ts";
import type { DoctorWorkspaceClient } from "./port/doctor-workspace-client.ts";

// 設計検証カバレッジの査定（checks 配列の第 5 ブロック、unit 粒度）＋
// refinement 失効（phase 3）。unit はモデルの units[] に載り、実 backend 文書の
// checked[] に現れて初めて verified——「きれいな unit」と「backend が到達しな
// かった unit」は別物（PR #7 レビュー追補）。refinement 失効は要件モデルが
// 設計検証より新しい intent（走査順——unit 行より先に並ぶ凍結順）。
export class CheckFunctionalCoverageUseCase {
  readonly #workspace: DoctorWorkspaceClient;

  constructor(workspace: DoctorWorkspaceClient) {
    this.#workspace = workspace;
  }

  execute(): UnitCoverage {
    const scopes = this.#workspace.functionalScopes();
    const problems: UnitCoverageRow[] = [];
    const refinementStale: RefinementStaleRow[] = [];
    let eligible = 0;
    for (const t of this.#workspace.functionalTargets(scopes)) {
      const modelUnits = new Set(t.modelUnits);
      const completed = new Set(t.completedUnits);
      for (const unit of t.units) {
        eligible += 1;
        if (!modelUnits.has(unit.name) || !t.hasFindings || !completed.has(unit.name)) {
          problems.push(UnitCoverageRow.reconstitute({ space: t.space, intent: t.intent, unit: unit.name, state: CoverageState.unverified() }));
          continue;
        }
        if (unit.newestArtifactMtime > t.modelMtime) {
          problems.push(UnitCoverageRow.reconstitute({ space: t.space, intent: t.intent, unit: unit.name, state: CoverageState.stale() }));
        }
      }
      if (t.modelMtime > 0 && t.hasFindings && t.requirementsModelMtime !== null && t.requirementsModelMtime > t.modelMtime) {
        refinementStale.push(RefinementStaleRow.reconstitute({ space: t.space, intent: t.intent }));
      }
    }
    return UnitCoverage.of({ eligible, problems, refinementStale, scopes });
  }
}
