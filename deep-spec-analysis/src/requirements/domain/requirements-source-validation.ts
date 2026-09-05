import { type DeclaredDigest, ErrorMessage, ErrorMessages, ValidationAssessment } from "@deep-spec/kernel-domain";
import type { ParseError, Result } from "@deep-spec/kernel-infrastructure";
import type { FunctionalRequirementReferenceIndex } from "./functional-requirement-reference-index.ts";
import type { IntermediateRepresentationModelDeclaration } from "./intermediate-representation-model-declaration.ts";
import type { RequirementsSource } from "./requirements-source.ts";
import { SourceAnchor } from "./source-anchor.ts";

// スキーマ適合後の検査段階。意味診断、逆参照、原文照合の順序を所有する。
export class RequirementsSourceValidation {
  readonly #view: IntermediateRepresentationModelDeclaration;
  readonly #references: FunctionalRequirementReferenceIndex;
  readonly #declaredDigest: DeclaredDigest | null;

  private constructor(
    view: IntermediateRepresentationModelDeclaration,
    references: FunctionalRequirementReferenceIndex,
    declaredDigest: DeclaredDigest | null,
  ) {
    this.#view = view;
    this.#references = references;
    this.#declaredDigest = declaredDigest;
  }

  static of(
    view: IntermediateRepresentationModelDeclaration,
    references: FunctionalRequirementReferenceIndex,
    declaredDigest: DeclaredDigest | null,
  ): RequirementsSourceValidation {
    return new RequirementsSourceValidation(view, references, declaredDigest);
  }

  assess(source: RequirementsSource | null): ValidationAssessment {
    return ValidationAssessment.of(ErrorMessages.collect(this.#diagnostics(source)));
  }

  *#diagnostics(source: RequirementsSource | null): Iterable<Result<ErrorMessage, ParseError>> {
    for (const message of this.#view.wellFormednessErrors()) yield ErrorMessage.parse(message);
    if (source === null) {
      yield ErrorMessage.parse(
        "requirements.md not found under this intent record — frRefs cannot be reverse-verified",
      );
    } else {
      for (const message of this.#references.missingErrors(source.knownIds())) yield ErrorMessage.parse(message);
      for (const message of SourceAnchor.of(this.#declaredDigest, source.digest()).errors())
        yield ErrorMessage.parse(message);
    }
  }
}
