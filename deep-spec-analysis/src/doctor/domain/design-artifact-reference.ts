import type { ArtifactPath } from "@deep-spec/kernel-domain";
import type { IntentLocation } from "./intent-location.ts";

type DesignArtifactReferenceParam = {
  location: IntentLocation;
  tool: ArtifactPath;
  artifactPath: ArtifactPath;
  relativePath: ArtifactPath;
};

// 検査対象成果物と担当センサーの対応。OSパスへの変換はbackend adapterが行う。
export class DesignArtifactReference {
  readonly #location: IntentLocation;
  readonly #tool: ArtifactPath;
  readonly #artifactPath: ArtifactPath;
  readonly #relativePath: ArtifactPath;
  private constructor(props: DesignArtifactReferenceParam) {
    this.#location = props.location;
    this.#tool = props.tool;
    this.#artifactPath = props.artifactPath;
    this.#relativePath = props.relativePath;
  }
  static of(props: DesignArtifactReferenceParam): DesignArtifactReference {
    return new DesignArtifactReference(props);
  }
  location(): IntentLocation {
    return this.#location;
  }
  tool(): ArtifactPath {
    return this.#tool;
  }
  artifactPath(): ArtifactPath {
    return this.#artifactPath;
  }
  relativePath(): ArtifactPath {
    return this.#relativePath;
  }
}
