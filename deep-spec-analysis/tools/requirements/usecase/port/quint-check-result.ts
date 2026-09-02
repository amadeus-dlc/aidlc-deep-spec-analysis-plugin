import type { QuintMachinePlan, QuintRuns, VerificationSkips } from "../../domain/index.ts";

export type QuintCheckResult =
  | { readonly kind: "cli-unavailable" }
  | { readonly kind: "machine-uncompilable"; readonly method: string; readonly error: string }
  | {
      readonly kind: "checked";
      readonly method: string;
      readonly plan: QuintMachinePlan;
      readonly compileSkips: VerificationSkips;
      readonly runs: QuintRuns;
    };
