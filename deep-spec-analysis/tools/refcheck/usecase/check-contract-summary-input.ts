import { ArtifactPath } from "../../kernel/domain/index.ts";
import type { CheckExecutionMode, DesignRecordId } from "../domain/index.ts";

export interface CheckContractSummaryInput {
  readonly recordId: DesignRecordId;
  readonly reportDirectory: ArtifactPath;
  readonly mode: CheckExecutionMode;
}
