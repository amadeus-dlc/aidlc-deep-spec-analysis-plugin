import { ArtifactPath } from "../../kernel/domain/index.ts";
import type { DesignRecordId } from "../domain/index.ts";
import type { CheckExecutionMode } from "./check-execution-mode.ts";

export interface CheckContractSummaryInput {
  readonly recordId: DesignRecordId;
  readonly reportDirectory: ArtifactPath;
  readonly mode: CheckExecutionMode;
}
