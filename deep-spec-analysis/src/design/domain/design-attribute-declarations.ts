import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignAttributeDeclaration } from "./design-attribute-declaration.ts";

export class DesignAttributeDeclarations extends FirstClassCollectionBase<
  DesignAttributeDeclaration,
  DesignAttributeDeclarations
> {
  readonly #values: readonly DesignAttributeDeclaration[];

  private constructor(values: readonly DesignAttributeDeclaration[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-design-attribute-declarations");
  }

  protected override rebuild(values: readonly DesignAttributeDeclaration[]): DesignAttributeDeclarations {
    return new DesignAttributeDeclarations(values);
  }

  static of(values: readonly DesignAttributeDeclaration[]): DesignAttributeDeclarations {
    return new DesignAttributeDeclarations(values);
  }

  static parse(values: readonly DesignAttributeDeclaration[]): Result<DesignAttributeDeclarations, ParseError> {
    return parseConstruction(() => new DesignAttributeDeclarations(values));
  }

  add(value: DesignAttributeDeclaration): DesignAttributeDeclarations {
    return new DesignAttributeDeclarations([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<DesignAttributeDeclaration> {
    yield* this.#values;
  }

  toArray(): readonly DesignAttributeDeclaration[] {
    return this.#values;
  }
}
