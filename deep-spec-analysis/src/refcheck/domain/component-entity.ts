import {
  type ArtifactPath,
  FindingKind,
  FindingTargets,
  TargetIdentifier,
  TargetIdentifiers,
} from "@deep-spec-analysis/kernel-domain";
import { combinedHash, hashOfNullable } from "@deep-spec-analysis/kernel-infrastructure";
import type { AttributeName } from "./attribute-name.ts";
import { DD_5 } from "./component-check-families.ts";
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
    this.#references.checkOwnersDeclared(this.#name, components, report, artifact);
  }
  checkReferenceTargets(components: Components, report: ReferenceCheckReport, artifact: ArtifactPath): void {
    this.#references.checkTargetsDeclared(this.#name, components, report, artifact);
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

  equals(other: ComponentEntity): boolean {
    const identifiersEqual =
      this.#identifier === null
        ? other.#identifier === null
        : other.#identifier !== null && this.#identifier.equals(other.#identifier);
    return (
      this.#name.equals(other.#name) &&
      this.#element.equals(other.#element) &&
      identifiersEqual &&
      this.#references.equals(other.#references)
    );
  }

  hashCode(): number {
    return combinedHash([
      this.#name.hashCode(),
      this.#element.hashCode(),
      hashOfNullable(this.#identifier, (identifier) => identifier.hashCode()),
      this.#references.hashCode(),
    ]);
  }
}
