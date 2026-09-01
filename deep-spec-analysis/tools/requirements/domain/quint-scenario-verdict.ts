export type QuintScenarioVerdict =
  | { readonly kind: "timeout" }
  | { readonly kind: "run-failed"; readonly outputTail: string }
  | { readonly kind: "evaluated"; readonly violated: boolean };
