// v1 検証 finding / skip の語彙（契約2）。witness は型付きユニオン——
// unsat core のラベル列・decode 済み状態モデル・クロスチェック判定表・
// 状態機械のステップトレース。

import type { TraceState } from "./trace-state.ts";

export type VerificationWitness =
  | { readonly core: string[] }
  | { readonly model: { [path: string]: boolean | number | string } }
  | { readonly verdicts: { [backend: string]: "violated" | "clean" } }
  | { readonly trace: TraceState[] };

export interface VerificationFinding {
  kind: string;
  frRefs: string[];
  targets: string[];
  witness: VerificationWitness;
  detail: string;
}

export interface VerificationSkipped {
  target: string;
  reason: string;
  detail?: string;
}
