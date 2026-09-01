import type { ArtifactPath } from "../../kernel/domain/index.ts";
import type { DesignModelId } from "../domain/index.ts";

export interface VerifyDesignInput {
  readonly modelId: DesignModelId;
  readonly verifyDirectory: ArtifactPath;
}
