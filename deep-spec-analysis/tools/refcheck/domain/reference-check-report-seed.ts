import { TargetIds } from "../../kernel/domain/index.ts";
import { Findings } from "./findings.ts";
import { Skips } from "./skips.ts";
import { InputAnchors } from "./input-anchors.ts";
import { ReferenceCheckReportId } from "./reference-check-report-id.ts";

export interface ReferenceCheckReportSeed {
  readonly id: ReferenceCheckReportId;
  readonly inputs: InputAnchors;
  readonly checked: TargetIds;
  readonly findings: Findings;
  readonly skipped: Skips;
}
