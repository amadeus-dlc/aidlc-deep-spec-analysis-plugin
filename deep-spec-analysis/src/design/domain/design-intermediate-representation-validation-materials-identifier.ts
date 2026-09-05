import type { DesignModelIdentifier } from "./design-model-identifier.ts";

export class DesignIntermediateRepresentationValidationMaterialsIdentifier {
  readonly #model: DesignModelIdentifier;

  private constructor(model: DesignModelIdentifier) {
    this.#model = model;
  }

  static of(model: DesignModelIdentifier): DesignIntermediateRepresentationValidationMaterialsIdentifier {
    return new DesignIntermediateRepresentationValidationMaterialsIdentifier(model);
  }

  equals(other: DesignIntermediateRepresentationValidationMaterialsIdentifier): boolean {
    return this.#model.equals(other.#model);
  }

  modelId(): DesignModelIdentifier {
    return this.#model;
  }
}
