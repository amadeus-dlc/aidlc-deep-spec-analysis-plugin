import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
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

  protected rebuild(values: readonly RelationshipDeclaration[]): RelationshipDeclarations {
    return new RelationshipDeclarations(values);
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

  *[Symbol.iterator](): Iterator<RelationshipDeclaration> {
    yield* this.#values;
  }

  toArray(): readonly RelationshipDeclaration[] {
    return this.#values;
  }
}
