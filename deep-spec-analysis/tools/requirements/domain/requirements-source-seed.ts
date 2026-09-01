import type { ArtifactPath, RequirementIds } from "../../kernel/domain/index.ts";
import type { RequirementsSourceId } from "./requirements-source-id.ts";

export interface RequirementsSourceSeed {
  readonly id: RequirementsSourceId;
  readonly sourcePath: ArtifactPath;
  readonly knownIds: RequirementIds;
  readonly digest: string;
  readonly sourceDocument: Uint8Array;
}
