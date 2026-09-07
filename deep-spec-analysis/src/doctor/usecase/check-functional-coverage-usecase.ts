import type { UnitCoverage } from "@deep-spec-analysis/doctor-domain";
import type { Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec-analysis/kernel-usecase";
import type { DoctorWorkspaceClient } from "./port/doctor-workspace-client.ts";

export class CheckFunctionalCoverageUseCase {
  readonly #workspace: DoctorWorkspaceClient;
  constructor(workspace: DoctorWorkspaceClient) {
    this.#workspace = workspace;
  }
  execute(): Result<UnitCoverage, RepositoryError> {
    return this.#workspace.functionalCoverage();
  }
}
