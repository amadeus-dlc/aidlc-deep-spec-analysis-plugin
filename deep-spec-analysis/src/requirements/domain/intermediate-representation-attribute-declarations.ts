import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { IntermediateRepresentationAttributeDeclaration } from "./intermediate-representation-attribute-declaration.ts";

export class IntermediateRepresentationAttributeDeclarations
  extends FirstClassCollectionBase<
    IntermediateRepresentationAttributeDeclaration,
    IntermediateRepresentationAttributeDeclarations
  >
  implements FirstClassCollection<IntermediateRepresentationAttributeDeclaration>
{
  readonly #values: readonly IntermediateRepresentationAttributeDeclaration[];

  private constructor(values: readonly IntermediateRepresentationAttributeDeclaration[]) {
    super();
    this.#values = boundedCollectionSnapshot(
      values,
      65_536,
      "too-many-intermediate-representation-attribute-declarations",
    );
  }

  protected override rebuild(
    values: readonly IntermediateRepresentationAttributeDeclaration[],
  ): IntermediateRepresentationAttributeDeclarations {
    return new IntermediateRepresentationAttributeDeclarations(values);
  }

  override map(
    transform: (
      element: IntermediateRepresentationAttributeDeclaration,
    ) => IntermediateRepresentationAttributeDeclaration,
  ): IntermediateRepresentationAttributeDeclarations {
    return this.mapTo(transform, IntermediateRepresentationAttributeDeclarations.of);
  }

  override combine(
    other: IntermediateRepresentationAttributeDeclarations,
  ): IntermediateRepresentationAttributeDeclarations {
    return this.combineTo(other, IntermediateRepresentationAttributeDeclarations.of);
  }

  static parse(
    values: readonly IntermediateRepresentationAttributeDeclaration[],
  ): Result<IntermediateRepresentationAttributeDeclarations, ParseError> {
    return parseConstruction(() => new IntermediateRepresentationAttributeDeclarations(values));
  }

  static of(
    values: readonly IntermediateRepresentationAttributeDeclaration[],
  ): IntermediateRepresentationAttributeDeclarations {
    return new IntermediateRepresentationAttributeDeclarations(values);
  }

  add(value: IntermediateRepresentationAttributeDeclaration): IntermediateRepresentationAttributeDeclarations {
    return new IntermediateRepresentationAttributeDeclarations([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<IntermediateRepresentationAttributeDeclaration> {
    yield* this.#values;
  }

  // 属性を宣言順に訪ね、「既に同名を見たか」を渡す（重複は 2 回目以降の
  // 出現に立つ——凍結順）。同名の判定は宣言列そのものの知識。
  inspectInDeclarationOrder(
    visitor: (attribute: IntermediateRepresentationAttributeDeclaration, duplicated: boolean) => void,
  ): void {
    const seen = new Set<string>();
    for (const attribute of this.#values) {
      const name = attribute.name().asString();
      visitor(attribute, seen.has(name));
      seen.add(name);
    }
  }

  toArray(): readonly IntermediateRepresentationAttributeDeclaration[] {
    return this.#values;
  }
}
