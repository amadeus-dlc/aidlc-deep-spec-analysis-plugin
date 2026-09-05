import type { ArtifactPath } from "@deep-spec/kernel-domain";
import type { DesignModelIdentifier } from "@deep-spec/design-domain";

export interface VerifyDesignInput {
  readonly modelId: DesignModelIdentifier;
  readonly verifyDirectory: ArtifactPath;
}
