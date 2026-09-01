import { VerificationFindings } from "./verification-findings.ts";
import { VerificationSkips } from "./verification-skips.ts";

export interface InterpretedQuintVerdicts {
  findings: VerificationFindings;
  skipped: VerificationSkips;
}
