import { StructuralDebt, type StructuralObservation } from "@deep-spec/doctor-domain";
import type { DoctorWorkspaceClient } from "./port/doctor-workspace-client.ts";
import type { ReferenceCheckBackendClient } from "./port/reference-check-backend-client.ts";

export class CheckStructuralDebtUseCase {
  readonly #workspace: DoctorWorkspaceClient;
  readonly #backend: ReferenceCheckBackendClient;
  constructor(workspace: DoctorWorkspaceClient, backend: ReferenceCheckBackendClient) {
    this.#workspace = workspace;
    this.#backend = backend;
  }
  execute(): StructuralDebt {
    const observations: StructuralObservation[] = [];
    for (const artifact of this.#workspace.designArtifacts()) observations.push(this.#backend.observe(artifact));
    return StructuralDebt.of(observations);
  }
}
