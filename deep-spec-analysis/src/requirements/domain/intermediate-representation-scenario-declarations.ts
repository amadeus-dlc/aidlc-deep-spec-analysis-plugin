import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { IntermediateRepresentationAttributeCatalog } from "./intermediate-representation-attribute-catalog.ts";
import type { IntermediateRepresentationScenarioDeclaration } from "./intermediate-representation-scenario-declaration.ts";

export class IntermediateRepresentationScenarioDeclarations
  extends FirstClassCollectionBase<
    IntermediateRepresentationScenarioDeclaration,
    IntermediateRepresentationScenarioDeclarations
  >
  implements FirstClassCollection<IntermediateRepresentationScenarioDeclaration>
{
  readonly #values: readonly IntermediateRepresentationScenarioDeclaration[];

  private constructor(values: readonly IntermediateRepresentationScenarioDeclaration[]) {
    super();
    this.#values = boundedCollectionSnapshot(
      values,
      65_536,
      "too-many-intermediate-representation-scenario-declarations",
    );
  }

  protected override rebuild(
    values: readonly IntermediateRepresentationScenarioDeclaration[],
  ): IntermediateRepresentationScenarioDeclarations {
    return new IntermediateRepresentationScenarioDeclarations(values);
  }

  static of(
    values: readonly IntermediateRepresentationScenarioDeclaration[],
  ): IntermediateRepresentationScenarioDeclarations {
    return new IntermediateRepresentationScenarioDeclarations(values);
  }

  override map(
    transform: (
      element: IntermediateRepresentationScenarioDeclaration,
    ) => IntermediateRepresentationScenarioDeclaration,
  ): IntermediateRepresentationScenarioDeclarations {
    return this.mapTo(transform, IntermediateRepresentationScenarioDeclarations.of);
  }

  override combine(
    other: IntermediateRepresentationScenarioDeclarations,
  ): IntermediateRepresentationScenarioDeclarations {
    return this.combineTo(other, IntermediateRepresentationScenarioDeclarations.of);
  }

  static parse(
    values: readonly IntermediateRepresentationScenarioDeclaration[],
  ): Result<IntermediateRepresentationScenarioDeclarations, ParseError> {
    return parseConstruction(() => new IntermediateRepresentationScenarioDeclarations(values));
  }

  add(value: IntermediateRepresentationScenarioDeclaration): IntermediateRepresentationScenarioDeclarations {
    return new IntermediateRepresentationScenarioDeclarations([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<IntermediateRepresentationScenarioDeclaration> {
    yield* this.#values;
  }

  // 宣言順に、既出 id との重複診断と各シナリオ自身の診断を並べる。id は宣言の
  // 種別をまたいで一意なので、既出 id の台帳は呼び手が持ち回る。
  // 境界: 診断の表現予算は呼び手の ErrorMessages.collect が守るので、
  // ここは文字列のまま返す。
  diagnosticStrings(catalog: IntermediateRepresentationAttributeCatalog | null, seenIds: Set<string>): string[] {
    const errors: string[] = [];
    for (const declaration of this.#values) {
      const id = declaration.id().asString();
      if (seenIds.has(id)) errors.push(`scenario ${id}: duplicate id "${id}"`);
      seenIds.add(id);
      if (catalog !== null) errors.push(...declaration.diagnosticStrings(catalog));
    }
    return errors;
  }

  toArray(): readonly IntermediateRepresentationScenarioDeclaration[] {
    return this.#values;
  }
}
