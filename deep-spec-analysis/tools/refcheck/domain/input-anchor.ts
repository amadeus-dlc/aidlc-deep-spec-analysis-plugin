import { ArtifactPath, type ContentHash } from "../../kernel/domain/index.ts";

// refcheck 入力の錨——記録相対の成果物名と読んだ時点の sha256。成果物名順
// （inputs[] の凍結順）と「同じ成果物か」「内容が変わったか」は錨自身の知識
// （#71 波19）。
export class InputAnchor {
  readonly #artifact: ArtifactPath;
  readonly #sha256: ContentHash;

  private constructor(props: { artifact: string; sha256: ContentHash }) {
    this.#artifact = ArtifactPath.reconstitute(props.artifact);
    this.#sha256 = props.sha256;
  }

  static reconstitute(props: { artifact: string; sha256: ContentHash }): InputAnchor {
    return new InputAnchor(props);
  }

  artifact(): string {
    return this.#artifact.asString();
  }

  sha256(): ContentHash {
    return this.#sha256;
  }

  compareByArtifact(other: InputAnchor): number {
    const a = this.#artifact.asString();
    const b = other.#artifact.asString();
    return a < b ? -1 : a > b ? 1 : 0;
  }
}
