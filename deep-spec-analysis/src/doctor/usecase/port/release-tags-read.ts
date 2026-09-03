export type ReleaseTagsRead =
  | { readonly kind: "available"; readonly tags: readonly string[] }
  | { readonly kind: "unavailable"; readonly reason: string };
