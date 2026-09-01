import type { TraceStates } from "./trace-states.ts";

export type QuintMachineRunVerdict =
  | { readonly kind: "timeout" }
  | { readonly kind: "deadlock"; readonly trace: TraceStates | null }
  | { readonly kind: "violation"; readonly trace: TraceStates }
  | { readonly kind: "run-failed"; readonly outputTail: string }
  | { readonly kind: "clean" };
