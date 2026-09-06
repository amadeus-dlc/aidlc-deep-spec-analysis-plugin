import { type ArtifactPath, FindingKind, TargetIdentifiers } from "@deep-spec-analysis/kernel-domain";
import type { AttributeDeclaration } from "./attribute-declaration.ts";
import type { AttributeDeclarations } from "./attribute-declarations.ts";
import type { AttributeName } from "./attribute-name.ts";
import { AttributeNames } from "./attribute-names.ts";
import type { ElementPath } from "./element-path.ts";
import type { EntityDeclarations } from "./entity-declarations.ts";
import type { EntityName } from "./entity-name.ts";
import { FD_E1, FD_S1, FD_S2 } from "./functional-check-families.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import type { RelationshipDeclarations } from "./relationship-declarations.ts";
import { WitnessReference } from "./witness-reference.ts";

// エンティティ宣言。属性の重複・選定・解決は属性コレクションに委ねる。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type EntityDeclarationParam = {
  readonly name: EntityName;
  readonly element: ElementPath;
  readonly attrs: AttributeDeclarations;
  readonly rels: RelationshipDeclarations;
};

export class EntityDeclaration {
  readonly #name: EntityName;
  readonly #element: ElementPath;
  readonly #attrs: AttributeDeclarations;
  readonly #rels: RelationshipDeclarations;

  private constructor(seed: EntityDeclarationParam) {
    this.#name = seed.name;
    this.#element = seed.element;
    this.#attrs = seed.attrs;
    this.#rels = seed.rels;
  }

  static of(seed: EntityDeclarationParam): EntityDeclaration {
    return new EntityDeclaration(seed);
  }

  checkDuplicateAttributes(report: ReferenceCheckReport, artifact: ArtifactPath): void {
    for (const duplicate of this.#attrs.duplicatesByName())
      report.finding(
        FD_E1,
        FindingKind.structureInvalid(),
        [TargetIdentifiers.safe("attr", `${this.#name.asString()}.${duplicate.name().asString()}`)],
        [
          WitnessReference.at(
            artifact.asString(),
            `${duplicate.element().asString()}.name`,
            duplicate.name().asString(),
          ),
        ],
        `attribute "${this.#name.asString()}.${duplicate.name().asString()}" is declared more than once`,
      );
  }

  checkAttributes(entities: EntityDeclarations, report: ReferenceCheckReport, artifact: ArtifactPath): void {
    for (const attribute of this.#attrs) {
      attribute.checkType(report, this.#name, artifact);
      attribute.checkBounds(report, this.#name, artifact);
      attribute.checkReference(entities, report, this.#name, artifact);
    }
  }

  name(): EntityName {
    return this.#name;
  }

  element(): ElementPath {
    return this.#element;
  }

  attributeNames(): AttributeNames {
    return AttributeNames.of(this.#attrs.names());
  }

  attrs(): AttributeDeclarations {
    return this.#attrs;
  }

  rels(): RelationshipDeclarations {
    return this.#rels;
  }

  lifecycleIsNamedBy(entity: EntityName, attribute: AttributeName | null): boolean {
    const lifecycle = this.lifecycleAttribute(attribute);
    return this.#name.normalized().equals(entity.normalized()) && lifecycle?.hasAllowedValues() === true;
  }

  reportMissingLifecycleIn(report: ReferenceCheckReport): void {
    for (const family of [FD_S1, FD_S2])
      report.skip(
        family,
        "unrecognized-format",
        `no \`### State Machine: ${this.#name.asString()}\` heading with a stateDiagram fence found for lifecycle entity "${this.#name.asString()}"`,
      );
  }

  lifecycleAttribute(attribute: AttributeName | null): AttributeDeclaration | null {
    return attribute === null ? this.#attrs.lifecycleAttr() : this.#attrs.named(attribute);
  }

  hasLifecycle(): boolean {
    return this.#attrs.lifecycleAttr() !== null;
  }

  attrNamed(name: AttributeName): AttributeDeclaration | null {
    return this.#attrs.named(name);
  }
}
