import { ContentHash, IrVersion } from "../../kernel/domain/index.ts";
import { CrossCheckedEntries } from "./cross-checked-entries.ts";
import { VerificationFindings } from "./verification-findings.ts";
import { VerificationSkips } from "./verification-skips.ts";
import type { VerificationReportId } from "./verification-report-id.ts";

export interface VerificationReportSeed {
  readonly id: VerificationReportId;
  readonly irVersion: IrVersion;
  readonly irHash: ContentHash;
  readonly method: string;
  readonly findings: VerificationFindings;
  readonly skipped: VerificationSkips;
  readonly crossChecked: CrossCheckedEntries | null;
  readonly unavailableReason: string | null;
}
