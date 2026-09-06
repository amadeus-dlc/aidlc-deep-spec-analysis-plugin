import { RequirementIdentifier, RequirementIdentifiers } from "@deep-spec-analysis/kernel-domain";
import type { ParseError, Result } from "@deep-spec-analysis/kernel-infrastructure";

/** requirements.md等の外部文書からRequirementIdentifiersをResultで復元する。 */
export function parseRequirementIdentifiers(text: string): Result<RequirementIdentifiers, ParseError> {
  const values: RequirementIdentifier[] = [];
  for (const match of text.matchAll(/\b(?:FR|NFR)-?[0-9]+(?:\.[0-9]+)*\b/g)) {
    const parsed = RequirementIdentifier.parse(match[0]);
    if (!parsed.ok) return parsed;
    values.push(parsed.value);
  }
  return RequirementIdentifiers.parse(values);
}
