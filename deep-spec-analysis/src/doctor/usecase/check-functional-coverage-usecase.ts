import type { UnitCoverage } from "@deep-spec/doctor-domain";
import type { DoctorWorkspaceClient } from "./port/doctor-workspace-client.ts";

export class CheckFunctionalCoverageUseCase {
  readonly #workspace: DoctorWorkspaceClient;
  constructor(workspace: DoctorWorkspaceClient) {
    this.#workspace = workspace;
  }
  execute(): UnitCoverage {
    return this.#workspace.functionalCoverage();
  }
}
