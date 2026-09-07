import { matchResult } from "@deep-spec-analysis/kernel-infrastructure";
import type { RepositoryError } from "@deep-spec-analysis/kernel-usecase";
import {
  type FormalModelIdentifier,
  IntermediateRepresentationValidationMaterialsIdentifier,
  type RequirementsSource,
} from "@deep-spec-analysis/requirements-domain";
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
            sourceRequired: (sourceId, validation): ValidateIntermediateRepresentationOutcome =>
              matchResult<RequirementsSource, RepositoryError, ValidateIntermediateRepresentationOutcome>(
                this.#sourceRepository.findById(sourceId),
                {
                  ok: (source) => ({ kind: "verdict", assessment: validation.assess(source) }),
                  err: (error) =>
                    error.kind === "not-found"
                      ? { kind: "verdict", assessment: validation.assess(null) }
                      : { kind: "acquisition-failed", error },
                },
              ),
          }),
      },
    );
  }
}
