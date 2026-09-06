import { type ArtifactPath, FindingKind, type RequirementIdentifiers } from "@deep-spec-analysis/kernel-domain";
import type { AppliesTo } from "./applies-to.ts";
import type { DeclaredRuleIdentifier } from "./declared-rule-identifier.ts";
import type { ElementPath } from "./element-path.ts";
import type { EntityDeclarations } from "./entity-declarations.ts";
import { FD_R1, FD_R2, FD_R3, FD_R4, FD_R5 } from "./functional-check-families.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import type { RuleCategory } from "./rule-category.ts";
import type { SourceIdentifiers } from "./source-identifiers.ts";
import { WitnessReference } from "./witness-reference.ts";

// 規則宣言。finding target の選定（BR 形なら自分の id、でなければ族の
// フォールバック）・source id の逆検証・category の閉集合整合を所有する。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type RuleDeclarationParam = {
  readonly id: DeclaredRuleIdentifier | null;
  readonly element: ElementPath;
  readonly category: RuleCategory | null;
  readonly appliesTo: AppliesTo | null;
  readonly sourceIds: SourceIdentifiers;
  // 欠落キー名の列（文言材料——語彙値ではない）。
  readonly missing: readonly string[];
};

export class RuleDeclaration {
  readonly #id: DeclaredRuleIdentifier | null;
  readonly #element: ElementPath;
  readonly #category: RuleCategory | null;
  readonly #appliesTo: AppliesTo | null;
  readonly #sourceIds: SourceIdentifiers;
  readonly #missing: readonly string[];

  private constructor(seed: RuleDeclarationParam) {
    this.#id = seed.id;
    this.#element = seed.element;
    this.#category = seed.category;
    this.#appliesTo = seed.appliesTo;
    this.#sourceIds = seed.sourceIds;
    this.#missing = Object.freeze([...seed.missing]);
  }

  static of(seed: RuleDeclarationParam): RuleDeclaration {
    return new RuleDeclaration(seed);
  }

  identifierForUniqueness(): DeclaredRuleIdentifier | null {
    return this.#id?.matchesShape() ? this.#id : null;
  }

  #findingTarget(fallback: string): string {
    return this.identifierForUniqueness()?.asString() ?? fallback;
  }

  checkRequiredKeys(report: ReferenceCheckReport, artifact: ArtifactPath): void {
    if (this.#missing.length === 0) return;
    report.finding(
      FD_R1,
      FindingKind.structureInvalid(),
      [this.#findingTarget("check:FD-R1")],
      [WitnessReference.at(artifact.asString(), this.#element.asString())],
      `rule is missing required key(s): ${this.#missing.join(", ")}`,
    );
  }

  checkIdentifier(report: ReferenceCheckReport, artifact: ArtifactPath): void {
    const id = this.#id;
    if (id === null || id.matchesShape()) return;
    report.finding(
      FD_R2,
      FindingKind.structureInvalid(),
      [FD_R2.asCheckTarget()],
      [WitnessReference.at(artifact.asString(), `${this.#element.asString()}.id`, id.asString())],
      `rule id "${id.asString()}" does not match BR{group}.{seq}`,
    );
  }

  reportDuplicateIdentifier(report: ReferenceCheckReport, artifact: ArtifactPath): void {
    const id = this.identifierForUniqueness();
    if (id === null) throw new Error("defect: a malformed rule identifier cannot be a duplicate identifier");
    report.finding(
      FD_R2,
      FindingKind.structureInvalid(),
      [id.asString()],
      [WitnessReference.at(artifact.asString(), `${this.#element.asString()}.id`, id.asString())],
      `rule id "${id.asString()}" is declared more than once`,
    );
  }

  checkSource(known: RequirementIdentifiers, report: ReferenceCheckReport, artifact: ArtifactPath): void {
    const missing = this.#sourceIds.valuesMissingFrom(known);
    if (missing.length === 0) return;
    report.finding(
      FD_R3,
      FindingKind.referenceBroken(),
      [this.#findingTarget("check:FD-R3")],
      missing.map((id) => WitnessReference.at(artifact.asString(), `${this.#element.asString()}.source`, id)),
      `source id(s) ${missing.join(", ")} do not exist in requirements.md`,
      missing,
    );
  }

  checkApplicability(entities: EntityDeclarations, report: ReferenceCheckReport, artifact: ArtifactPath): void {
    const target = this.#appliesTo;
    if (target === null || entities.resolvesAppliesTo(target)) return;
    report.finding(
      FD_R4,
      FindingKind.referenceBroken(),
      [this.#findingTarget("check:FD-R4")],
      [WitnessReference.at(artifact.asString(), this.#element.asString(), target.asString())],
      `applies-to "${target.asString()}" does not resolve to a declared entity or entity.attribute`,
    );
  }

  checkCategory(report: ReferenceCheckReport, artifact: ArtifactPath): void {
    const category = this.#category;
    if (category === null || category.isKnownCategory()) return;
    report.finding(
      FD_R5,
      FindingKind.structureInvalid(),
      [this.#findingTarget("check:FD-R5")],
      [WitnessReference.at(artifact.asString(), `${this.#element.asString()}.category`, category.asString())],
      `category "${category.asString()}" is not one of validation | authorization | constraint | calculation | policy`,
    );
  }
}
