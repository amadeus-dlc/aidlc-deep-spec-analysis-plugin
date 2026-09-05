import {
  DesignIntermediateRepresentationValidationMaterialsIdentifier,
  type DesignModelIdentifier,
} from "@deep-spec/design-domain";
import { matchResult } from "@deep-spec/kernel-infrastructure";
import type { DesignIntermediateRepresentationValidationMaterialsRepository } from "./port/design-intermediate-representation-validation-materials-repository.ts";
import type { ValidateDesignIntermediateRepresentationOutcome } from "./validate-design-intermediate-representation-outcome.ts";

export class ValidateDesignIntermediateRepresentationUseCase {
  readonly #repository: DesignIntermediateRepresentationValidationMaterialsRepository;

  constructor(repository: DesignIntermediateRepresentationValidationMaterialsRepository) {
    this.#repository = repository;
  }

  execute(modelId: DesignModelIdentifier): ValidateDesignIntermediateRepresentationOutcome {
    return matchResult(
      this.#repository.findById(DesignIntermediateRepresentationValidationMaterialsIdentifier.of(modelId)),
      {
        ok: (materials): ValidateDesignIntermediateRepresentationOutcome => ({
          kind: "verdict",
          assessment: materials.assess(),
        }),
        err: (error): ValidateDesignIntermediateRepresentationOutcome =>
          error.kind === "not-found" ? { kind: "not-applicable" } : { kind: "acquisition-failed", error },
      },
    );
  }
}
