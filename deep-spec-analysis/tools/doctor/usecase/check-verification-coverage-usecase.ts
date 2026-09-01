import { CoverageAssessment, VerificationStaleness } from "../domain/index.ts";
import type { CoverageRow } from "../domain/index.ts";
import type { DoctorWorkspaceClient } from "./port/doctor-workspace-client.ts";

// 要件検証カバレッジの査定（checks 配列の第 3 ブロック）。適格＝スコープ
// 一致かつ requirements.md 実在（ゲートウェイが母数を絞る）。モデルか
// findings が無ければ unverified、あれば鮮度判断（domain）で stale。
export class CheckVerificationCoverageUseCase {
  readonly #workspace: DoctorWorkspaceClient;

  constructor(workspace: DoctorWorkspaceClient) {
    this.#workspace = workspace;
  }

  execute(): CoverageAssessment {
    const scopes = this.#workspace.verificationScopes();
    const problems: CoverageRow[] = [];
    const targets = this.#workspace.verificationTargets(scopes);
    for (const t of targets) {
      if (!t.hasModel || !t.hasFindings) {
        problems.push({ space: t.space, intent: t.intent, state: "unverified" });
        continue;
      }
      const stale = VerificationStaleness.of({ anchor: t.anchor, sourceNewerThanModel: t.sourceNewerThanModel }).isStale();
      if (stale) problems.push({ space: t.space, intent: t.intent, state: "stale" });
    }
    return CoverageAssessment.of({ eligible: targets.length, problems, scopes });
  }
}
