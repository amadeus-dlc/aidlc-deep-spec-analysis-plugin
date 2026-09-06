import type { FirstClassCollection, IterableFirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import { ErrorMessage, ErrorMessages } from "@deep-spec-analysis/kernel-domain";
import type { IntermediateRepresentationAttributeDeclaration } from "./intermediate-representation-attribute-declaration.ts";
import type { IntermediateRepresentationEntityDeclaration } from "./intermediate-representation-entity-declaration.ts";

export class IntermediateRepresentationEntityDeclarations
  implements FirstClassCollection, IterableFirstClassCollection<IntermediateRepresentationEntityDeclaration>
{
  readonly #values: readonly IntermediateRepresentationEntityDeclaration[];

  private constructor(values: readonly IntermediateRepresentationEntityDeclaration[]) {
    this.#values = Object.freeze([...values]);
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

  isEmpty(): boolean {
    return this.#values.length === 0;
  }
}
