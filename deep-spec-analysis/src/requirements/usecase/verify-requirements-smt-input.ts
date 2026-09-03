import type { ArtifactPath } from "@deep-spec/kernel-domain";
import type { FormalModelId } from "@deep-spec/requirements-domain";

export interface VerifyRequirementsSmtInput {
  readonly modelId: FormalModelId;
  readonly verifyDirectory: ArtifactPath;
}
