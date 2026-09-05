import type { DesignArtifactReference, StructuralObservation } from "@deep-spec/doctor-domain";

// 故障隔離・timeoutを含む外部実行。未計測と0件を区別した観測を返す。
export interface ReferenceCheckBackendClient {
  observe(artifact: DesignArtifactReference): StructuralObservation;
}
