import type { DesignModelIdentifier } from "@deep-spec/design-domain";
import type { ArtifactPath } from "@deep-spec/kernel-domain";

export interface VerifyDesignInput {
  readonly modelId: DesignModelIdentifier;
  readonly verifyDirectory: ArtifactPath;
}
