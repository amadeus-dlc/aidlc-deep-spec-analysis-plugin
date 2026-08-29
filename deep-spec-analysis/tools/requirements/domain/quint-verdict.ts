// Quint 実行 1 フェーズ分の型付き判定。CLI 出力・ITF という形式はアダプタが
// decode 済みで渡す。outputTail は CLI の生出力尾（材料）で、凍結 detail 文言に
// 逐語で載る。

import type { TraceState } from "./trace-state.ts";

export type QuintMachineRunVerdict =
  | { readonly kind: "timeout" }
  | { readonly kind: "deadlock"; readonly trace: TraceState[] | null }
  | { readonly kind: "violation"; readonly trace: TraceState[] }
  | { readonly kind: "run-failed"; readonly outputTail: string }
  | { readonly kind: "clean" };

export type QuintTemporalVerdict =
  | { readonly kind: "timeout" }
  | { readonly kind: "violation"; readonly trace: TraceState[] }
  | { readonly kind: "clean" };

export type QuintScenarioVerdict =
  | { readonly kind: "timeout" }
  | { readonly kind: "run-failed"; readonly outputTail: string }
  | { readonly kind: "evaluated"; readonly violated: boolean };

export interface QuintRuns {
  readonly machine: QuintMachineRunVerdict | null;
  readonly temporals: ReadonlyMap<string, QuintTemporalVerdict>;
  readonly scenarios: ReadonlyMap<string, QuintScenarioVerdict>;
}
