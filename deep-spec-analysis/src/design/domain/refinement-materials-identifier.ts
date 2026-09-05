// RefinementMaterialsIdentifier — Phase 3（refinement）随伴文脈集約の識別子。文脈は
// 設計形式モデルに 1:1 で錨着するため、恒等は「どの設計モデルの文脈か」。
// ofはモデル識別子を受け取り、この1:1の関係を型で表す。

import type { ArtifactPath } from "@deep-spec/kernel-domain";
import { DesignModelIdentifier } from "./design-model-identifier.ts";

export class RefinementMaterialsIdentifier {
  readonly #model: DesignModelIdentifier;

  private constructor(model: DesignModelIdentifier) {
    this.#model = model;
  }

  static of(model: DesignModelIdentifier): RefinementMaterialsIdentifier {
    return new RefinementMaterialsIdentifier(model);
  }

  equals(other: RefinementMaterialsIdentifier): boolean {
    return this.#model.equals(other.#model);
  }

  modelArtifactPath(): ArtifactPath {
    return this.#model.artifactPath();
  }
}
