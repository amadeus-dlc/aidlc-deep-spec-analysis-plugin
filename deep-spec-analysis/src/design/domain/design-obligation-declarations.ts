import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignObligationDeclaration } from "./design-obligation-declaration.ts";

export class DesignObligationDeclarations extends FirstClassCollectionBase<
  DesignObligationDeclaration,
  DesignObligationDeclarations
> {
  readonly #values: readonly DesignObligationDeclaration[];

  private constructor(values: readonly DesignObligationDeclaration[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-design-obligation-declarations");
  }

  protected override rebuild(values: readonly DesignObligationDeclaration[]): DesignObligationDeclarations {
    return new DesignObligationDeclarations(values);
  }

  static of(values: readonly DesignObligationDeclaration[]): DesignObligationDeclarations {
    return new DesignObligationDeclarations(values);
  }

  override map(
    transform: (element: DesignObligationDeclaration) => DesignObligationDeclaration,
  ): DesignObligationDeclarations {
    return this.mapTo(transform, DesignObligationDeclarations.of);
  }

  override combine(other: DesignObligationDeclarations): DesignObligationDeclarations {
    return this.combineTo(other, DesignObligationDeclarations.of);
  }

  static parse(values: readonly DesignObligationDeclaration[]): Result<DesignObligationDeclarations, ParseError> {
    return parseConstruction(() => new DesignObligationDeclarations(values));
  }

  add(value: DesignObligationDeclaration): DesignObligationDeclarations {
    return new DesignObligationDeclarations([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<DesignObligationDeclaration> {
    yield* this.#values;
  }

  toArray(): readonly DesignObligationDeclaration[] {
    return this.#values;
  }
}
