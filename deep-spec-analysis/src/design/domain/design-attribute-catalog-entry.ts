import { AttributePath } from "@deep-spec-analysis/kernel-domain";
import { type ParseError, parseConstruction, type Result } from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignAttributeDeclaration } from "./design-attribute-declaration.ts";
import type { DesignEntityName } from "./design-entity-name.ts";

/** 属性カタログの論理要素。属性値だけでは所有エンティティと完全座標を復元できない。 */
export class DesignAttributeCatalogEntry {
  readonly #path: AttributePath;
  readonly #owner: DesignEntityName;
  readonly #attribute: DesignAttributeDeclaration;

  private constructor(owner: DesignEntityName, attribute: DesignAttributeDeclaration) {
    this.#path = AttributePath.of(`${owner.asString()}.${attribute.name().asString()}`);
    this.#owner = owner;
    this.#attribute = attribute;
  }

  static of(owner: DesignEntityName, attribute: DesignAttributeDeclaration): DesignAttributeCatalogEntry {
    return new DesignAttributeCatalogEntry(owner, attribute);
  }

  static parse(
    owner: DesignEntityName,
    attribute: DesignAttributeDeclaration,
  ): Result<DesignAttributeCatalogEntry, ParseError> {
    return parseConstruction(() => new DesignAttributeCatalogEntry(owner, attribute));
  }

  path(): AttributePath {
    return this.#path;
  }

  owner(): DesignEntityName {
    return this.#owner;
  }

  attribute(): DesignAttributeDeclaration {
    return this.#attribute;
  }

  equals(other: DesignAttributeCatalogEntry): boolean {
    return (
      this.#path.equals(other.#path) && this.#owner.equals(other.#owner) && this.#attribute.equals(other.#attribute)
    );
  }
}
