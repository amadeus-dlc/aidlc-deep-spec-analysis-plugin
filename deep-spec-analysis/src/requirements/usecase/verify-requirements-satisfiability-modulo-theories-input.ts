import type { ArtifactPath } from "@deep-spec/kernel-domain";
import type { FormalModelIdentifier } from "@deep-spec/requirements-domain";

export interface VerifyRequirementsSatisfiabilityModuloTheoriesInput {
  readonly modelId: FormalModelIdentifier;
  readonly verifyDirectory: ArtifactPath;
}
