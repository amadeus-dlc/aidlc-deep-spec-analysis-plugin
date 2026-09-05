import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec/kernel-infrastructure";

// ファイルシステムが観測した更新時刻（UNIX epochからのミリ秒）。
export class ArtifactModifiedAt {
  readonly #value: number;
  private constructor(milliseconds: number) {
    if (!Number.isFinite(milliseconds) || Math.abs(milliseconds) > Number.MAX_SAFE_INTEGER)
      throw new IllegalArgumentException({ kind: "invalid-artifact-modified-at", raw: milliseconds });
    this.#value = milliseconds;
  }
  static of(milliseconds: number): ArtifactModifiedAt {
    return new ArtifactModifiedAt(milliseconds);
  }
  static parse(milliseconds: number): Result<ArtifactModifiedAt, ParseError> {
    return parseConstruction(() => new ArtifactModifiedAt(milliseconds));
  }
  isAfter(other: ArtifactModifiedAt): boolean {
    return this.#value > other.#value;
  }
}
