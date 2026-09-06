import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignTransitionDeclaration } from "./design-transition-declaration.ts";

export class DesignTransitionDeclarations extends FirstClassCollectionBase<
  DesignTransitionDeclaration,
  DesignTransitionDeclarations
> {
  readonly #values: readonly DesignTransitionDeclaration[];

  private constructor(values: readonly DesignTransitionDeclaration[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-design-transition-declarations");
  }

  protected rebuild(values: readonly DesignTransitionDeclaration[]): DesignTransitionDeclarations {
    return new DesignTransitionDeclarations(values);
  }

  static of(values: readonly DesignTransitionDeclaration[]): DesignTransitionDeclarations {
    return new DesignTransitionDeclarations(values);
  }

  static parse(values: readonly DesignTransitionDeclaration[]): Result<DesignTransitionDeclarations, ParseError> {
    return parseConstruction(() => new DesignTransitionDeclarations(values));
  }

  add(value: DesignTransitionDeclaration): DesignTransitionDeclarations {
    return new DesignTransitionDeclarations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<DesignTransitionDeclaration> {
    yield* this.#values;
  }

  toArray(): readonly DesignTransitionDeclaration[] {
    return this.#values;
  }
}
