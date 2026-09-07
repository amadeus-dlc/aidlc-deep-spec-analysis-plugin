import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignIgnoreDeclaration } from "./design-ignore-declaration.ts";

export class DesignIgnoreDeclarations extends FirstClassCollectionBase<
  DesignIgnoreDeclaration,
  DesignIgnoreDeclarations
> {
  readonly #values: readonly DesignIgnoreDeclaration[];

  private constructor(values: readonly DesignIgnoreDeclaration[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-design-ignore-declarations");
  }

  protected override rebuild(values: readonly DesignIgnoreDeclaration[]): DesignIgnoreDeclarations {
    return new DesignIgnoreDeclarations(values);
  }

  static of(values: readonly DesignIgnoreDeclaration[]): DesignIgnoreDeclarations {
    return new DesignIgnoreDeclarations(values);
  }

  static parse(values: readonly DesignIgnoreDeclaration[]): Result<DesignIgnoreDeclarations, ParseError> {
    return parseConstruction(() => new DesignIgnoreDeclarations(values));
  }

  add(value: DesignIgnoreDeclaration): DesignIgnoreDeclarations {
    return new DesignIgnoreDeclarations([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<DesignIgnoreDeclaration> {
    yield* this.#values;
  }

  toArray(): readonly DesignIgnoreDeclaration[] {
    return this.#values;
  }
}
