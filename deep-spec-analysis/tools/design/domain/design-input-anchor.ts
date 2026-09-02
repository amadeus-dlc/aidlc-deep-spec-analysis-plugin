import type { ContentHash } from "../../kernel/domain/index.ts";

// 設計検証入力の錨——記録相対の成果物名と読んだ時点の sha256。成果物名順
// （inputs[] の凍結順）と「同じ成果物か」「内容が変わったか」は錨自身の知識
// （#71 波19）。
export class DesignInputAnchor {
  readonly #artifact: string;
  readonly #sha256: ContentHash;

  private constructor(props: { artifact: string; sha256: ContentHash }) {
    this.#artifact = props.artifact;
    this.#sha256 = props.sha256;
  }

  static reconstitute(props: { artifact: string; sha256: ContentHash }): DesignInputAnchor {
    return new DesignInputAnchor(props);
  }

  artifact(): string {
    return this.#artifact;
  }

  sha256(): ContentHash {
    return this.#sha256;
  }

  compareByArtifact(other: DesignInputAnchor): number {
    return this.#artifact < other.#artifact ? -1 : this.#artifact > other.#artifact ? 1 : 0;
  }
}
