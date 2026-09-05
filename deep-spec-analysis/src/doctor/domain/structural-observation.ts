import type { DesignArtifactReference } from "./design-artifact-reference.ts";
import type { FindingCount } from "./finding-count.ts";

// 未計測は0件と区別し、走査済み母数に入れない。
export class StructuralObservation {
  readonly #artifact: DesignArtifactReference;
  readonly #findings: FindingCount | null;
  private constructor(artifact: DesignArtifactReference, findings: FindingCount | null) {
    this.#artifact = artifact;
    this.#findings = findings;
  }
  static of(artifact: DesignArtifactReference, findings: FindingCount | null): StructuralObservation {
    return new StructuralObservation(artifact, findings);
  }
  wasScanned(): boolean {
    return this.#findings !== null;
  }
  hasDebt(): boolean {
    return this.#findings !== null && !this.#findings.isEmpty();
  }
  findingCount(): number {
    return this.#findings?.asNumber() ?? 0;
  }
  artifact(): DesignArtifactReference {
    return this.#artifact;
  }
}
