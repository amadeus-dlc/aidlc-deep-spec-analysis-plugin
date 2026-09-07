import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignBackgroundDeclaration } from "./design-background-declaration.ts";

export class DesignBackgroundDeclarations extends FirstClassCollectionBase<
  DesignBackgroundDeclaration,
  DesignBackgroundDeclarations
> {
  readonly #values: readonly DesignBackgroundDeclaration[];

  private constructor(values: readonly DesignBackgroundDeclaration[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-design-background-declarations");
  }

  protected override rebuild(values: readonly DesignBackgroundDeclaration[]): DesignBackgroundDeclarations {
    return new DesignBackgroundDeclarations(values);
  }

  static of(values: readonly DesignBackgroundDeclaration[]): DesignBackgroundDeclarations {
    return new DesignBackgroundDeclarations(values);
  }

  override map(
    transform: (element: DesignBackgroundDeclaration) => DesignBackgroundDeclaration,
  ): DesignBackgroundDeclarations {
    return this.mapTo(transform, DesignBackgroundDeclarations.of);
  }

  override combine(other: DesignBackgroundDeclarations): DesignBackgroundDeclarations {
    return this.combineTo(other, DesignBackgroundDeclarations.of);
  }

  static parse(values: readonly DesignBackgroundDeclaration[]): Result<DesignBackgroundDeclarations, ParseError> {
    return parseConstruction(() => new DesignBackgroundDeclarations(values));
  }

  add(value: DesignBackgroundDeclaration): DesignBackgroundDeclarations {
    return new DesignBackgroundDeclarations([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<DesignBackgroundDeclaration> {
    yield* this.#values;
  }

  toArray(): readonly DesignBackgroundDeclaration[] {
    return this.#values;
  }
}
