// DesignRecordId — refcheck が検査する DesignRecord 集約の識別子。恒等は
// 発火対象の成果物パス。指した先が検査対象の集約として成立するかは
// Repository の解決の結果（not-found が not-applicable の期待分岐）。

import type { ArtifactPath } from "../../kernel/domain/index.ts";

export class DesignRecordId {
  readonly #path: ArtifactPath;

  private constructor(path: ArtifactPath) {
    this.#path = path;
  }

  static of(path: ArtifactPath): DesignRecordId {
    return new DesignRecordId(path);
  }

  equals(other: DesignRecordId): boolean {
    return this.#path.equals(other.#path);
  }

  artifactPath(): ArtifactPath {
    return this.#path;
  }
}
