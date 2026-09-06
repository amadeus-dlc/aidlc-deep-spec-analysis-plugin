import {
  ErrorMessage,
  ErrorMessages,
  type FirstClassCollection,
  FirstClassCollectionBase,
} from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { IntermediateRepresentationAttributeDeclaration } from "./intermediate-representation-attribute-declaration.ts";
import type { IntermediateRepresentationEntityDeclaration } from "./intermediate-representation-entity-declaration.ts";

export class IntermediateRepresentationEntityDeclarations
  extends FirstClassCollectionBase<
    IntermediateRepresentationEntityDeclaration,
    IntermediateRepresentationEntityDeclarations
  >
  implements FirstClassCollection<IntermediateRepresentationEntityDeclaration>
{
  readonly #values: readonly IntermediateRepresentationEntityDeclaration[];

  private constructor(values: readonly IntermediateRepresentationEntityDeclaration[]) {
    super();
    this.#values = boundedCollectionSnapshot(
      values,
      65_536,
      "too-many-intermediate-representation-entity-declarations",
    );
  }

  protected rebuild(
    values: readonly IntermediateRepresentationEntityDeclaration[],
  ): IntermediateRepresentationEntityDeclarations {
    return new IntermediateRepresentationEntityDeclarations(values);
  }

  static parse(
    values: readonly IntermediateRepresentationEntityDeclaration[],
  ): Result<IntermediateRepresentationEntityDeclarations, ParseError> {
    return parseConstruction(() => new IntermediateRepresentationEntityDeclarations(values));
  }

  static of(
    values: readonly IntermediateRepresentationEntityDeclaration[],
  ): IntermediateRepresentationEntityDeclarations {
    return new IntermediateRepresentationEntityDeclarations(values);
  }

  add(value: IntermediateRepresentationEntityDeclaration): IntermediateRepresentationEntityDeclarations {
    return new IntermediateRepresentationEntityDeclarations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<IntermediateRepresentationEntityDeclaration> {
    yield* this.#values;
  }

  #inspect(
    entityFound: (entity: IntermediateRepresentationEntityDeclaration, duplicate: boolean) => void,
    attributeFound: (
      coordinate: string,
      attribute: IntermediateRepresentationAttributeDeclaration,
      duplicate: boolean,
    ) => void,
  ): void {
    const names = new Set<string>();
    for (const entity of this.#values) {
      const name = entity.name().asString();
      entityFound(entity, names.has(name));
      names.add(name);
      entity.inspectAttributes(attributeFound);
    }
  }

  hasAmbiguousAttributes(): boolean {
    let ambiguous = false;
    this.#inspect(
      (_entity, duplicate) => {
        ambiguous ||= duplicate;
      },
      (_path, _attribute, duplicate) => {
        ambiguous ||= duplicate;
      },
    );
    return ambiguous;
  }

  diagnostics(): ErrorMessages {
    const messages: string[] = [];
    this.#inspect(
      (entity, duplicate) => {
        if (duplicate) messages.push(`schema: duplicate entity "${entity.name().asString()}"`);
      },
      (coordinate, attribute, duplicate) => {
        if (duplicate) messages.push(`schema: duplicate attribute "${coordinate}"`);
        if (attribute.boundsInverted()) messages.push(`schema: ${coordinate}: min > max`);
        if (attribute.boundsOutsideSafeRange()) messages.push(`schema: ${coordinate}: bounds must be safe integers`);
      },
    );
    return ErrorMessages.collect(messages.map(ErrorMessage.parse));
  }

  toArray(): readonly IntermediateRepresentationEntityDeclaration[] {
    return this.#values;
  }
}
