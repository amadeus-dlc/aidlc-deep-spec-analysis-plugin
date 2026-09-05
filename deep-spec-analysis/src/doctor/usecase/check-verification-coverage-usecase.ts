import type { CoverageAssessment } from "@deep-spec/doctor-domain";
import type { DoctorWorkspaceClient } from "./port/doctor-workspace-client.ts";

export class CheckVerificationCoverageUseCase {
  readonly #workspace: DoctorWorkspaceClient;
  constructor(workspace: DoctorWorkspaceClient) {
    this.#workspace = workspace;
  }
  execute(): CoverageAssessment {
    return this.#workspace.verificationCoverage();
  }
}
