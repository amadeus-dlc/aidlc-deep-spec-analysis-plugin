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

  override map(transform: (element: AttributePath) => AttributePath): AttributePaths {
    return this.mapTo(transform, AttributePaths.of);
  }

  override combine(other: AttributePaths): AttributePaths {
    return this.combineTo(other, AttributePaths.of);
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

  // 文字列としての辞書順。invariant／scenario の診断文言はこの順で凍結されている。
  sortedLexicographically(): AttributePaths {
    return AttributePaths.of(
      [...this.#values].sort((a, b) => (a.asString() < b.asString() ? -1 : a.asString() > b.asString() ? 1 : 0)),
    );
  }

  // 正準順（AttributePath.compareTo）。event の診断文言はこの順。
  sortedCanonically(): AttributePaths {
    return AttributePaths.of([...this.#values].sort((a, b) => a.compareTo(b)));
  }

  // 境界: 描画専用。パスを文字列にして区切り文字で連結する。
  joined(separator: string): string {
    return [...this.#values].map((path) => path.asString()).join(separator);
  }

  toArray(): readonly AttributePath[] {
    return [...this.#values];
  }
}
