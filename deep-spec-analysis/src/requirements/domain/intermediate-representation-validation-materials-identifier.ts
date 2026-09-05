import type { FormalModelIdentifier } from "./formal-model-identifier.ts";

export class IntermediateRepresentationValidationMaterialsIdentifier {
  readonly #model: FormalModelIdentifier;

  private constructor(model: FormalModelIdentifier) {
    this.#model = model;
  }

  static of(model: FormalModelIdentifier): IntermediateRepresentationValidationMaterialsIdentifier {
    return new IntermediateRepresentationValidationMaterialsIdentifier(model);
  }

  equals(other: IntermediateRepresentationValidationMaterialsIdentifier): boolean {
    return this.#model.equals(other.#model);
  }

  modelId(): FormalModelIdentifier {
    return this.#model;
  }
}
