export type InstallationProvenanceRead =
  | { readonly kind: "found"; readonly version: string; readonly ref: string; readonly source: string }
  | { readonly kind: "missing" }
  | { readonly kind: "malformed"; readonly reason: string };
