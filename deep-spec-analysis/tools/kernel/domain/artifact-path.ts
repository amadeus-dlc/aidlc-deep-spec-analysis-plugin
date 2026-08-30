// ArtifactPath — 記録ワークスペース内の成果物・配置先を指すパスの語彙。
// 全コンテキストが「成果物パス（識別）」として話すため kernel が所有する。
// parse が唯一の構築口（DP 規律）：境界（entry の flags）で一度だけ parse し、
// 以後は VO のまま運ぶ。プリミティブへ戻すのは adapter の fs 境界（value()）
// だけ。エラーは材料のみの閉じたユニオンで、文言は emitter 側の責務。

import { type Result, err, ok } from "../infrastructure/index.ts";

export type ArtifactPathError = { readonly kind: "empty-path" };

export class ArtifactPath {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<ArtifactPath, ArtifactPathError> {
    if (raw === "") return err({ kind: "empty-path" });
    return ok(new ArtifactPath(raw));
  }

  equals(other: ArtifactPath): boolean {
    return this.#value === other.#value;
  }

  // 境界: adapter が fs 操作（join / read / mkdir）に使う生の値。
  value(): string {
    return this.#value;
  }
}
