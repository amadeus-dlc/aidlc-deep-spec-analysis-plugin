// RefinementMapIdentifier — RefinementMap 集約（契約4 の refinement map 文書）の
// 識別子。map は 1 記録に 1 つで、恒等はその成果物パス。

import type { ArtifactPath } from "@deep-spec/kernel-domain";

export class RefinementMapIdentifier {
  readonly #path: ArtifactPath;

  private constructor(path: ArtifactPath) {
    this.#path = path;
  }

  static of(path: ArtifactPath): RefinementMapIdentifier {
    return new RefinementMapIdentifier(path);
  }

  equals(other: RefinementMapIdentifier): boolean {
    return this.#path.equals(other.#path);
  }

  artifactPath(): ArtifactPath {
    return this.#path;
  }
}
