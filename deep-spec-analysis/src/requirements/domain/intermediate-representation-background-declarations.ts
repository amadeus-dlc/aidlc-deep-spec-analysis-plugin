import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { IntermediateRepresentationAttributeCatalog } from "./intermediate-representation-attribute-catalog.ts";
import type { IntermediateRepresentationBackgroundDeclaration } from "./intermediate-representation-background-declaration.ts";

export class IntermediateRepresentationBackgroundDeclarations
  extends FirstClassCollectionBase<
    IntermediateRepresentationBackgroundDeclaration,
    IntermediateRepresentationBackgroundDeclarations
  >
  implements FirstClassCollection<IntermediateRepresentationBackgroundDeclaration>
{
  readonly #values: readonly IntermediateRepresentationBackgroundDeclaration[];

  private constructor(values: readonly IntermediateRepresentationBackgroundDeclaration[]) {
    super();
    this.#values = boundedCollectionSnapshot(
      values,
      65_536,
      "too-many-intermediate-representation-background-declarations",
    );
  }

  protected override rebuild(
    values: readonly IntermediateRepresentationBackgroundDeclaration[],
  ): IntermediateRepresentationBackgroundDeclarations {
    return new IntermediateRepresentationBackgroundDeclarations(values);
  }

  override map(
    transform: (
      element: IntermediateRepresentationBackgroundDeclaration,
    ) => IntermediateRepresentationBackgroundDeclaration,
  ): IntermediateRepresentationBackgroundDeclarations {
    return this.mapTo(transform, IntermediateRepresentationBackgroundDeclarations.of);
  }

  override combine(
    other: IntermediateRepresentationBackgroundDeclarations,
  ): IntermediateRepresentationBackgroundDeclarations {
    return this.combineTo(other, IntermediateRepresentationBackgroundDeclarations.of);
  }

  static parse(
    values: readonly IntermediateRepresentationBackgroundDeclaration[],
  ): Result<IntermediateRepresentationBackgroundDeclarations, ParseError> {
    return parseConstruction(() => new IntermediateRepresentationBackgroundDeclarations(values));
  }

  static of(
    values: readonly IntermediateRepresentationBackgroundDeclaration[],
  ): IntermediateRepresentationBackgroundDeclarations {
    return new IntermediateRepresentationBackgroundDeclarations(values);
  }

  add(value: IntermediateRepresentationBackgroundDeclaration): IntermediateRepresentationBackgroundDeclarations {
    return new IntermediateRepresentationBackgroundDeclarations([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<IntermediateRepresentationBackgroundDeclaration> {
    yield* this.#values;
  }

  // 宣言順に、既出 id との重複診断と各背景仮定自身の診断を並べる。id は宣言の
  // 種別をまたいで一意なので、既出 id の台帳は呼び手が持ち回る。
  // 境界: 診断の表現予算は呼び手の ErrorMessages.collect が守るので、
  // ここは文字列のまま返す。
  diagnosticStrings(catalog: IntermediateRepresentationAttributeCatalog | null, seenIds: Set<string>): string[] {
    const errors: string[] = [];
    for (const declaration of this.#values) {
      const id = declaration.id().asString();
      if (seenIds.has(id)) errors.push(`background ${id}: duplicate id "${id}"`);
      seenIds.add(id);
      if (catalog !== null) errors.push(...declaration.diagnosticStrings(catalog));
    }
    return errors;
  }

  toArray(): readonly IntermediateRepresentationBackgroundDeclaration[] {
    return this.#values;
  }
}
