import type { ArtifactPath } from "@deep-spec/kernel-domain";

// ワークスペース内のintentの所在。表示ラベルはadapterが投影する。
export class IntentLocation {
  readonly #space: ArtifactPath;
  readonly #intent: ArtifactPath;
  private constructor(space: ArtifactPath, intent: ArtifactPath) {
    this.#space = space;
    this.#intent = intent;
  }
  static of(space: ArtifactPath, intent: ArtifactPath): IntentLocation {
    return new IntentLocation(space, intent);
  }
  space(): ArtifactPath {
    return this.#space;
  }
  intent(): ArtifactPath {
    return this.#intent;
  }
}
