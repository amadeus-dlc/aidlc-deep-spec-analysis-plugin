import { ErrorMessage, ErrorMessages, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignAttributeDeclaration } from "./design-attribute-declaration.ts";
import type { DesignEntityDeclaration } from "./design-entity-declaration.ts";

export class DesignEntityDeclarations extends FirstClassCollectionBase<
  DesignEntityDeclaration,
  DesignEntityDeclarations
> {
  readonly #values: readonly DesignEntityDeclaration[];

  private constructor(values: readonly DesignEntityDeclaration[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-design-entity-declarations");
  }

  protected rebuild(values: readonly DesignEntityDeclaration[]): DesignEntityDeclarations {
    return new DesignEntityDeclarations(values);
  }

  static of(values: readonly DesignEntityDeclaration[]): DesignEntityDeclarations {
    return new DesignEntityDeclarations(values);
  }

  static parse(values: readonly DesignEntityDeclaration[]): Result<DesignEntityDeclarations, ParseError> {
    return parseConstruction(() => new DesignEntityDeclarations(values));
  }

  add(value: DesignEntityDeclaration): DesignEntityDeclarations {
    return new DesignEntityDeclarations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignEntityDeclaration> {
    yield* this.#values;
  }

  #inspect(
    entityFound: (entity: DesignEntityDeclaration, duplicate: boolean) => void,
    attributeFound: (coordinate: string, attribute: DesignAttributeDeclaration, duplicate: boolean) => void,
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
        if (duplicate) messages.push(`duplicate entity "${entity.name().asString()}"`);
      },
      (coordinate, attribute, duplicate) => {
        if (duplicate) messages.push(`duplicate attribute "${coordinate}"`);
        if (attribute.lacksIntBounds())
          messages.push(`${coordinate}: int attributes require min and max — the Quint backend needs bounded domains`);
        if (attribute.boundsInverted()) messages.push(`${coordinate}: min > max`);
        if (attribute.boundsOutsideSafeRange()) messages.push(`${coordinate}: bounds must be safe integers`);
      },
    );
    return ErrorMessages.collect(messages.map(ErrorMessage.parse));
  }

  toArray(): readonly DesignEntityDeclaration[] {
    return this.#values;
  }
}
