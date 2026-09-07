import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { IntermediateRepresentationAttributeCatalog } from "./intermediate-representation-attribute-catalog.ts";
import type { IntermediateRepresentationObligationDeclaration } from "./intermediate-representation-obligation-declaration.ts";

export class IntermediateRepresentationObligationDeclarations
  extends FirstClassCollectionBase<
    IntermediateRepresentationObligationDeclaration,
    IntermediateRepresentationObligationDeclarations
  >
  implements FirstClassCollection<IntermediateRepresentationObligationDeclaration>
{
  readonly #values: readonly IntermediateRepresentationObligationDeclaration[];

  private constructor(values: readonly IntermediateRepresentationObligationDeclaration[]) {
    super();
    this.#values = boundedCollectionSnapshot(
      values,
      65_536,
      "too-many-intermediate-representation-obligation-declarations",
    );
  }

  protected override rebuild(
    values: readonly IntermediateRepresentationObligationDeclaration[],
  ): IntermediateRepresentationObligationDeclarations {
    return new IntermediateRepresentationObligationDeclarations(values);
  }

  override map(
    transform: (
      element: IntermediateRepresentationObligationDeclaration,
    ) => IntermediateRepresentationObligationDeclaration,
  ): IntermediateRepresentationObligationDeclarations {
    return this.mapTo(transform, IntermediateRepresentationObligationDeclarations.of);
  }

  override combine(
    other: IntermediateRepresentationObligationDeclarations,
  ): IntermediateRepresentationObligationDeclarations {
    return this.combineTo(other, IntermediateRepresentationObligationDeclarations.of);
  }

  static parse(
    values: readonly IntermediateRepresentationObligationDeclaration[],
  ): Result<IntermediateRepresentationObligationDeclarations, ParseError> {
    return parseConstruction(() => new IntermediateRepresentationObligationDeclarations(values));
  }

  static of(
    values: readonly IntermediateRepresentationObligationDeclaration[],
  ): IntermediateRepresentationObligationDeclarations {
    return new IntermediateRepresentationObligationDeclarations(values);
  }

  add(value: IntermediateRepresentationObligationDeclaration): IntermediateRepresentationObligationDeclarations {
    return new IntermediateRepresentationObligationDeclarations([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<IntermediateRepresentationObligationDeclaration> {
    yield* this.#values;
  }

  // 宣言順に、既出 id との重複診断と各義務自身の診断を並べる。id は宣言の
  // 種別をまたいで一意なので、既出 id の台帳は呼び手が持ち回る。
  // 境界: 診断の表現予算は呼び手の ErrorMessages.collect が守るので、
  // ここは文字列のまま返す。
  diagnosticStrings(catalog: IntermediateRepresentationAttributeCatalog | null, seenIds: Set<string>): string[] {
    const errors: string[] = [];
    for (const declaration of this.#values) {
      const id = declaration.id().asString();
      if (seenIds.has(id)) errors.push(`obligation ${id}: duplicate id "${id}"`);
      seenIds.add(id);
      if (catalog !== null) errors.push(...declaration.diagnosticStrings(catalog));
    }
    return errors;
  }

  toArray(): readonly IntermediateRepresentationObligationDeclaration[] {
    return this.#values;
  }
}
