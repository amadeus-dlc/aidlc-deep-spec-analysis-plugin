import type { StructuralDebt } from "@deep-spec-analysis/doctor-domain";
import { err, matchResult, ok, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec-analysis/kernel-usecase";
import type { DoctorWorkspaceClient } from "./port/doctor-workspace-client.ts";
import type { ReferenceCheckBackendClient } from "./port/reference-check-backend-client.ts";

export class CheckStructuralDebtUseCase {
  readonly #workspace: DoctorWorkspaceClient;
  readonly #backend: ReferenceCheckBackendClient;
  constructor(workspace: DoctorWorkspaceClient, backend: ReferenceCheckBackendClient) {
    this.#workspace = workspace;
    this.#backend = backend;
  }
  execute(): Result<StructuralDebt, RepositoryError> {
    return matchResult(this.#workspace.designArtifacts(), {
      err: (error): Result<StructuralDebt, RepositoryError> => err(error),
      ok: (artifacts) => ok(artifacts.observedBy((artifact) => this.#backend.observe(artifact))),
    });
  }
}
