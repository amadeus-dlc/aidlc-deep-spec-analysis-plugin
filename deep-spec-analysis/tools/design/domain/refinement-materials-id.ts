// RefinementMaterialsId — Phase 3（refinement）随伴文脈集約の識別子。文脈は
// 設計形式モデルに 1:1 で錨着するため、恒等は「どの設計モデルの文脈か」。
// ofModel が唯一の構築口で、この 1:1 錨着を型で表す。

import type { ArtifactPath } from "../../kernel/domain/index.ts";
import { DesignModelId } from "./design-model-id.ts";

export class RefinementMaterialsId {
  readonly #model: DesignModelId;

  private constructor(model: DesignModelId) {
    this.#model = model;
  }

  static ofModel(model: DesignModelId): RefinementMaterialsId {
    return new RefinementMaterialsId(model);
  }

  equals(other: RefinementMaterialsId): boolean {
    return this.#model.equals(other.#model);
  }

  modelArtifactPath(): ArtifactPath {
    return this.#model.artifactPath();
  }
}
