import { type FirstClassCollection, FirstClassCollectionBase, type UnitName } from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";

// unit 名のファーストクラスコレクション（depends_on の並びなど宣言順を保持）。
export class UnitNames extends FirstClassCollectionBase<UnitName, UnitNames> implements FirstClassCollection<UnitName> {
  readonly #values: readonly UnitName[];

  private constructor(values: readonly UnitName[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-unit-names");
  }

  protected rebuild(values: readonly UnitName[]): UnitNames {
    return new UnitNames(values);
  }

  static parse(values: readonly UnitName[]): Result<UnitNames, ParseError> {
    return parseConstruction(() => new UnitNames(values));
  }

  static of(values: readonly UnitName[]): UnitNames {
    return new UnitNames(values);
  }

  add(value: UnitName): UnitNames {
    return new UnitNames([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<UnitName> {
    yield* this.#values;
  }

  declares(value: string): boolean {
    return this.#values.some((v) => v.asString() === value);
  }

  // CD-3 の走査順（辞書順）はコレクション知識。
  sortedByValue(): UnitNames {
    return new UnitNames([...this.#values].sort((a, b) => (a.asString() < b.asString() ? -1 : 1)));
  }

  toArray(): readonly UnitName[] {
    return this.#values;
  }
}
