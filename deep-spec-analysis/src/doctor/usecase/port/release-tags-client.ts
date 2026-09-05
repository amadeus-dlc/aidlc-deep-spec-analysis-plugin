import type { ReleaseCatalog } from "@deep-spec/doctor-domain";
export interface ReleaseTagsClient {
  list(): Promise<ReleaseCatalog>;
}
