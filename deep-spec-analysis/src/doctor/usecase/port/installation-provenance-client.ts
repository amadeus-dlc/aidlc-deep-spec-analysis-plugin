import type { InstallationProvenance } from "@deep-spec/doctor-domain";
export interface InstallationProvenanceClient {
  read(): InstallationProvenance;
}
