import { ArtifactPath } from "@deep-spec/kernel-domain";
import type { DesignRecordId } from "@deep-spec/refcheck-domain";
import type { CheckExecutionMode } from "./check-execution-mode.ts";

export interface CheckDomainComponentsInput {
  readonly recordId: DesignRecordId;
  readonly reportDirectory: ArtifactPath;
  readonly mode: CheckExecutionMode;
}
