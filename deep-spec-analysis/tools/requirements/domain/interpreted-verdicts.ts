import { VerificationFindings } from "./verification-findings.ts";
import { VerificationSkips } from "./verification-skips.ts";

export interface InterpretedVerdicts {
  findings: VerificationFindings;
  skipped: VerificationSkips;
}
