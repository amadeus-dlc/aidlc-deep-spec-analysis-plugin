export type RefinementStatus =
  | { kind: "checkable" }
  | { kind: "waived"; reason: string }
  | { kind: "gap"; detail: string }
  | { kind: "capability"; detail: string };
