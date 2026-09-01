import type { TraceStates } from "./trace-states.ts";

export type QuintTemporalVerdict =
  | { readonly kind: "timeout" }
  | { readonly kind: "violation"; readonly trace: TraceStates }
  | { readonly kind: "clean" };
