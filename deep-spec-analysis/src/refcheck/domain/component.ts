import {
  type ArtifactPath,
  FindingKind,
  FindingTargets,
  TargetIdentifier,
  TargetIdentifiers,
} from "@deep-spec-analysis/kernel-domain";
import { combinedHash } from "@deep-spec-analysis/kernel-infrastructure";
import { DD_1 } from "./component-check-families.ts";
import type { ComponentEntities } from "./component-entities.ts";
import type { ComponentName } from "./component-name.ts";
import type { ComponentReferences } from "./component-references.ts";
import type { Components } from "./components.ts";
import type { ElementPath } from "./element-path.ts";
import type { EntityName } from "./entity-name.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import { WitnessReference } from "./witness-reference.ts";

// components.md のコンポーネント宣言。名の形（DD-1 の PascalCase）と自己依存
// の検出（DD-3）は宣言自身が所有する（#71 波6）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type ComponentParam = {
  name: ComponentName;
  element: ElementPath;
  dependsOn: ComponentReferences;
  dependents: ComponentReferences;
  entities: ComponentEntities;
};

export class Component {
  readonly #name: ComponentName;
  readonly #element: ElementPath;
  readonly #dependsOn: ComponentReferences;
  readonly #dependents: ComponentReferences;
  readonly #entities: ComponentEntities;

  private constructor(props: ComponentParam) {
    this.#name = props.name;
    this.#element = props.element;
    this.#dependsOn = props.dependsOn;
    this.#dependents = props.dependents;
    this.#entities = props.entities;
  }

  static of(props: ComponentParam): Component {
    return new Component(props);
  }

  checkName(report: ReferenceCheckReport, artifact: ArtifactPath): void {
    const name = this.#name.asString();
    if (!this.nameIsPascalCase())
      report.finding(
        DD_1,
        FindingKind.structureInvalid(),
        FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("component", name)), []),
        [WitnessReference.at(artifact.asString(), `${this.#element.asString()}.name`, name)],
        `component name "${name}" is not PascalCase`,
      );
  }
  checkReferences(components: Components, report: ReferenceCheckReport, artifact: ArtifactPath): void {
    this.#allReferences().checkDeclared(this.#name, components, report, artifact);
    this.#entities.checkReferenceOwners(components, report, artifact);
  }
  checkSelfReferences(report: ReferenceCheckReport, artifact: ArtifactPath): void {
    this.#allReferences().checkSelfReferences(this.#name, report, artifact);
  }
  checkIdentifiers(report: ReferenceCheckReport, artifact: ArtifactPath): void {
    this.#entities.checkIdentifiers(report, artifact);
  }
  checkEntityReferences(components: Components, report: ReferenceCheckReport, artifact: ArtifactPath): void {
    this.#entities.checkReferenceTargets(components, report, artifact);
  }
  declaresEntity(name: EntityName): boolean {
    return this.#entities.declaresEntity(name);
  }

  name(): ComponentName {
    return this.#name;
  }

  element(): ElementPath {
    return this.#element;
  }

  equals(other: Component): boolean {
    return (
      this.#name.equals(other.#name) &&
      this.#element.equals(other.#element) &&
      this.#dependsOn.equals(other.#dependsOn) &&
      this.#dependents.equals(other.#dependents) &&
      this.#entities.equals(other.#entities)
    );
  }

  hashCode(): number {
    return combinedHash([
      this.#name.hashCode(),
      this.#element.hashCode(),
      this.#dependsOn.hashCode(),
      this.#dependents.hashCode(),
      this.#entities.hashCode(),
    ]);
  }

  dependsOn(): ComponentReferences {
    return this.#dependsOn;
  }

  dependents(): ComponentReferences {
    return this.#dependents;
  }

  entities(): ComponentEntities {
    return this.#entities;
  }

  // DD-1: コンポーネント名は PascalCase でなければならない。
  nameIsPascalCase(): boolean {
    return /^[A-Z][A-Za-z0-9]*$/.test(this.#name.asString());
  }

  // DD-3: 自分自身を指す依存参照（depends_on → dependents の走査順——凍結）。
  selfReferences(): ComponentReferences {
    return this.#allReferences().pointingAt(this.#name);
  }

  // DD-2・DD-3 が見る参照面（depends_on → dependents の走査順——凍結）。
  #allReferences(): ComponentReferences {
    return this.#dependsOn.combine(this.#dependents);
  }
}
