import type { FormalModelId } from "./formal-model-id.ts";

export class IrValidationMaterialsId {
  readonly #model: FormalModelId;

  private constructor(model: FormalModelId) {
    this.#model = model;
  }

  static ofModel(model: FormalModelId): IrValidationMaterialsId {
    return new IrValidationMaterialsId(model);
  }

  equals(other: IrValidationMaterialsId): boolean {
    return this.#model.equals(other.#model);
  }

  modelId(): FormalModelId {
    return this.#model;
  }
}
