import type { ParseError } from "@deep-spec/kernel-infrastructure";
import { IllegalArgumentException, parseConstruction, type Result } from "@deep-spec/kernel-infrastructure";
// ArtifactPath — 記録ワークスペース内の成果物・配置先を指すパスの語彙。
// 全コンテキストが「成果物パス（識別）」として話すため kernel が所有する。
// 通常の入力は境界（entry の flags）でparseし、再構成にはofを使う。
// 以後は VO のまま運ぶ。プリミティブへ戻すのは adapter の fs 境界（asString()）
// だけ。エラーは材料のみの閉じたユニオンで、文言は emitter 側の責務。

export class ArtifactPath {
  readonly #value: string;

  /** 成果物パスの処理予算。OS固有のバイト長上限とは別のUTF-16長制約。 単位はUTF-16コード単位。 */
  private constructor(raw: string) {
    if (raw.length > 4096) throw new IllegalArgumentException({ kind: "artifact-path-too-long", raw: raw.length });
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-path" });
    this.#value = raw;
  }

  static of(raw: string): ArtifactPath {
    return new ArtifactPath(raw);
  }

  static parse(raw: string): Result<ArtifactPath, ParseError> {
    return parseConstruction(() => new ArtifactPath(raw));
  }

  equals(other: ArtifactPath): boolean {
    return this.#value === other.#value;
  }

  // 境界: adapter が fs 操作（join / read / mkdir）に使う生の値。
  asString(): string {
    return this.#value;
  }
}
