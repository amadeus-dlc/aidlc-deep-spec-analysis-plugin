import type { DesignModelId } from "./design-model-id.ts";

export class DesignIrValidationMaterialsId {
  readonly #model: DesignModelId;

  private constructor(model: DesignModelId) {
    this.#model = model;
  }

  static ofModel(model: DesignModelId): DesignIrValidationMaterialsId {
    return new DesignIrValidationMaterialsId(model);
  }

  equals(other: DesignIrValidationMaterialsId): boolean {
    return this.#model.equals(other.#model);
  }

  modelId(): DesignModelId {
    return this.#model;
  }
}
