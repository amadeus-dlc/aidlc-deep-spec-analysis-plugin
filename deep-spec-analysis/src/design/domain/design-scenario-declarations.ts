import { FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignScenarioDeclaration } from "./design-scenario-declaration.ts";

export class DesignScenarioDeclarations extends FirstClassCollectionBase<
  DesignScenarioDeclaration,
  DesignScenarioDeclarations
> {
  readonly #values: readonly DesignScenarioDeclaration[];

  private constructor(values: readonly DesignScenarioDeclaration[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-design-scenario-declarations");
  }

  protected override rebuild(values: readonly DesignScenarioDeclaration[]): DesignScenarioDeclarations {
    return new DesignScenarioDeclarations(values);
  }

  static of(values: readonly DesignScenarioDeclaration[]): DesignScenarioDeclarations {
    return new DesignScenarioDeclarations(values);
  }

  override map(
    transform: (element: DesignScenarioDeclaration) => DesignScenarioDeclaration,
  ): DesignScenarioDeclarations {
    return this.mapTo(transform, DesignScenarioDeclarations.of);
  }

  override combine(other: DesignScenarioDeclarations): DesignScenarioDeclarations {
    return this.combineTo(other, DesignScenarioDeclarations.of);
  }

  static parse(values: readonly DesignScenarioDeclaration[]): Result<DesignScenarioDeclarations, ParseError> {
    return parseConstruction(() => new DesignScenarioDeclarations(values));
  }

  add(value: DesignScenarioDeclaration): DesignScenarioDeclarations {
    return new DesignScenarioDeclarations([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<DesignScenarioDeclaration> {
    yield* this.#values;
  }

  toArray(): readonly DesignScenarioDeclaration[] {
    return this.#values;
  }
}
