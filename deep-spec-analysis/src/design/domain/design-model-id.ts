// DesignModelId — 設計形式モデル（契約3 IR 成果物）集約の識別子。恒等は
// 成果物パス。指した先に集約が実在するかは Repository の解決の結果。

import type { ArtifactPath } from "@deep-spec/kernel-domain";

export class DesignModelId {
  readonly #path: ArtifactPath;

  private constructor(path: ArtifactPath) {
    this.#path = path;
  }

  static of(path: ArtifactPath): DesignModelId {
    return new DesignModelId(path);
  }

  equals(other: DesignModelId): boolean {
    return this.#path.equals(other.#path);
  }

  artifactPath(): ArtifactPath {
    return this.#path;
  }
}
