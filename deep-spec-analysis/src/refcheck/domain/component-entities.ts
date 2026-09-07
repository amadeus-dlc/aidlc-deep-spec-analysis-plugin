import {
  type ArtifactPath,
  type FirstClassCollection,
  FirstClassCollectionBase,
} from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { ComponentEntity } from "./component-entity.ts";
import type { Components } from "./components.ts";
import type { EntityName } from "./entity-name.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";

export class ComponentEntities
  extends FirstClassCollectionBase<ComponentEntity, ComponentEntities>
  implements FirstClassCollection<ComponentEntity>
{
  readonly #values: readonly ComponentEntity[];

  private constructor(values: readonly ComponentEntity[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-component-entities");
  }

  protected override rebuild(values: readonly ComponentEntity[]): ComponentEntities {
    return new ComponentEntities(values);
  }

  override map(transform: (element: ComponentEntity) => ComponentEntity): ComponentEntities {
    return this.mapTo(transform, ComponentEntities.of);
  }

  override combine(other: ComponentEntities): ComponentEntities {
    return this.combineTo(other, ComponentEntities.of);
  }

  static parse(values: readonly ComponentEntity[]): Result<ComponentEntities, ParseError> {
    return parseConstruction(() => new ComponentEntities(values));
  }

  static of(values: readonly ComponentEntity[]): ComponentEntities {
    return new ComponentEntities(values);
  }

  add(value: ComponentEntity): ComponentEntities {
    return new ComponentEntities([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<ComponentEntity> {
    yield* this.#values;
  }

  // DD-6：owner がこの名前のエンティティを宣言しているか。
  declaresEntity(name: EntityName): boolean {
    return this.#values.some((e) => e.name().equals(name));
  }

  // DD-2: 所有エンティティすべての参照所有者を宣言順に検査する。
  checkReferenceOwners(components: Components, report: ReferenceCheckReport, artifact: ArtifactPath): void {
    for (const entity of this.#values) entity.checkReferenceOwners(components, report, artifact);
  }

  // DD-5: 所有エンティティすべての識別子の有無を宣言順に検査する。
  checkIdentifiers(report: ReferenceCheckReport, artifact: ArtifactPath): void {
    for (const entity of this.#values) entity.checkIdentifier(report, artifact);
  }

  // DD-6: 所有エンティティすべての参照先を宣言順に検査する。
  checkReferenceTargets(components: Components, report: ReferenceCheckReport, artifact: ArtifactPath): void {
    for (const entity of this.#values) entity.checkReferenceTargets(components, report, artifact);
  }

  toArray(): readonly ComponentEntity[] {
    return this.#values;
  }
}
