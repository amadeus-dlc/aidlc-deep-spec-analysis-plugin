import {
  type ArtifactPath,
  FindingKind,
  FindingTargets,
  TargetIdentifier,
  TargetIdentifiers,
} from "@deep-spec-analysis/kernel-domain";
import type { AttributeName } from "./attribute-name.ts";
import { DD_2, DD_5, DD_6 } from "./component-check-families.ts";
import type { Components } from "./components.ts";
import type { ElementPath } from "./element-path.ts";
import type { EntityName } from "./entity-name.ts";
import type { EntityReferences } from "./entity-references.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import { WitnessReference } from "./witness-reference.ts";

// コンポーネントが所有するエンティティ宣言。所有の要件たる識別子の有無
// （DD-5）はエンティティ自身が判定する（#71 波6）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type ComponentEntityParam = {
  name: EntityName;
  element: ElementPath;
  identifier: AttributeName | null;
  references: EntityReferences;
};

export class ComponentEntity {
  readonly #name: EntityName;
  readonly #element: ElementPath;
  readonly #identifier: AttributeName | null;
  readonly #references: EntityReferences;

  private constructor(props: ComponentEntityParam) {
    this.#name = props.name;
    this.#element = props.element;
    this.#identifier = props.identifier;
    this.#references = props.references;
  }

  static of(props: ComponentEntityParam): ComponentEntity {
    return new ComponentEntity(props);
  }

  checkIdentifier(report: ReferenceCheckReport, artifact: ArtifactPath): void {
    if (!this.hasIdentifier())
      report.finding(
        DD_5,
        FindingKind.structureInvalid(),
        FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("entity", this.#name.asString())), []),
        [WitnessReference.at(artifact.asString(), `${this.#element.asString()}.identifier`)],
        `entity "${this.#name.asString()}" has no identifier`,
      );
  }
  checkReferenceOwners(components: Components, report: ReferenceCheckReport, artifact: ArtifactPath): void {
    for (const reference of this.#references) {
      if (!components.declares(reference.ownedBy()))
        report.finding(
          DD_2,
          FindingKind.referenceBroken(),
          FindingTargets.of(
            TargetIdentifier.of(TargetIdentifiers.safe("component", reference.ownedBy().asString())),
            [],
          ),
          [
            WitnessReference.at(
              artifact.asString(),
              `${reference.element().asString()}.owned_by`,
              reference.ownedBy().asString(),
            ),
          ],
          `entity "${this.#name.asString()}" references owner component "${reference.ownedBy().asString()}" which is not declared`,
        );
    }
  }
  checkReferenceTargets(components: Components, report: ReferenceCheckReport, artifact: ArtifactPath): void {
    for (const reference of this.#references) {
      const owner = components.byName(reference.ownedBy());
      if (owner !== null && !owner.declaresEntity(reference.entity()))
        report.finding(
          DD_6,
          FindingKind.referenceBroken(),
          FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("entity", reference.entity().asString())), []),
          [
            WitnessReference.at(
              artifact.asString(),
              `${reference.element().asString()}.entity`,
              reference.entity().asString(),
            ),
          ],
          `entity "${this.#name.asString()}" references "${reference.entity().asString()}" as owned by "${reference.ownedBy().asString()}", but "${reference.ownedBy().asString()}" declares no such entity`,
        );
    }
  }

  name(): EntityName {
    return this.#name;
  }

  element(): ElementPath {
    return this.#element;
  }

  references(): EntityReferences {
    return this.#references;
  }

  // DD-5: 所有の要件たる識別子を持つか（未宣言・空文字は識別子なし——凍結条件）。
  hasIdentifier(): boolean {
    return this.#identifier !== null;
  }
}
