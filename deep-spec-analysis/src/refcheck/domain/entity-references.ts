import {
  type ArtifactPath,
  FindingKind,
  FindingTargets,
  type FirstClassCollection,
  FirstClassCollectionBase,
  TargetIdentifier,
  TargetIdentifiers,
} from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import { DD_2, DD_6 } from "./component-check-families.ts";
import type { Components } from "./components.ts";
import type { EntityName } from "./entity-name.ts";
import type { EntityReference } from "./entity-reference.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import { WitnessReference } from "./witness-reference.ts";

export class EntityReferences
  extends FirstClassCollectionBase<EntityReference, EntityReferences>
  implements FirstClassCollection<EntityReference>
{
  readonly #values: readonly EntityReference[];

  private constructor(values: readonly EntityReference[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-entity-references");
  }

  protected override rebuild(values: readonly EntityReference[]): EntityReferences {
    return new EntityReferences(values);
  }

  override map(transform: (element: EntityReference) => EntityReference): EntityReferences {
    return this.mapTo(transform, EntityReferences.of);
  }

  override combine(other: EntityReferences): EntityReferences {
    return this.combineTo(other, EntityReferences.of);
  }

  static parse(values: readonly EntityReference[]): Result<EntityReferences, ParseError> {
    return parseConstruction(() => new EntityReferences(values));
  }

  static of(values: readonly EntityReference[]): EntityReferences {
    return new EntityReferences(values);
  }

  add(value: EntityReference): EntityReferences {
    return new EntityReferences([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<EntityReference> {
    yield* this.#values;
  }

  // DD-2: 未宣言の所有コンポーネントを指す参照を、宣言順のまま finding にする。
  checkOwnersDeclared(
    entity: EntityName,
    components: Components,
    report: ReferenceCheckReport,
    artifact: ArtifactPath,
  ): void {
    for (const reference of this.#values) {
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
          `entity "${entity.asString()}" references owner component "${reference.ownedBy().asString()}" which is not declared`,
        );
    }
  }

  // DD-6: 所有コンポーネントが宣言していないエンティティへの参照を finding にする。
  checkTargetsDeclared(
    entity: EntityName,
    components: Components,
    report: ReferenceCheckReport,
    artifact: ArtifactPath,
  ): void {
    for (const reference of this.#values) {
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
          `entity "${entity.asString()}" references "${reference.entity().asString()}" as owned by "${reference.ownedBy().asString()}", but "${reference.ownedBy().asString()}" declares no such entity`,
        );
    }
  }

  toArray(): readonly EntityReference[] {
    return this.#values;
  }
}
