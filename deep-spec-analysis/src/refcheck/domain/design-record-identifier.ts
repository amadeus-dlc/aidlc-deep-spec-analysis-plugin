// DesignRecordIdentifier — refcheck が検査する DesignRecord 集約の識別子。恒等は
// 発火対象の成果物パス。指した先が検査対象の集約として成立するかは
// Repository の解決の結果（not-found が not-applicable の期待分岐）。

import type { ArtifactPath } from "@deep-spec/kernel-domain";

export class DesignRecordIdentifier {
  readonly #path: ArtifactPath;

  private constructor(path: ArtifactPath) {
    this.#path = path;
  }

  static of(path: ArtifactPath): DesignRecordIdentifier {
    return new DesignRecordIdentifier(path);
  }

  equals(other: DesignRecordIdentifier): boolean {
    return this.#path.equals(other.#path);
  }

  artifactPath(): ArtifactPath {
    return this.#path;
  }
}
