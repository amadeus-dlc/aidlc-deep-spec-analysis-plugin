import { AttributePath } from "@deep-spec-analysis/kernel-domain";
import {
  combinedHash,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { IntermediateRepresentationAttributeDeclaration } from "./intermediate-representation-attribute-declaration.ts";
import type { IntermediateRepresentationEntityName } from "./intermediate-representation-entity-name.ts";

// IR 属性カタログの論理項目。属性宣言単体では owner と完全座標が消えるため、
// entity owner・path・宣言を一つのドメイン要素として保持する。
export class IntermediateRepresentationAttributeEntry {
  readonly #owner: IntermediateRepresentationEntityName;
  readonly #path: AttributePath;
  readonly #attribute: IntermediateRepresentationAttributeDeclaration;

  private constructor(
    owner: IntermediateRepresentationEntityName,
    attribute: IntermediateRepresentationAttributeDeclaration,
  ) {
    this.#owner = owner;
    this.#path = AttributePath.of(`${owner.asString()}.${attribute.name().asString()}`);
    this.#attribute = attribute;
  }

  static of(
    owner: IntermediateRepresentationEntityName,
    attribute: IntermediateRepresentationAttributeDeclaration,
  ): IntermediateRepresentationAttributeEntry {
    return new IntermediateRepresentationAttributeEntry(owner, attribute);
  }

  static parse(
    owner: IntermediateRepresentationEntityName,
    attribute: IntermediateRepresentationAttributeDeclaration,
  ): Result<IntermediateRepresentationAttributeEntry, ParseError> {
    return parseConstruction(() => new IntermediateRepresentationAttributeEntry(owner, attribute));
  }

  path(): AttributePath {
    return this.#path;
  }

  owner(): IntermediateRepresentationEntityName {
    return this.#owner;
  }

  attribute(): IntermediateRepresentationAttributeDeclaration {
    return this.#attribute;
  }

  equals(other: IntermediateRepresentationAttributeEntry): boolean {
    return (
      this.#owner.equals(other.#owner) && this.#path.equals(other.#path) && this.#attribute.equals(other.#attribute)
    );
  }

  hashCode(): number {
    return combinedHash([this.#owner.hashCode(), this.#path.hashCode(), this.#attribute.hashCode()]);
  }
}
