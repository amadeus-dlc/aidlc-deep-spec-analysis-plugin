import { BackendName, TargetIds } from "../../kernel/domain/index.ts";

export interface DesignCrossCheckedEntry {
  readonly backend: BackendName;
  readonly targets: TargetIds;
}
