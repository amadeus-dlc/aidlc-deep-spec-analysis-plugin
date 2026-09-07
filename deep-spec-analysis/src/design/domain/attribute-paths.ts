import { type AttributePath, FirstClassCollectionBase, KeySet } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
// 設計属性パス集合のファーストクラスコレクション（lowering・alpha 置換の照会面）。
export class AttributePaths extends FirstClassCollectionBase<AttributePath, AttributePaths> {
  readonly #values: KeySet<AttributePath>;

  private constructor(values: readonly AttributePath[]) {
    super();
    this.#values = KeySet.of(boundedCollectionSnapshot(values, 65_536, "too-many-attribute-paths"));
  }

  protected override rebuild(values: readonly AttributePath[]): AttributePaths {
    return new AttributePaths(values);
  }

  static of(values: readonly AttributePath[]): AttributePaths {
    return new AttributePaths(values);
  }

  static parse(values: readonly AttributePath[]): Result<AttributePaths, ParseError> {
    return parseConstruction(() => new AttributePaths(values));
  }

  add(value: AttributePath): AttributePaths {
    if (this.#values.has(value)) return this;
    return new AttributePaths([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<AttributePath> {
    yield* this.#values;
  }

  has(value: AttributePath): boolean {
    return this.#values.has(value);
  }

  toArray(): readonly AttributePath[] {
    return [...this.#values];
  }
}
