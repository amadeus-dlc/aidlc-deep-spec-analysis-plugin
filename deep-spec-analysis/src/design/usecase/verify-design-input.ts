import type { ArtifactPath } from "@deep-spec/kernel-domain";
import type { DesignModelId } from "@deep-spec/design-domain";

export interface VerifyDesignInput {
  readonly modelId: DesignModelId;
  readonly verifyDirectory: ArtifactPath;
}
