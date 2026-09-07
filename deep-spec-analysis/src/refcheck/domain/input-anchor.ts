import { ArtifactPath, type ContentHash } from "@deep-spec-analysis/kernel-domain";
import {
  combinedHash,
  type Json,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";

// refcheck 入力の錨——記録相対の成果物名と読んだ時点の sha256。成果物名順
// （inputs[] の凍結順）と「同じ成果物か」「内容が変わったか」は錨自身の知識
// （#71 波19）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type InputAnchorParam = { artifact: string; sha256: ContentHash };

export class InputAnchor {
  readonly #artifact: ArtifactPath;
  readonly #sha256: ContentHash;

  private constructor(props: InputAnchorParam) {
    this.#artifact = ArtifactPath.of(props.artifact);
    this.#sha256 = props.sha256;
  }

  static parse(props: InputAnchorParam): Result<InputAnchor, ParseError> {
    return parseConstruction(() => new InputAnchor(props));
  }

  static of(props: InputAnchorParam): InputAnchor {
    return new InputAnchor(props);
  }

  artifact(): string {
    return this.#artifact.asString();
  }

  sha256(): ContentHash {
    return this.#sha256;
  }

  equals(other: InputAnchor): boolean {
    return this.#artifact.equals(other.#artifact) && this.#sha256.equals(other.#sha256);
  }

  hashCode(): number {
    return combinedHash([this.#artifact.hashCode(), this.#sha256.hashCode()]);
  }

  // 境界: 描画専用。inputs[] の 1 行——キー順 (artifact, sha256) は契約2 の凍結形。
  toDocument(): { [k: string]: Json } {
    return { artifact: this.#artifact.asString(), sha256: this.#sha256.asString() };
  }

  compareByArtifact(other: InputAnchor): number {
    const a = this.#artifact.asString();
    const b = other.#artifact.asString();
    return a < b ? -1 : a > b ? 1 : 0;
  }
}
