import {
  BusinessRuleReference,
  BusinessRuleReferenceIndex,
  BusinessRuleReferences,
} from "@deep-spec-analysis/design-domain";
import { flatMapResult, type ParseError, type Result, traverseResult } from "@deep-spec-analysis/kernel-infrastructure";

export function parseBusinessRuleReferenceIndex(markdown: string): Result<BusinessRuleReferenceIndex, ParseError> {
  return flatMapResult(
    traverseResult([...markdown.matchAll(/\bBR[0-9]+\.[0-9]+\b/g)], (match) => BusinessRuleReference.parse(match[0])),
    (values) =>
      flatMapResult(BusinessRuleReferences.parse(values), (references) => ({
        ok: true,
        value: BusinessRuleReferenceIndex.of(references),
      })),
  );
}
