import { matchResult } from "@deep-spec/kernel-infrastructure";
import {
  type FormalModelIdentifier,
  IntermediateRepresentationValidationMaterialsIdentifier,
} from "@deep-spec/requirements-domain";
import type { IntermediateRepresentationValidationMaterialsRepository } from "./port/intermediate-representation-validation-materials-repository.ts";
import type { RequirementsSourceRepository } from "./port/requirements-source-repository.ts";
import type { ValidateIntermediateRepresentationOutcome } from "./validate-intermediate-representation-outcome.ts";

export class ValidateIntermediateRepresentationUseCase {
  readonly #materialsRepository: IntermediateRepresentationValidationMaterialsRepository;
  readonly #sourceRepository: RequirementsSourceRepository;

  constructor(
    materialsRepository: IntermediateRepresentationValidationMaterialsRepository,
    sourceRepository: RequirementsSourceRepository,
  ) {
    this.#materialsRepository = materialsRepository;
    this.#sourceRepository = sourceRepository;
  }

  execute(modelId: FormalModelIdentifier): ValidateIntermediateRepresentationOutcome {
    return matchResult(
      this.#materialsRepository.findById(IntermediateRepresentationValidationMaterialsIdentifier.of(modelId)),
      {
        err: (error): ValidateIntermediateRepresentationOutcome =>
          error.kind === "not-found" ? { kind: "not-applicable" } : { kind: "acquisition-failed", error },
        ok: (materials) =>
          materials.validate<ValidateIntermediateRepresentationOutcome>({
            complete: (assessment) => ({ kind: "verdict", assessment }),
            sourceRequired: (sourceId, validation) =>
              matchResult(this.#sourceRepository.findById(sourceId), {
                ok: (source) => ({ kind: "verdict", assessment: validation.assess(source) }),
                err: () => ({ kind: "verdict", assessment: validation.assess(null) }),
              }),
          }),
      },
    );
  }
}
