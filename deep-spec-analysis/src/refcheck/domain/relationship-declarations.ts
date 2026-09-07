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
import type { EntityDeclarations } from "./entity-declarations.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import type { RelationshipDeclaration } from "./relationship-declaration.ts";

export class RelationshipDeclarations
  extends FirstClassCollectionBase<RelationshipDeclaration, RelationshipDeclarations>
  implements FirstClassCollection<RelationshipDeclaration>
{
  readonly #values: readonly RelationshipDeclaration[];

  private constructor(values: readonly RelationshipDeclaration[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-relationship-declarations");
  }

  protected override rebuild(values: readonly RelationshipDeclaration[]): RelationshipDeclarations {
    return new RelationshipDeclarations(values);
  }

  override map(transform: (element: RelationshipDeclaration) => RelationshipDeclaration): RelationshipDeclarations {
    return this.mapTo(transform, RelationshipDeclarations.of);
  }

  override combine(other: RelationshipDeclarations): RelationshipDeclarations {
    return this.combineTo(other, RelationshipDeclarations.of);
  }

  static parse(values: readonly RelationshipDeclaration[]): Result<RelationshipDeclarations, ParseError> {
    return parseConstruction(() => new RelationshipDeclarations(values));
  }

  static of(values: readonly RelationshipDeclaration[]): RelationshipDeclarations {
    return new RelationshipDeclarations(values);
  }

  add(value: RelationshipDeclaration): RelationshipDeclarations {
    return new RelationshipDeclarations([...this.#values, value]);
  }

  concat(other: RelationshipDeclarations): RelationshipDeclarations {
    return new RelationshipDeclarations([...this.#values, ...other.#values]);
  }

  override *[Symbol.iterator](): Iterator<RelationshipDeclaration> {
    yield* this.#values;
  }

  // 関係宣言すべての端点を合成順のまま検査する（FD-E2）。
  checkAgainst(entities: EntityDeclarations, report: ReferenceCheckReport, artifact: ArtifactPath): void {
    for (const relationship of this.#values) relationship.checkAgainst(entities, report, artifact);
  }

  toArray(): readonly RelationshipDeclaration[] {
    return this.#values;
  }
}
