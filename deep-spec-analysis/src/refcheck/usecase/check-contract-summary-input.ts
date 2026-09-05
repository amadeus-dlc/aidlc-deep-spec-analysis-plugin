import { ArtifactPath } from "@deep-spec/kernel-domain";
import type { DesignRecordIdentifier } from "@deep-spec/refcheck-domain";
import type { CheckExecutionMode } from "./check-execution-mode.ts";

export interface CheckContractSummaryInput {
  readonly recordId: DesignRecordIdentifier;
  readonly reportDirectory: ArtifactPath;
  readonly mode: CheckExecutionMode;
}
