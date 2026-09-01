import { SiblingVerdictFindings } from "./sibling-verdict-findings.ts";
import { SiblingVerdictSkips } from "./sibling-verdict-skips.ts";
export type SiblingVerdictDocument =
  | { kind: "unreadable" }
  | { kind: "unavailable"; reason: string; method: string | null }
  | { kind: "readable"; method: string | null; findings: SiblingVerdictFindings; skipped: SiblingVerdictSkips };
