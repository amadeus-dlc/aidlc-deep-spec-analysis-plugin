import { RelationshipDeclaration } from "./relationship-declaration.ts";

export class RelationshipDeclarations {
  readonly #values: readonly RelationshipDeclaration[];

  private constructor(values: readonly RelationshipDeclaration[]) {
    this.#values = Object.freeze([...values]);
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
