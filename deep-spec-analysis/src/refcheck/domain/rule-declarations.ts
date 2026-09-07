import {
  type ArtifactPath,
  type FirstClassCollection,
  FirstClassCollectionBase,
  type RequirementIdentifiers,
} from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DeclaredEntities } from "./declared-entities.ts";
import { FD_R3, FD_R4 } from "./functional-check-families.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import type { RuleDeclaration } from "./rule-declaration.ts";

export class RuleDeclarations
  extends FirstClassCollectionBase<RuleDeclaration, RuleDeclarations>
  implements FirstClassCollection<RuleDeclaration>
{
  readonly #values: readonly RuleDeclaration[];

  private constructor(values: readonly RuleDeclaration[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-rule-declarations");
  }

  protected override rebuild(values: readonly RuleDeclaration[]): RuleDeclarations {
    return new RuleDeclarations(values);
  }

  override map(transform: (element: RuleDeclaration) => RuleDeclaration): RuleDeclarations {
    return this.mapTo(transform, RuleDeclarations.of);
  }

  override combine(other: RuleDeclarations): RuleDeclarations {
    return this.combineTo(other, RuleDeclarations.of);
  }

  static parse(values: readonly RuleDeclaration[]): Result<RuleDeclarations, ParseError> {
    return parseConstruction(() => new RuleDeclarations(values));
  }

  static of(values: readonly RuleDeclaration[]): RuleDeclarations {
    return new RuleDeclarations(values);
  }

  add(value: RuleDeclaration): RuleDeclarations {
    return new RuleDeclarations([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<RuleDeclaration> {
    yield* this.#values;
  }

  toArray(): readonly RuleDeclaration[] {
    return this.#values;
  }

  // 検査族の順序・識別子の重複・隣接文書の不在を所有する。
  check(
    report: ReferenceCheckReport,
    artifact: ArtifactPath,
    requirementIdsKnown: RequirementIdentifiers | null,
    entities: DeclaredEntities | null,
  ): void {
    for (const rule of this) rule.checkRequiredKeys(report, artifact);
    const seen = new Set<string>();
    for (const rule of this) {
      rule.checkIdentifier(report, artifact);
      const id = rule.identifierForUniqueness();
      if (id === null) continue;
      if (seen.has(id.asString())) rule.reportDuplicateIdentifier(report, artifact);
      seen.add(id.asString());
    }
    if (requirementIdsKnown === null)
      report.skip(
        FD_R3,
        "absent-input",
        "requirements.md not found under this intent record — source ids cannot be reverse-verified",
      );
    else for (const rule of this) rule.checkSource(requirementIdsKnown, report, artifact);
    if (entities === null)
      report.skip(FD_R4, "absent-input", "entities.md is unavailable — applies-to cannot be resolved");
    else for (const rule of this) rule.checkApplicability(entities.entities(), report, artifact);
    for (const rule of this) rule.checkCategory(report, artifact);
  }
}
