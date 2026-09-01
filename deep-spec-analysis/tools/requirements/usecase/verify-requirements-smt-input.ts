import type { ArtifactPath } from "../../kernel/domain/index.ts";
import type { FormalModelId } from "../domain/index.ts";

export interface VerifyRequirementsSmtInput {
  readonly modelId: FormalModelId;
  readonly verifyDirectory: ArtifactPath;
}
