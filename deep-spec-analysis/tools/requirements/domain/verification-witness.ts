import type { TraceState } from "./trace-state.ts";

export type VerificationWitness =
  | { readonly core: string[] }
  | { readonly model: { [path: string]: boolean | number | string } }
  | { readonly verdicts: { [backend: string]: "violated" | "clean" } }
  | { readonly trace: TraceState[] };
