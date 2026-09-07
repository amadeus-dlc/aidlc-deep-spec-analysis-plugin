import {
  type ArtifactPath,
  FindingKind,
  FindingTargets,
  type FirstClassCollection,
  FirstClassCollectionBase,
  KeySet,
  type NormalizedName,
  TargetIdentifier,
  TargetIdentifiers,
} from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { AppliesTo } from "./applies-to.ts";
import { AttributeName } from "./attribute-name.ts";
import type { EntityDeclaration } from "./entity-declaration.ts";
import { EntityName } from "./entity-name.ts";
import { FD_E1 } from "./functional-check-families.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import type { ReferenceTarget } from "./reference-target.ts";
import { WitnessReference } from "./witness-reference.ts";

// エンティティ宣言のコレクション。重複・所属・正規化名解決・ライフサイクル
// 対象の選定・あいまい照合という集合の知識を所有する。
export class EntityDeclarations
  extends FirstClassCollectionBase<EntityDeclaration, EntityDeclarations>
  implements FirstClassCollection<EntityDeclaration>
{
  readonly #values: readonly EntityDeclaration[];
  readonly #names: KeySet<EntityName>;

  private constructor(values: readonly EntityDeclaration[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-entity-declarations");
    this.#names = KeySet.of(this.#values.map((e) => e.name()));
  }

  protected override rebuild(values: readonly EntityDeclaration[]): EntityDeclarations {
    return new EntityDeclarations(values);
  }

  override map(transform: (element: EntityDeclaration) => EntityDeclaration): EntityDeclarations {
    return this.mapTo(transform, EntityDeclarations.of);
  }

  override combine(other: EntityDeclarations): EntityDeclarations {
    return this.combineTo(other, EntityDeclarations.of);
  }

  static parse(values: readonly EntityDeclaration[]): Result<EntityDeclarations, ParseError> {
    return parseConstruction(() => new EntityDeclarations(values));
  }

  static of(values: readonly EntityDeclaration[]): EntityDeclarations {
    return new EntityDeclarations(values);
  }

  add(value: EntityDeclaration): EntityDeclarations {
    return new EntityDeclarations([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<EntityDeclaration> {
    yield* this.#values;
  }

  duplicatesByName(): EntityDeclaration[] {
    const seen = new Set<string>();
    const dups: EntityDeclaration[] = [];
    for (const e of this.#values) {
      if (seen.has(e.name().asString())) dups.push(e);
      seen.add(e.name().asString());
    }
    return dups;
  }

  checkDuplicates(report: ReferenceCheckReport, artifact: ArtifactPath): void {
    for (const duplicate of this.duplicatesByName())
      report.finding(
        FD_E1,
        FindingKind.structureInvalid(),
        FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("entity", duplicate.name().asString())), []),
        [
          WitnessReference.at(
            artifact.asString(),
            `${duplicate.element().asString()}.name`,
            duplicate.name().asString(),
          ),
        ],
        `entity "${duplicate.name().asString()}" is declared more than once`,
      );
  }

  // 各エンティティの属性重複を宣言順に検査する（FD-E1）。
  checkDuplicateAttributes(report: ReferenceCheckReport, artifact: ArtifactPath): void {
    for (const entity of this.#values) entity.checkDuplicateAttributes(report, artifact);
  }

  // 各エンティティの属性を宣言順に検査する（解決先はこの集合自身）。
  checkAttributes(report: ReferenceCheckReport, artifact: ArtifactPath): void {
    for (const entity of this.#values) entity.checkAttributes(this, report, artifact);
  }

  containsNamed(name: EntityName): boolean {
    return this.#names.has(name);
  }

  byNormalizedName(normalized: NormalizedName): EntityDeclaration | undefined {
    return this.#values.find((e) => e.name().normalized().equals(normalized));
  }

  lifecycleOnly(): EntityDeclaration[] {
    return this.#values.filter((e) => e.hasLifecycle());
  }

  // FD-E6: Entity / Entity.attr 形はエンティティ名の厳密照合、自由文は
  // 小文字包含の緩い照合（凍結挙動）。
  resolvesReference(reference: ReferenceTarget): boolean {
    const token = reference.entityToken();
    if (token !== null) {
      const parsed = EntityName.parse(token);
      return parsed.ok && this.#names.has(parsed.value);
    }
    return this.#values.some((d) => reference.looselyMentions(d.name()));
  }

  // FD-R4: applies-to が Entity / Entity.attribute へ解決するか。
  resolvesAppliesTo(target: AppliesTo): boolean {
    const token = target.entityToken();
    if (token !== null) {
      const ent = this.#values.find((e) => e.name().asString() === token);
      const attr = target.attributeToken();
      if (ent === undefined) return false;
      if (attr === null) return true;
      const parsed = AttributeName.parse(attr);
      return parsed.ok && ent.attrNamed(parsed.value) !== null;
    }
    return this.#values.some((e) => target.looselyMentions(e.name()));
  }

  toArray(): readonly EntityDeclaration[] {
    return this.#values;
  }
}
