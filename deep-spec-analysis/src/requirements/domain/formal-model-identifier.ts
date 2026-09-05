// FormalModelIdentifier — 形式モデル（契約1 IR 成果物）集約の識別子。恒等は成果物
// パス。センサーの発火対象がこの集約でない可能性（basename 不一致・不在）は
// Repository が not-found / not-applicable で答える——ID は指すだけで、指した
// 先に集約が実在するかは解決の結果である。

import type { ArtifactPath } from "@deep-spec/kernel-domain";

export class FormalModelIdentifier {
  readonly #path: ArtifactPath;

  private constructor(path: ArtifactPath) {
    this.#path = path;
  }

  static of(path: ArtifactPath): FormalModelIdentifier {
    return new FormalModelIdentifier(path);
  }

  equals(other: FormalModelIdentifier): boolean {
    return this.#path.equals(other.#path);
  }

  artifactPath(): ArtifactPath {
    return this.#path;
  }
}
