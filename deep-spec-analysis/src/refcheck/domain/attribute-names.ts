import { type FirstClassCollection, FirstClassCollectionBase } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { AttributeName } from "./attribute-name.ts";

// ---- ファーストクラスコレクション（語彙） -----------------------------------
// ドメイン層は配列を生で扱わない。集合の知識（正規化照合・差分・所属）は
// コレクション自身が所有し、toArray() は境界（描画・アダプタ）専用の脱出口。

export class AttributeNames
  extends FirstClassCollectionBase<AttributeName, AttributeNames>
  implements FirstClassCollection<AttributeName>
{
  readonly #values: readonly AttributeName[];

  private constructor(values: readonly AttributeName[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-attribute-names");
  }

  protected override rebuild(values: readonly AttributeName[]): AttributeNames {
    return new AttributeNames(values);
  }

  override map(transform: (element: AttributeName) => AttributeName): AttributeNames {
    return this.mapTo(transform, AttributeNames.of);
  }

  override combine(other: AttributeNames): AttributeNames {
    return this.combineTo(other, AttributeNames.of);
  }

  static parse(values: readonly AttributeName[]): Result<AttributeNames, ParseError> {
    return parseConstruction(() => new AttributeNames(values));
  }

  static of(values: readonly AttributeName[]): AttributeNames {
    return new AttributeNames(values);
  }

  add(value: AttributeName): AttributeNames {
    return new AttributeNames([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<AttributeName> {
    yield* this.#values;
  }

  override count(): number {
    return this.#values.length;
  }

  // 正規化名での被覆判定（XS-3 の照合知識）。
  coversNormalized(name: AttributeName): boolean {
    return this.#values.some((v) => v.normalized().equals(name.normalized()));
  }

  // XS-3: other が覆っていない属性の名を値の昇順で（凍結順）。
  namesNotCoveredBy(other: AttributeNames): string[] {
    return this.#values
      .filter((name) => !other.coversNormalized(name))
      .map((name) => name.asString())
      .sort();
  }

  // 境界: 描画・アダプタ専用。
  toArray(): readonly AttributeName[] {
    return this.#values;
  }
}
