import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignMachineDeclaration } from "./design-machine-declaration.ts";

export class DesignMachineDeclarations extends FirstClassCollectionBase<
  DesignMachineDeclaration,
  DesignMachineDeclarations
> {
  readonly #values: readonly DesignMachineDeclaration[];

  private constructor(values: readonly DesignMachineDeclaration[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-design-machine-declarations");
  }

  protected override rebuild(values: readonly DesignMachineDeclaration[]): DesignMachineDeclarations {
    return new DesignMachineDeclarations(values);
  }

  static of(values: readonly DesignMachineDeclaration[]): DesignMachineDeclarations {
    return new DesignMachineDeclarations(values);
  }

  static parse(values: readonly DesignMachineDeclaration[]): Result<DesignMachineDeclarations, ParseError> {
    return parseConstruction(() => new DesignMachineDeclarations(values));
  }

  add(value: DesignMachineDeclaration): DesignMachineDeclarations {
    return new DesignMachineDeclarations([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<DesignMachineDeclaration> {
    yield* this.#values;
  }

  toArray(): readonly DesignMachineDeclaration[] {
    return this.#values;
  }
}
