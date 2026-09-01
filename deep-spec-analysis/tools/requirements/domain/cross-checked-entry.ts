import { BackendName, TargetIds } from "../../kernel/domain/index.ts";

export interface CrossCheckedEntry {
  readonly backend: BackendName;
  readonly targets: TargetIds;
}
